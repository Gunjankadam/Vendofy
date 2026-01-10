import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <img 
          src={abstractImage} 
          alt="" 
          className="absolute inset-0 w-full h-full opacity-10 object-cover"
        />
      </div>
      
      <Header />
      
      <main className="container mx-auto px-6 pt-32 relative z-10">
        <section className="min-h-[80vh] flex flex-col justify-center items-center text-center">
          <div className="max-w-2xl animate-fade-in">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-6">
              Welcome
            </p>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium leading-tight mb-8 text-balance">
              Simplicity is the ultimate sophistication
            </h1>
            <p className="text-lg text-muted-foreground mb-12 max-w-md mx-auto">
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
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Built for everyone
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-medium">
              One platform, three perspectives
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div 
              className="group p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-foreground/20 hover:bg-card transition-all duration-300 animate-slide-up" 
              style={{ animationDelay: '0.1s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">01</span>
              <h3 className="font-serif text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Administrators</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Complete oversight and control over all operations, users, and system configurations.
              </p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>
            
            <div 
              className="group p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-foreground/20 hover:bg-card transition-all duration-300 animate-slide-up" 
              style={{ animationDelay: '0.2s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">02</span>
              <h3 className="font-serif text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Distributors</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Manage inventory, track orders, and coordinate with customers efficiently.
              </p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>
            
            <div 
              className="group p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-foreground/20 hover:bg-card transition-all duration-300 animate-slide-up" 
              style={{ animationDelay: '0.3s' }}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-wider">03</span>
              <h3 className="font-serif text-xl mt-2 mb-3 group-hover:text-primary transition-colors">For Customers</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
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
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 Vendofy. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
