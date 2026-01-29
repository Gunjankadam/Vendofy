import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface CustomerPricing {
  _id: string;
  customerId: { _id: string; name: string; email: string };
  productId: { _id: string; name: string; price: number; imageUrl?: string };
  customPrice: number;
}

interface Customer {
  _id: string;
  name: string;
  email: string;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

const DistributorPricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pricing, setPricing] = useState<CustomerPricing[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState<CustomerPricing | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    productId: '',
    customPrice: '',
  });

  useEffect(() => {
    if (!user?.token) return;
    loadData();
  }, [user?.token]);

  const loadData = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const { cachedFetch } = await import('@/lib/cached-fetch');

      // Load all data in parallel with caching
      const [pricingData, customersData, productsData] = await Promise.all([
        cachedFetch('/api/distributor/customer-pricing', user.token).catch(() => []),
        cachedFetch('/api/distributor/customers', user.token).catch(() => []),
        cachedFetch('/api/distributor/products', user.token).catch(() => []),
      ]);

      setPricing(pricingData || []);
      setCustomers(customersData || []);
      setProducts(productsData || []);
    } catch (error: any) {
      console.error('Load data error:', error);
      toast({
        title: 'Failed to load data',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ customerId: '', productId: '', customPrice: '' });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (pricingItem: CustomerPricing) => {
    setSelectedPricing(pricingItem);
    setFormData({
      customerId: pricingItem.customerId._id,
      productId: pricingItem.productId._id,
      customPrice: pricingItem.customPrice.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (pricingItem: CustomerPricing) => {
    setSelectedPricing(pricingItem);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token) return;

    try {
      const res = await fetch(getApiUrl('/api/distributor/customer-pricing'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          productId: formData.productId,
          customPrice: parseFloat(formData.customPrice),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save pricing');
      }

      toast({
        title: 'Pricing saved',
        description: 'Custom price has been set successfully.',
        variant: 'success',
      });

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setFormData({ customerId: '', productId: '', customPrice: '' });
      await loadData();
    } catch (error: any) {
      console.error('Save pricing error:', error);
      toast({
        title: 'Failed to save pricing',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user?.token || !selectedPricing) return;

    try {
      const res = await fetch(getApiUrl(`/api/distributor/customer-pricing/${selectedPricing._id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete pricing');
      }

      toast({
        title: 'Pricing deleted',
        description: 'Custom price has been removed.',
        variant: 'success',
      });

      setIsDeleteDialogOpen(false);
      setSelectedPricing(null);
      await loadData();
    } catch (error: any) {
      console.error('Delete pricing error:', error);
      toast({
        title: 'Failed to delete pricing',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent relative">
        <Header />
        <main className="container mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading pricing...</p>
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-sans text-2xl md:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-2 tracking-tight">
              <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
              Customer Pricing Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base">Set custom prices for your customers</p>
          </div>
          <Button onClick={handleAdd} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Custom Price
          </Button>
        </div>

        {pricing.length === 0 ? (
          <Card className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4 font-medium">No custom pricing set yet.</p>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Price
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricing.map((item) => (
              <Card key={item._id} className="hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold">{item.productId.name}</CardTitle>
                      <CardDescription className="mt-1 text-gray-600 dark:text-gray-400 font-medium">
                        {item.customerId.name}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Base Price:</span>
                      <span className="text-sm line-through text-gray-600 dark:text-gray-400">
                        ₹{item.productId.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Custom Price:</span>
                      <span className="text-xl font-bold text-primary">
                        ₹{item.customPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      Custom
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setFormData({ customerId: '', productId: '', customPrice: '' });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditDialogOpen ? 'Edit' : 'Add'} Custom Price</DialogTitle>
              <DialogDescription>
                Set a custom price for a specific customer and product.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                  >
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer._id} value={customer._id}>
                          {customer.name} ({customer.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="product">Product</Label>
                  <Select
                    value={formData.productId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, productId: value });
                      // Auto-fill base price
                      const product = products.find(p => p._id === value);
                      if (product && !formData.customPrice) {
                        setFormData({ ...formData, productId: value, customPrice: product.price.toString() });
                      }
                    }}
                  >
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} (Base: ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customPrice">Custom Price (₹)</Label>
                  <Input
                    id="customPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.customPrice}
                    onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
                    placeholder="Enter custom price"
                    required
                  />
                  {formData.productId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Base price: ₹{products.find(p => p._id === formData.productId)?.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0'}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setIsEditDialogOpen(false);
                    setFormData({ customerId: '', productId: '', customPrice: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!formData.customerId || !formData.productId || !formData.customPrice}>
                  {isEditDialogOpen ? 'Update' : 'Add'} Price
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Custom Price</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the custom price for {selectedPricing?.productId.name} for customer {selectedPricing?.customerId.name}?
                The customer will see the base price instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default DistributorPricing;

