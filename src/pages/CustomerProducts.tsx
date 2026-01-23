import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import abstractImage from '@/assets/abstract-login.jpg';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Minus, Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  hasCustomPrice: boolean;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const CustomerProducts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!user?.token) return;
    loadProducts();
  }, [user?.token]);

  const loadProducts = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const { cachedFetch } = await import('@/lib/cached-fetch');
      const data = await cachedFetch<Product[]>('/api/customer/products', user.token);
      setProducts(data);
    } catch (error: any) {
      console.error('Load products error:', error);
      toast({
        title: 'Failed to load products',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product._id);
    let updatedCart: CartItem[];
    if (existingItem) {
      updatedCart = cart.map((item) =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [...cart, {
        productId: product._id,
        productName: product.name,
        quantity: 1,
        price: product.price,
      }];
    }
    setCart(updatedCart);
    localStorage.setItem('customerCart', JSON.stringify(updatedCart));
    toast({
      title: 'Added to cart',
      description: `${product.name} added to cart`,
      variant: 'success',
    });
  };

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

  const setQuantity = (productId: string, quantity: number) => {
    const numQuantity = parseInt(quantity.toString()) || 1;
    const finalQuantity = Math.max(1, numQuantity);
    const updatedCart = cart.map((item) => {
      if (item.productId === productId) {
        return { ...item, quantity: finalQuantity };
      }
      return item;
    });
    setCart(updatedCart);
    localStorage.setItem('customerCart', JSON.stringify(updatedCart));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-serif text-3xl font-medium">Browse Products</h1>
          </div>
          <Button
            onClick={() => navigate('/customer/checkout')}
            disabled={cart.length === 0}
            className="relative"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart ({cartItemCount})
            {cart.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-primary-foreground text-primary text-xs rounded-full">
                ₹{cartTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading products...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No products available.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const cartItem = cart.find((item) => item.productId === product._id);
              return (
                <Card key={product._id} className="hover:shadow-md transition-shadow">
                  {product.imageUrl && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    {product.description && (
                      <CardDescription className="line-clamp-2">
                        {product.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-serif font-medium">
                          ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                        {product.hasCustomPrice && (
                          <p className="text-xs text-muted-foreground">Custom price</p>
                        )}
                      </div>
                    </div>
                    {cartItem ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 border rounded-md">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product._id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={cartItem.quantity}
                            onChange={(e) => setQuantity(product._id, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              setQuantity(product._id, value);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(product._id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFromCart(product._id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => addToCart(product)}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Cart
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerProducts;

