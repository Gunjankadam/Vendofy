import { Suspense, lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DeferredToaster } from "@/components/DeferredToaster";
import GlobalBackground from "@/components/GlobalBackground";

// Lazy load all route components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const SystemSettings = lazy(() => import("./pages/SystemSettings"));
const ProductManagement = lazy(() => import("./pages/ProductManagement"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const CustomerProducts = lazy(() => import("./pages/CustomerProducts"));
const CustomerCheckout = lazy(() => import("./pages/CustomerCheckout"));
const CustomerOrders = lazy(() => import("./pages/CustomerOrders"));
const DistributorOrders = lazy(() => import("./pages/DistributorOrders"));
const DistributorTransit = lazy(() => import("./pages/DistributorTransit"));
const DistributorPricing = lazy(() => import("./pages/DistributorPricing"));
const AdminOrderNotifications = lazy(() => import("./pages/AdminOrderNotifications"));
const AdminProductUsage = lazy(() => import("./pages/AdminProductUsage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Create QueryClient outside component to avoid recreation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
    },
  },
});

const App = () => {
  // Prefetch likely routes on idle (runs once on mount)
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        // Prefetch common routes
        void import('./pages/Login');
        void import('./pages/Dashboard');
      },
      { timeout: 2000 }
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <DeferredToaster />
          <BrowserRouter>
            <GlobalBackground />
            <Suspense fallback={<LoadingSpinner />}>
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
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
