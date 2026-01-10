import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Camera, User2, Lock } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newName, setNewName] = useState('');

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-serif text-xl font-medium tracking-tight">
          Vendofy
        </Link>
        
        <nav className="flex items-center gap-6">
          {isAuthenticated && user ? (
            <>
              <Link 
                to="/dashboard" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
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
