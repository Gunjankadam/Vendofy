import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import { getCachedEtag, setCachedResponse, getCachedResponse } from '@/lib/api-cache';
import Header from '@/components/Header';
import PasswordChangeNotification from '@/components/PasswordChangeNotification';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Package,
  ShoppingCart,
  Settings,
  TrendingUp,
  Truck,
  BarChart3,
  FileText,
  Bell,
  Heart,
  ChevronDown,
  ChevronRight,
  Loader2,
  Filter,
  Info
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  value?: string | React.ReactNode;
  onClick?: () => void;
  infoText?: string;
}

// InfoTooltip component that stays open on mobile tap
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

const DashboardCard = ({ title, description, icon, value, onClick, infoText }: DashboardCardProps) => (
  <Card
    className="h-full flex flex-col min-h-[110px] md:min-h-0 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl"
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base md:text-base font-semibold text-foreground">{title}</CardTitle>
        {infoText && <InfoTooltip infoText={infoText} />}
      </div>
      <div className="text-primary group-hover:text-primary transition-colors">
        <div className="group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
    </CardHeader>
    <CardContent className="flex-1 flex flex-col justify-between min-h-[80px] md:min-h-0">
      <div className="flex-1 flex flex-col justify-center">
        {value ? (
          <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
            {value}
          </p>
        ) : (
          <div className="h-[32px] md:h-0" /> // Spacer for cards without values on mobile
        )}
      </div>
      <CardDescription className="text-sm md:text-sm font-medium text-gray-600 dark:text-gray-400">{description}</CardDescription>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<{
    total: number;
    admin: number;
    distributor: number;
    customer: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [usersHierarchyFilter, setUsersHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [showUsersHierarchy, setShowUsersHierarchy] = useState(false);
  const [usersLevel, setUsersLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [usersParentId, setUsersParentId] = useState<string | null>(null);
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalOrders: number;
    breakdown?: Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>;
  } | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [ordersBreakdown, setOrdersBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showRevenueHierarchy, setShowRevenueHierarchy] = useState(false);
  const [revenueLevel, setRevenueLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [revenueParentId, setRevenueParentId] = useState<string | null>(null);
  const [showOrdersHierarchy, setShowOrdersHierarchy] = useState(false);
  const [ordersLevel, setOrdersLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [ordersParentId, setOrdersParentId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Filter states
  const [revenueHierarchyFilter, setRevenueHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [revenueDateFilter, setRevenueDateFilter] = useState<'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom'>('all');
  const [revenueMonth, setRevenueMonth] = useState<string>('');
  const [revenueYear, setRevenueYear] = useState<string>('');
  const [revenueStartDate, setRevenueStartDate] = useState<string>('');
  const [revenueEndDate, setRevenueEndDate] = useState<string>('');

  const [ordersHierarchyFilter, setOrdersHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [ordersDateFilter, setOrdersDateFilter] = useState<'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom'>('all');
  const [ordersMonth, setOrdersMonth] = useState<string>('');
  const [ordersYear, setOrdersYear] = useState<string>('');
  const [ordersStartDate, setOrdersStartDate] = useState<string>('');
  const [ordersEndDate, setOrdersEndDate] = useState<string>('');

  const isSuperAdmin = user?.isSuperAdmin && user.role === 'admin';

  useEffect(() => {
    const loadUserStats = async () => {
      if (!user?.token) return;
      try {
        setLoadingStats(true);

        // Build URL with filter parameters
        const params = new URLSearchParams();
        if (usersHierarchyFilter !== 'all') {
          params.append('level', usersHierarchyFilter);
          if (usersParentId) params.append('parentId', usersParentId);
        }

        const url = getApiUrl(`/api/admin/users/stats?${params.toString()}`);

        const headers: HeadersInit = {
          Authorization: `Bearer ${user.token}`,
        };

        // Add If-None-Match header if we have a cached ETag
        const cachedEtag = getCachedEtag(url);
        if (cachedEtag) {
          headers['If-None-Match'] = cachedEtag;
        }

        const res = await fetch(url, { headers });

        if (res.status === 304) {
          // Use cached data if available
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
        console.error('Load user stats error:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    void loadUserStats();
  }, [user?.token, usersHierarchyFilter, usersParentId]);

  // Separate useEffect for revenue filters - independent from orders
  useEffect(() => {
    if (!user?.token) return;
    const loadRevenue = async () => {
      try {
        setLoadingRevenue(true);

        // Build revenue params with filters
        const revenueParams = new URLSearchParams();
        if (revenueHierarchyFilter !== 'all') {
          revenueParams.append('level', revenueHierarchyFilter);
          if (revenueParentId) revenueParams.append('parentId', revenueParentId);
        }
        if (revenueDateFilter !== 'all') {
          revenueParams.append('dateFilter', revenueDateFilter);
          if (revenueDateFilter === 'month' && revenueMonth && revenueYear) {
            revenueParams.append('month', revenueMonth);
            revenueParams.append('year', revenueYear);
          } else if (revenueDateFilter === 'year' && revenueYear) {
            revenueParams.append('year', revenueYear);
          } else if (revenueDateFilter === 'custom' && revenueStartDate && revenueEndDate) {
            revenueParams.append('startDate', revenueStartDate);
            revenueParams.append('endDate', revenueEndDate);
          }
        }

        // Load revenue stats
        const revenueRes = await fetch(getApiUrl(`/api/admin/stats/revenue-orders?${revenueParams.toString()}`), {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!revenueRes.ok) throw new Error('Failed to load revenue stats');
        const revenueData = await revenueRes.json();
        setRevenueStats(prev => ({ ...prev, totalRevenue: revenueData.totalRevenue }));
        setRevenueBreakdown(revenueData.breakdown || []);
      } catch (error) {
        console.error('Load revenue error:', error);
      } finally {
        setLoadingRevenue(false);
      }
    };
    void loadRevenue();
  }, [user?.token, revenueLevel, revenueParentId, revenueHierarchyFilter, revenueDateFilter, revenueMonth, revenueYear, revenueStartDate, revenueEndDate]);

  // Separate useEffect for orders filters - independent from revenue
  useEffect(() => {
    if (!user?.token) return;
    const loadOrders = async () => {
      try {
        setLoadingOrders(true);

        // Build orders params with filters
        const ordersParams = new URLSearchParams();
        if (ordersHierarchyFilter !== 'all') {
          ordersParams.append('level', ordersHierarchyFilter);
          if (ordersParentId) ordersParams.append('parentId', ordersParentId);
        }
        if (ordersDateFilter !== 'all') {
          ordersParams.append('dateFilter', ordersDateFilter);
          if (ordersDateFilter === 'month' && ordersMonth && ordersYear) {
            ordersParams.append('month', ordersMonth);
            ordersParams.append('year', ordersYear);
          } else if (ordersDateFilter === 'year' && ordersYear) {
            ordersParams.append('year', ordersYear);
          } else if (ordersDateFilter === 'custom' && ordersStartDate && ordersEndDate) {
            ordersParams.append('startDate', ordersStartDate);
            ordersParams.append('endDate', ordersEndDate);
          }
        }

        // Load orders stats
        const ordersRes = await fetch(getApiUrl(`/api/admin/stats/revenue-orders?${ordersParams.toString()}`), {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!ordersRes.ok) throw new Error('Failed to load orders stats');
        const ordersData = await ordersRes.json();
        setRevenueStats(prev => ({ ...prev, totalOrders: ordersData.totalOrders }));
        setOrdersBreakdown(ordersData.breakdown || []);
      } catch (error) {
        console.error('Load orders error:', error);
      } finally {
        setLoadingOrders(false);
      }
    };
    void loadOrders();
  }, [user?.token, ordersLevel, ordersParentId, ordersHierarchyFilter, ordersDateFilter, ordersMonth, ordersYear, ordersStartDate, ordersEndDate]);

  useEffect(() => {
    // Mark initial load as complete when stats, revenue, and orders are loaded
    if (!loadingStats && !loadingRevenue && !loadingOrders && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loadingStats, loadingRevenue, isInitialLoad]);

  // loadRevenueOrders function removed - now split into separate useEffects above for independent filtering

  const handleRevenueClick = (level: 'admin' | 'distributor' | 'customer' | null, parentId: string | null = null) => {
    if (level === 'admin') {
      setRevenueLevel('admin');
      setRevenueParentId(null);
      setRevenueHierarchyFilter('admin');
    } else if (level === 'distributor' && parentId) {
      setRevenueLevel('distributor');
      setRevenueParentId(parentId);
      setRevenueHierarchyFilter('distributor');
    } else if (level === 'customer' && parentId) {
      setRevenueLevel('customer');
      setRevenueParentId(parentId);
      setRevenueHierarchyFilter('customer');
    } else {
      setShowRevenueHierarchy(false);
      setRevenueLevel(null);
      setRevenueParentId(null);
      setRevenueHierarchyFilter('all');
    }
  };

  const handleOrdersClick = (level: 'admin' | 'distributor' | 'customer' | null, parentId: string | null = null) => {
    if (level === 'admin') {
      setOrdersLevel('admin');
      setOrdersParentId(null);
      setOrdersHierarchyFilter('admin');
    } else if (level === 'distributor' && parentId) {
      setOrdersLevel('distributor');
      setOrdersParentId(parentId);
      setOrdersHierarchyFilter('distributor');
    } else if (level === 'customer' && parentId) {
      setOrdersLevel('customer');
      setOrdersParentId(parentId);
      setOrdersHierarchyFilter('customer');
    } else {
      setShowOrdersHierarchy(false);
      setOrdersLevel(null);
      setOrdersParentId(null);
      setOrdersHierarchyFilter('all');
    }
  };

  const handleUsersClick = (level: 'admin' | 'distributor' | 'customer' | null, parentId: string | null = null) => {
    if (level === 'admin') {
      setUsersLevel('admin');
      setUsersParentId(null);
      setUsersHierarchyFilter('admin');
    } else if (level === 'distributor' && parentId) {
      setUsersLevel('distributor');
      setUsersParentId(parentId);
      setUsersHierarchyFilter('distributor');
    } else if (level === 'customer' && parentId) {
      setUsersLevel('customer');
      setUsersParentId(parentId);
      setUsersHierarchyFilter('customer');
    } else {
      setShowUsersHierarchy(false);
      setUsersLevel(null);
      setUsersParentId(null);
      setUsersHierarchyFilter('all');
    }
  };

  // Show loading screen during initial load
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 md:gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base font-medium text-foreground/80">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="relative overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl">
        <h2 className="font-sans text-2xl md:text-4xl font-bold mb-1 text-foreground tracking-tight">
          {isSuperAdmin ? 'Super Administrator Dashboard' : (user?.businessName ? `${user.businessName.charAt(0).toUpperCase() + user.businessName.slice(1)} Dashboard` : 'Administrator Dashboard')}
        </h2>
      </div>

      {/* Super Admin Layout */}
      {isSuperAdmin && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
          {/* Total Users - First for Super Admin */}

          {/* User Management - Second for Super Admin */}
          <DashboardCard
            title="User Management"
            description="Add, edit, or remove user accounts"
            icon={<Users size={20} className="text-primary" />}
            onClick={() => navigate('/user-management')}
            infoText="Manage user accounts, roles, and permissions"
          />
          {/* Products - Third for Super Admin */}
          <DashboardCard
            title="Products"
            description="Manage and review products"
            icon={<Package size={20} className="text-primary" />}
            onClick={() => navigate('/product-management')}
            infoText="Review and approve products submitted by distributors"
          />
          {/* Revenue - Fourth for Super Admin */}
          <Card className="h-full flex flex-col min-h-[110px] md:min-h-0 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-base font-semibold text-foreground">Revenue</CardTitle>
                <InfoTooltip infoText="View revenue statistics with filters for hierarchy and date ranges" />
              </div>
              <div className="text-primary hover:text-primary transition-colors flex items-center gap-2">
                <TrendingUp size={20} className="text-primary hover:scale-110 transition-transform" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                {/* Filters */}
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-foreground" />
                    <Label className="text-xs font-medium">Hierarchy:</Label>
                    <Select
                      value={revenueHierarchyFilter}
                      onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                        setRevenueHierarchyFilter(value);
                        if (value === 'all') {
                          setShowRevenueHierarchy(false);
                          setRevenueLevel(null);
                          setRevenueParentId(null);
                        } else {
                          setShowRevenueHierarchy(true);
                          setRevenueLevel(value);
                          setRevenueParentId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {isSuperAdmin && <SelectItem value="admin">By Admin</SelectItem>}
                        <SelectItem value="distributor">By Distributor</SelectItem>
                        <SelectItem value="customer">By Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Date:</Label>
                    <Select
                      value={revenueDateFilter}
                      onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                        setRevenueDateFilter(value);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="thisYear">This Year</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="year">By Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {revenueDateFilter === 'month' && (
                    <div className="flex items-center gap-2">
                      <Select value={revenueMonth} onValueChange={setRevenueMonth}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={revenueYear} onValueChange={setRevenueYear}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {revenueDateFilter === 'year' && (
                    <Select value={revenueYear} onValueChange={setRevenueYear}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {revenueDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={revenueStartDate}
                        onChange={(e) => setRevenueStartDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                      <span className="text-foreground/60">to</span>
                      <input
                        type="date"
                        value={revenueEndDate}
                        onChange={(e) => setRevenueEndDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                    </div>
                  )}
                </div>

                <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                  {loadingRevenue ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                  ) : (
                    `₹${(revenueStats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                  )}
                </p>
                <CardDescription className="text-sm md:text-sm font-medium text-foreground/80 mt-auto">Total revenue</CardDescription>
                {showRevenueHierarchy && revenueBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                    <div className="text-sm font-semibold text-foreground mb-3">
                      {revenueLevel === 'admin'
                        ? (isSuperAdmin ? 'By Admin' : 'By Distributor')
                        : revenueLevel === 'distributor'
                          ? 'By Distributor'
                          : 'By Customer'}
                    </div>
                    <div className="space-y-2">
                      {revenueBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (revenueLevel === 'admin') {
                              if (isSuperAdmin && item.adminId) {
                                handleRevenueClick('distributor', item.adminId);
                              } else if (!isSuperAdmin && item.distributorId) {
                                handleRevenueClick('customer', item.distributorId);
                              }
                            } else if (revenueLevel === 'distributor' && item.distributorId) {
                              handleRevenueClick('customer', item.distributorId);
                            }
                          }}
                        >
                          <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                          <span className="font-bold text-foreground text-lg">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card
            className="h-full flex flex-col min-h-[110px] md:min-h-0 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl"
            onClick={() => handleOrdersClick(null)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-base font-semibold text-foreground">Orders</CardTitle>
                <InfoTooltip infoText="View order statistics with filters for hierarchy and date ranges" />
              </div>
              <div className="text-primary group-hover:text-primary transition-colors flex items-center gap-2">
                {showOrdersHierarchy ? <ChevronDown size={20} className="text-primary" /> : <ChevronRight size={20} className="text-primary" />}
                <ShoppingCart size={20} className="text-primary group-hover:scale-110 transition-transform" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                {/* Filters */}
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-foreground" />
                    <Label className="text-xs font-medium">Hierarchy:</Label>
                    <Select
                      value={ordersHierarchyFilter}
                      onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                        setOrdersHierarchyFilter(value);
                        if (value === 'all') {
                          setShowOrdersHierarchy(false);
                          setOrdersLevel(null);
                          setOrdersParentId(null);
                        } else {
                          setShowOrdersHierarchy(true);
                          setOrdersLevel(value);
                          setOrdersParentId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {isSuperAdmin && <SelectItem value="admin">By Admin</SelectItem>}
                        <SelectItem value="distributor">By Distributor</SelectItem>
                        <SelectItem value="customer">By Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Date:</Label>
                    <Select
                      value={ordersDateFilter}
                      onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                        setOrdersDateFilter(value);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="thisYear">This Year</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="year">By Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ordersDateFilter === 'month' && (
                    <div className="flex items-center gap-2">
                      <Select value={ordersMonth} onValueChange={setOrdersMonth}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={ordersYear} onValueChange={setOrdersYear}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {ordersDateFilter === 'year' && (
                    <Select value={ordersYear} onValueChange={setOrdersYear}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {ordersDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={ordersStartDate}
                        onChange={(e) => setOrdersStartDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                      <span className="text-foreground/60">to</span>
                      <input
                        type="date"
                        value={ordersEndDate}
                        onChange={(e) => setOrdersEndDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                    </div>
                  )}
                </div>

                <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                  {loadingOrders ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                  ) : (
                    (revenueStats?.totalOrders || 0).toLocaleString()
                  )}
                </p>
                <CardDescription className="text-sm md:text-sm font-medium text-foreground/80 mt-auto">Total orders</CardDescription>
                {showOrdersHierarchy && ordersBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                    <div className="text-sm font-semibold text-foreground mb-3">
                      {ordersLevel === 'admin'
                        ? (isSuperAdmin ? 'By Admin' : 'By Distributor')
                        : ordersLevel === 'distributor'
                          ? 'By Distributor'
                          : 'By Customer'}
                    </div>
                    <div className="space-y-2">
                      {ordersBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ordersLevel === 'admin') {
                              if (isSuperAdmin && item.adminId) {
                                handleOrdersClick('distributor', item.adminId);
                              } else if (!isSuperAdmin && item.distributorId) {
                                handleOrdersClick('customer', item.distributorId);
                              }
                            } else if (ordersLevel === 'distributor' && item.distributorId) {
                              handleOrdersClick('customer', item.distributorId);
                            }
                          }}
                        >
                          <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                          <span className="font-bold text-foreground text-lg">{item.orders.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Regular Admin Layout - Order: Products, Revenue, Orders, Total Users */}
      {!isSuperAdmin && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
          {/* 1. Products - First for Regular Admin */}
          <Card className="h-full flex flex-col min-h-[140px] hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-base font-semibold text-foreground">Products</CardTitle>
                <InfoTooltip infoText="Manage products and set pricing for distributors" />
              </div>
              <div className="text-primary transition-colors">
                <Package size={20} className="text-primary" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full justify-start bg-white dark:bg-gray-200 text-foreground hover:bg-gray-100 dark:hover:bg-gray-300"
                onClick={() => navigate('/product-management')}
              >
                <Package size={16} className="mr-2" />
                Manage Products
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/admin/product-usage')}
              >
                <Package size={16} className="mr-2" />
                Use Products
              </Button>
            </CardContent>
          </Card>

          <DashboardCard
            title="User Management"
            description="Add, edit, or remove user accounts"
            icon={<Users size={20} className="text-primary" />}
            onClick={() => navigate('/user-management')}
            infoText="Manage user accounts, roles, and permissions"
          />

          {/* 2. Revenue - Second for Regular Admin */}
          <Card className="h-full flex flex-col min-h-[140px] hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-base font-semibold text-foreground">Revenue</CardTitle>
                <InfoTooltip infoText="View revenue statistics with filters for hierarchy and date ranges" />
              </div>
              <div className="text-primary hover:text-primary transition-colors flex items-center gap-2">
                <TrendingUp size={20} className="text-primary hover:scale-110 transition-transform" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                {/* Filters */}
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-foreground" />
                    <Label className="text-xs font-medium">Hierarchy:</Label>
                    <Select
                      value={revenueHierarchyFilter}
                      onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                        setRevenueHierarchyFilter(value);
                        if (value === 'all') {
                          setShowRevenueHierarchy(false);
                          setRevenueLevel(null);
                          setRevenueParentId(null);
                        } else {
                          setShowRevenueHierarchy(true);
                          setRevenueLevel(value);
                          setRevenueParentId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {user?.isSuperAdmin && <SelectItem value="admin">By Admin</SelectItem>}
                        <SelectItem value="distributor">By Distributor</SelectItem>
                        <SelectItem value="customer">By Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Date:</Label>
                    <Select
                      value={revenueDateFilter}
                      onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                        setRevenueDateFilter(value);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="thisYear">This Year</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="year">By Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {revenueDateFilter === 'month' && (
                    <div className="flex items-center gap-2">
                      <Select value={revenueMonth} onValueChange={setRevenueMonth}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={revenueYear} onValueChange={setRevenueYear}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {revenueDateFilter === 'year' && (
                    <Select value={revenueYear} onValueChange={setRevenueYear}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {revenueDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={revenueStartDate}
                        onChange={(e) => setRevenueStartDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                      <span className="text-foreground/60">to</span>
                      <input
                        type="date"
                        value={revenueEndDate}
                        onChange={(e) => setRevenueEndDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                    </div>
                  )}
                </div>

                <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                  {loadingRevenue ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                  ) : (
                    `₹${(revenueStats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                  )}
                </p>
                <CardDescription className="text-sm md:text-sm font-medium text-foreground/80 mt-auto">Total revenue</CardDescription>
                {showRevenueHierarchy && revenueBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                    <div className="text-sm font-semibold text-foreground mb-3">
                      {revenueLevel === 'distributor'
                        ? 'By Distributor'
                        : 'By Customer'}
                    </div>
                    <div className="space-y-2">
                      {revenueBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (revenueLevel === 'distributor' && item.distributorId) {
                              handleRevenueClick('customer', item.distributorId);
                            }
                          }}
                        >
                          <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                          <span className="font-bold text-foreground text-lg">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. Orders - Third for Regular Admin */}
          <Card
            className="h-full flex flex-col min-h-[140px] hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group"
            onClick={() => handleOrdersClick(null)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-base font-semibold text-foreground">Orders</CardTitle>
                <InfoTooltip infoText="View order statistics with filters for hierarchy and date ranges" />
              </div>
              <div className="text-primary group-hover:text-primary transition-colors flex items-center gap-2">
                {showOrdersHierarchy ? <ChevronDown size={20} className="text-primary" /> : <ChevronRight size={20} className="text-primary" />}
                <ShoppingCart size={20} className="text-primary group-hover:scale-110 transition-transform" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                {/* Filters */}
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-foreground" />
                    <Label className="text-xs font-medium">Hierarchy:</Label>
                    <Select
                      value={ordersHierarchyFilter}
                      onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                        setOrdersHierarchyFilter(value);
                        if (value === 'all') {
                          setShowOrdersHierarchy(false);
                          setOrdersLevel(null);
                          setOrdersParentId(null);
                        } else {
                          setShowOrdersHierarchy(true);
                          setOrdersLevel(value);
                          setOrdersParentId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {user?.isSuperAdmin && <SelectItem value="admin">By Admin</SelectItem>}
                        <SelectItem value="distributor">By Distributor</SelectItem>
                        <SelectItem value="customer">By Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Date:</Label>
                    <Select
                      value={ordersDateFilter}
                      onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                        setOrdersDateFilter(value);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="thisYear">This Year</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="year">By Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ordersDateFilter === 'month' && (
                    <div className="flex items-center gap-2">
                      <Select value={ordersMonth} onValueChange={setOrdersMonth}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={ordersYear} onValueChange={setOrdersYear}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {ordersDateFilter === 'year' && (
                    <Select value={ordersYear} onValueChange={setOrdersYear}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {ordersDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={ordersStartDate}
                        onChange={(e) => setOrdersStartDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                      <span className="text-foreground/60">to</span>
                      <input
                        type="date"
                        value={ordersEndDate}
                        onChange={(e) => setOrdersEndDate(e.target.value)}
                        className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                      />
                    </div>
                  )}
                </div>

                <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                  {loadingOrders ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                  ) : (
                    (revenueStats?.totalOrders || 0).toLocaleString()
                  )}
                </p>
                <CardDescription className="text-sm md:text-sm font-medium text-foreground/80 mt-auto">Total orders</CardDescription>
                {showOrdersHierarchy && ordersBreakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                    <div className="text-sm font-semibold text-foreground mb-3">
                      {ordersLevel === 'distributor'
                        ? 'By Distributor'
                        : 'By Customer'}
                    </div>
                    <div className="space-y-2">
                      {ordersBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ordersLevel === 'distributor' && item.distributorId) {
                              handleOrdersClick('customer', item.distributorId);
                            }
                          }}
                        >
                          <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                          <span className="font-bold text-foreground text-lg">{item.orders.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


        </div>
      )}


    </div>
  );
};

const DistributorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [inTransitCount, setInTransitCount] = useState<number | null>(null);
  const [loadingInTransit, setLoadingInTransit] = useState(true);
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalOrders: number;
    breakdown?: Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>;
  } | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [ordersBreakdown, setOrdersBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showRevenueHierarchy, setShowRevenueHierarchy] = useState(false);
  const [revenueLevel, setRevenueLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [revenueParentId, setRevenueParentId] = useState<string | null>(null);
  const [showOrdersHierarchy, setShowOrdersHierarchy] = useState(false);
  const [ordersLevel, setOrdersLevel] = useState<'admin' | 'distributor' | 'customer' | null>(null);
  const [ordersParentId, setOrdersParentId] = useState<string | null>(null);

  // Filter states
  const [revenueHierarchyFilter, setRevenueHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [revenueDateFilter, setRevenueDateFilter] = useState<'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom'>('all');
  const [revenueMonth, setRevenueMonth] = useState<string>('');
  const [revenueYear, setRevenueYear] = useState<string>('');
  const [revenueStartDate, setRevenueStartDate] = useState<string>('');
  const [revenueEndDate, setRevenueEndDate] = useState<string>('');

  const [ordersHierarchyFilter, setOrdersHierarchyFilter] = useState<'all' | 'admin' | 'distributor' | 'customer'>('all');
  const [ordersDateFilter, setOrdersDateFilter] = useState<'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom'>('all');
  const [ordersMonth, setOrdersMonth] = useState<string>('');
  const [ordersYear, setOrdersYear] = useState<string>('');
  const [ordersStartDate, setOrdersStartDate] = useState<string>('');
  const [ordersEndDate, setOrdersEndDate] = useState<string>('');

  const loadRevenueOrders = async () => {
    if (!user?.token) {
      setLoadingRevenue(false);
      setLoadingOrders(false);
      return;
    }
    try {
      setLoadingRevenue(true);
      setLoadingOrders(true);

      // Build revenue params with filters
      const revenueParams = new URLSearchParams();
      if (revenueHierarchyFilter !== 'all') {
        revenueParams.append('level', revenueHierarchyFilter);
        if (revenueParentId) revenueParams.append('parentId', revenueParentId);
      }
      if (revenueDateFilter !== 'all') {
        revenueParams.append('dateFilter', revenueDateFilter);
        if (revenueDateFilter === 'month' && revenueMonth && revenueYear) {
          revenueParams.append('month', revenueMonth);
          revenueParams.append('year', revenueYear);
        } else if (revenueDateFilter === 'year' && revenueYear) {
          revenueParams.append('year', revenueYear);
        } else if (revenueDateFilter === 'custom' && revenueStartDate && revenueEndDate) {
          revenueParams.append('startDate', revenueStartDate);
          revenueParams.append('endDate', revenueEndDate);
        }
      }

      // Load revenue stats
      const revenueRes = await fetch(getApiUrl(`/api/admin/stats/revenue-orders?${revenueParams.toString()}`), {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!revenueRes.ok) throw new Error('Failed to load revenue stats');
      const revenueData = await revenueRes.json();
      setRevenueStats(prev => ({ ...prev, totalRevenue: revenueData.totalRevenue }));
      setRevenueBreakdown(revenueData.breakdown || []);

      // Build orders params with filters
      const ordersParams = new URLSearchParams();
      if (ordersHierarchyFilter !== 'all') {
        ordersParams.append('level', ordersHierarchyFilter);
        if (ordersParentId) ordersParams.append('parentId', ordersParentId);
      }
      if (ordersDateFilter !== 'all') {
        ordersParams.append('dateFilter', ordersDateFilter);
        if (ordersDateFilter === 'month' && ordersMonth && ordersYear) {
          ordersParams.append('month', ordersMonth);
          ordersParams.append('year', ordersYear);
        } else if (ordersDateFilter === 'year' && ordersYear) {
          ordersParams.append('year', ordersYear);
        } else if (ordersDateFilter === 'custom' && ordersStartDate && ordersEndDate) {
          ordersParams.append('startDate', ordersStartDate);
          ordersParams.append('endDate', ordersEndDate);
        }
      }

      // Load orders stats
      const ordersRes = await fetch(getApiUrl(`/api/admin/stats/revenue-orders?${ordersParams.toString()}`), {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!ordersRes.ok) throw new Error('Failed to load orders stats');
      const ordersData = await ordersRes.json();
      setRevenueStats(prev => ({ ...prev, totalOrders: ordersData.totalOrders }));
      setOrdersBreakdown(ordersData.breakdown || []);
    } catch (error) {
      console.error('Load revenue/orders error:', error);
      setRevenueStats({ totalRevenue: 0, totalOrders: 0, breakdown: [] });
      setRevenueBreakdown([]);
      setOrdersBreakdown([]);
    } finally {
      setLoadingRevenue(false);
      setLoadingOrders(false);
    }
  };

  const handleRevenueClick = (level: 'admin' | 'distributor' | 'customer' | null, parentId: string | null = null) => {
    if (level === 'customer' && parentId) {
      setRevenueLevel('customer');
      setRevenueParentId(parentId);
      setRevenueHierarchyFilter('customer');
    } else {
      setShowRevenueHierarchy(false);
      setRevenueLevel(null);
      setRevenueParentId(null);
      setRevenueHierarchyFilter('all');
    }
  };

  const handleOrdersClick = (level: 'admin' | 'distributor' | 'customer' | null, parentId: string | null = null) => {
    if (level === 'customer' && parentId) {
      setOrdersLevel('customer');
      setOrdersParentId(parentId);
      setOrdersHierarchyFilter('customer');
    } else {
      setShowOrdersHierarchy(false);
      setOrdersLevel(null);
      setOrdersParentId(null);
      setOrdersHierarchyFilter('all');
    }
  };

  useEffect(() => {
    // Mark initial load as complete when data is loaded
    if (!loadingRevenue && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loadingRevenue, isInitialLoad]);

  const loadInTransitCount = async () => {
    if (!user?.token) {
      setLoadingInTransit(false);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/distributor/orders/in-transit-count'), {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load in-transit count');
      const data = await res.json();
      setInTransitCount(data.count);
    } catch (error) {
      console.error('Load in-transit count error:', error);
      setInTransitCount(0);
    } finally {
      setLoadingInTransit(false);
    }
  };

  useEffect(() => {
    void loadRevenueOrders();
    void loadInTransitCount();
    // Poll for in-transit count updates every 5 seconds
    const interval = setInterval(loadInTransitCount, 5000);
    return () => clearInterval(interval);
  }, [user?.token, revenueLevel, revenueParentId, ordersLevel, ordersParentId,
    revenueHierarchyFilter, revenueDateFilter, revenueMonth, revenueYear, revenueStartDate, revenueEndDate,
    ordersHierarchyFilter, ordersDateFilter, ordersMonth, ordersYear, ordersStartDate, ordersEndDate]);

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 md:gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base font-medium text-foreground/80">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="relative overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl">
        <h2 className="font-sans text-2xl md:text-4xl font-bold mb-1 text-foreground tracking-tight">Distributor Dashboard</h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <DashboardCard
          title="Order Management"
          description="View and manage customer orders"
          icon={<ShoppingCart size={20} className="text-primary" />}
          onClick={() => navigate('/distributor/orders')}
          infoText="View, process, and manage orders from your customers"
        />
        <DashboardCard
          title="Shipments"
          description="In transit"
          icon={<Truck size={20} className="text-primary" />}
          value={loadingInTransit ? <Loader2 className="h-5 w-5 animate-spin text-primary inline-block" /> : (inTransitCount ?? 0).toString()}
          onClick={() => navigate('/distributor/transit')}
          infoText="View shipments currently in transit to customers"
        />
        <DashboardCard
          title="Customer Management"
          description="Add, edit, and delete customers"
          icon={<Users size={20} className="text-primary" />}
          onClick={() => navigate('/user-management')}
          infoText="Manage your customer accounts and information"
        />
        <DashboardCard
          title="Customer Pricing"
          description="Set custom prices for customers"
          icon={<TrendingUp size={20} className="text-primary" />}
          onClick={() => navigate('/distributor/pricing')}
          infoText="Set and manage custom pricing for individual customers"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        <Card className="h-full flex flex-col min-h-[110px] md:min-h-0 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-foreground">Revenue</CardTitle>
              <InfoTooltip infoText="View revenue statistics with filters for hierarchy and date ranges" />
            </div>
            <div className="text-primary hover:text-primary transition-colors flex items-center gap-2">
              <TrendingUp size={20} className="text-primary hover:scale-110 transition-transform" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-foreground" />
                  <Label className="text-xs font-medium">Hierarchy:</Label>
                  <Select
                    value={revenueHierarchyFilter}
                    onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                      setRevenueHierarchyFilter(value);
                      if (value === 'all') {
                        setShowRevenueHierarchy(false);
                        setRevenueLevel(null);
                        setRevenueParentId(null);
                      } else {
                        setShowRevenueHierarchy(true);
                        setRevenueLevel(value);
                        setRevenueParentId(null);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="customer">By Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Date:</Label>
                  <Select
                    value={revenueDateFilter}
                    onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                      setRevenueDateFilter(value);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="thisYear">This Year</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                      <SelectItem value="year">By Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {revenueDateFilter === 'month' && (
                  <div className="flex items-center gap-2">
                    <Select value={revenueMonth} onValueChange={setRevenueMonth}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={revenueYear} onValueChange={setRevenueYear}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {revenueDateFilter === 'year' && (
                  <Select value={revenueYear} onValueChange={setRevenueYear}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )}
                {revenueDateFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={revenueStartDate}
                      onChange={(e) => setRevenueStartDate(e.target.value)}
                      className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                    />
                    <span className="text-foreground/60">to</span>
                    <input
                      type="date"
                      value={revenueEndDate}
                      onChange={(e) => setRevenueEndDate(e.target.value)}
                      className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                    />
                  </div>
                )}
              </div>

              <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                {loadingRevenue ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                ) : (
                  `₹${(revenueStats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                )}
              </p>
              <CardDescription className="text-sm md:text-sm font-medium text-gray-600 dark:text-gray-400 mt-auto">Total revenue</CardDescription>
              {showRevenueHierarchy && revenueBreakdown.length > 0 && (
                <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                  <div className="text-sm font-semibold text-foreground mb-3">
                    By Customer
                  </div>
                  <div className="space-y-2">
                    {revenueBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (revenueLevel === 'customer' && item.customerId) {
                            handleRevenueClick('customer', item.customerId);
                          }
                        }}
                      >
                        <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                        <span className="font-bold text-foreground text-lg">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="h-full flex flex-col min-h-[110px] md:min-h-0 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white/95 to-white/50 dark:from-black/95 dark:to-black/50 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-xl group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base md:text-base font-semibold text-foreground">Orders</CardTitle>
              <InfoTooltip infoText="View order statistics with filters for hierarchy and date ranges" />
            </div>
            <div className="text-primary hover:text-primary transition-colors flex items-center gap-2">
              <ShoppingCart size={20} className="text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-foreground" />
                  <Label className="text-xs font-medium">Hierarchy:</Label>
                  <Select
                    value={ordersHierarchyFilter}
                    onValueChange={(value: 'all' | 'admin' | 'distributor' | 'customer') => {
                      setOrdersHierarchyFilter(value);
                      if (value === 'all') {
                        setShowOrdersHierarchy(false);
                        setOrdersLevel(null);
                        setOrdersParentId(null);
                      } else {
                        setShowOrdersHierarchy(true);
                        setOrdersLevel(value);
                        setOrdersParentId(null);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="customer">By Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Date:</Label>
                  <Select
                    value={ordersDateFilter}
                    onValueChange={(value: 'all' | 'today' | 'thisMonth' | 'thisYear' | 'month' | 'year' | 'custom') => {
                      setOrdersDateFilter(value);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="thisYear">This Year</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                      <SelectItem value="year">By Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ordersDateFilter === 'month' && (
                  <div className="flex items-center gap-2">
                    <Select value={ordersMonth} onValueChange={setOrdersMonth}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={ordersYear} onValueChange={setOrdersYear}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {ordersDateFilter === 'year' && (
                  <Select value={ordersYear} onValueChange={setOrdersYear}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )}
                {ordersDateFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={ordersStartDate}
                      onChange={(e) => setOrdersStartDate(e.target.value)}
                      className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                    />
                    <span className="text-foreground/60">to</span>
                    <input
                      type="date"
                      value={ordersEndDate}
                      onChange={(e) => setOrdersEndDate(e.target.value)}
                      className="h-7 text-xs px-2 border border-black/30 dark:border-black/50 rounded-md flex-1"
                    />
                  </div>
                )}
              </div>

              <p className="text-2xl md:text-3xl font-sans font-bold mb-1 text-primary">
                {loadingOrders ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary inline-block" />
                ) : (
                  (revenueStats?.totalOrders || 0).toLocaleString()
                )}
              </p>
              <CardDescription className="text-sm md:text-sm font-medium text-gray-600 dark:text-gray-400 mt-auto">Total orders</CardDescription>
              {showOrdersHierarchy && ordersBreakdown.length > 0 && (
                <div className="mt-4 pt-4 border-t border-black/20 dark:border-black/40">
                  <div className="text-sm font-semibold text-foreground mb-3">
                    By Customer
                  </div>
                  <div className="space-y-2">
                    {ordersBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ordersLevel === 'customer' && item.customerId) {
                            handleOrdersClick('customer', item.customerId);
                          }
                        }}
                      >
                        <span className="font-semibold truncate text-foreground text-base">{item.name}</span>
                        <span className="font-bold text-foreground text-lg">{item.orders.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [orderStats, setOrderStats] = useState<{
    total: number;
    inTransit: number;
    pending: number;
  } | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    loadOrderStats();
  }, [user?.token]);

  useEffect(() => {
    // Mark initial load as complete when order stats are loaded
    if (!loadingOrders && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loadingOrders, isInitialLoad]);

  const loadOrderStats = async () => {
    if (!user?.token) return;
    try {
      setLoadingOrders(true);
      const { cachedFetch } = await import('@/lib/cached-fetch');
      const orders = await cachedFetch<any[]>('/api/customer/orders', user.token);
      const total = orders.length;
      const inTransit = orders.filter((o: any) => o.markedForToday === true && !o.receivedAt).length;
      const pending = orders.filter((o: any) => o.status === 'pending' && !o.markedForToday).length;
      setOrderStats({ total, inTransit, pending });
    } catch (error) {
      console.error('Load order stats error:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 md:gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base font-medium text-foreground/80">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="relative overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl">
        <h2 className="font-sans text-2xl md:text-4xl font-bold mb-1 text-foreground tracking-tight">Welcome back</h2>
        <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-400">Your personal shopping dashboard</p>
      </div>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <DashboardCard
            title="Browse Products"
            description="Explore our catalog"
            icon={<Package size={20} className="text-primary" />}
            onClick={() => navigate('/customer/products')}
            infoText="Browse and search available products"
          />
          <DashboardCard
            title="Order History"
            description="View past purchases"
            icon={<FileText size={20} className="text-primary" />}
            onClick={() => navigate('/customer/orders')}
            infoText="View your complete order history and past purchases"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <DashboardCard
            title="In Transit"
            description="On the way"
            icon={<Truck size={20} className="text-primary" />}
            value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin text-primary inline-block" /> : (orderStats?.inTransit || 0).toString()}
            infoText="Orders currently being shipped to you"
          />
          <DashboardCard
            title="Pending Orders"
            description="Awaiting processing"
            icon={<FileText size={20} className="text-primary" />}
            value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin text-primary inline-block" /> : (orderStats?.pending || 0).toString()}
            infoText="Orders waiting to be processed by distributor"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <div className="md:col-span-2">
            <DashboardCard
              title="Total Orders"
              description="Total orders placed"
              icon={<ShoppingCart size={20} className="text-primary" />}
              value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin text-primary inline-block" /> : (orderStats?.total || 0).toString()}
              infoText="View your total number of orders placed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const dashboardComponents: Record<UserRole, React.FC> = {
  admin: AdminDashboard,
  distributor: DistributorDashboard,
  customer: CustomerDashboard,
};

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const DashboardContent = dashboardComponents[user.role];

  return (
    <div className="min-h-screen bg-transparent relative">
      <Header />

      <main className="container mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12 relative z-10">
        <PasswordChangeNotification />
        <DashboardContent />
      </main>
    </div>
  );
};

export default Dashboard;
