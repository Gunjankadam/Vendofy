import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import Header from '@/components/Header';
import abstractImage from '@/assets/abstract-login.jpg';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Send, Calendar, ChevronRight, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

const DistributorOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ordersByDate, setOrdersByDate] = useState<Record<string, Order[]>>({});
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [sendingToAdmin, setSendingToAdmin] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [selectedOrderForDate, setSelectedOrderForDate] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string>('');
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    if (!user?.token) return;
    loadOrders();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [user?.token]);

  const loadOrders = async () => {
    if (!user?.token) return;
    try {
      const { cachedFetch } = await import('@/lib/cached-fetch');
      // Skip cache for polling requests to get fresh data
      const data = await cachedFetch<any>('/api/distributor/orders', user.token, { skipCache: true });

      // Only update if orders actually changed
      const ordersChanged = JSON.stringify(prevOrdersRef.current) !== JSON.stringify(data.allOrders);
      if (ordersChanged) {
        setOrdersByDate(data.ordersByDate);
        setAllOrders(data.allOrders);
        prevOrdersRef.current = data.allOrders;
      }
    } catch (error: any) {
      console.error('Load orders error:', error);
      if (loading) {
        toast({
          title: 'Failed to load orders',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToTransit = async (orderIds: string[]) => {
    if (!user?.token) return;
    try {
      const res = await fetch(getApiUrl('/api/distributor/orders/mark-for-today'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ orderIds }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to add orders to transit');
      }

      toast({
        title: 'Orders added to transit',
        description: `${orderIds.length} order(s) added to transit.`,
        variant: 'success',
      });

      await loadOrders();
      setSelectedOrders(new Set());
    } catch (error: any) {
      console.error('Add to transit error:', error);
      toast({
        title: 'Failed to add orders to transit',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSendToAdmin = async () => {
    if (!user?.token || selectedOrders.size === 0) return;
    try {
      setSendingToAdmin(true);
      const res = await fetch(getApiUrl('/api/distributor/orders/send-to-admin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send orders');
      }

      const data = await res.json();
      toast({
        title: 'Orders sent to admin',
        description: `${data.ordersCount} order(s) sent successfully.`,
        variant: 'success',
      });

      setShowSendDialog(false);
      setSelectedOrders(new Set());
      await loadOrders();
    } catch (error: any) {
      console.error('Send to admin error:', error);
      toast({
        title: 'Failed to send orders',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingToAdmin(false);
    }
  };

  const handleCustomDate = (orderId: string) => {
    setSelectedOrderForDate(orderId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCustomDate(tomorrow.toISOString().split('T')[0]);
    setShowDateDialog(true);
  };

  const handleUpdateDeliveryDate = async () => {
    if (!user?.token || !selectedOrderForDate || !customDate) return;
    try {
      const res = await fetch(getApiUrl(`/api/distributor/orders/${selectedOrderForDate}/update-delivery-date`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ deliveryDate: customDate }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update delivery date');
      }

      toast({
        title: 'Delivery date updated',
        description: 'Customer has been notified of possible transit date.',
        variant: 'success',
      });

      setShowDateDialog(false);
      setSelectedOrderForDate(null);
      setCustomDate('');
      await loadOrders();
    } catch (error: any) {
      console.error('Update delivery date error:', error);
      toast({
        title: 'Failed to update delivery date',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };



  const sortedDates = Object.keys(ordersByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = ordersByDate[today] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative">
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <img
            src={abstractImage}
            alt=""
            className="absolute inset-0 w-full h-full opacity-[0.30] object-cover"
            loading="lazy"
            fetchPriority="low"
          />
          <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-3xl" />
        </div>
        <Header />
        <main className="container mx-auto px-6 pt-28 pb-12 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src={abstractImage}
          alt=""
          className="absolute inset-0 w-full h-full opacity-[0.30] object-cover"
          loading="lazy"
          fetchPriority="low"
        />
        <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-3xl" />
      </div>
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
          <h1 className="font-sans text-2xl md:text-4xl font-bold mb-1 md:mb-2 tracking-tight">Order Management</h1>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base">Manage and fulfill customer orders</p>
        </div>

        {/* Today's Orders Section */}
        {todayOrders.length > 0 && (
          <Card className="mb-6 border-white/40 dark:border-white/20 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-bold">
                    <Calendar className="h-5 w-5" />
                    Today's Orders ({todayOrders.length})
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">Orders scheduled for delivery today</CardDescription>
                </div>
                {selectedOrders.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleAddToTransit(Array.from(selectedOrders))}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Add Selected to Transit
                    </Button>
                    <Button
                      onClick={() => setShowSendDialog(true)}
                      disabled={sendingToAdmin}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send to Admin ({selectedOrders.size})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayOrders.map((order) => (
                  <div
                    key={order._id}
                    className="p-4 border border-black/10 dark:border-white/10 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-3 md:gap-4 flex-1">
                        <Checkbox
                          checked={selectedOrders.has(order._id)}
                          onCheckedChange={() => toggleOrderSelection(order._id)}
                          disabled={order.sentToAdmin}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-bold text-sm md:text-base break-all">Order #{order.orderNumber}</h3>
                            <Badge variant={order.markedForToday ? "default" : "outline"}>
                              {order.markedForToday ? "In Transit" : "Pending"}
                            </Badge>
                            {order.sentToAdmin && (
                              <Badge variant="secondary">Sent to Admin</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
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
                      <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto justify-end md:justify-start flex-wrap">
                        {!order.markedForToday && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddToTransit([order._id])}
                          >
                            <Truck className="mr-2 h-4 w-4" />
                            Add to Transit
                          </Button>
                        )}
                        {order.markedForToday && !order.sentToAdmin && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedOrders(new Set([order._id]));
                              setShowSendDialog(true);
                            }}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Send to Admin
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCustomDate(order._id)}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Modify Date
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Orders by Date */}
        <div className="space-y-6">
          {sortedDates.filter(date => date !== today).map((date) => {
            const orders = ordersByDate[date] || [];
            const dateObj = new Date(date);
            const isPast = dateObj < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <Card key={date} className={`${isPast ? "opacity-60" : ""} bg-white/95 dark:bg-black/95 backdrop-blur-xl border-white/20 shadow-xl`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-bold text-lg">
                    <Calendar className="h-5 w-5" />
                    {dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {isPast && <Badge variant="destructive" className="ml-2">Past Due</Badge>}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">{orders.length} order(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order._id}
                        className="p-4 border border-black/10 dark:border-white/10 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex items-start gap-3 md:gap-4 flex-1">
                            <Checkbox
                              checked={selectedOrders.has(order._id)}
                              onCheckedChange={() => toggleOrderSelection(order._id)}
                              disabled={order.sentToAdmin}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="font-bold text-sm md:text-base break-all">Order #{order.orderNumber}</h3>
                                {order.markedForToday && (
                                  <Badge variant="default">In Transit</Badge>
                                )}
                                {order.sentToAdmin && (
                                  <Badge variant="secondary">Sent to Admin</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
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
                          <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto justify-end md:justify-start flex-wrap">
                            {!order.markedForToday && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddToTransit([order._id])}
                              >
                                <Truck className="mr-2 h-4 w-4" />
                                Add to Transit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCustomDate(order._id)}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              Modify Date
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {sortedDates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No orders found.</p>
          </div>
        )}

        <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Orders to Admin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to send {selectedOrders.size} order(s) to the admin? This will notify them of the required items.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSendToAdmin} disabled={sendingToAdmin}>
                {sendingToAdmin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send to Admin'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modify Delivery Date</DialogTitle>
              <DialogDescription>
                Set a custom delivery date. The customer will be notified of the possible transit date.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="deliveryDate">Delivery Date</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDeliveryDate} disabled={!customDate}>
                Update Date
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DistributorOrders;

