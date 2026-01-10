import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PasswordChangeNotification = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Show notification on every login if mustChangePassword is true
    if (user?.mustChangePassword) {
      toast({
        title: 'Password Change Required',
        description: 'You must change your password before continuing. Please use the "Forgot Password" option to set a new password.',
        variant: 'destructive',
        duration: 10000, // Show for 10 seconds
      });
    }
  }, [user?.mustChangePassword, toast]);

  // Don't render if user doesn't need to change password
  if (!user?.mustChangePassword) {
    return null;
  }

  const handleDismiss = () => {
    // Don't actually dismiss, just hide temporarily
    // The notification will show again on next page load/login
  };

  return (
    <Alert variant="destructive" className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertTitle className="text-orange-900 dark:text-orange-100">
        Password Change Required
      </AlertTitle>
      <AlertDescription className="text-orange-800 dark:text-orange-200 mt-2">
        <p className="mb-3">
          Your password has been reset by an administrator. You must change your password before you can continue using your account.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to login page and open forgot password dialog
              navigate('/login');
            }}
            className="border-orange-600 text-orange-700 hover:bg-orange-100 dark:border-orange-400 dark:text-orange-300 dark:hover:bg-orange-900/30"
          >
            Change Password
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PasswordChangeNotification;

