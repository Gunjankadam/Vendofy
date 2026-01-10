import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Edit, Trash2, Check, X, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  stock?: number;
  category?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdBy?: { name: string; email: string };
  reviewedBy?: { name: string; email: string };
  reviewedAt?: string;
  rejectionReason?: string;
}

const ProductManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  
  // Refs to track previous state for polling
  const prevProductsRef = useRef<Product[]>([]);
  const prevPendingProductsRef = useRef<Product[]>([]);

  const isSuperAdmin = user?.isSuperAdmin && user.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    stock: '',
    category: '',
    enableStock: true,
  });
  const [imageInputType, setImageInputType] = useState<'url' | 'upload'>('url');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      await loadProducts();
      if (isSuperAdmin) {
        await loadPendingProducts();
      }
    };
    void fetchData();
  }, [user?.token, isSuperAdmin, filter]);

  // Poll for product status updates (for admin - when their products are approved/rejected)
  useEffect(() => {
    if (!user?.token || isSuperAdmin) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/products', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const newProducts = data || [];
          const prevProducts = prevProductsRef.current;
          
          // Check if any product status changed
          const hasChanges = newProducts.length !== prevProducts.length ||
            newProducts.some((newProduct: Product) => {
              const prevProduct = prevProducts.find((p) => p._id === newProduct._id);
              return !prevProduct || prevProduct.status !== newProduct.status;
            });
          
          if (hasChanges) {
            setProducts(newProducts);
            prevProductsRef.current = newProducts;
            
            // Show notification if a product was approved
            const approvedProducts = newProducts.filter((newProduct: Product) => {
              const prevProduct = prevProducts.find((p) => p._id === newProduct._id);
              return prevProduct && prevProduct.status === 'pending' && newProduct.status === 'approved';
            });
            if (approvedProducts.length > 0) {
              toast({
                title: 'Product approved',
                description: `${approvedProducts.length} product(s) have been approved.`,
                variant: 'success',
              });
            }
            // Show notification if a product was rejected
            const rejectedProducts = newProducts.filter((newProduct: Product) => {
              const prevProduct = prevProducts.find((p) => p._id === newProduct._id);
              return prevProduct && prevProduct.status === 'pending' && newProduct.status === 'rejected';
            });
            if (rejectedProducts.length > 0) {
              toast({
                title: 'Product rejected',
                description: `${rejectedProducts.length} product(s) have been rejected.`,
                variant: 'destructive',
              });
            }
          }
        }
      } catch (error) {
        console.error('Poll products error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user?.token, isSuperAdmin]);

  // Poll for new pending products (for super admin)
  useEffect(() => {
    if (!user?.token || !isSuperAdmin) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/products/pending', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const newPendingProducts = data || [];
          const prevPendingProducts = prevPendingProductsRef.current;
          const prevPendingIds = new Set(prevPendingProducts.map((p) => p._id));
          const newPendingIds = new Set(newPendingProducts.map((p: Product) => p._id));
          
          // Check if there are new pending products
          if (newPendingProducts.length !== prevPendingProducts.length ||
              Array.from(newPendingIds).some((id) => !prevPendingIds.has(id))) {
            setPendingProducts(newPendingProducts);
            prevPendingProductsRef.current = newPendingProducts;
            
            // Show notification if new products were submitted
            const newProducts = newPendingProducts.filter((p: Product) => !prevPendingIds.has(p._id));
            if (newProducts.length > 0) {
              toast({
                title: 'New product submission',
                description: `${newProducts.length} new product(s) submitted for review.`,
                variant: 'default',
              });
            }
          }
        }
      } catch (error) {
        console.error('Poll pending products error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user?.token, isSuperAdmin]);

  const loadProducts = async () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const url = isSuperAdmin && filter !== 'all'
        ? `http://localhost:5000/api/products?status=${filter}`
        : 'http://localhost:5000/api/products';
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to load products' }));
        if (res.status === 401 || res.status === 403) {
          toast({
            title: 'Authentication Error',
            description: errorData.message || 'You are not authorized to view products. Please log in again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorData.message || 'Failed to load products',
            variant: 'destructive',
          });
        }
        setProducts([]);
        prevProductsRef.current = [];
        return;
      }
      const data = await res.json();
      const productsData = data || [];
      setProducts(productsData);
      prevProductsRef.current = productsData;
    } catch (error: any) {
      console.error('Load products error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load products. Please check your connection.',
        variant: 'destructive',
      });
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingProducts = async () => {
    if (!user?.token || !isSuperAdmin) return;
    try {
      const res = await fetch('http://localhost:5000/api/products/pending', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load pending products');
      const data = await res.json();
      const pendingData = data || [];
      setPendingProducts(pendingData);
      prevPendingProductsRef.current = pendingData;
    } catch (error) {
      console.error('Load pending products error:', error);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      imageUrl: '',
      stock: '',
      category: '',
      enableStock: true,
    });
    setImageInputType('url');
    setUploadedImage(null);
    setUploadedImageFile(null);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      imageUrl: product.imageUrl || '',
      stock: product.stock?.toString() || '',
      category: product.category || '',
      enableStock: product.stock !== undefined && product.stock !== null,
    });
    setImageInputType(product.imageUrl ? 'url' : 'upload');
    setUploadedImage(null);
    setUploadedImageFile(null);
    setIsEditDialogOpen(true);
  };

  const handleReview = (product: Product) => {
    setSelectedProduct(product);
    setIsReviewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (!user?.token || !isSuperAdmin) return;
    setDeleteProductId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user?.token || !deleteProductId) return;

    try {
      const res = await fetch(`http://localhost:5000/api/products/${deleteProductId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete product');
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
        variant: 'success',
      });
      setIsDeleteDialogOpen(false);
      setDeleteProductId(null);
      loadProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (isEdit: boolean) => {
    if (!user?.token) return;

    try {
      const url = isEdit
        ? `http://localhost:5000/api/products/${selectedProduct?._id}`
        : 'http://localhost:5000/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          imageUrl: imageInputType === 'url' ? (formData.imageUrl || undefined) : (uploadedImage || undefined),
          stock: formData.enableStock ? (parseInt(formData.stock) || 0) : null,
          category: formData.category,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save product');
      }

      toast({
        title: 'Success',
        description: isEdit
          ? isSuperAdmin
            ? 'Product updated successfully'
            : 'Product update submitted for review'
          : isSuperAdmin
            ? 'Product created successfully'
            : 'Product submitted for review',
        variant: 'success',
      });

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      loadProducts();
      if (isSuperAdmin) loadPendingProducts();
    } catch (error: any) {
      console.error('Save product error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save product',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async () => {
    if (!user?.token || !selectedProduct) return;

    try {
      const res = await fetch(`http://localhost:5000/api/products/${selectedProduct._id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to approve product');

      toast({
        title: 'Success',
        description: 'Product approved successfully',
        variant: 'success',
      });

      setIsReviewDialogOpen(false);
      setSelectedProduct(null);
      loadProducts();
      loadPendingProducts();
    } catch (error) {
      console.error('Approve product error:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve product',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (reason: string) => {
    if (!user?.token || !selectedProduct) return;

    try {
      const res = await fetch(`http://localhost:5000/api/products/${selectedProduct._id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) throw new Error('Failed to reject product');

      toast({
        title: 'Success',
        description: 'Product rejected',
        variant: 'success',
      });

      setIsReviewDialogOpen(false);
      setSelectedProduct(null);
      loadProducts();
      loadPendingProducts();
    } catch (error) {
      console.error('Reject product error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject product',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return (
        <Badge variant="outline">
          Unknown
        </Badge>
      );
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 pt-28 pb-12">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="font-serif text-2xl font-medium mb-1">Product Management</h2>
                <p className="text-muted-foreground">
                  {isSuperAdmin ? 'Manage and review products' : 'Manage your products'}
                </p>
              </div>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>

          {isSuperAdmin && pendingProducts.length > 0 && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Pending Review ({pendingProducts.length})
                </CardTitle>
                <CardDescription>
                  Products waiting for your approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingProducts.map((product) => (
                    <Card key={product._id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          {getStatusBadge(product.status)}
                        </div>
                        {product.createdBy && (
                          <CardDescription className="text-xs">
                            Created by: {product.createdBy.name}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          {product.description}
                        </p>
                        <p className="text-lg font-semibold mb-4">₹{product.price.toFixed(2)}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReview(product)}
                            className="flex-1"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isSuperAdmin && (
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'approved' ? 'default' : 'outline'}
                onClick={() => setFilter('approved')}
              >
                Approved
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={filter === 'rejected' ? 'default' : 'outline'}
                onClick={() => setFilter('rejected')}
              >
                Rejected
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product._id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {getStatusBadge(product.status)}
                    </div>
                    {product.description && (
                      <CardDescription className="text-xs mt-1">
                        {product.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-lg font-semibold">₹{product.price.toFixed(2)}</p>
                        {product.stock !== undefined && product.stock !== null && product.stock >= 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Stock: {product.stock}
                          </p>
                        )}
                      </div>
                      {product.category && (
                        <Badge variant="outline">{product.category}</Badge>
                      )}
                    </div>
                    {product.rejectionReason && (
                      <p className="text-xs text-destructive mb-2">
                        Reason: {product.rejectionReason}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(product)}
                        className="flex-1"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(product._id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      {isSuperAdmin && product.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(product)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? 'Create a new product (will be approved immediately)'
                : 'Submit a new product for review'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="enable-stock"
                    checked={formData.enableStock}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableStock: checked as boolean })}
                  />
                  <Label htmlFor="enable-stock" className="cursor-pointer">Enable Stock Tracking</Label>
                </div>
                {formData.enableStock && (
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Product category"
              />
            </div>
            <div>
              <Label>Product Image</Label>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="image-url"
                    name="imageType"
                    checked={imageInputType === 'url'}
                    onChange={() => {
                      setImageInputType('url');
                      setUploadedImage(null);
                      setUploadedImageFile(null);
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="image-url" className="cursor-pointer font-normal">Image URL</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="image-upload"
                    name="imageType"
                    checked={imageInputType === 'upload'}
                    onChange={() => {
                      setImageInputType('upload');
                      setFormData({ ...formData, imageUrl: '' });
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="image-upload" className="cursor-pointer font-normal">Upload Image</Label>
                </div>
              </div>
              {imageInputType === 'url' ? (
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    id="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast({
                            title: 'File too large',
                            description: 'Image must be less than 5MB',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setUploadedImageFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setUploadedImage(base64String);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {uploadedImage && (
                    <div className="mt-2">
                      <img
                        src={uploadedImage}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={!formData.name || !formData.price}>
              {isSuperAdmin ? 'Create' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? 'Update product details (changes apply immediately)'
                : 'Update product (changes will be submitted for review)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Price *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="edit-enable-stock"
                    checked={formData.enableStock}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableStock: checked as boolean })}
                  />
                  <Label htmlFor="edit-enable-stock" className="cursor-pointer">Enable Stock Tracking</Label>
                </div>
                {formData.enableStock && (
                  <Input
                    id="edit-stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Product category"
              />
            </div>
            <div>
              <Label>Product Image</Label>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="edit-image-url"
                    name="editImageType"
                    checked={imageInputType === 'url'}
                    onChange={() => {
                      setImageInputType('url');
                      setUploadedImage(null);
                      setUploadedImageFile(null);
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit-image-url" className="cursor-pointer font-normal">Image URL</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="edit-image-upload"
                    name="editImageType"
                    checked={imageInputType === 'upload'}
                    onChange={() => {
                      setImageInputType('upload');
                      setFormData({ ...formData, imageUrl: '' });
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit-image-upload" className="cursor-pointer font-normal">Upload Image</Label>
                </div>
              </div>
              {imageInputType === 'url' ? (
                <Input
                  id="edit-imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast({
                            title: 'File too large',
                            description: 'Image must be less than 5MB',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setUploadedImageFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setUploadedImage(base64String);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {uploadedImage && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-1">New image preview:</p>
                      <img
                        src={uploadedImage}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                  {!uploadedImage && selectedProduct?.imageUrl && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-1">Current image:</p>
                      <img
                        src={selectedProduct.imageUrl}
                        alt="Current"
                        className="w-32 h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit(true)} disabled={!formData.name || !formData.price}>
              {isSuperAdmin ? 'Update' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Product Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Product</DialogTitle>
            <DialogDescription>
              Review and approve or reject this product submission
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="text-sm font-medium">{selectedProduct.name}</p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.description || 'No description'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price</Label>
                  <p className="text-sm font-medium">₹{selectedProduct.price.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Stock</Label>
                  <p className="text-sm font-medium">{selectedProduct.stock || 0}</p>
                </div>
              </div>
              {selectedProduct.category && (
                <div>
                  <Label>Category</Label>
                  <p className="text-sm font-medium">{selectedProduct.category}</p>
                </div>
              )}
              {selectedProduct.createdBy && (
                <div>
                  <Label>Created By</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct.createdBy.name} ({selectedProduct.createdBy.email})
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Enter reason for rejection..."
                  rows={3}
                  onChange={(e) => {
                    if (selectedProduct) {
                      setSelectedProduct({ ...selectedProduct, rejectionReason: e.target.value });
                    }
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(selectedProduct?.rejectionReason || 'Rejected by super admin')}
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleApprove}>
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductManagement;

