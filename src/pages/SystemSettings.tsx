import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Loader2, Check, X, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SystemSettingsData {
  // Global configuration
  emailFromAddress?: string;
  smtpStatus?: 'active' | 'inactive';

  // Authentication & security
  jwtSessionDuration?: number;
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireSpecialChars?: boolean;

  // App behavior
  featureToggles?: { [key: string]: boolean };
  notificationEmailEnabled?: boolean;
  notificationOnSiteEnabled?: boolean;

  // Field requirements per role
  fieldRequirements?: {
    admin?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
    distributor?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
    customer?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
  };
}

const SystemSettings = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<SystemSettingsData>({});
  const [pendingChange, setPendingChange] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [jwtDurationValue, setJwtDurationValue] = useState<number>(1);
  const [jwtDurationUnit, setJwtDurationUnit] = useState<'seconds' | 'minutes' | 'hours'>('hours');
  
  // Separate state for field requirements to force toggle updates
  const [fieldRequirements, setFieldRequirements] = useState<{
    admin?: any;
    distributor?: any;
    customer?: any;
  }>({});
  
  // Version counter to force Switch remount when settings change
  const [fieldReqsVersion, setFieldReqsVersion] = useState(0);
  
  // Ref to track previous settings for comparison
  const prevSettingsRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated || (!user?.isSuperAdmin && user?.role !== 'admin')) {
      navigate('/dashboard');
      return;
    }
    if (user?.token) {
      loadSettings();
      if (!user?.isSuperAdmin) {
        loadPendingChange();
      } else {
        loadPendingRequests();
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Sync fieldRequirements state when settings change
  useEffect(() => {
    if (settings.fieldRequirements) {
      const newFieldReqs = {
        admin: { ...settings.fieldRequirements.admin },
        distributor: { ...settings.fieldRequirements.distributor },
        customer: { ...settings.fieldRequirements.customer },
      };
      setFieldRequirements(newFieldReqs);
      // Increment version to force Switch remount
      setFieldReqsVersion(prev => prev + 1);
    }
  }, [settings.fieldRequirements]);

  // Poll for pending change status updates (for admin)
  useEffect(() => {
    if (!user?.token || user?.isSuperAdmin) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system-settings/pending/my', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            const currentPendingId = pendingChange?._id || pendingChange?.id;
            const newPendingId = data._id || data.id;
            
            // If status changed from pending to approved/rejected
            if (currentPendingId === newPendingId && pendingChange?.status === 'pending' && data.status !== 'pending') {
              if (data.status === 'approved') {
                // Reload settings to show approved changes
                await loadSettings();
                setPendingChange(null);
                toast({
                  title: 'Request approved',
                  description: 'Your settings change request has been approved and applied.',
                  variant: 'success',
                });
              } else if (data.status === 'rejected') {
                setPendingChange(null);
                toast({
                  title: 'Request rejected',
                  description: data.rejectionReason || 'Your settings change request has been rejected.',
                  variant: 'destructive',
                });
              }
            } else if (data.status === 'pending') {
              // Still pending or new pending request, update the pending change object
              if (!pendingChange || currentPendingId !== newPendingId) {
                setPendingChange(data);
              }
            }
          } else if (pendingChange) {
            // No pending change found, clear it
            setPendingChange(null);
          }
        }
      } catch (error) {
        console.error('Poll pending change error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user?.token, user?.isSuperAdmin, pendingChange]);

  // Poll for settings changes (for admin - when super admin makes direct changes)
  useEffect(() => {
    if (!user?.token || user?.isSuperAdmin) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system-settings', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Structure the data the same way as loadSettings
          const structuredData = {
            ...data,
            fieldRequirements: {
              admin: {
                mobileNo: data.fieldRequirements?.admin?.mobileNo || false,
                businessName: data.fieldRequirements?.admin?.businessName || false,
                address: data.fieldRequirements?.admin?.address || false,
                registrationNo: data.fieldRequirements?.admin?.registrationNo || false,
                registrationCopy: data.fieldRequirements?.admin?.registrationCopy || false,
              },
              distributor: {
                mobileNo: data.fieldRequirements?.distributor?.mobileNo || false,
                businessName: data.fieldRequirements?.distributor?.businessName || false,
                address: data.fieldRequirements?.distributor?.address || false,
                registrationNo: data.fieldRequirements?.distributor?.registrationNo || false,
                registrationCopy: data.fieldRequirements?.distributor?.registrationCopy || false,
              },
              customer: {
                mobileNo: data.fieldRequirements?.customer?.mobileNo || false,
                businessName: data.fieldRequirements?.customer?.businessName || false,
                address: data.fieldRequirements?.customer?.address || false,
                registrationNo: data.fieldRequirements?.customer?.registrationNo || false,
                registrationCopy: data.fieldRequirements?.customer?.registrationCopy || false,
              },
            },
          };
          
          const currentFieldReqs = JSON.stringify(structuredData.fieldRequirements);
          const prevFieldReqs = JSON.stringify(prevSettingsRef.current?.fieldRequirements);
          
          // Check if field requirements changed
          if (currentFieldReqs !== prevFieldReqs) {
            // Update settings to reflect changes - use deep copy to force re-render
            const deepCopy = JSON.parse(JSON.stringify(structuredData));
            setSettings(deepCopy);
            // Explicitly update field requirements state to force toggle re-render
            const newFieldReqs = {
              admin: { ...deepCopy.fieldRequirements?.admin },
              distributor: { ...deepCopy.fieldRequirements?.distributor },
              customer: { ...deepCopy.fieldRequirements?.customer },
            };
            setFieldRequirements(newFieldReqs);
            // Increment version to force Switch remount
            setFieldReqsVersion(prev => prev + 1);
            prevSettingsRef.current = deepCopy;
            toast({
              title: 'Settings updated',
              description: 'System settings have been updated.',
              variant: 'success',
            });
          } else {
            // Update ref even if no change detected
            prevSettingsRef.current = JSON.parse(JSON.stringify(structuredData));
          }
        }
      } catch (error) {
        console.error('Poll settings error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user?.token, user?.isSuperAdmin]);

  // Poll for new pending requests (for super admin)
  useEffect(() => {
    if (!user?.token || !user?.isSuperAdmin) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system-settings/pending', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const newRequests = data || [];
          const currentRequestIds = new Set(pendingRequests.map((r: any) => r._id || r.id));
          const newRequestIds = new Set(newRequests.map((r: any) => r._id || r.id));
          
          // Check if there are new requests or count changed
          if (newRequests.length !== pendingRequests.length || 
              Array.from(newRequestIds).some((id: any) => !currentRequestIds.has(id))) {
            setPendingRequests(newRequests);
          }
        }
      } catch (error) {
        console.error('Poll pending requests error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user?.token, user?.isSuperAdmin, pendingRequests]);

  const loadSettings = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('http://localhost:5000/api/system-settings', {
        headers: { Authorization: `Bearer ${user.token}` },
        cache: 'no-store', // Prevent caching
      });
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      
      // Preserve existing admin settings if they exist, otherwise use defaults
      const existingAdmin = settings.fieldRequirements?.admin || {};
      const newAdmin = data.fieldRequirements?.admin || {};
      
      // Create a properly structured settings object with all field requirements
      const newSettings = {
        ...data,
        fieldRequirements: {
          admin: {
            mobileNo: newAdmin.mobileNo ?? existingAdmin.mobileNo ?? false,
            businessName: newAdmin.businessName ?? existingAdmin.businessName ?? false,
            address: newAdmin.address ?? existingAdmin.address ?? false,
            registrationNo: newAdmin.registrationNo ?? existingAdmin.registrationNo ?? false,
            registrationCopy: newAdmin.registrationCopy ?? existingAdmin.registrationCopy ?? false,
          },
          distributor: {
            mobileNo: data.fieldRequirements?.distributor?.mobileNo ?? false,
            businessName: data.fieldRequirements?.distributor?.businessName ?? false,
            address: data.fieldRequirements?.distributor?.address ?? false,
            registrationNo: data.fieldRequirements?.distributor?.registrationNo ?? false,
            registrationCopy: data.fieldRequirements?.distributor?.registrationCopy ?? false,
          },
          customer: {
            mobileNo: data.fieldRequirements?.customer?.mobileNo ?? false,
            businessName: data.fieldRequirements?.customer?.businessName ?? false,
            address: data.fieldRequirements?.customer?.address ?? false,
            registrationNo: data.fieldRequirements?.customer?.registrationNo ?? false,
            registrationCopy: data.fieldRequirements?.customer?.registrationCopy ?? false,
          },
        },
      };
      
      // Update settings - use a completely new object
      setSettings({ ...newSettings });
      
      // Explicitly update field requirements state with completely new objects
      setFieldRequirements({
        admin: { ...newSettings.fieldRequirements.admin },
        distributor: { ...newSettings.fieldRequirements.distributor },
        customer: { ...newSettings.fieldRequirements.customer },
      });
      
      // Force Switch remount by incrementing version
      setFieldReqsVersion(prev => prev + 1);
      prevSettingsRef.current = newSettings;
      
      // Convert JWT duration from seconds to display unit
      if (data.jwtSessionDuration) {
        const seconds = data.jwtSessionDuration;
        if (seconds % 3600 === 0) {
          setJwtDurationValue(seconds / 3600);
          setJwtDurationUnit('hours');
        } else if (seconds % 60 === 0) {
          setJwtDurationValue(seconds / 60);
          setJwtDurationUnit('minutes');
        } else {
          setJwtDurationValue(seconds);
          setJwtDurationUnit('seconds');
        }
      }
    } catch (error) {
      console.error('Load settings error:', error);
      toast({
        title: 'Failed to load settings',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPendingChange = async () => {
    if (!user?.token || user?.isSuperAdmin) return;
    try {
      const res = await fetch('http://localhost:5000/api/system-settings/pending/my', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Only set as pending if status is actually pending
        if (data && data.status === 'pending') {
          setPendingChange(data);
        } else {
          setPendingChange(null);
          // If it was approved, reload settings to reflect changes
          if (data && data.status === 'approved') {
            await loadSettings();
            toast({
              title: 'Request approved',
              description: 'Your settings change request has been approved and applied.',
              variant: 'success',
            });
          } else if (data && data.status === 'rejected') {
            toast({
              title: 'Request rejected',
              description: data.rejectionReason || 'Your settings change request has been rejected.',
              variant: 'destructive',
            });
          }
        }
      }
    } catch (error) {
      console.error('Load pending change error:', error);
    }
  };

  const loadPendingRequests = async () => {
    if (!user?.token || !user?.isSuperAdmin) return;
    setLoadingPending(true);
    try {
      const res = await fetch('http://localhost:5000/api/system-settings/pending', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data || []);
      }
    } catch (error) {
      console.error('Load pending requests error:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApplyChanges = (request: any) => {
    const fieldReqs = request.fieldRequirements || {};
    const distributorReqs = fieldReqs.distributor || {};
    const customerReqs = fieldReqs.customer || {};
    
    // Apply the requested changes to current settings
    const updatedSettings = {
      ...settings,
      fieldRequirements: {
        ...settings.fieldRequirements,
        distributor: {
          ...settings.fieldRequirements?.distributor,
          ...distributorReqs,
        },
        customer: {
          ...settings.fieldRequirements?.customer,
          ...customerReqs,
        },
      },
    };
    
    setSettings(updatedSettings);
    setFieldRequirements({
      ...fieldRequirements,
      distributor: { ...updatedSettings.fieldRequirements.distributor },
      customer: { ...updatedSettings.fieldRequirements.customer },
    });
    setFieldReqsVersion(prev => prev + 1);
    
    toast({
      title: 'Changes applied',
      description: 'The requested changes have been applied to the settings. Review and save when ready.',
      variant: 'success',
    });
  };

  const handleApprove = async (requestId: string) => {
    if (!user?.token) return;
    try {
      // First, save the current settings (which may have been manually adjusted)
      const saveRes = await fetch('http://localhost:5000/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          ...settings,
          jwtSessionDuration: jwtDurationValue * (jwtDurationUnit === 'minutes' ? 60 : jwtDurationUnit === 'hours' ? 3600 : 1),
        }),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save current settings');
      }

      // Then approve the request (this marks it as approved in the database)
      const res = await fetch(`http://localhost:5000/api/system-settings/pending/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to approve request');
      }

      toast({
        title: 'Request approved',
        description: 'The settings have been saved and the request has been approved.',
        variant: 'success',
      });

      // Reload settings and pending requests to ensure everything is in sync
      await loadSettings();
      await loadPendingRequests();
      
    } catch (error: any) {
      console.error('Approve request error:', error);
      toast({
        title: 'Failed to approve request',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (requestId: string, reason?: string) => {
    if (!user?.token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/system-settings/pending/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ reason: reason || 'Rejected by super admin' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reject request');
      }

      toast({
        title: 'Request rejected',
        description: 'The settings change request has been rejected.',
        variant: 'success',
      });

      // Reload pending requests
      await loadPendingRequests();
    } catch (error: any) {
      console.error('Reject request error:', error);
      toast({
        title: 'Failed to reject request',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!user?.token) return;
    setSaving(true);
    try {
      // Convert JWT duration to seconds
      let jwtDurationInSeconds = jwtDurationValue;
      if (jwtDurationUnit === 'minutes') {
        jwtDurationInSeconds = jwtDurationValue * 60;
      } else if (jwtDurationUnit === 'hours') {
        jwtDurationInSeconds = jwtDurationValue * 3600;
      }
      
      const res = await fetch('http://localhost:5000/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          ...settings,
          jwtSessionDuration: jwtDurationInSeconds,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      
      // Reload settings to ensure consistency
      await loadSettings();
      
      toast({
        title: 'Settings saved',
        description: 'Your changes have been saved successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Save settings error:', error);
      toast({
        title: 'Failed to save settings',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitPending = async () => {
    if (!user?.token || user?.isSuperAdmin) return;
    setSubmitting(true);
    try {
      const fieldRequirements = {
        distributor: settings.fieldRequirements?.distributor || {},
        customer: settings.fieldRequirements?.customer || {},
      };

      const res = await fetch('http://localhost:5000/api/system-settings/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ fieldRequirements }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to submit changes');
      }

      const data = await res.json();
      setPendingChange(data);
      toast({
        title: 'Changes submitted',
        description: 'Your changes have been submitted for super admin approval.',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Submit pending error:', error);
      toast({
        title: 'Failed to submit changes',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 pt-28 pb-12">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 pt-28 pb-12 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          <div>
            <h1 className="font-serif text-3xl font-medium mb-1">System Settings</h1>
            <p className="text-muted-foreground">
              {user?.isSuperAdmin ? 'Configure global system preferences' : ''}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Global Configuration - Super Admin Only */}
          {user?.isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Global Configuration</CardTitle>
                <CardDescription>Email settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress">Email From Address</Label>
                  <Input
                    id="emailFromAddress"
                    type="email"
                    value={settings.emailFromAddress || ''}
                    onChange={(e) => setSettings({ ...settings, emailFromAddress: e.target.value })}
                    placeholder="noreply@yourcompany.com"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="smtpStatus">SMTP Status</Label>
                    <p className="text-sm text-muted-foreground">Email sending service status</p>
                  </div>
                  <Switch
                    id="smtpStatus"
                    checked={settings.smtpStatus === 'active'}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, smtpStatus: checked ? 'active' : 'inactive' })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Authentication & Security - Super Admin Only */}
          {user?.isSuperAdmin && (
            <Card>
            <CardHeader>
              <CardTitle>Authentication & Security</CardTitle>
              <CardDescription>
                {user?.isSuperAdmin ? 'JWT session and password policy settings' : 'JWT session and password policy settings (read-only)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jwtSessionDuration">JWT Session Duration</Label>
                <div className="flex gap-2">
                  <Input
                    id="jwtSessionDuration"
                    type="number"
                    min="1"
                    value={jwtDurationValue}
                    onChange={(e) => setJwtDurationValue(Number(e.target.value))}
                    className="flex-1"
                    disabled={!user?.isSuperAdmin}
                  />
                  <Select 
                    value={jwtDurationUnit} 
                    onValueChange={(value: 'seconds' | 'minutes' | 'hours') => setJwtDurationUnit(value)}
                    disabled={!user?.isSuperAdmin}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">Password Minimum Length</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  min="6"
                  max="32"
                  value={settings.passwordMinLength || 8}
                  onChange={(e) =>
                    setSettings({ ...settings, passwordMinLength: Number(e.target.value) })
                  }
                  disabled={!user?.isSuperAdmin}
                />
              </div>
              <div className="space-y-3">
                <Label>Password Requirements</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireUppercase" className="font-normal">
                      Require uppercase letters
                    </Label>
                    <Switch
                      id="requireUppercase"
                      checked={settings.passwordRequireUppercase || false}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, passwordRequireUppercase: checked })
                      }
                      disabled={!user?.isSuperAdmin}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireLowercase" className="font-normal">
                      Require lowercase letters
                    </Label>
                    <Switch
                      id="requireLowercase"
                      checked={settings.passwordRequireLowercase || false}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, passwordRequireLowercase: checked })
                      }
                      disabled={!user?.isSuperAdmin}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireNumbers" className="font-normal">
                      Require numbers
                    </Label>
                    <Switch
                      id="requireNumbers"
                      checked={settings.passwordRequireNumbers || false}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, passwordRequireNumbers: checked })
                      }
                      disabled={!user?.isSuperAdmin}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireSpecialChars" className="font-normal">
                      Require special characters
                    </Label>
                    <Switch
                      id="requireSpecialChars"
                      checked={settings.passwordRequireSpecialChars || false}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, passwordRequireSpecialChars: checked })
                      }
                      disabled={!user?.isSuperAdmin}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* App Behavior - Super Admin Only */}
          {user?.isSuperAdmin && (
            <Card>
            <CardHeader>
              <CardTitle>App Behavior</CardTitle>
              <CardDescription>
                {user?.isSuperAdmin ? 'Feature toggles and notification preferences' : 'Feature toggles and notification preferences (read-only)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notificationEmail">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via email</p>
                </div>
                <Switch
                  id="notificationEmail"
                  checked={settings.notificationEmailEnabled !== false}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notificationEmailEnabled: checked })
                  }
                  disabled={!user?.isSuperAdmin}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notificationOnSite">On-Site Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                </div>
                <Switch
                  id="notificationOnSite"
                  checked={settings.notificationOnSiteEnabled !== false}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notificationOnSiteEnabled: checked })
                  }
                  disabled={!user?.isSuperAdmin}
                />
              </div>
            </CardContent>
          </Card>
          )}

          {/* Pending Approval Requests - Super Admin Only */}
          {user?.isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Approval Requests
                </CardTitle>
                <CardDescription>
                  Review and approve field requirement changes submitted by admins
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No pending approval requests
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => {
                      const requestedBy = request.requestedBy;
                      const fieldReqs = request.fieldRequirements || {};
                      const distributorReqs = fieldReqs.distributor || {};
                      const customerReqs = fieldReqs.customer || {};
                      const createdAt = new Date(request.createdAt).toLocaleString();

                      return (
                        <div
                          key={request._id}
                          className="border border-border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                Requested by: {requestedBy?.name || 'Unknown'} ({requestedBy?.email || 'N/A'})
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Submitted on: {createdAt}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-border">
                            <p className="text-sm font-medium mb-2">Requested Changes:</p>
                            
                            {Object.keys(distributorReqs).length > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
                                  Distributor Role:
                                </p>
                                <div className="space-y-1.5">
                                  {Object.entries(distributorReqs).map(([key, requestedValue]) => {
                                    const currentValue = settings.fieldRequirements?.distributor?.[key as keyof typeof settings.fieldRequirements.distributor] || false;
                                    const fieldName = key === 'registrationNo' || key === 'registrationCopy'
                                      ? 'Registration'
                                      : key.replace(/([A-Z])/g, ' $1').trim();
                                    const hasChanged = currentValue !== requestedValue;
                                    
                                    return (
                                      <div key={key} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground capitalize">{fieldName}:</span>
                                        <div className="flex items-center gap-2">
                                          {hasChanged && (
                                            <span className="text-gray-500 line-through">
                                              {currentValue ? 'Required' : 'Optional'}
                                            </span>
                                          )}
                                          <span className={`font-medium ${requestedValue ? 'text-green-600' : 'text-gray-400'}`}>
                                            {requestedValue ? 'Required' : 'Optional'}
                                          </span>
                                          {hasChanged && <span className="text-blue-600">→</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {Object.keys(customerReqs).length > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
                                  Customer Role:
                                </p>
                                <div className="space-y-1.5">
                                  {Object.entries(customerReqs).map(([key, requestedValue]) => {
                                    const currentValue = settings.fieldRequirements?.customer?.[key as keyof typeof settings.fieldRequirements.customer] || false;
                                    const fieldName = key === 'registrationNo' || key === 'registrationCopy'
                                      ? 'Registration'
                                      : key.replace(/([A-Z])/g, ' $1').trim();
                                    const hasChanged = currentValue !== requestedValue;
                                    
                                    return (
                                      <div key={key} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground capitalize">{fieldName}:</span>
                                        <div className="flex items-center gap-2">
                                          {hasChanged && (
                                            <span className="text-gray-500 line-through">
                                              {currentValue ? 'Required' : 'Optional'}
                                            </span>
                                          )}
                                          <span className={`font-medium ${requestedValue ? 'text-green-600' : 'text-gray-400'}`}>
                                            {requestedValue ? 'Required' : 'Optional'}
                                          </span>
                                          {hasChanged && <span className="text-blue-600">→</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApplyChanges(request)}
                                className="flex-1"
                              >
                                Apply Changes to Settings
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(request._id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(request._id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Field Requirements - Admin can edit distributor and customer, Super Admin can edit all */}
          {(user?.isSuperAdmin || user?.role === 'admin') && (
            <Card>
              <CardHeader>
                <CardTitle>Field Requirements</CardTitle>
                <CardDescription>
                  {user?.isSuperAdmin 
                    ? 'Configure which fields are mandatory for each role during user creation'
                    : 'Configure which fields are mandatory for distributor and customer roles (requires super admin approval)'}
                </CardDescription>
                {pendingChange && !user?.isSuperAdmin && (
                  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      You have a pending change request awaiting super admin approval.
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {(user?.isSuperAdmin ? ['admin', 'distributor', 'customer'] : ['distributor', 'customer']).map((role) => (
                  <div key={role} className="space-y-3 border-b border-border pb-4 last:border-0">
                    <h3 className="font-medium capitalize">{role} Role</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'mobileNo', label: 'Mobile Number' },
                        { key: 'businessName', label: 'Business Name' },
                        { key: 'address', label: 'Address' },
                        { key: 'registration', label: 'Registration (Number OR Copy)' },
                      ].map((field) => {
                        // For registration, check if either registrationNo or registrationCopy is enabled
                        const isRegistration = field.key === 'registration';
                        // Use fieldRequirements state - get fresh value each render
                        const roleReqs = fieldRequirements[role as 'admin' | 'distributor' | 'customer'] || settings.fieldRequirements?.[role] || {};
                        const checkedValue = isRegistration
                          ? Boolean(roleReqs.registrationNo || roleReqs.registrationCopy)
                          : Boolean(roleReqs[field.key as keyof typeof roleReqs]);
                        
                        return (
                          <div key={field.key} className="flex items-center justify-between">
                            <Label htmlFor={`${role}-${field.key}`} className="font-normal text-sm">
                              {field.label}
                            </Label>
                            <Switch
                              key={`${role}-${field.key}-v${fieldReqsVersion}-${checkedValue}`}
                              id={`${role}-${field.key}`}
                              checked={checkedValue}
                              defaultChecked={checkedValue}
                              onCheckedChange={(checked) => {
                                const updatedRoleReqs = {
                                  ...(fieldRequirements[role as 'admin' | 'distributor' | 'customer'] || settings.fieldRequirements?.[role] || {}),
                                };
                                
                                if (isRegistration) {
                                  updatedRoleReqs.registrationNo = checked;
                                  updatedRoleReqs.registrationCopy = checked;
                                } else {
                                  updatedRoleReqs[field.key as keyof typeof updatedRoleReqs] = checked;
                                }
                                
                                // Update both states
                                const updatedFieldReqs = {
                                  ...fieldRequirements,
                                  [role]: updatedRoleReqs,
                                };
                                setFieldRequirements(updatedFieldReqs);
                                
                                setSettings({
                                  ...settings,
                                  fieldRequirements: {
                                    ...settings.fieldRequirements,
                                    [role]: updatedRoleReqs,
                                  },
                                });
                                
                                // Increment version to ensure UI updates
                                setFieldReqsVersion(prev => prev + 1);
                              }}
                              disabled={!user?.isSuperAdmin && role === 'admin'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            {user?.isSuperAdmin ? (
              <>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitPending} disabled={submitting || !!pendingChange}>
                  <Save className="mr-2 h-4 w-4" />
                  {submitting ? 'Submitting...' : pendingChange ? 'Pending Approval' : 'Submit for Approval'}
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SystemSettings;

