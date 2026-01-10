import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import SystemSettings from "./pages/SystemSettings";
import ProductManagement from "./pages/ProductManagement";
import VerifyEmail from "./pages/VerifyEmail";
import CustomerProducts from "./pages/CustomerProducts";
import CustomerCheckout from "./pages/CustomerCheckout";
import CustomerOrders from "./pages/CustomerOrders";
import DistributorOrders from "./pages/DistributorOrders";
import DistributorTransit from "./pages/DistributorTransit";
import DistributorPricing from "./pages/DistributorPricing";
import AdminOrderNotifications from "./pages/AdminOrderNotifications";
import AdminProductUsage from "./pages/AdminProductUsage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="/product-management" element={<ProductManagement />} />
            <Route path="/customer/products" element={<CustomerProducts />} />
            <Route path="/customer/checkout" element={<CustomerCheckout />} />
            <Route path="/customer/orders" element={<CustomerOrders />} />
            <Route path="/distributor/orders" element={<DistributorOrders />} />
            <Route path="/distributor/transit" element={<DistributorTransit />} />
            <Route path="/distributor/pricing" element={<DistributorPricing />} />
            <Route path="/admin/order-notifications" element={<AdminOrderNotifications />} />
            <Route path="/admin/product-usage" element={<AdminProductUsage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
