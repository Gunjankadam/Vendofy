import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Truck, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Order {
  _id: string;
  orderNumber: string;
  customerId: { name: string; email: string };
  items: Array<{
    productId: { name: string; imageUrl?: string };
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  desiredDeliveryDate: string;
  currentDeliveryDate: string;
  markedForToday: boolean;
  sentToAdmin: boolean;
  status: string;
  receivedAt?: string;
}

const DistributorTransit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transitOrders, setTransitOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [markingReceived, setMarkingReceived] = useState(false);
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    if (!user?.token) return;
    loadTransitOrders();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadTransitOrders, 5000);
    return () => clearInterval(interval);
  }, [user?.token]);

  const loadTransitOrders = async () => {
    if (!user?.token) return;
    try {
      const { cachedFetch } = await import('@/lib/cached-fetch');
      // Skip cache for polling requests to get fresh data
      const data = await cachedFetch<any>('/api/distributor/orders', user.token, { skipCache: true });

      // Show all orders that are marked for today (including received ones)
      const transit = (data.allOrders || []).filter((order: Order) =>
        order.markedForToday
      );

      // Only update if orders actually changed
      const ordersChanged = JSON.stringify(prevOrdersRef.current) !== JSON.stringify(transit);
      if (ordersChanged) {
        setTransitOrders(transit);
        prevOrdersRef.current = transit;
      }
    } catch (error: any) {
      console.error('Load transit orders error:', error);
      if (loading) {
        toast({
          title: 'Failed to load transit orders',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReceived = async (orderIds: string[]) => {
    if (!user?.token) return;

    setMarkingReceived(true);
    try {
      if (orderIds.length === 1) {
        const res = await fetch(getApiUrl(`/api/distributor/orders/${orderIds[0]}/mark-received`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to mark order as received');
      } else {
        const res = await fetch(getApiUrl('/api/distributor/orders/mark-received-bulk'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ orderIds }),
        });
        if (!res.ok) throw new Error('Failed to mark orders as received');
      }

      toast({
        title: 'Success',
        description: `${orderIds.length} order(s) marked as received.`,
        variant: 'success',
      });

      setSelectedOrders(new Set());
      await loadTransitOrders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark orders as received.',
        variant: 'destructive',
      });
    } finally {
      setMarkingReceived(false);
    }
  };

  const handleSelectAll = () => {
    // Only select orders that haven't been received yet
    const unreceivedOrders = transitOrders.filter(o => !o.receivedAt);
    const unreceivedOrderIds = unreceivedOrders.map(o => o._id);

    if (unreceivedOrderIds.every(id => selectedOrders.has(id)) && unreceivedOrderIds.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(unreceivedOrderIds));
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const selectedTransitOrders = transitOrders.filter(order =>
    selectedOrders.has(order._id) && !order.receivedAt
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent relative">
        <Header />
        <main className="container mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading transit orders...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent relative">
      <Header />
      <main className="container mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 relative z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="mb-6 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="mb-4 md:mb-6">
          <h1 className="font-sans text-2xl md:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-2 tracking-tight">
            <Truck className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
            Transit Box
          </h1>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base">Orders in transit - mark as received when items arrive</p>
        </div>

        {transitOrders.length === 0 ? (
          <Card className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
            <CardContent className="py-12 text-center">
              <Truck className="h-12 w-12 mx-auto mb-4 text-gray-600 dark:text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No orders in transit.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={transitOrders.length > 0 && transitOrders.every(order => selectedOrders.has(order._id))}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {selectedTransitOrders.length > 0 ? `${selectedTransitOrders.length} selected` : 'Select all'}
                </span>
              </div>
              {selectedTransitOrders.length > 0 && (
                <Button
                  onClick={() => handleMarkReceived(Array.from(selectedTransitOrders.map(o => o._id)))}
                  disabled={markingReceived}
                  size="sm"
                >
                  {markingReceived ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark as Received ({selectedTransitOrders.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {transitOrders.map((order) => {
                const isSelected = selectedOrders.has(order._id);
                return (
                  <Card key={order._id} className={`hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-white/20 shadow-xl group ${isSelected ? 'border-primary' : ''}`}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOrderSelection(order._id)}
                            disabled={!!order.receivedAt}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-bold text-sm md:text-base break-all">Order #{order.orderNumber}</h3>
                              {order.receivedAt ? (
                                <Badge variant="default" className="bg-green-600">Stocked</Badge>
                              ) : (
                                <Badge variant="default">In Transit</Badge>
                              )}
                              {order.sentToAdmin && (
                                <Badge variant="secondary">Sent to Admin</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">
                              Customer: {order.customerId.name} ({order.customerId.email})
                            </p>
                            <div className="space-y-1 mb-2">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  {item.productId.name} × {item.quantity} = ₹{(item.price * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </div>
                              ))}
                            </div>
                            <p className="font-medium">
                              Total: ₹{order.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        {!order.receivedAt && (
                          <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto justify-end md:justify-start">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkReceived([order._id])}
                              disabled={markingReceived}
                              className="w-full md:w-auto"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark Received
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default DistributorTransit;

