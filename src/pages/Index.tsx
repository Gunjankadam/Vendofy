import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LazyHeader } from '@/components/LazyHeader';
import { Button } from '@/components/ui/button';
// Import icons directly - they're tree-shakeable and small
import { Shield, Truck, ShoppingBag, ArrowRight } from 'lucide-react';
import abstractImage from '@/assets/abstract-login.jpg';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Abstract background image */}
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

      <LazyHeader />

      <main className="container mx-auto px-6 pt-32 relative z-10">
        <section className="min-h-[80vh] flex flex-col justify-center items-center text-center">
          <div className="max-w-2xl animate-fade-in">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-700 dark:text-gray-300 mb-6 font-medium">
              Welcome
            </p>
            <h1 className="font-sans text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-8 text-balance text-gray-900 dark:text-white">
              Simplicity is the ultimate sophistication
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-12 max-w-md mx-auto font-medium">
              A minimal approach to managing your business with elegance and clarity.
            </p>
            <Link to="/login">
              <Button size="lg" className="px-8 py-6 text-base">
                Get Started
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-24 border-t border-border">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-700 dark:text-gray-300 mb-4 font-medium">
              Built for everyone
            </p>
            <h2 className="font-sans text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              One platform, three perspectives
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div
              className="group p-8 rounded-2xl border border-white/20 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">01</span>
              <h3 className="font-sans font-bold text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Administrators</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Complete oversight and control over all operations, users, and system configurations.
              </p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>

            <div
              className="group p-8 rounded-2xl border border-white/20 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">02</span>
              <h3 className="font-sans font-bold text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Distributors</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Manage inventory, track orders, and coordinate with customers efficiently.
              </p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>

            <div
              className="group p-8 rounded-2xl border border-white/20 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">03</span>
              <h3 className="font-sans font-bold text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Customers</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Browse products, place orders, and track deliveries with ease.
              </p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 relative z-10">
        <div className="container mx-auto px-6 text-center text-sm text-black dark:text-gray-300">
          © 2026 Vendofy. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
