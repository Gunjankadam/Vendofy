import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`${getApiUrl('/api/auth/verify-email')}?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.message || 'Verification failed. The link may have expired.');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email verified successfully! Your temporary password has been sent to your email.');
        
        toast({
          title: 'Email verified',
          description: 'Your account is now active. Please check your email for your temporary password.',
          variant: 'success',
        });
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again.');
      }
    };

    void verifyEmail();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying your email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle>Email verified!</CardTitle>
              <CardDescription>Your account has been successfully verified.</CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle>Verification failed</CardTitle>
              <CardDescription>We couldn't verify your email address.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p className="text-sm text-muted-foreground text-center">{message}</p>
          )}
          {status === 'success' && (
            <div className="space-y-2">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ Important: Change your password immediately
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Check your email for your temporary password. Please change it as soon as you log in using the "Forgot Password" option if needed.
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </div>
          )}
          {status === 'error' && (
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;

