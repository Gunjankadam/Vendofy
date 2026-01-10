import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
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
  Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  value?: string | React.ReactNode;
  onClick?: () => void;
}

const DashboardCard = ({ title, description, icon, value, onClick }: DashboardCardProps) => (
  <Card 
    className="hover:shadow-md transition-shadow cursor-pointer group"
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground group-hover:text-foreground transition-colors">
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      {value && (
        <p className="text-2xl font-serif font-medium mb-1">
          {typeof value === 'string' ? value : value}
        </p>
      )}
      <CardDescription className="text-xs">{description}</CardDescription>
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
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalOrders: number;
    breakdown?: Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>;
  } | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [ordersBreakdown, setOrdersBreakdown] = useState<Array<{ adminId?: string; distributorId?: string; customerId?: string; name: string; email: string; revenue: number; orders: number }>>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
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
        const res = await fetch('http://localhost:5000/api/admin/users/stats', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to load user stats');
        const data = await res.json();
        setUserStats(data);
      } catch (error) {
        console.error('Load user stats error:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    void loadUserStats();
    void loadRevenueOrders();
  }, [user?.token, revenueLevel, revenueParentId, ordersLevel, ordersParentId,
      revenueHierarchyFilter, revenueDateFilter, revenueMonth, revenueYear, revenueStartDate, revenueEndDate,
      ordersHierarchyFilter, ordersDateFilter, ordersMonth, ordersYear, ordersStartDate, ordersEndDate]);

  useEffect(() => {
    // Mark initial load as complete when both stats and revenue are loaded
    if (!loadingStats && !loadingRevenue && isInitialLoad) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setIsInitialLoad(false);
      }, 100);
    }
  }, [loadingStats, loadingRevenue, isInitialLoad]);

  const loadRevenueOrders = async () => {
    if (!user?.token) {
      setLoadingRevenue(false);
      return;
    }
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
      const revenueRes = await fetch(`http://localhost:5000/api/admin/stats/revenue-orders?${revenueParams.toString()}`, {
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
      const ordersRes = await fetch(`http://localhost:5000/api/admin/stats/revenue-orders?${ordersParams.toString()}`, {
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
    }
  };

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

  // Show loading screen during initial load
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
  <div className="space-y-8 animate-fade-in">
    <div>
        <h2 className="font-serif text-2xl font-medium mb-1">
          {isSuperAdmin ? 'Super Administrator Dashboard' : 'Administrator Dashboard'}
        </h2>
    </div>
    
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer group"
        onClick={() => setShowHierarchy(!showHierarchy)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <div className="text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-2">
            {showHierarchy ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <Users size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-serif font-medium mb-1">
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
            ) : (
              userStats?.total.toLocaleString() || '0'
            )}
          </p>
          <CardDescription className="text-xs">
            {isSuperAdmin ? 'All active accounts' : 'Your hierarchy'}
          </CardDescription>
          {showHierarchy && userStats && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-3">
                {isSuperAdmin ? 'User Hierarchy' : 'Your User Hierarchy'}
              </div>
              <div className="space-y-3">
                {isSuperAdmin && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="font-medium">Admin</span>
                    </div>
                    <span className="font-semibold">{userStats.admin.toLocaleString()}</span>
                  </div>
                )}
                {(isSuperAdmin || userStats.distributor > 0) && (
                  <div className={`flex items-center justify-between text-sm ${isSuperAdmin ? 'pl-4 relative' : ''}`}>
                    {isSuperAdmin && (
                      <>
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                        <div className="w-1 h-1 rounded-full bg-border -ml-1" />
                      </>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="font-medium">Distributor</span>
                    </div>
                    <span className="font-semibold">{userStats.distributor.toLocaleString()}</span>
                  </div>
                )}
                <div className={`flex items-center justify-between text-sm ${isSuperAdmin ? 'pl-8' : userStats.distributor > 0 ? 'pl-4' : ''} relative`}>
                  {(isSuperAdmin || userStats.distributor > 0) && (
                    <>
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                      <div className="w-1 h-1 rounded-full bg-border -ml-1" />
                    </>
                  )}
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-medium">Customer</span>
                  </div>
                  <span className="font-semibold">{userStats.customer.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <div className="text-muted-foreground transition-colors flex items-center gap-2">
            <TrendingUp size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
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
                <Label className="text-xs font-medium">Date:</Label>
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
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={revenueEndDate}
                    onChange={(e) => setRevenueEndDate(e.target.value)}
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                </div>
              )}
            </div>
            
            <p className="text-2xl font-serif font-medium mb-1">
              {loadingRevenue ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
              ) : (
                `₹${(revenueStats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              )}
            </p>
            <CardDescription className="text-xs">Total revenue</CardDescription>
            {showRevenueHierarchy && revenueBreakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted-foreground mb-3">
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
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="font-semibold">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer group"
        onClick={() => handleOrdersClick(null)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Orders</CardTitle>
          <div className="text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-2">
            {showOrdersHierarchy ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <ShoppingCart size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
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
                <Label className="text-xs font-medium">Date:</Label>
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
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={ordersEndDate}
                    onChange={(e) => setOrdersEndDate(e.target.value)}
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                </div>
              )}
            </div>
            
            <p className="text-2xl font-serif font-medium mb-1">
              {loadingRevenue ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
              ) : (
                (revenueStats?.totalOrders || 0).toLocaleString()
              )}
            </p>
            <CardDescription className="text-xs">Total orders</CardDescription>
            {showOrdersHierarchy && ordersBreakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted-foreground mb-3">
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
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="font-semibold">{item.orders.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <DashboardCard 
        title="Products" 
        description="Manage and review products" 
        icon={<Package size={20} />}
        onClick={() => navigate('/product-management')}
      />
    </div>

    <div className={`grid ${isSuperAdmin ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
      <DashboardCard 
        title="User Management" 
        description="Add, edit, or remove user accounts" 
        icon={<Users size={24} />}
        onClick={() => navigate('/user-management')}
      />
      <DashboardCard 
        title="System Settings" 
        description="Configure system preferences" 
        icon={<Settings size={24} />}
        onClick={() => navigate('/system-settings')}
      />
      {!isSuperAdmin && (
      <DashboardCard 
          title="Use Products" 
          description="Use products and set pricing for distributors" 
          icon={<Package size={24} />}
          onClick={() => navigate('/admin/product-usage')}
        />
      )}
    </div>
    
    {!isSuperAdmin && (
      <div className="grid md:grid-cols-1 gap-4">
        <Card 
          className="hover:shadow-md transition-shadow cursor-pointer group"
          onClick={() => navigate('/admin/order-notifications')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-medium">Order Notifications</CardTitle>
            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
              <Bell size={32} />
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">View orders from distributors</CardDescription>
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
      return;
    }
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
      const revenueRes = await fetch(`http://localhost:5000/api/admin/stats/revenue-orders?${revenueParams.toString()}`, {
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
      const ordersRes = await fetch(`http://localhost:5000/api/admin/stats/revenue-orders?${ordersParams.toString()}`, {
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
    // Simulate asset loading for distributor dashboard
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const loadInTransitCount = async () => {
    if (!user?.token) {
      setLoadingInTransit(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/distributor/orders/in-transit-count', {
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
  <div className="space-y-8 animate-fade-in">
    <div>
      <h2 className="font-serif text-2xl font-medium mb-1">Distributor Dashboard</h2>
    </div>
    
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardCard 
        title="Shipments" 
        description="In transit" 
        icon={<Truck size={20} />}
        value={loadingInTransit ? <Loader2 className="h-5 w-5 animate-spin inline-block" /> : (inTransitCount ?? 0).toString()}
        onClick={() => navigate('/distributor/transit')}
      />
      <DashboardCard 
        title="Customer Management" 
        description="Add, edit, and delete customers" 
        icon={<Users size={20} />}
        onClick={() => navigate('/user-management')}
      />
      <DashboardCard 
        title="Order Management" 
        description="View and manage customer orders" 
        icon={<ShoppingCart size={20} />}
        onClick={() => navigate('/distributor/orders')}
      />
      <DashboardCard 
        title="Customer Pricing" 
        description="Set custom prices for customers" 
        icon={<TrendingUp size={20} />}
        onClick={() => navigate('/distributor/pricing')}
      />
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <div className="text-muted-foreground transition-colors flex items-center gap-2">
            <TrendingUp size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
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
                <Label className="text-xs font-medium">Date:</Label>
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
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={revenueEndDate}
                    onChange={(e) => setRevenueEndDate(e.target.value)}
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                </div>
              )}
            </div>
            
            <p className="text-2xl font-serif font-medium mb-1">
              {loadingRevenue ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
              ) : (
                `₹${(revenueStats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              )}
            </p>
            <CardDescription className="text-xs">Total revenue</CardDescription>
            {showRevenueHierarchy && revenueBreakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted-foreground mb-3">
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
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="font-semibold">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Orders</CardTitle>
          <div className="text-muted-foreground transition-colors flex items-center gap-2">
            <ShoppingCart size={20} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
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
                <Label className="text-xs font-medium">Date:</Label>
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
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={ordersEndDate}
                    onChange={(e) => setOrdersEndDate(e.target.value)}
                    className="h-7 text-xs px-2 border border-border rounded-md flex-1"
                  />
                </div>
              )}
            </div>
            
            <p className="text-2xl font-serif font-medium mb-1">
              {loadingRevenue ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
              ) : (
                (revenueStats?.totalOrders || 0).toLocaleString()
              )}
            </p>
            <CardDescription className="text-xs">Total orders</CardDescription>
            {showOrdersHierarchy && ordersBreakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted-foreground mb-3">
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
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="font-semibold">{item.orders.toLocaleString()}</span>
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
    // Simulate asset loading for customer dashboard
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [user?.token]);

  const loadOrderStats = async () => {
    if (!user?.token) return;
    try {
      setLoadingOrders(true);
      const res = await fetch('http://localhost:5000/api/customer/orders', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (res.ok) {
        const orders = await res.json();
        const total = orders.length;
        const inTransit = orders.filter((o: any) => o.markedForToday === true && !o.receivedAt).length;
        const pending = orders.filter((o: any) => o.status === 'pending' && !o.markedForToday).length;
        setOrderStats({ total, inTransit, pending });
      }
    } catch (error) {
      console.error('Load order stats error:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
  <div className="space-y-8 animate-fade-in">
    <div>
      <h2 className="font-serif text-2xl font-medium mb-1">Welcome back</h2>
      <p className="text-muted-foreground">Your personal shopping dashboard</p>
    </div>
    
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
      <DashboardCard 
        title="My Orders" 
        description="Total orders placed" 
        icon={<ShoppingCart size={20} />}
          value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin inline-block" /> : (orderStats?.total || 0).toString()}
      />
      <DashboardCard 
        title="In Transit" 
        description="On the way" 
        icon={<Truck size={20} />}
          value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin inline-block" /> : (orderStats?.inTransit || 0).toString()}
      />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
      <DashboardCard 
          title="Pending Orders" 
          description="Awaiting processing" 
          icon={<FileText size={20} />}
          value={loadingOrders ? <Loader2 className="h-5 w-5 animate-spin inline-block" /> : (orderStats?.pending || 0).toString()}
        />
      <DashboardCard 
        title="Browse Products" 
        description="Explore our catalog" 
        icon={<Package size={20} />}
          onClick={() => navigate('/customer/products')}
      />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
      <DashboardCard 
        title="Order History" 
        description="View past purchases" 
        icon={<FileText size={20} />}
            onClick={() => navigate('/customer/orders')}
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
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 pt-28 pb-12">
        <PasswordChangeNotification />
        <DashboardContent />
      </main>
    </div>
  );
};

export default Dashboard;
