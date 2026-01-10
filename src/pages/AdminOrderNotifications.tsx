import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Bell, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface OrderNotification {
  _id: string;
  orderNumber: string;
  customerId: { name: string; email: string };
  distributorId: { name: string; email: string };
  items: Array<{
    productId: { name: string; imageUrl?: string };
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  desiredDeliveryDate: string;
  currentDeliveryDate: string;
  sentToAdminAt: string;
  status: string;
}

const AdminOrderNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const prevNotificationsRef = useRef<OrderNotification[]>([]);

  useEffect(() => {
    if (!user?.token) return;
    loadNotifications();
    // Poll for updates every 3 seconds
    const interval = setInterval(loadNotifications, 3000);
    return () => clearInterval(interval);
  }, [user?.token]);

  const loadNotifications = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(getApiUrl('/api/admin/order-notifications'), {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      
      // Only update if notifications actually changed
      const notificationsChanged = JSON.stringify(prevNotificationsRef.current) !== JSON.stringify(data);
      if (notificationsChanged) {
        setNotifications(data);
        prevNotificationsRef.current = data;
        
        // Show toast for new notifications
        if (data.length > prevNotificationsRef.current.length && prevNotificationsRef.current.length > 0) {
          const newCount = data.length - prevNotificationsRef.current.length;
          toast({
            title: 'New Order Notifications',
            description: `${newCount} new order(s) received from distributors.`,
            variant: 'success',
          });
        }
      }
    } catch (error: any) {
      console.error('Load notifications error:', error);
      if (loading) {
        toast({
          title: 'Failed to load notifications',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Aggregate items by product across all notifications
  const getItemsSummary = () => {
    const itemsByProduct = new Map<string, { productName: string; totalQuantity: number; distributors: Set<string> }>();

    notifications.forEach((notification) => {
      notification.items.forEach((item) => {
        const productId = item.productId.name;
        const existing = itemsByProduct.get(productId);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.distributors.add(notification.distributorId.name);
        } else {
          itemsByProduct.set(productId, {
            productName: item.productId.name,
            totalQuantity: item.quantity,
            distributors: new Set([notification.distributorId.name]),
          });
        }
      });
    });

    return Array.from(itemsByProduct.values());
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 pt-28 pb-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const itemsSummary = getItemsSummary();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 pt-28 pb-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="mb-6 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="mb-6">
          <h1 className="font-serif text-3xl font-medium mb-2 flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Order Notifications
          </h1>
          <p className="text-muted-foreground">
            {notifications.length} notification(s) from distributors
          </p>
        </div>

        {/* Items Summary */}
        {itemsSummary.length > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Items Summary</span>
                </div>
                <Badge variant="default" className="text-base px-3 py-1.5">
                  {itemsSummary.reduce((sum, item) => sum + item.totalQuantity, 0)} units
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Notifications */}
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No order notifications yet.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const totalUnits = notification.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <Card key={notification._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle>Order #{notification.orderNumber}</CardTitle>
                      <Badge variant="default" className="text-lg px-4 py-2">
                        {totalUnits} units
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminOrderNotifications;

