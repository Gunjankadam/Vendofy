import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Camera, User2, Lock, Bell, Settings, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Header = () => {
  const { isAuthenticated, logout, user, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const roleLabel = (() => {
    if (!user) return '';
    if (user.isSuperAdmin && user.role === 'admin') {
      return 'super administrator';
    }
    return user.role;
  })();

  const initials = (() => {
    if (!user) return '';
    if (user.name) {
      const parts = user.name.trim().split(' ');
      const first = parts[0]?.[0] ?? '';
      const second = parts[1]?.[0] ?? '';
      return (first + second).toUpperCase() || first.toUpperCase();
    }
    const emailFirst = user.email?.[0] ?? '';
    return emailFirst.toUpperCase();
  })();

  const isSuperAdmin = user?.isSuperAdmin && user.role === 'admin';

  // Load notifications
  useEffect(() => {
    if (!user?.token || user.role !== 'admin') return;

    const loadNotifications = async () => {
      try {
        let count = 0;

        if (isSuperAdmin) {
          // Super admin: pending settings changes and pending product approvals (NO order notifications)
          const [pendingSettings, pendingProducts] = await Promise.all([
            fetch(getApiUrl('/api/system-settings/pending'), {
              headers: { Authorization: `Bearer ${user.token}` },
            }).then(res => res.ok ? res.json() : []).catch(() => []),
            fetch(getApiUrl('/api/products/pending'), {
              headers: { Authorization: `Bearer ${user.token}` },
            }).then(res => res.ok ? res.json() : []).catch(() => [])
          ]);

          count = (pendingSettings?.length || 0) + (pendingProducts?.length || 0);
        } else {
          // Regular admin: order notifications only
          const { cachedFetch } = await import('@/lib/cached-fetch');
          const notifications = await cachedFetch<any[]>('/api/admin/order-notifications', user.token, { skipCache: true });
          count = notifications?.length || 0;
        }

        setNotificationCount(count);
      } catch (error) {
        console.error('Failed to load notifications', error);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [user?.token, user?.role, isSuperAdmin]);

  const handleNotificationClick = (type: 'orders' | 'settings' | 'products') => {
    if (type === 'orders') {
      navigate('/admin/order-notifications');
    } else if (type === 'settings') {
      navigate('/system-settings');
    } else if (type === 'products') {
      navigate('/product-management');
    }
    setNotificationsOpen(false);
  };

  const handleEditPhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.token) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const avatarData = reader.result as string;
        const res = await fetch(getApiUrl('/api/user/profile-photo'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ avatarData }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (data.avatarUrl) {
          updateUser({ avatarUrl: data.avatarUrl });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update profile photo', error);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsDataURL(file);
  };

  const handleEditNameClick = () => {
    if (isSuperAdmin) return;
    setNewName(user?.name || '');
    setEditNameOpen(true);
  };

  const handleSaveName = async () => {
    if (!user?.token || !newName.trim()) return;

    try {
      const res = await fetch(getApiUrl('/api/user/name'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update name');
      }

      const data = await res.json();
      updateUser({ name: data.name });
      setEditNameOpen(false);
      toast({
        title: 'Name updated',
        description: 'Your name has been updated successfully.',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Failed to update name', error);
      toast({
        title: 'Failed to update name',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-sans text-xl font-bold tracking-tight">
          Vendofy
        </Link>

        <nav className="flex items-center gap-6">
          {isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-black dark:text-white hover:text-primary transition-colors"
              >
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="relative flex items-center justify-center rounded-full border border-border bg-card h-10 w-10 hover:border-foreground/60 transition-colors"
                    >
                      <Bell size={18} className="text-foreground" />
                      {notificationCount > 0 && (
                        <>
                          <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background"></span>
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {notificationCount > 9 ? '9+' : notificationCount}
                          </span>
                        </>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isSuperAdmin ? (
                      <>
                        {/* Super admin: pending settings and products (NO order notifications) */}
                        <DropdownMenuItem
                          className="flex items-center gap-2 text-sm cursor-pointer"
                          onClick={() => handleNotificationClick('settings')}
                        >
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">Pending Settings Changes</span>
                            <span className="text-xs text-muted-foreground">
                              Settings change requests awaiting approval
                            </span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2 text-sm cursor-pointer"
                          onClick={() => handleNotificationClick('products')}
                        >
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">Pending Product Approvals</span>
                            <span className="text-xs text-muted-foreground">
                              Products awaiting review and approval
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-sm cursor-pointer"
                        onClick={() => handleNotificationClick('orders')}
                      >
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium">Order Notifications</span>
                          <span className="text-xs text-muted-foreground">
                            {notificationCount > 0 ? `${notificationCount} new order(s)` : 'No new orders'}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                    {notificationCount === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No new notifications
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-full border border-border bg-card h-11 w-11 hover:border-foreground/60 transition-colors"
                  >
                    <Avatar className="h-9 w-9" key={user.avatarUrl || 'no-avatar'}>
                      {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {initials || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">
                      {isSuperAdmin ? 'Super Administrator' : user.name || user.email}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {roleLabel}
                    </span>
                    {user.uid && (
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">
                        UID: {user.uid}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-sm"
                    onClick={handleEditPhotoClick}
                  >
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span>Edit profile photo</span>
                  </DropdownMenuItem>
                  {user.avatarUrl && (
                    <DropdownMenuItem
                      className="flex items-center gap-2 text-sm"
                      onClick={async () => {
                        if (!user.token) return;
                        try {
                          const res = await fetch(getApiUrl('/api/user/profile-photo/remove'), {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${user.token}`,
                            },
                          });
                          if (!res.ok) return;
                          updateUser({ avatarUrl: undefined });
                        } catch (error) {
                          // eslint-disable-next-line no-console
                          console.error('Failed to remove profile photo', error);
                        }
                      }}
                    >
                      <Camera className="h-4 w-4 text-muted-foreground rotate-180" />
                      <span>Remove photo</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-sm"
                    disabled={isSuperAdmin}
                    onClick={handleEditNameClick}
                  >
                    {isSuperAdmin ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{isSuperAdmin ? 'Edit name locked' : 'Edit name'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-sm"
                    onClick={() => navigate('/system-settings')}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>System Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-sm text-destructive focus:text-destructive"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-sm">
                Login
              </Button>
            </Link>
          )}
        </nav>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
            <DialogDescription>
              Update your display name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSaveName();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
