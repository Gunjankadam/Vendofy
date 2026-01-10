import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Package, Calendar, CheckCircle, Truck, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface OrderItem {
  productId: {
    _id: string;
    name: string;
    imageUrl?: string;
  };
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  desiredDeliveryDate: string;
  currentDeliveryDate: string;
  createdAt: string;
  markedForToday?: boolean;
  receivedAt?: string;
  amountPaid?: number;
  paymentStatus?: string;
}

const CustomerOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [updatingPayment, setUpdatingPayment] = useState(false);

  useEffect(() => {
    if (!user?.token) return;
    loadOrders();
  }, [user?.token]);

  const loadOrders = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/customer/orders'), {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data);
    } catch (error: any) {
      console.error('Load orders error:', error);
      toast({
        title: 'Failed to load orders',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pending', variant: 'secondary' },
      processing: { label: 'Processing', variant: 'default' },
      shipped: { label: 'Shipped', variant: 'default' },
      delivered: { label: 'Delivered', variant: 'default' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleMarkReceived = async (orderId: string) => {
    if (!user?.token) return;
    try {
      const res = await fetch(getApiUrl(`/api/customer/orders/${orderId}/receive`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to mark order as received');
      }

      toast({
        title: 'Order marked as received',
        description: 'Please update the payment amount.',
        variant: 'success',
      });

      await loadOrders();
      
      // Open payment dialog
      const updatedOrder = await res.json();
      setSelectedOrder(updatedOrder);
      setPaymentAmount(updatedOrder.amountPaid?.toString() || '');
      setShowPaymentDialog(true);
    } catch (error: any) {
      console.error('Mark received error:', error);
      toast({
        title: 'Failed to mark order as received',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePayment = async () => {
    if (!user?.token || !selectedOrder) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid payment amount.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingPayment(true);
      const res = await fetch(getApiUrl(`/api/customer/orders/${selectedOrder._id}/payment`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ amountPaid: amount }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update payment');
      }

      toast({
        title: 'Payment updated',
        description: `Payment amount of ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} has been recorded.`,
        variant: 'success',
      });

      setShowPaymentDialog(false);
      setSelectedOrder(null);
      setPaymentAmount('');
      await loadOrders();
    } catch (error: any) {
      console.error('Update payment error:', error);
      toast({
        title: 'Failed to update payment',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-serif text-3xl font-medium">Order History</h1>
            <p className="text-muted-foreground">View all your past and current orders</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No orders found.</p>
              <Button onClick={() => navigate('/customer/products')}>
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle>
                      <CardDescription className="mt-1">
                        Placed on {formatDate(order.createdAt)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {item.productId.imageUrl && (
                            <img
                              src={item.productId.imageUrl}
                              alt={item.productId.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.productId.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Quantity: {item.quantity} × ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Desired Delivery: {formatDate(order.desiredDeliveryDate)}</span>
                        </div>
                        {(order.currentDeliveryDate && order.currentDeliveryDate !== order.desiredDeliveryDate) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-4 w-4" />
                            <span>Arrival Date: {formatDate(order.currentDeliveryDate)}</span>
                          </div>
                        )}
                        {order.receivedAt && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-4 w-4" />
                            <span>Received: {formatDate(order.receivedAt)}</span>
                          </div>
                        )}
                      </div>
                      {order.markedForToday && !order.receivedAt && (
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-primary" />
                          <Badge variant="default">In Transit</Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-right flex-1">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-2xl font-serif font-semibold">
                          ₹{order.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                        {order.amountPaid !== undefined && order.amountPaid !== null && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground">Amount Paid</p>
                            <p className="text-lg font-semibold text-primary">
                              ₹{order.amountPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                            {order.amountPaid < order.totalAmount && (
                              <p className="text-xs text-muted-foreground">
                                Remaining: ₹{(order.totalAmount - order.amountPaid).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!order.receivedAt && order.markedForToday && (
                      <Button
                        onClick={() => handleMarkReceived(order._id)}
                        className="w-full"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark as Received
                      </Button>
                    )}
                    {order.receivedAt && (
                      <div className="space-y-2">
                        <Badge variant="default" className="w-full justify-center py-2">
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Received on {formatDate(order.receivedAt)}
                        </Badge>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setPaymentAmount(order.amountPaid?.toString() || '');
                            setShowPaymentDialog(true);
                          }}
                          className="w-full"
                        >
                          {order.amountPaid ? 'Update Payment' : 'Enter Payment Amount'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Payment Amount</DialogTitle>
              <DialogDescription>
                Enter the amount you paid for this order. This will update the revenue calculation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedOrder && (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Total:</p>
                    <p className="text-lg font-semibold">
                      ₹{selectedOrder.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="paymentAmount">Amount Paid (₹)</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedOrder.totalAmount}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Enter payment amount"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter 0 if not paid yet, or partial amount if partially paid.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePayment} disabled={updatingPayment || !paymentAmount}>
                {updatingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Payment'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default CustomerOrders;

