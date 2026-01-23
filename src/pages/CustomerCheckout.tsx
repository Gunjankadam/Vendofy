import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import abstractImage from '@/assets/abstract-login.jpg';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const CustomerCheckout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get cart from localStorage or navigate back if empty
    const savedCart = localStorage.getItem('customerCart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    } else {
      navigate('/customer/products');
    }

    // Set minimum date to today
    const today = new Date();
    today.setDate(today.getDate() + 1); // Minimum tomorrow
    const minDate = today.toISOString().split('T')[0];
    setDesiredDeliveryDate(minDate);
  }, [navigate]);

  const updateQuantity = (productId: string, delta: number) => {
    const updatedCart = cart.map((item) => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + delta;
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    });
    setCart(updatedCart);
    localStorage.setItem('customerCart', JSON.stringify(updatedCart));
  };

  const removeFromCart = (productId: string) => {
    const updatedCart = cart.filter((item) => item.productId !== productId);
    setCart(updatedCart);
    localStorage.setItem('customerCart', JSON.stringify(updatedCart));
  };

  const handlePlaceOrder = async () => {
    if (!user?.token) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to place an order.',
        variant: 'destructive',
      });
      return;
    }

    if (!desiredDeliveryDate) {
      toast({
        title: 'Delivery date required',
        description: 'Please select a desired delivery date.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/customer/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          desiredDeliveryDate,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to place order');
      }

      const order = await res.json();
      
      // Clear cart
      localStorage.removeItem('customerCart');
      setCart([]);

      toast({
        title: 'Order placed successfully',
        description: `Order #${order.orderNumber} has been placed.`,
        variant: 'success',
      });

      navigate('/customer/orders');
    } catch (error: any) {
      console.error('Place order error:', error);
      toast({
        title: 'Failed to place order',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0) {
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
          <div className="absolute inset-0 bg-background/30" />
        </div>
        <Header />
        <main className="container mx-auto px-6 pt-28 pb-12 relative z-10">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Button onClick={() => navigate('/customer/products')}>
              Browse Products
            </Button>
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
        <div className="absolute inset-0 bg-background/30" />
      </div>
      <Header />
      <main className="container mx-auto px-6 pt-28 pb-12 max-w-4xl relative z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/customer/products')}
          className="mb-6 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{item.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} each
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          +
                        </Button>
                      </div>
                      <p className="font-medium w-24 text-right">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="deliveryDate" className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    Desired Delivery Date
                  </Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={desiredDeliveryDate}
                    onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      ₹{cartTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>₹{cartTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handlePlaceOrder}
                  disabled={loading || !desiredDeliveryDate}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    'Place Order'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerCheckout;

