import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { getCachedEtag, setCachedResponse, getCachedResponse } from '@/lib/api-cache';
import Header from '@/components/Header';
import abstractImage from '@/assets/abstract-login.jpg';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, ShieldAlert, Plus, Pencil, Trash2, Sparkles, Upload, X, Loader2, Users, Filter, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';


// InfoTooltip component
const InfoTooltip = ({ infoText }: { infoText: string }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setOpen((prev) => !prev);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={isMobile ? open : undefined} onOpenChange={isMobile ? setOpen : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center"
            onClick={handleClick}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Info size={16} className="text-primary/70 hover:text-primary transition-colors cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{infoText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'distributor' | 'customer' | 'super-admin';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  uid?: string;
  mobileNo?: string;
  businessName?: string;
  address?: {
    address1?: string;
    address2?: string;
    city?: string;
    district?: string;
    pin?: string;
    state?: string;
    country?: string;
  };
  registrationNo?: string;
  registrationCopyUrl?: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  parentId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

const UserManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<{ total: number; admin: number; distributor: number; customer: number } | null>(null);
  const [usersHierarchyFilter, setUsersHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [showUsersHierarchy, setShowUsersHierarchy] = useState(false);
  const [usersLevel, setUsersLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [usersParentId, setUsersParentId] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer' as 'admin' | 'distributor' | 'customer',
    isActive: true,
    uid: '',
    mobileNo: '',
    businessName: '',
    address: {
      address1: '',
      address2: '',
      city: '',
      district: '',
      pin: '',
      state: '',
      country: '',
    },
    registrationNo: '',
    registrationCopyUrl: '',
  });

  const [suggestedUID, setSuggestedUID] = useState('');
  const [checkingUID, setCheckingUID] = useState(false);
  const [uploadingRegCopy, setUploadingRegCopy] = useState(false);
  const [registrationType, setRegistrationType] = useState<'number' | 'copy' | 'none'>('none');

  useEffect(() => {
    if (!isAuthenticated || (!user?.isSuperAdmin && user?.role !== 'admin' && user?.role !== 'distributor')) {
      navigate('/dashboard');
      return;
    }
    void loadUsers();
    void loadUserStats();
  }, [isAuthenticated, user, navigate]);

  const loadUserStats = async () => {
    if (!user?.token) return;
    try {
      setLoadingStats(true);
      const params = new URLSearchParams();
      if (usersHierarchyFilter !== 'all') {
        params.append('level', usersHierarchyFilter);
        if (usersParentId) params.append('parentId', usersParentId);
      }

      const url = getApiUrl(`/api/admin/users/stats?${params.toString()}`);
      const headers: HeadersInit = {
        Authorization: `Bearer ${user.token}`,
      };

      const cachedEtag = getCachedEtag(url);
      if (cachedEtag) {
        headers['If-None-Match'] = cachedEtag;
      }

      const res = await fetch(url, { headers });

      if (res.status === 304) {
        const cached = getCachedResponse(url);
        if (cached) {
          setUserStats(cached);
        }
        setLoadingStats(false);
        return;
      }

      if (!res.ok) throw new Error('Failed to load user stats');
      const data = await res.json();

      const etag = res.headers.get('ETag');
      if (etag) {
        setCachedResponse(url, etag, data);
      }

      setUserStats(data);
    } catch (error) {
      console.error('Failed to load user stats', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Reload stats when filter changes
  useEffect(() => {
    void loadUserStats();
  }, [usersHierarchyFilter, usersParentId]);

  // Reload users when filters change (with debounce for search)
  useEffect(() => {
    if (!isAuthenticated || (!user?.isSuperAdmin && user?.role !== 'admin' && user?.role !== 'distributor') || !user?.token) {
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      void loadUsers();
    }, search ? 300 : 0);

    return () => clearTimeout(timeoutId);
  }, [search, roleFilter, statusFilter, user?.token]);

  const loadUsers = async () => {
    if (!user?.token) return;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const { cachedFetch } = await import('@/lib/cached-fetch');
      const data = await cachedFetch(`/api/admin/users?${params.toString()}`, user.token);
      setUsers(data);
    } catch (error: any) {
      console.error('Load users error:', error);
      toast({
        title: 'Failed to load users',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestUID = async () => {
    try {
      const params = new URLSearchParams();
      params.append('role', formData.role);
      if (formData.businessName) params.append('businessName', formData.businessName);
      if (formData.name) params.append('name', formData.name);

      const res = await fetch(getApiUrl(`/api/admin/users/suggest-uid?${params.toString()}`), {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to suggest UID');
      const data = await res.json();
      setSuggestedUID(data.uid);
      setFormData((prev) => ({ ...prev, uid: data.uid }));
    } catch (error) {
      console.error('Suggest UID error:', error);
      toast({
        title: 'Failed to suggest UID',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const checkUID = async (uid: string) => {
    if (!uid.trim()) return;
    setCheckingUID(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/check-uid/${uid}`), {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to check UID');
      const data = await res.json();
      if (data.exists) {
        toast({
          title: 'UID already exists',
          description: 'Please enter a different UID.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Check UID error:', error);
    } finally {
      setCheckingUID(false);
    }
  };

  const handleRegCopyUpload = async (file: File) => {
    setUploadingRegCopy(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const res = await fetch(getApiUrl('/api/user/profile-photo'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({ avatarData: base64Data }),
        });
        if (!res.ok) throw new Error('Failed to upload registration copy');
        const data = await res.json();
        setFormData((prev) => ({ ...prev, registrationCopyUrl: data.avatarUrl }));
        toast({
          title: 'Registration copy uploaded',
          description: 'The document has been uploaded successfully.',
          variant: 'success',
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload registration copy error:', error);
      toast({
        title: 'Failed to upload registration copy',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingRegCopy(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'distributor' | 'customer') => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/role`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u)),
      );
      toast({
        title: 'Role updated',
        description: 'User role has been updated.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Update role error:', error);
      toast({
        title: 'Failed to update role',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusToggle = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive } : u)),
      );
      toast({
        title: isActive ? 'User activated' : 'User deactivated',
        description: isActive
          ? 'The user account is now active.'
          : 'The user account has been deactivated.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Update status error:', error);
      toast({
        title: 'Failed to update status',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleForceReset = async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/force-reset`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to force reset');
      }

      toast({
        title: 'Password reset required',
        description: 'The user will be required to reset their password on next login.',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Force reset error:', error);
      toast({
        title: 'Failed to force reset',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: user?.role === 'distributor' ? 'customer' : 'customer', // Default to customer
      isActive: true,
      uid: '',
      mobileNo: '',
      businessName: '',
      address: {
        address1: '',
        address2: '',
        city: '',
        district: '',
        pin: '',
        state: '',
        country: '',
      },
      registrationNo: '',
      registrationCopyUrl: '',
    });
    setSuggestedUID('');
    setRegistrationType('none');
  };

  const handleAddUser = async () => {
    try {
      if (!formData.name || !formData.email || !formData.password) {
        toast({
          title: 'Validation error',
          description: 'Name, email, and password are required.',
          variant: 'destructive',
        });
        return;
      }

      const res = await fetch(getApiUrl('/api/admin/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          ...formData,
          address: Object.values(formData.address).some((v) => v) ? formData.address : undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create user');
      }

      toast({
        title: 'User created',
        description: 'The user has been created successfully.',
        variant: 'success',
      });

      setAddDialogOpen(false);
      resetForm();
      void loadUsers();
    } catch (error: any) {
      console.error('Add user error:', error);
      toast({
        title: 'Failed to create user',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      if (!formData.name || !formData.email) {
        toast({
          title: 'Validation error',
          description: 'Name and email are required.',
          variant: 'destructive',
        });
        return;
      }

      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
        uid: formData.uid || undefined,
        mobileNo: formData.mobileNo || undefined,
        businessName: formData.businessName || undefined,
        address: Object.values(formData.address).some((v) => v) ? formData.address : undefined,
        registrationNo: formData.registrationNo || undefined,
        registrationCopyUrl: formData.registrationCopyUrl || undefined,
      };

      if (formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      const res = await fetch(getApiUrl(`/api/admin/users/${selectedUser._id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update user');
      }

      toast({
        title: 'User updated',
        description: 'The user has been updated successfully.',
        variant: 'success',
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      void loadUsers();
    } catch (error: any) {
      console.error('Edit user error:', error);
      toast({
        title: 'Failed to update user',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${selectedUser._id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      toast({
        title: 'User deleted',
        description: 'The user has been deleted successfully.',
        variant: 'success',
      });

      setDeleteDialogOpen(false);
      setSelectedUser(null);
      void loadUsers();
    } catch (error: any) {
      console.error('Delete user error:', error);
      toast({
        title: 'Failed to delete user',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (userData: ManagedUser) => {
    setSelectedUser(userData);
    const hasRegNo = !!userData.registrationNo;
    const hasRegCopy = !!userData.registrationCopyUrl;
    setFormData({
      name: userData.name,
      email: userData.email,
      password: '',
      role: userData.role === 'super-admin' ? 'admin' : userData.role,
      isActive: userData.isActive,
      uid: userData.uid || '',
      mobileNo: userData.mobileNo || '',
      businessName: userData.businessName || '',
      address: {
        address1: userData.address?.address1 || '',
        address2: userData.address?.address2 || '',
        city: userData.address?.city || '',
        district: userData.address?.district || '',
        pin: userData.address?.pin || '',
        state: userData.address?.state || '',
        country: userData.address?.country || '',
      },
      registrationNo: userData.registrationNo || '',
      registrationCopyUrl: userData.registrationCopyUrl || '',
    });
    setRegistrationType(hasRegNo ? 'number' : hasRegCopy ? 'copy' : 'none');
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (userData: ManagedUser) => {
    setSelectedUser(userData);
    setDeleteDialogOpen(true);
  };

  const filteredUsers = useMemo(() => users, [users]);

  const renderUserForm = (isEdit = false) => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1 pr-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Enter email"
          />
        </div>
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Enter password"
          />
        </div>
      )}

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="password">New Password (leave blank to keep current)</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Enter new password"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={(value: 'admin' | 'distributor' | 'customer') => {
              setFormData((prev) => ({ ...prev, role: value }));
              if (!isEdit) {
                setFormData((prev) => ({ ...prev, uid: '' }));
                setSuggestedUID('');
              }
            }}
            disabled={user?.role === 'distributor'} // Distributors can only create customers
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {user?.isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
              {(user?.isSuperAdmin || user?.role === 'admin') && <SelectItem value="distributor">Distributor</SelectItem>}
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
          {user?.role === 'distributor' && (
            <p className="text-xs text-muted-foreground">Distributors can only create customers</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="uid">
            UID
            {!isEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2"
                onClick={suggestUID}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Suggest
              </Button>
            )}
          </Label>
          <Input
            id="uid"
            value={formData.uid}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, uid: e.target.value }));
              if (e.target.value && !checkingUID) {
                void checkUID(e.target.value);
              }
            }}
            onBlur={() => {
              if (formData.uid) void checkUID(formData.uid);
            }}
            placeholder="Enter or generate UID"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mobileNo">Mobile Number</Label>
          <Input
            id="mobileNo"
            value={formData.mobileNo}
            onChange={(e) => setFormData((prev) => ({ ...prev, mobileNo: e.target.value }))}
            placeholder="Enter mobile number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            value={formData.businessName}
            onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
            placeholder="Enter business name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <div className="space-y-2">
          <Input
            placeholder="Address Line 1"
            value={formData.address.address1}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                address: { ...prev.address, address1: e.target.value },
              }))
            }
          />
          <Input
            placeholder="Address Line 2"
            value={formData.address.address2}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                address: { ...prev.address, address2: e.target.value },
              }))
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="City"
              value={formData.address.city}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address: { ...prev.address, city: e.target.value },
                }))
              }
            />
            <Input
              placeholder="District"
              value={formData.address.district}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address: { ...prev.address, district: e.target.value },
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="PIN Code"
              value={formData.address.pin}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address: { ...prev.address, pin: e.target.value },
                }))
              }
            />
            <Input
              placeholder="State"
              value={formData.address.state}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address: { ...prev.address, state: e.target.value },
                }))
              }
            />
          </div>
          <Input
            placeholder="Country"
            value={formData.address.country}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                address: { ...prev.address, country: e.target.value },
              }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Registration Number OR Registration Copy</Label>
        <Select
          value={registrationType}
          onValueChange={(value: 'number' | 'copy' | 'none') => {
            setRegistrationType(value);
            if (value === 'none') {
              setFormData((prev) => ({ ...prev, registrationNo: '', registrationCopyUrl: '' }));
            } else if (value === 'number') {
              setFormData((prev) => ({ ...prev, registrationCopyUrl: '' }));
            } else if (value === 'copy') {
              setFormData((prev) => ({ ...prev, registrationNo: '' }));
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select registration type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="number">Registration Number</SelectItem>
            <SelectItem value="copy">Registration Copy</SelectItem>
          </SelectContent>
        </Select>
        {registrationType === 'number' && (
          <div className="space-y-2">
            <Label htmlFor="registrationNo" className="text-sm text-muted-foreground">
              Registration Number
            </Label>
            <Input
              id="registrationNo"
              value={formData.registrationNo}
              onChange={(e) => setFormData((prev) => ({ ...prev, registrationNo: e.target.value }))}
              placeholder="Enter registration number"
            />
          </div>
        )}
        {registrationType === 'copy' && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Registration Copy</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                id="regCopyUpload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleRegCopyUpload(file);
                }}
              />
              <Label
                htmlFor="regCopyUpload"
                className="flex-1 cursor-pointer border border-border rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                {formData.registrationCopyUrl ? 'Change file' : 'Upload file'}
              </Label>
              {formData.registrationCopyUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, registrationCopyUrl: '' }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {formData.registrationCopyUrl && (
              <p className="text-xs text-muted-foreground">File uploaded</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active
        </Label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background relative">
      {/* Fixed abstract background */}
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
      <Header />
      <main className="container mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 max-w-6xl relative z-10">
        <div className="flex items-center gap-4 mb-4 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="rounded-full shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-sans text-2xl md:text-4xl font-bold mb-1 tracking-tight">User Management</h1>
            <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-400">Add, edit, or remove user accounts</p>
          </div>
        </div>

        {/* Total Users Stats Card */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Total Users</CardTitle>
                <InfoTooltip infoText="View total users with filters for hierarchy" />
              </div>
              <div className="text-primary hover:text-primary transition-colors flex items-center gap-2">
                <Users size={20} className="text-primary hover:scale-110 transition-transform" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-foreground" />
                    <Label className="text-xs font-medium">Hierarchy:</Label>
                    <Select
                      value={usersHierarchyFilter}
                      onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                        setUsersHierarchyFilter(value);
                        if (value === 'all') {
                          setShowUsersHierarchy(false);
                          setUsersLevel(null);
                          setUsersParentId(null);
                        } else {
                          setShowUsersHierarchy(true);
                          setUsersLevel(value);
                          setUsersParentId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {user?.isSuperAdmin && <SelectItem value="admin">By Admin</SelectItem>}
                        {user?.role !== 'distributor' && <SelectItem value="distributor">By Distributor</SelectItem>}
                        <SelectItem value="customer">By Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                  {loadingStats ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                  ) : (
                    (() => {
                      if (usersHierarchyFilter === 'all') {
                        return userStats?.total.toLocaleString() || '0';
                      } else if (usersHierarchyFilter === 'admin') {
                        return userStats?.admin.toLocaleString() || '0';
                      } else if (usersHierarchyFilter === 'distributor') {
                        return userStats?.distributor.toLocaleString() || '0';
                      } else if (usersHierarchyFilter === 'customer') {
                        return userStats?.customer.toLocaleString() || '0';
                      }
                      return userStats?.total.toLocaleString() || '0';
                    })()
                  )}
                </p>
                <CardDescription className="text-sm font-medium text-foreground/80">
                  All active accounts
                </CardDescription>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-40 space-y-1">
              <Label>Role</Label>
              <Select
                value={roleFilter}
                onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                  setRoleFilter(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {user?.isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                  {user?.role !== 'distributor' && <SelectItem value="distributor">Distributor</SelectItem>}
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => {
                  setStatusFilter(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">Users</CardTitle>
              <Button onClick={() => {
                resetForm();
                setAddDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading users...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 pr-4 font-medium">Associated With</th>
                        <th className="py-2 pr-4 font-medium">Role</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Last login</th>
                        <th className="py-2 pr-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u._id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-4">
                            <div className="flex flex-col">
                              <span className="font-medium">{u.name}</span>
                              <span className={`text-xs font-medium ${u.role === 'super-admin' ? 'text-purple-600 dark:text-purple-400' :
                                u.role === 'admin' ? 'text-blue-600 dark:text-blue-400' :
                                  u.role === 'distributor' ? 'text-green-600 dark:text-green-400' :
                                    'text-orange-600 dark:text-orange-400'
                                }`}>
                                {u.role === 'super-admin' ? 'Super Admin' : u.role}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-4">{u.email}</td>
                          <td className="py-2 pr-4">
                            {u.parentId ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{u.parentId.name}</span>
                                <span className={`text-xs ${u.parentId.role === 'super-admin' ? 'text-purple-600 dark:text-purple-400' :
                                  u.parentId.role === 'admin' ? 'text-blue-600 dark:text-blue-400' :
                                    u.parentId.role === 'distributor' ? 'text-green-600 dark:text-green-400' :
                                      'text-orange-600 dark:text-orange-400'
                                  }`}>{u.parentId.role === 'super-admin' ? 'Super Admin' : u.parentId.role}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {u.role === 'super-admin' ? (
                              <span className="text-xs text-muted-foreground">Locked</span>
                            ) : (
                              <Select
                                value={u.role}
                                onValueChange={(value: 'admin' | 'distributor' | 'customer') =>
                                  handleRoleChange(u._id, value)
                                }
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="distributor">Distributor</SelectItem>
                                  <SelectItem value="customer">Customer</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Switch
                                checked={u.isActive}
                                onCheckedChange={(checked) => handleStatusToggle(u._id, checked)}
                                disabled={u.role === 'super-admin'}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString()
                              : 'Never'}
                          </td>
                          <td className="py-2 pr-0">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={u.role === 'super-admin'}
                                onClick={() => openEditDialog(u)}
                                title="Edit user"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={u.role === 'super-admin'}
                                onClick={() => openDeleteDialog(u)}
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={u.role === 'super-admin'}
                                onClick={() => handleForceReset(u._id)}
                                title="Force password reset"
                              >
                                <ShieldAlert className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No users found.
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div key={u._id} className="border border-border/60 rounded-lg p-3 space-y-2 bg-background/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm truncate">{u.name}</span>
                              <span className={`text-xs font-medium ${u.role === 'super-admin' ? 'text-purple-600 dark:text-purple-400' :
                                u.role === 'admin' ? 'text-blue-600 dark:text-blue-400' :
                                  u.role === 'distributor' ? 'text-green-600 dark:text-green-400' :
                                    'text-orange-600 dark:text-orange-400'
                                }`}>
                                {u.role === 'super-admin' ? 'Super Admin' : u.role}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={u.role === 'super-admin'}
                              onClick={() => openEditDialog(u)}
                              title="Edit user"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={u.role === 'super-admin'}
                              onClick={() => openDeleteDialog(u)}
                              title="Delete user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="text-right truncate ml-2 flex-1">{u.email}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Associated With:</span>
                            <span className="text-right">
                              {u.parentId ? (
                                <div className="flex flex-col items-end">
                                  <span className="font-medium">{u.parentId.name}</span>
                                  <span className={`text-xs ${u.parentId.role === 'super-admin' ? 'text-purple-600 dark:text-purple-400' :
                                    u.parentId.role === 'admin' ? 'text-blue-600 dark:text-blue-400' :
                                      u.parentId.role === 'distributor' ? 'text-green-600 dark:text-green-400' :
                                        'text-orange-600 dark:text-orange-400'
                                    }`}>{u.parentId.role === 'super-admin' ? 'Super Admin' : u.parentId.role}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Role:</span>
                            <div>
                              {u.role === 'super-admin' ? (
                                <span className="text-muted-foreground">Locked</span>
                              ) : (
                                <Select
                                  value={u.role}
                                  onValueChange={(value: 'admin' | 'distributor' | 'customer') =>
                                    handleRoleChange(u._id, value)
                                  }
                                >
                                  <SelectTrigger className="h-7 w-24 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="distributor">Distributor</SelectItem>
                                    <SelectItem value="customer">Customer</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Switch
                                checked={u.isActive}
                                onCheckedChange={(checked) => handleStatusToggle(u._id, checked)}
                                disabled={u.role === 'super-admin'}
                              />
                              <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          {u.lastLoginAt && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last login:</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(u.lastLoginAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={u.role === 'super-admin'}
                              onClick={() => handleForceReset(u._id)}
                              title="Force password reset"
                            >
                              <ShieldAlert className="h-3 w-3 mr-1" />
                              Reset Password
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the required information.
            </DialogDescription>
          </DialogHeader>
          {renderUserForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep current password.
            </DialogDescription>
          </DialogHeader>
          {renderUserForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Alert Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
