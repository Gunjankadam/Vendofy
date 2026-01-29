import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getApiUrl } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

interface Distributor {
  _id: string;
  name: string;
  email: string;
}

interface UsedProduct {
  product: Product;
  distributors: Array<{
    distributorId: string;
    distributorName: string;
    distributorEmail: string;
    customPrice: number;
    pricingId: string;
  }>;
}

export default function AdminProductUsage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [usedProducts, setUsedProducts] = useState<UsedProduct[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsed, setLoadingUsed] = useState(true);
  const [isUseDialogOpen, setIsUseDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPricingId, setSelectedPricingId] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<Record<string, number>>({});
  const [editPrice, setEditPrice] = useState<number>(0);

  useEffect(() => {
    if (!user?.token) return;
    loadAvailableProducts();
    loadUsedProducts();
    loadDistributors();
  }, [user?.token]);

  const loadAvailableProducts = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const { cachedFetch } = await import('@/lib/cached-fetch');
      const data = await cachedFetch<Product[]>("/api/admin/products/available", user.token).catch(() => []);
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("Load available products error:", error);
      toast({ title: "Error", description: "Failed to load available products.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadUsedProducts = async () => {
    if (!user?.token) return;
    try {
      setLoadingUsed(true);
      const { cachedFetch } = await import('@/lib/cached-fetch');
      const data = await cachedFetch<UsedProduct[]>("/api/admin/products/used", user.token).catch(() => []);
      setUsedProducts(data || []);
    } catch (error) {
      console.error("Load used products error:", error);
      toast({ title: "Error", description: "Failed to load used products.", variant: "destructive" });
    } finally {
      setLoadingUsed(false);
    }
  };

  const loadDistributors = async () => {
    if (!user?.token) return;
    try {
      const { cachedFetch } = await import('@/lib/cached-fetch');
      const data = await cachedFetch<Distributor[]>("/api/admin/distributors", user.token).catch(() => []);
      setDistributors(data || []);
    } catch (error) {
      console.error("Load distributors error:", error);
    }
  };

  const handleUseProduct = (product: Product) => {
    setSelectedProduct(product);
    setPricingData({});
    setIsUseDialogOpen(true);
  };

  const handleSubmitUse = async () => {
    if (!user?.token || !selectedProduct) return;

    const pricingArray = Object.entries(pricingData)
      .filter(([_, price]) => price > 0)
      .map(([distributorId, customPrice]) => ({ distributorId, customPrice }));

    if (pricingArray.length === 0) {
      toast({ title: "Error", description: "Please set pricing for at least one distributor.", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/admin/products/use"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          productId: selectedProduct._id,
          distributorPricing: pricingArray,
        }),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Product pricing set successfully.", variant: "success" });
        setIsUseDialogOpen(false);
        setSelectedProduct(null);
        setPricingData({});
        loadUsedProducts();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to set product pricing.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Use product error:", error);
      toast({ title: "Error", description: "Failed to set product pricing.", variant: "destructive" });
    }
  };

  const handleEditPricing = (pricingId: string, currentPrice: number) => {
    setSelectedPricingId(pricingId);
    setEditPrice(currentPrice);
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = async () => {
    if (!user?.token || !selectedPricingId || editPrice <= 0) return;

    try {
      const res = await fetch(getApiUrl(`/api/admin/products/pricing/${selectedPricingId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ customPrice: editPrice }),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Pricing updated successfully.", variant: "success" });
        setIsEditDialogOpen(false);
        setSelectedPricingId(null);
        setEditPrice(0);
        loadUsedProducts();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to update pricing.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Update pricing error:", error);
      toast({ title: "Error", description: "Failed to update pricing.", variant: "destructive" });
    }
  };

  const handleDeletePricing = async () => {
    if (!user?.token || !selectedPricingId) return;

    try {
      const res = await fetch(getApiUrl(`/api/admin/products/pricing/${selectedPricingId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (res.ok) {
        toast({ title: "Success", description: "Product pricing removed successfully.", variant: "success" });
        setIsDeleteDialogOpen(false);
        setSelectedPricingId(null);
        loadUsedProducts();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to remove pricing.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Delete pricing error:", error);
      toast({ title: "Error", description: "Failed to remove pricing.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-transparent relative">
      <div className="container mx-auto px-6 pt-28 pb-12 relative z-10">
        <div className="flex items-center gap-4 mb-4 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-sans text-2xl md:text-4xl font-bold mb-1 md:mb-2 tracking-tight">Product Usage & Pricing</h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base">Use products and set custom pricing for your distributors</p>
          </div>
        </div>

        {/* Available Products */}
        <div className="mb-8">
          <h2 className="text-xl font-medium mb-4">Available Products</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : availableProducts.length === 0 ? (
            <p className="text-muted-foreground">No products available.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableProducts.map((product) => (
                <Card key={product._id} className="hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription>{product.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-serif font-medium">₹{product.price.toFixed(2)}</p>
                        {product.category && <p className="text-sm text-muted-foreground">{product.category}</p>}
                      </div>
                      <Button onClick={() => handleUseProduct(product)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Use Product
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Used Products */}
        <div>
          <h2 className="text-xl font-medium mb-4">Your Used Products</h2>
          {loadingUsed ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : usedProducts.length === 0 ? (
            <p className="text-muted-foreground">No products in use yet. Use a product to get started.</p>
          ) : (
            <div className="space-y-4">
              {usedProducts.map((item) => (
                <Card key={item.product._id} className="hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.product.name}</CardTitle>
                    <CardDescription>Base Price: ₹{item.product.price.toFixed(2)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {item.distributors.map((dist) => (
                        <div key={dist.pricingId} className="flex items-center justify-between p-3 border border-black/10 dark:border-white/10 rounded-lg bg-muted/30">
                          <div>
                            <p className="font-medium">{dist.distributorName}</p>
                            <p className="text-sm text-muted-foreground">{dist.distributorEmail}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">₹{dist.customPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Custom Price</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPricing(dist.pricingId, dist.customPrice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPricingId(dist.pricingId);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Use Product Dialog */}
        <Dialog open={isUseDialogOpen} onOpenChange={setIsUseDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Use Product: {selectedProduct?.name}</DialogTitle>
              <DialogDescription>Set custom pricing for your distributors</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {distributors.map((dist) => (
                <div key={dist._id} className="space-y-2">
                  <Label htmlFor={`price-${dist._id}`}>{dist.name} ({dist.email})</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`price-${dist._id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`Base: ₹${selectedProduct?.price.toFixed(2) || "0.00"}`}
                      value={pricingData[dist._id] || ""}
                      onChange={(e) =>
                        setPricingData({ ...pricingData, [dist._id]: parseFloat(e.target.value) || 0 })
                      }
                    />
                    <span className="text-sm text-muted-foreground">₹</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsUseDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitUse}>Set Pricing</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Pricing Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Pricing</DialogTitle>
              <DialogDescription>Update the custom price for this distributor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Custom Price (₹)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitEdit}>Update</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Product Pricing?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the custom pricing for this distributor. The product will no longer be available to them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePricing}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

