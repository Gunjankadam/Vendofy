import { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !role) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password, role);
      toast({
        title: 'Login successful',
        description: 'Welcome back to your dashboard.',
        variant: 'success',
      });
      // Navigate to dashboard after successful login
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Login failed. Please try again.');
      toast({
        title: 'Login failed',
        description: 'Please check your credentials and role.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');

    if (!fpEmail) {
      setFpError('Please enter your email.');
      return;
    }

    setFpLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: fpEmail }),
      });

      if (!res.ok) {
        throw new Error('Failed to send code');
      }

      toast({
        title: 'Code sent',
        description: 'A one-time code has been sent to your email.',
        variant: 'success',
      });

      setForgotStep('reset');
    } catch (err) {
      console.error(err);
      setFpError('Failed to send code. Please try again.');
      toast({
        title: 'Something went wrong',
        description: 'Could not send reset code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');

    if (!fpCode || !fpNewPassword || !fpConfirmPassword) {
      setFpError('Please fill in all fields.');
      return;
    }

    if (fpNewPassword !== fpConfirmPassword) {
      setFpError('Passwords do not match.');
      return;
    }

    setFpLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password/reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: fpEmail, code: fpCode, newPassword: fpNewPassword }),
      });

      if (!res.ok) {
        throw new Error('Failed to reset password');
      }

      toast({
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
        variant: 'success',
      });

      setForgotOpen(false);
      setForgotStep('email');
      setFpEmail('');
      setFpCode('');
      setFpNewPassword('');
      setFpConfirmPassword('');
    } catch (err) {
      console.error(err);
      setFpError('Invalid code or expired. Please try again.');
      toast({
        title: 'Reset failed',
        description: 'The code is invalid or has expired.',
        variant: 'destructive',
      });
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full relative bg-transparent">

      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:px-8 relative z-10">
        <Link
          to="/"
          className="absolute top-6 left-6 w-10 h-10 rounded-full border border-white/20 bg-white/50 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-white/80 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="max-w-[400px] w-full bg-white/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl animate-fade-in">
          <Link
            to="/"
            className="font-sans text-xl font-bold tracking-tight inline-block mb-8 hover:opacity-70 transition-opacity text-foreground"
          >
            Vendofy
          </Link>

          <h1 className="font-sans text-3xl font-bold mb-2 text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8 font-medium">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                className="h-12 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 dark:bg-black/50 dark:border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-12 pr-10 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 dark:bg-black/50 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select your role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger className="h-12 bg-white/50 border-gray-200 dark:bg-black/50 dark:border-white/10">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotStep('email');
                  setFpEmail(email);
                  setFpError('');
                }}
                className="text-sm text-primary font-medium hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 bg-white/10 backdrop-blur-sm items-center justify-center border-l border-white/20 relative z-10">
        <div className="text-center px-12 animate-slide-up">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-700 dark:text-gray-300 mb-4 font-bold">
            One platform
          </p>
          <h2 className="font-sans text-4xl font-bold leading-tight max-w-md text-gray-900 dark:text-white">
            Three perspectives, unified experience
          </h2>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(open) => {
        setForgotOpen(open);
        if (!open) {
          setForgotStep('email');
          setFpEmail('');
          setFpCode('');
          setFpNewPassword('');
          setFpConfirmPassword('');
          setShowNewPassword(false);
          setShowConfirmPassword(false);
          setFpError('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {forgotStep === 'email'
                ? 'Enter your email and we will send you a one-time code.'
                : 'Enter the code sent to your email and choose a new password.'}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 'email' ? (
            <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email" className="text-sm">
                  Email
                </Label>
                <Input
                  id="fp-email"
                  type="email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  placeholder="Enter email"
                  className="h-10"
                />
              </div>

              {fpError && <p className="text-sm text-destructive">{fpError}</p>}

              <DialogFooter>
                <Button type="submit" disabled={fpLoading} className="w-full">
                  {fpLoading ? 'Sending code...' : 'Send code'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleForgotResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-code" className="text-sm">
                  One-time code
                </Label>
                <Input
                  id="fp-code"
                  value={fpCode}
                  onChange={(e) => setFpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="h-10 tracking-[0.35em] text-center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fp-new-password" className="text-sm">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="fp-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={fpNewPassword}
                    onChange={(e) => setFpNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fp-confirm-password" className="text-sm">
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    id="fp-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={fpConfirmPassword}
                    onChange={(e) => setFpConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {fpError && <p className="text-sm text-destructive">{fpError}</p>}

              <DialogFooter>
                <Button type="submit" disabled={fpLoading} className="w-full">
                  {fpLoading ? 'Updating password...' : 'Update password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
