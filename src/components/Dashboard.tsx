import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { 
  NormalizedDashboardData,
  NormalizedOrder,
  NormalizedInvoice,
  NormalizedCustomer,
  NormalizedAgent,
  BrandPerformance,
  TopItem
} from '../types/dashboard';
import CountUp from 'react-countup';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { auth, db } from '../firebase';
import { collection, doc, updateDoc, getDocs } from 'firebase/firestore';
import "./dashboard.css";
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json'; 
import { optimizeDataForAI, optimizeDashboardData, validateDataSize } from '../utils/dataOptimizer';
import { ProgressLoader } from './ProgressLoader';


// Enhanced Dashboard with role-specific views
interface DashboardProps {
  agentId?: string;
  isAgentView?: boolean;
  userId?: string;
}

// MetricCard interface
interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  onClick?: () => void;
  onAIInsight?: () => void;
  formatter?: (value: number) => string;
  icon: string;
  color?: string;
}

// AI insight interface
interface AIInsight {
  insight: string;
  trend: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  itemTrends?: any;
  valueAnalysis?: any;
  volumeTrends?: any;
}

interface AIInsightModalState {
  isOpen: boolean;
  insight: AIInsight | null;
  cardTitle: string;
  isLoading: boolean;
  enhanced?: boolean;
}

// Filter state interface
interface OrderFilters {
  brand?: string;
  salesAgent?: string;
  status?: string;
  sortBy?: 'value' | 'date';
  pageSize: number;
  currentPage: number;
}

const EnhancedDashboard: React.FC<DashboardProps> = ({ 
  agentId, 
  userId 
}) => {
  // Get the context from the Outlet
  const [dateRange, setDateRange] = useState('30_days');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [customDateRange, setCustomDateRange] = useState({ 
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)), // 1 month ago
    end: new Date() // today
  });
  const [activeView, setActiveView] = useState('overview');
  const [aiInsightModal, setAiInsightModal] = useState<AIInsightModalState>({
    isOpen: false,
    insight: null,
    cardTitle: '',
    isLoading: false
  });
  
  // Order filters state
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    pageSize: 10,
    currentPage: 1
  });
  
  // Add new state for logo and tab indicator
  const [logoUrl, setLogoUrl] = useState<string | null>(
    localStorage.getItem('dashboardLogo')
  );
  const tabIndicatorRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the actual userId passed as prop or fallback to auth
  const currentUserId = userId || auth.currentUser?.uid || agentId;
  
  const memoizedCustomDateRange = useMemo(() => {
    if (dateRange === 'custom' && customDateRange.start && customDateRange.end) {
      return {
        start: customDateRange.start.toISOString().split('T')[0],
        end: customDateRange.end.toISOString().split('T')[0]
      };
    }
    return undefined;
  }, [dateRange, customDateRange.start, customDateRange.end]);
  
  const { data, loading, error, refresh, lastUpdated } = useDashboard({
    userId: currentUserId,
    dateRange,
    customDateRange: memoizedCustomDateRange,
    autoRefresh: true,
    refreshInterval: 300000
  });
  
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setLogoUrl(url);
        localStorage.setItem('dashboardLogo', url);
      };
      reader.readAsDataURL(file);
    }
  };

  // Derive isAgentView from the actual data role
  const isAgentView = data?.role === 'salesAgent';
  
  // Define available views based on user role
  const availableViews = useMemo(() => {
    const baseViews = [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'orders', label: 'Orders', icon: '📦' },
    ];
    
    if (!isAgentView) {  // Managers see these tabs
      baseViews.push(
        { id: 'revenue', label: 'Revenue', icon: '💰' },
        { id: 'invoices', label: 'Invoices', icon: '📄' },
        { id: 'brands', label: 'Brands', icon: '🏷️' },
        { id: 'forecasting', label: 'Forecasting', icon: '🔮' }
      );
    } else {  // Agents see these tabs
      baseViews.push(
        { id: 'invoices', label: 'Invoices', icon: '📄' },
        { id: 'customers', label: 'Customers', icon: '👥' }
      );
    }
    
    return baseViews;
  }, [isAgentView]);
  
  useEffect(() => {
    const updateIndicator = () => {
      if (activeTabRef.current && tabIndicatorRef.current && tabsContainerRef.current) {
        const activeTab = activeTabRef.current;
        const container = tabsContainerRef.current;
        const indicator = tabIndicatorRef.current;
        
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        indicator.style.left = `${tabRect.left - containerRect.left + container.scrollLeft}px`;
        indicator.style.width = `${tabRect.width}px`;
      }
    };
    
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeView]);
  
  useEffect(() => {
  if (loading) {
    // Reset progress when loading starts
    setLoadingProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    return () => clearInterval(progressInterval);
  } else {
    // Set to 100 when loading completes
    setLoadingProgress(100);
  }
}, [loading]);

  // When calling AI insights
  const generateCardInsights = async (cardType: string, cardData: any) => {
    try {
      // Optimize the data before sending
      const optimizedCardData = optimizeDataForAI(cardData, {
        maxArrayLength: 50,
        maxDepth: 2,
      });
      
      const optimizedDashboardData = optimizeDashboardData(data);
      
      const response = await fetch('/api/ai-insights/card-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardType,
          cardData: optimizedCardData,
          fullDashboardData: optimizedDashboardData,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating insights:', error);
      // Handle error
    }
  };

  const handleAIInsight = useCallback(async (cardType: string, cardTitle: string) => {
    if (!cardType || !cardTitle || !data) {
      console.error('Invalid parameters for AI insight');
      return;
    }

    setAiInsightModal({
      isOpen: true,
      insight: null,
      cardTitle,
      isLoading: true
    });
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      
      // Prepare enhanced card data based on type
      let enhancedCardData;
      
      switch (cardType) {
        case 'orders':
        case 'total-orders':
          // Include detailed order analysis data
          enhancedCardData = {
            count: data.metrics?.totalOrders || 0,
            totalValue: data.metrics?.totalRevenue || 0,
            averageValue: data.metrics?.averageOrderValue || 0,
            orders: data.orders?.slice(0, 100) || [], // More orders for analysis
            itemAnalysis: prepareItemAnalysis(data.orders),
            customerDistribution: prepareCustomerDistribution(data.orders),
            timeDistribution: prepareTimeDistribution(data.orders)
          };
          break;
          
        case 'revenue':
        case 'total-revenue':
          enhancedCardData = {
            current: data.metrics?.totalRevenue || 0,
            orders: data.metrics?.totalOrders || 0,
            brandBreakdown: prepareBrandRevenue(data),
            customerSegments: prepareCustomerSegments(data),
            productMix: prepareProductMix(data),
            channelBreakdown: prepareChannelBreakdown(data)
          };
          break;
          
        case 'aov':
        case 'average-order-value':
          enhancedCardData = {
            averageValue: data.metrics?.averageOrderValue || 0,
            distribution: prepareOrderValueDistribution(data.orders),
            factors: prepareAOVFactors(data),
            bundleAnalysis: prepareBundleAnalysis(data.orders),
            customerAOV: prepareCustomerAOV(data)
          };
          break;
          
        case 'invoices':
        case 'outstanding-invoices':
          enhancedCardData = {
            ...data.invoices,
            agingAnalysis: prepareInvoiceAging(data.invoices),
            customerRisk: prepareCustomerRisk(data.invoices),
            paymentPatterns: preparePaymentPatterns(data)
          };
          break;
          
        default:
          enhancedCardData = extractCardSpecificData(cardType, data);
      }
      
      // Call enhanced AI insights endpoint
      const response = await fetch(`${apiUrl}/api/ai-insights/enhanced-card-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId || 'unknown'
        },
        body: JSON.stringify({
          cardType: cardType.replace(/-/g, '_').toLowerCase(),
          cardData: enhancedCardData,
          fullDashboardData: {
            ...optimizeDashboardData(data),
            dateRange: data.dateRange,
            customDateRange: dateRange === 'custom' ? customDateRange : null,
            role: isAgentView ? 'salesAgent' : 'brandManager',
            userId: currentUserId
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Enhanced modal display with more detailed insights
      setAiInsightModal({
        isOpen: true,
        insight: result.data,
        cardTitle,
        isLoading: false,
        enhanced: true // Flag for enhanced view
      });
      
    } catch (error) {
      console.error('Error generating AI insights:', error);
      setAiInsightModal({
        isOpen: true,
        insight: {
          insight: 'Unable to generate AI insights at this time.',
          trend: 'unavailable',
          action: 'Please try again in a few moments',
          priority: 'medium',
          impact: 'Analysis temporarily unavailable'
        },
        cardTitle,
        isLoading: false
      });
    }
  }, [data, isAgentView, currentUserId, dateRange, customDateRange]);

  // Helper functions for data preparation
  const prepareItemAnalysis = (orders: any[]) => {
    const itemMap = new Map();
    
    orders?.forEach(order => {
      order.line_items?.forEach((item: any) => {
        const key = item.item_id || item.sku;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            id: key,
            name: item.item_name || item.name,
            quantity: 0,
            revenue: 0,
            orders: 0,
            firstSeen: order.date,
            lastSeen: order.date
          });
        }
        
        const itemData = itemMap.get(key);
        itemData.quantity += item.quantity || 0;
        itemData.revenue += item.total || (item.quantity * item.rate) || 0;
        itemData.orders += 1;
        
        if (new Date(order.date) < new Date(itemData.firstSeen)) {
          itemData.firstSeen = order.date;
        }
        if (new Date(order.date) > new Date(itemData.lastSeen)) {
          itemData.lastSeen = order.date;
        }
      });
    });
    
    return Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map(item => ({
        ...item,
        velocityScore: calculateVelocityScore(item),
        trendDirection: calculateTrend(item)
      }));
  };

  // Add all the missing helper functions
  const prepareCustomerDistribution = (orders: any[]) => {
    const customerMap = new Map();
    
    orders?.forEach(order => {
      const customerId = order.customer_id || order.customer_name;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          name: order.customer_name,
          orderCount: 0,
          totalSpent: 0,
          averageOrderValue: 0
        });
      }
      
      const customer = customerMap.get(customerId);
      customer.orderCount += 1;
      customer.totalSpent += order.total || 0;
      customer.averageOrderValue = customer.totalSpent / customer.orderCount;
    });
    
    return {
      totalCustomers: customerMap.size,
      distribution: Array.from(customerMap.values()),
      topCustomers: Array.from(customerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
    };
  };

  const prepareTimeDistribution = (orders: any[]) => {
    const hourlyMap = new Map();
    const dailyMap = new Map();
    const monthlyMap = new Map();
    
    orders?.forEach(order => {
      const date = new Date(order.date);
      const hour = date.getHours();
      const day = date.getDay();
      const month = date.getMonth();
      
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    });
    
    return {
      hourly: Array.from(hourlyMap.entries()),
      daily: Array.from(dailyMap.entries()),
      monthly: Array.from(monthlyMap.entries()),
      peakHour: Array.from(hourlyMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
      peakDay: Array.from(dailyMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  };

  const prepareBrandRevenue = (data: any) => {
    const brandMap = new Map();
    
    data.orders?.forEach((order: any) => {
      order.line_items?.forEach((item: any) => {
        const brand = item.brand || 'Unknown';
        if (!brandMap.has(brand)) {
          brandMap.set(brand, {
            name: brand,
            revenue: 0,
            orderCount: 0,
            itemCount: 0
          });
        }
        
        const brandData = brandMap.get(brand);
        brandData.revenue += item.total || (item.quantity * item.rate) || 0;
        brandData.orderCount += 1;
        brandData.itemCount += item.quantity || 0;
      });
    });
    
    return Array.from(brandMap.values())
      .sort((a, b) => b.revenue - a.revenue);
  };

  const prepareCustomerSegments = (data: any) => {
    const customers = data.performance?.top_customers || [];
    
    const segments = {
      vip: customers.filter((c: any) => c.total_spent > 10000),
      regular: customers.filter((c: any) => c.total_spent > 1000 && c.total_spent <= 10000),
      occasional: customers.filter((c: any) => c.total_spent <= 1000),
      new: customers.filter((c: any) => c.order_count === 1),
      returning: customers.filter((c: any) => c.order_count > 1)
    };
    
    return {
      segments,
      distribution: Object.entries(segments).map(([key, value]) => ({
        segment: key,
        count: value.length,
        revenue: value.reduce((sum, c: any) => sum + (c.total_spent || 0), 0)
      }))
    };
  };

  const prepareProductMix = (data: any) => {
    const categoryMap = new Map();
    
    data.performance?.top_items?.forEach((item: any) => {
      const category = item.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          revenue: 0,
          quantity: 0,
          items: []
        });
      }
      
      const catData = categoryMap.get(category);
      catData.revenue += item.revenue || 0;
      catData.quantity += item.quantity || 0;
      catData.items.push(item);
    });
    
    return Array.from(categoryMap.values());
  };

  const prepareChannelBreakdown = (data: any) => {
    const channelMap = new Map();
    
    data.orders?.forEach((order: any) => {
      const channel = order.is_marketplace_order ? 'Marketplace' : 'Direct Sales';
      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          name: channel,
          revenue: 0,
          orderCount: 0
        });
      }
      
      const channelData = channelMap.get(channel);
      channelData.revenue += order.total || 0;
      channelData.orderCount += 1;
    });
    
    return Array.from(channelMap.values());
  };

  const prepareOrderValueDistribution = (orders: any[]) => {
    const ranges = [
      { min: 0, max: 100, label: '£0-100', count: 0, total: 0 },
      { min: 100, max: 500, label: '£100-500', count: 0, total: 0 },
      { min: 500, max: 1000, label: '£500-1K', count: 0, total: 0 },
      { min: 1000, max: 5000, label: '£1K-5K', count: 0, total: 0 },
      { min: 5000, max: Infinity, label: '£5K+', count: 0, total: 0 }
    ];
    
    orders?.forEach(order => {
      const value = order.total || 0;
      const range = ranges.find(r => value >= r.min && value < r.max);
      if (range) {
        range.count += 1;
        range.total += value;
      }
    });
    
    return ranges;
  };

  const prepareAOVFactors = (data: any) => {
    const factors = [];
    
    // Calculate average items per order
    const avgItemsPerOrder = data.orders?.reduce((sum: number, order: any) => {
      return sum + (order.line_items?.length || 0);
    }, 0) / Math.max(data.orders?.length || 1, 1);
    
    factors.push({
      factor: 'Average Items per Order',
      value: avgItemsPerOrder.toFixed(2),
      impact: avgItemsPerOrder > 3 ? 'positive' : 'negative'
    });
    
    // Calculate discount impact
    const ordersWithDiscount = data.orders?.filter((o: any) => o.discount_amount > 0) || [];
    const discountRate = (ordersWithDiscount.length / Math.max(data.orders?.length || 1, 1)) * 100;
    
    factors.push({
      factor: 'Discount Rate',
      value: `${discountRate.toFixed(1)}%`,
      impact: discountRate > 30 ? 'negative' : 'neutral'
    });
    
    return factors;
  };

  const prepareBundleAnalysis = (orders: any[]) => {
    const bundleMap = new Map();
    
    orders?.forEach(order => {
      if (order.line_items?.length > 1) {
        // Create a bundle key from sorted item names
        const bundle = order.line_items
          .map((item: any) => item.item_name || item.name)
          .sort()
          .join(' + ');
        
        if (!bundleMap.has(bundle)) {
          bundleMap.set(bundle, {
            items: bundle,
            count: 0,
            revenue: 0
          });
        }
        
        const bundleData = bundleMap.get(bundle);
        bundleData.count += 1;
        bundleData.revenue += order.total || 0;
      }
    });
    
    return Array.from(bundleMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const prepareCustomerAOV = (data: any) => {
    const customerAOVMap = new Map();
    
    data.performance?.top_customers?.forEach((customer: any) => {
      const aov = customer.total_spent / Math.max(customer.order_count, 1);
      customerAOVMap.set(customer.name, {
        name: customer.name,
        aov: aov,
        orderCount: customer.order_count,
        totalSpent: customer.total_spent
      });
    });
    
    return {
      topAOVCustomers: Array.from(customerAOVMap.values())
        .sort((a, b) => b.aov - a.aov)
        .slice(0, 10),
      averageAOV: Array.from(customerAOVMap.values())
        .reduce((sum, c) => sum + c.aov, 0) / Math.max(customerAOVMap.size, 1)
    };
  };

  const prepareInvoiceAging = (invoices: any) => {
    const agingBuckets = [
      { range: '0-30 days', min: 0, max: 30, count: 0, total: 0 },
      { range: '31-60 days', min: 31, max: 60, count: 0, total: 0 },
      { range: '61-90 days', min: 61, max: 90, count: 0, total: 0 },
      { range: '90+ days', min: 91, max: Infinity, count: 0, total: 0 }
    ];
    
    invoices?.overdue?.forEach((invoice: any) => {
      const daysOverdue = invoice.days_overdue || 0;
      const bucket = agingBuckets.find(b => daysOverdue >= b.min && daysOverdue <= b.max);
      if (bucket) {
        bucket.count += 1;
        bucket.total += invoice.balance || 0;
      }
    });
    
    return agingBuckets;
  };

  const prepareCustomerRisk = (invoices: any) => {
    const customerRiskMap = new Map();
    
    invoices?.overdue?.forEach((invoice: any) => {
      const customerId = invoice.customer_id;
      if (!customerRiskMap.has(customerId)) {
        customerRiskMap.set(customerId, {
          customerId,
          customerName: invoice.customer_name,
          overdueInvoices: 0,
          totalOverdue: 0,
          maxDaysOverdue: 0,
          riskLevel: 'low'
        });
      }
      
      const riskData = customerRiskMap.get(customerId);
      riskData.overdueInvoices += 1;
      riskData.totalOverdue += invoice.balance || 0;
      riskData.maxDaysOverdue = Math.max(riskData.maxDaysOverdue, invoice.days_overdue || 0);
      
      // Calculate risk level
      if (riskData.maxDaysOverdue > 90 || riskData.totalOverdue > 10000) {
        riskData.riskLevel = 'high';
      } else if (riskData.maxDaysOverdue > 60 || riskData.totalOverdue > 5000) {
        riskData.riskLevel = 'medium';
      }
    });
    
    return Array.from(customerRiskMap.values())
      .sort((a, b) => b.totalOverdue - a.totalOverdue);
  };

  const preparePaymentPatterns = (data: any) => {
    const patterns = {
      onTime: 0,
      late: 0,
      veryLate: 0,
      averageDaysToPayment: 0
    };
    
    const paidInvoices = data.invoices?.paid || [];
    let totalDays = 0;
    
    paidInvoices.forEach((invoice: any) => {
      const dueDate = new Date(invoice.due_date);
      const paidDate = new Date(invoice.paid_date || invoice.date);
      const daysDiff = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      totalDays += Math.max(0, daysDiff);
      
      if (daysDiff <= 0) {
        patterns.onTime += 1;
      } else if (daysDiff <= 30) {
        patterns.late += 1;
      } else {
        patterns.veryLate += 1;
      }
    });
    
    patterns.averageDaysToPayment = paidInvoices.length > 0 
      ? totalDays / paidInvoices.length 
      : 0;
    
    return patterns;
  };

  const extractCardSpecificData = (cardType: string, data: any) => {
    // Generic fallback for any card type not specifically handled
    switch (cardType) {
      case 'customers':
        return {
          total: data.performance?.top_customers?.length || 0,
          active: data.performance?.top_customers?.filter((c: any) => c.order_count > 1).length || 0,
          new: data.performance?.top_customers?.filter((c: any) => c.order_count === 1).length || 0
        };
      
      case 'brands':
        return {
          brands: data.performance?.brands || [],
          topBrand: data.performance?.brands?.[0] || null
        };
      
      default:
        return {
          raw: data.metrics || {},
          performance: data.performance || {}
        };
    }
  };

  const calculateVelocityScore = (item: any) => {
    // Calculate how fast an item is selling
    const daysSinceFirst = Math.floor(
      (new Date(item.lastSeen).getTime() - new Date(item.firstSeen).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceFirst === 0) return 100;
    
    const dailyVelocity = item.quantity / Math.max(daysSinceFirst, 1);
    
    // Score from 0-100 based on velocity
    return Math.min(100, Math.round(dailyVelocity * 10));
  };

  const calculateTrend = (item: any) => {
    // Simple trend calculation based on recent vs overall performance
    // In a real implementation, you'd compare recent periods
    const velocity = calculateVelocityScore(item);
    
    if (velocity > 70) return 'rising';
    if (velocity < 30) return 'declining';
    return 'stable';
  };

  // Remind invoice handler
  const handleInvoiceReminder = async (invoiceId: string, customerEmail: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      
      await fetch(`${apiUrl}/api/invoices/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId
        },
        body: JSON.stringify({
          invoiceId,
          customerEmail
        })
      });
      
      // Update local state to show reminder was sent
      const invoiceRef = doc(db, 'invoices', invoiceId);
      await updateDoc(invoiceRef, {
        lastReminded: new Date().toISOString()
      });
      
      // Refresh dashboard data
      refresh();
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  // MetricCard component
  const MetricCard: React.FC<MetricCardProps> = ({ 
    title, 
    value, 
    subtitle, 
    trend, 
    onClick, 
    onAIInsight, 
    formatter, 
    icon, 
    color = 'aqua' 
  }) => {
    const formatValue = useCallback((val: number | string) => {
      if (typeof val === 'string') return val;
      if (formatter) return formatter(val);
      if (val >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `£${(val / 1000).toFixed(1)}K`;
      return `£${val.toLocaleString()}`;
    }, [formatter]);

    const getTrendIcon = () => {
      if (!trend) return null;
      if (trend.direction === 'up') return <span className="trend-icon up">↗</span>;
      if (trend.direction === 'down') return <span className="trend-icon down">↘</span>;
      return <span className="trend-icon stable">→</span>;
    };

    return (
      <div className="metric-card-enhanced" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        <div className="card-header-enhanced">
          <div className="metric-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <h3 className="card-title">{title}</h3>
            </div>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {onAIInsight && (
            <button 
              className="ai-insight-button"
              onClick={(e) => {
                e.stopPropagation();
                onAIInsight();
              }}
              title="Get AI insights"
            >
              💡
            </button>
          )}
        </div>
        
        <div className="metric-content-enhanced">
          <div className="metric-value">
            <span className="primary-metric-enhanced">
              <CountUp 
                end={typeof value === 'number' ? value : 0} 
                duration={1.5} 
                formattingFn={formatValue} 
              />
            </span>
          </div>
          
          {trend && (
            <div className="metric-trend">
              {getTrendIcon()}
              <span style={{ color: trend.direction === 'up' ? '#6c8471' : trend.direction === 'down' ? '#a66b6b' : '#6c757d' }}>
                {trend.percentage > 0 ? '+' : ''}{trend.percentage?.toFixed(1)}%
              </span>
              <span className="trend-period">vs {trend.period}</span>
            </div>
          )}
        </div>
        
        {onClick && (
          <div className="card-footer-enhanced">
            <span className="drill-down-hint">
              Click for detailed analysis →
            </span>
          </div>
        )}
      </div>
    );
  };

  // Empty state component
  const EmptyState = ({ message }: { message: string }) => (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: '0.875rem'
    }}>
      {message}
    </div>
  );

  // Update OrderTrendsChart to be mobile-responsive
  const OrderTrendsChart = () => {
    if (!data?.orders) return null;
    
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth <= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Calculate order trends
    const trendMap = new Map();
    data.orders.forEach(order => {
      const date = new Date(order.date);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, {
          date: dateKey,
          orders: 0,
          value: 0
        });
      }
      
      const dayData = trendMap.get(dateKey);
      dayData.orders += 1;
      dayData.value += order.total || 0;
    });
    
    const trendData = Array.from(trendMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days
    
    // Calculate summary stats
    const totalOrders = trendData.reduce((sum, day) => sum + day.orders, 0);
    const totalValue = trendData.reduce((sum, day) => sum + day.value, 0);
    const avgOrdersPerDay = (totalOrders / trendData.length).toFixed(1);
    
    return (
      <div className="chart-card-enhanced">
        <h3 className="chart-title">Order Trends</h3>
        
        {isMobile && (
          <div className="mobile-chart-summary">
            <h4>Last 30 Days Summary</h4>
            <div className="summary-item">
              <span>Total Orders</span>
              <span>{totalOrders.toLocaleString()}</span>
            </div>
            <div className="summary-item">
              <span>Total Value</span>
              <span>£{totalValue.toLocaleString()}</span>
            </div>
            <div className="summary-item">
              <span>Avg Orders/Day</span>
              <span>{avgOrdersPerDay}</span>
            </div>
          </div>
        )}
        
        <div className="chart-container-enhanced">
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={isMobile ? (date) => new Date(date).getDate().toString() : undefined}
              />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="orders" 
                stroke="#448382"
                strokeWidth={isMobile ? 2 : 3}
                dot={!isMobile}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Enhanced Overview View with normalized data
  const OverviewView = () => {
    if (!data) return <EmptyState message="No data available" />;
    
    const { metrics, performance, commission, agentPerformance, orders = [] } = data;

    if (isAgentView) {
      // Extract data for agent view
      const topItems = performance?.top_items || [];
      const topCustomers = performance?.top_customers || [];
      
      // Calculate best customer performance (highest order values)
      const bestCustomers = [...topCustomers]
        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 5);

      // SalesAgent View
      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Total Orders"
              value={metrics?.totalOrders || 0}
              subtitle="Orders processed"
              icon="📦"
              formatter={(val) => val.toLocaleString()}
              onClick={() => setActiveView('orders')}
              onAIInsight={() => handleAIInsight('orders', 'Total Orders')}
            />
            <MetricCard
              title="Total Orders Value"
              value={metrics?.totalRevenue || 0}
              subtitle="Combined value of all orders"
              icon="💰"
              onAIInsight={() => handleAIInsight('order-value', 'Total Orders Value')}
            />
            <MetricCard
              title="Average Order Value"
              value={metrics?.averageOrderValue || 0}
              subtitle="Average value per order"
              icon="📊"
              onAIInsight={() => handleAIInsight('aov', 'Average Order Value')}
            />
            <MetricCard
              title="Outstanding Customer Invoices"
              value={metrics?.outstandingInvoices || 0}
              subtitle="From your customers"
              icon="📄"
              formatter={(val) => val.toLocaleString()}
              onClick={() => setActiveView('invoices')}
              onAIInsight={() => handleAIInsight('invoices', 'Outstanding Invoices')}
            />
          </div>

          <div className="overview-tables-grid">
            {/* Most Sold Items */}
            <div className="overview-table-card">
              <h3>Most Sold Items</h3>
              <div className="table-content">
                {topItems && topItems.length > 0 ? (
                  topItems.slice(0, 5).map((item, index) => (
                    <div key={item.id || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                      <span className="value">{item.quantity || 0} units</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No items data available" />
                )}
              </div>
            </div>

            {/* Best Customer Performance */}
            <div className="overview-table-card">
              <h3>Best Customer Performance</h3>
              <div className="table-content">
                {bestCustomers.length > 0 ? (
                  bestCustomers.map((customer, index) => (
                    <div key={customer.id || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{customer.name}</span>
                      <span className="value">£{(customer.total_spent || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No customer data available" />
                )}
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="overview-table-card">
              <h3>Top Selling Items</h3>
              <div className="table-content">
                {topItems && topItems.length > 0 ? (
                  topItems.slice(0, 5).map((item, index) => (
                    <div key={item.id || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                      <span className="value">£{(item.revenue || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No items data available" />
                )}
              </div>
            </div>
          </div>

          {/* Order Trends Chart */}
          <OrderTrendsChart />
        </div>
      );
    } else {
      // Brand Manager View
      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Total Orders"
              value={metrics?.totalOrders || 0}
              subtitle="All orders received"
              icon="📦"
              formatter={(val) => val.toLocaleString()}
              onClick={() => setActiveView('orders')}
              onAIInsight={() => handleAIInsight('orders', 'Total Orders')}
            />
            <MetricCard
              title="Total Revenue"
              value={metrics?.totalRevenue || 0}
              subtitle="Total revenue for period"
              icon="💰"
              onClick={() => setActiveView('revenue')}
              onAIInsight={() => handleAIInsight('revenue', 'Total Revenue')}
            />
            <MetricCard
              title="Average Order Value"
              value={metrics?.averageOrderValue || 0}
              subtitle="Average value per order"
              icon="📊"
              onAIInsight={() => handleAIInsight('aov', 'Average Order Value')}
            />
            <MetricCard
              title="Outstanding Invoices"
              value={(data.invoices?.outstanding || []).length}
              subtitle="Number of unpaid invoices"
              icon="📄"
              formatter={(val) => val.toLocaleString()}
              onClick={() => setActiveView('invoices')}
              onAIInsight={() => handleAIInsight('invoices', 'Outstanding Invoices')}
            />
          </div>

          <div className="overview-tables-grid">
            {/* Top Performing Sales Agent */}
            <div className="overview-table-card">
              <h3>Top Performing Sales Agent</h3>
              <div className="table-content">
                {agentPerformance?.agents && agentPerformance.agents.length > 0 ? (
                  agentPerformance.agents.slice(0, 5).map((agent, index) => (
                    <div key={agent.id || agent.agentUid || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{agent.agentName}</span>
                      <span className="value">£{(agent.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No agent data available" />
                )}
              </div>
            </div>

            {/* Top Performing Brand */}
            <div className="overview-table-card">
              <h3>Top Performing Brand</h3>
              <div className="table-content">
                {performance?.brands && performance.brands.length > 0 ? (
                  performance.brands.slice(0, 5).map((brand, index) => (
                    <div key={brand.name || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{brand.name}</span>
                      <span className="value">£{(brand.revenue || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No brand data available" />
                )}
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="overview-table-card">
              <h3>Top Selling Items</h3>
              <div className="table-content">
                {performance?.top_items && performance.top_items.length > 0 ? (
                  performance.top_items.slice(0, 5).map((item, index) => (
                    <div key={item.id || index} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                      <span className="value">{item.quantity || 0} units</span>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No items data available" />
                )}
              </div>
            </div>
          </div>

          {/* Order Trends Chart */}
          <OrderTrendsChart />
        </div>
      );
    }
  };

  // Enhanced Orders View with filters
  const OrdersView = () => {
    if (!data) return <EmptyState message="No data available" />;
    
    const { metrics, orders = [], performance, agentPerformance } = data;
    
    // Ensure orders is an array
    const ordersList = Array.isArray(orders) ? orders : [];
    
    // Calculate marketplace vs sales orders
    const marketplaceOrders = ordersList.filter(o => o.is_marketplace_order);
    const salesOrders = ordersList.filter(o => !o.is_marketplace_order);
    
    // Calculate year-over-year comparisons for agents
    const calculateYearOverYear = () => {
      if (!isAgentView) return { orderCount: null, orderValue: null };
      
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      const currentYearOrders = ordersList.filter(o => 
        new Date(o.date).getFullYear() === currentYear
      );
      const lastYearOrders = ordersList.filter(o => 
        new Date(o.date).getFullYear() === lastYear
      );
      
      const currentCount = currentYearOrders.length;
      const lastCount = lastYearOrders.length;
      const currentValue = currentYearOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const lastValue = lastYearOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      
      return {
        orderCount: lastCount > 0 ? ((currentCount - lastCount) / lastCount) * 100 : 0,
        orderValue: lastValue > 0 ? ((currentValue - lastValue) / lastValue) * 100 : 0
      };
    };
    
    const yearOverYear = calculateYearOverYear();
    
    // Filter orders based on current filters
    let filteredOrders = [...ordersList];
    
    if (orderFilters.brand && orderFilters.brand !== 'all') {
      filteredOrders = filteredOrders.filter(order => 
        order.line_items?.some(item => item.brand === orderFilters.brand)
      );
    }
    
    if (orderFilters.salesAgent && orderFilters.salesAgent !== 'all') {
      filteredOrders = filteredOrders.filter(order => 
        order.salesperson_uid === orderFilters.salesAgent  // Now we can use UID!
      );
    }
    
    if (orderFilters.status && orderFilters.status !== 'all') {
      filteredOrders = filteredOrders.filter(order => 
        order.status === orderFilters.status
      );
    }
    
    // Sort orders
    if (orderFilters.sortBy === 'value') {
      filteredOrders.sort((a, b) => (b.total || 0) - (a.total || 0));
    } else {
      filteredOrders.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    
    // Paginate orders
    const startIndex = (orderFilters.currentPage - 1) * orderFilters.pageSize;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + orderFilters.pageSize);
    const totalPages = Math.ceil(filteredOrders.length / orderFilters.pageSize);
    
    // Get high value orders (top 5)
    const highValueOrders = [...ordersList]
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 5);
    
    if (isAgentView) {
      // Agent View
      const topItems = performance?.top_items || [];
      const topCustomers = performance?.top_customers || [];
      const bestCustomers = [...topCustomers]
        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 5);
      
      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Total Orders"
              value={metrics.totalOrders || 0}
              subtitle="All orders in period"
              icon="📦"
              formatter={(val) => val.toLocaleString()}
              onAIInsight={() => handleAIInsight('orders', 'Total Orders')}
            />
            <MetricCard
              title="Total Order Value"
              value={metrics.totalRevenue || 0}
              subtitle="Combined value of all orders"
              icon="💰"
              onAIInsight={() => handleAIInsight('order-value', 'Total Order Value')}
            />
            <MetricCard
              title="Orders vs Last Year"
              value={yearOverYear.orderCount || 0}
              subtitle="Order count comparison"
              icon="📈"
              formatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`}
              trend={{
                direction: yearOverYear.orderCount > 0 ? 'up' : yearOverYear.orderCount < 0 ? 'down' : 'stable',
                percentage: Math.abs(yearOverYear.orderCount || 0),
                period: 'last year'
              }}
            />
            <MetricCard
              title="Value vs Last Year"
              value={yearOverYear.orderValue || 0}
              subtitle="Order value comparison"
              icon="💸"
              formatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`}
              trend={{
                direction: yearOverYear.orderValue > 0 ? 'up' : yearOverYear.orderValue < 0 ? 'down' : 'stable',
                percentage: Math.abs(yearOverYear.orderValue || 0),
                period: 'last year'
              }}
            />
          </div>

          <div className="overview-tables-grid">
            {/* Most Sold Items */}
            <div className="overview-table-card">
              <h3>Most Sold Items</h3>
              <div className="table-content">
                {topItems.slice(0, 5).map((item, index) => (
                  <div key={item.id || index} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                    <span className="value">{item.quantity || 0} units</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Best Customer Performance */}
            <div className="overview-table-card">
              <h3>Best Customer Performance</h3>
              <div className="table-content">
                {bestCustomers.map((customer, index) => (
                  <div key={customer.id || index} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{customer.customer_name || customer.name || 'Unknown'}</span>
                    <span className="value">£{(customer.total_spent || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Selling Items by Revenue */}
            <div className="overview-table-card">
              <h3>Top Selling Items</h3>
              <div className="table-content">
                {topItems.slice(0, 5).map((item, index) => (
                  <div key={item.id || index} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                    <span className="value">£{(item.revenue || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Orders Table with Filters for Agents */}
          <div className="data-table-card-enhanced">
            <div className="AP-table-header">
              <h3 className="table-title">Orders</h3>
              <div className="table-controls">
                <select 
                  value={orderFilters.pageSize}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, pageSize: Number(e.target.value), currentPage: 1 }))}
                  className="filter-select"
                >
                  <option value={10}>Show 10</option>
                  <option value={25}>Show 25</option>
                  <option value={50}>Show 50</option>
                  <option value={100}>Show 100</option>
                </select>
              </div>
            </div>
            
            <div className="table-container-enhanced">
              <table className="data-table-enhanced">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_number || order.salesorder_number}</td>
                      <td>{order.customer_name}</td>
                      <td>{new Date(order.date).toLocaleDateString('en-GB')}</td>
                      <td>£{(order.total || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${['confirmed', 'completed', 'fulfilled'].includes(order.status) ? 'success' : 'warning'}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="table-pagination">
                <button 
                  onClick={() => setOrderFilters(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={orderFilters.currentPage === 1}
                >
                  Previous
                </button>
                <span>Page {orderFilters.currentPage} of {totalPages}</span>
                <button 
                  onClick={() => setOrderFilters(prev => ({ ...prev, currentPage: Math.min(totalPages, prev.currentPage + 1) }))}
                  disabled={orderFilters.currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Manager View
      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Total Orders"
              value={metrics.totalOrders || 0}
              subtitle="All orders in period"
              icon="📦"
              formatter={(val) => val.toLocaleString()}
              onAIInsight={() => handleAIInsight('orders', 'Total Orders')}
            />
            <MetricCard
              title="Total Order Value"
              value={metrics.totalRevenue || 0}
              subtitle="Combined value of all orders"
              icon="💰"
              onAIInsight={() => handleAIInsight('order-value', 'Total Order Value')}
            />
            <MetricCard
              title="Marketplace Orders"
              value={marketplaceOrders.length}
              subtitle="Orders from marketplaces"
              icon="🛒"
              formatter={(val) => val.toLocaleString()}
            />
            <MetricCard
              title="Sales Orders"
              value={salesOrders.length}
              subtitle="Direct sales orders"
              icon="💼"
              formatter={(val) => val.toLocaleString()}
            />
          </div>

          <div className="overview-tables-grid">
            {/* High Order Values */}
            <div className="overview-table-card">
              <h3>High Order Values (Top 5)</h3>
              <div className="table-content">
                {highValueOrders.map((order, index) => (
                  <div key={order.id} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{order.order_number || order.salesorder_number}</span>
                    <span className="value">£{(order.total || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Brand */}
            <div className="overview-table-card">
              <h3>Top Performing Brand (Top 5)</h3>
              <div className="table-content">
                {performance?.brands && performance.brands.slice(0, 5).map((brand, index) => (
                  <div key={brand.name} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{brand.name}</span>
                    <span className="value">£{(brand.revenue || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Orders Table with Advanced Filters */}
          <div className="data-table-card-enhanced">
            <div className="AP-table-header">
              <h3 className="table-title">Orders</h3>
              <div className="table-controls">
                <select 
                  value={orderFilters.brand || 'all'}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, brand: e.target.value, currentPage: 1 }))}
                  className="filter-select"
                >
                  <option value="all">All Brands</option>
                  <option value="blomus">Blomus</option>
                  <option value="elvang">Elvang</option>
                  <option value="rader">Räder</option>
                  <option value="remember">Remember</option>
                  <option value="relaxound">Relaxound</option>
                  <option value="my flame">My Flame</option>
                </select>
                
                <select 
                  value={orderFilters.salesAgent || 'all'}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, salesAgent: e.target.value, currentPage: 1 }))}
                  className="filter-select"
                >
                  <option value="all">All Sales Agents</option>
                  {agentPerformance?.agents.map(agent => (
                    <option key={agent.agentUid} value={agent.agentUid}>  {/* Use agentUid (Firebase UID) */}
                      {agent.agentName}
                    </option>
                  ))}
                </select>
                
                <select 
                  value={orderFilters.status || 'all'}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, status: e.target.value, currentPage: 1 }))}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                </select>
                
                <select 
                  value={orderFilters.sortBy || 'date'}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, sortBy: e.target.value as 'value' | 'date' }))}
                  className="filter-select"
                >
                  <option value="date">Sort by Date</option>
                  <option value="value">Sort by Value</option>
                </select>
                
                <select 
                  value={orderFilters.pageSize}
                  onChange={(e) => setOrderFilters(prev => ({ ...prev, pageSize: Number(e.target.value), currentPage: 1 }))}
                  className="filter-select"
                >
                  <option value={10}>Show 10</option>
                  <option value={25}>Show 25</option>
                  <option value={50}>Show 50</option>
                  <option value={100}>Show 100</option>
                </select>
              </div>
            </div>
            
            <div className="table-container-enhanced">
              <table className="data-table-enhanced">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Salesperson</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_number || order.salesorder_number}</td>
                      <td>{order.customer_name}</td>
                      <td>{order.salesperson_name || 'Marketplace'}</td>
                      <td>{new Date(order.date).toLocaleDateString('en-GB')}</td>
                      <td>£{(order.total || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${['confirmed', 'completed', 'fulfilled'].includes(order.status) ? 'success' : 'warning'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        {order.is_marketplace_order ? (
                          <span className="marketplace-badge">{order.marketplace_source || 'Marketplace'}</span>
                        ) : (
                          <span className="direct-badge">Direct</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="table-pagination">
                <button 
                  onClick={() => setOrderFilters(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={orderFilters.currentPage === 1}
                >
                  Previous
                </button>
                <span>Page {orderFilters.currentPage} of {totalPages}</span>
                <button 
                  onClick={() => setOrderFilters(prev => ({ ...prev, currentPage: Math.min(totalPages, prev.currentPage + 1) }))}
                  disabled={orderFilters.currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  // Updated Revenue View for Brand Managers only
  const RevenueView = () => {
    if (!data || isAgentView) return <EmptyState message="No data available" />;
    
    const { metrics, orders = [], performance, agentPerformance } = data;
    
    // Calculate gross revenue and average order value
    const grossRevenue = metrics.totalRevenue || 0;
    const averageOrderValue = metrics.averageOrderValue || 0;
    
    // Get top performing by revenue
    const topAgentsByRevenue = agentPerformance?.agents
      ? [...agentPerformance.agents].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)
      : [];
    
    const topBrandsByRevenue = performance?.brands
      ? [...performance.brands].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      : [];
    
    const topItemsByRevenue = performance?.top_items
      ? [...performance.top_items].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      : [];
    
    return (
      <div className="view-content">
        <div className="metrics-grid-enhanced" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <MetricCard
            title="Gross Revenue"
            value={grossRevenue}
            subtitle="Total revenue for the period"
            icon="💰"
            onAIInsight={() => handleAIInsight('gross-revenue', 'Gross Revenue')}
          />
          <MetricCard
            title="Average Order Value"
            value={averageOrderValue}
            subtitle="Average value per order"
            icon="📊"
            onAIInsight={() => handleAIInsight('aov', 'Average Order Value')}
          />
        </div>

        <div className="overview-tables-grid">
          {/* Top Performing Sales Agent by Revenue */}
          <div className="overview-table-card">
            <h3>Top Performing Sales Agent (Revenue)</h3>
            <div className="table-content">
              {topAgentsByRevenue.map((agent, index) => (
                <div key={agent.agentUid || index} className="table-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{agent.agentName}</span>
                  <span className="value">£{(agent.totalRevenue || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performing Brand by Revenue */}
          <div className="overview-table-card">
            <h3>Top Performing Brand (Revenue)</h3>
            <div className="table-content">
              {topBrandsByRevenue.map((brand, index) => (
                <div key={brand.name || index} className="table-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{brand.name}</span>
                  <span className="value">£{(brand.revenue || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Items by Revenue */}
          <div className="overview-table-card">
            <h3>Top Selling Items (Revenue)</h3>
            <div className="table-content">
              {topItemsByRevenue.map((item, index) => (
                <div key={item.id || index} className="table-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{item.product_name || item.item_name || item.name || 'Unknown'}</span>
                  <span className="value">£{(item.revenue || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Updated Invoices View with Remind functionality
  const InvoicesView = () => {
    if (!data) return <EmptyState message="No data available" />;
    
    const { invoices } = data;
    
    if (isAgentView) {
      // Agent view - group by customer
      const customersWithOverdue = new Map();
      
      invoices.overdue.forEach(inv => {
        if (!customersWithOverdue.has(inv.customer_id)) {
          customersWithOverdue.set(inv.customer_id, {
            customerName: inv.customer_name,
            customerEmail: inv.customer_email,
            totalOverdue: 0,
            maxDaysOverdue: 0,
            invoiceCount: 0,
            invoices: []
          });
        }
        
        const customer = customersWithOverdue.get(inv.customer_id);
        customer.totalOverdue += inv.balance;
        customer.maxDaysOverdue = Math.max(customer.maxDaysOverdue, inv.days_overdue);
        customer.invoiceCount += 1;
        customer.invoices.push(inv);
      });

      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Customers with Overdue"
              value={customersWithOverdue.size}
              subtitle="Number of customers"
              icon="👥"
              formatter={(val) => val.toLocaleString()}
            />
            <MetricCard
              title="Total Overdue"
              value={invoices.overdue.reduce((sum, inv) => sum + inv.balance, 0)}
              subtitle="Total overdue amount"
              icon="💰"
            />
          </div>

          <div className="data-table-card-enhanced">
            <div className="AP-table-header">
              <h3 className="table-title">Customers with Overdue Invoices</h3>
            </div>
            <div className="table-container-enhanced">
              <table className="data-table-enhanced">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Total Overdue</th>
                    <th>Invoices</th>
                    <th>Max Days Overdue</th>
                    <th>Last Reminded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(customersWithOverdue.entries()).map(([customerId, customer]) => (
                    <tr key={customerId}>
                      <td>{customer.customerName}</td>
                      <td>£{customer.totalOverdue.toLocaleString()}</td>
                      <td>{customer.invoiceCount}</td>
                      <td>{customer.maxDaysOverdue} days</td>
                      <td>
                        {customer.invoices[0]?.lastReminded 
                          ? new Date(customer.invoices[0].lastReminded).toLocaleDateString('en-GB') 
                          : 'Never'
                        }
                      </td>
                      <td>
                        <button 
                          className="remind-button"
                          onClick={() => handleInvoiceReminder(
                            customer.invoices[0].invoice_id || customer.invoices[0].id,
                            customer.invoices[0].customer_email || customer.customerEmail || ''
                          )}
                        >
                          Remind
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    } else {
      // Manager view
      return (
        <div className="view-content">
          <div className="metrics-grid-enhanced">
            <MetricCard
              title="Total Overdue"
              value={invoices.overdue.reduce((sum, inv) => sum + inv.balance, 0)}
              subtitle={`${invoices.overdue.length} invoices`}
              icon="📄"
              onAIInsight={() => handleAIInsight('overdue', 'Overdue Invoices')}
            />
            <MetricCard
              title="Total Outstanding"
              value={invoices.outstanding.reduce((sum, inv) => sum + inv.balance, 0)}
              subtitle={`${invoices.outstanding.length} invoices`}
              icon="💰"
              onAIInsight={() => handleAIInsight('outstanding', 'Outstanding Invoices')}
            />
            <MetricCard
              title="Total Paid"
              value={invoices.paid.reduce((sum, inv) => sum + inv.total, 0)}
              subtitle={`${invoices.paid.length} invoices`}
              icon="✅"
              onAIInsight={() => handleAIInsight('paid', 'Paid Invoices')}
            />
          </div>

          <div className="data-table-card-enhanced">
            <div className="AP-table-header">
              <h3 className="table-title">Outstanding Invoices</h3>
            </div>
            <div className="table-container-enhanced">
              <table className="data-table-enhanced">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Last Reminded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.outstanding.slice(0, 10).map((invoice) => (
                    <tr key={invoice.id || invoice.invoice_id}>
                      <td>{invoice.invoice_number}</td>
                      <td>{invoice.customer_name}</td>
                      <td>£{invoice.balance.toLocaleString()}</td>
                      <td>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                      <td>
                        <span className={`status-badge ${invoice.days_overdue > 0 ? 'error' : 'warning'}`}>
                          {invoice.days_overdue > 0 ? `${invoice.days_overdue} days overdue` : 'Due'}
                        </span>
                      </td>
                      <td>
                        {invoice.lastReminded 
                          ? new Date(invoice.lastReminded).toLocaleDateString('en-GB') 
                          : 'Never'
                        }
                      </td>
                      <td>
                        <button 
                          className="remind-button"
                          onClick={() => handleInvoiceReminder(
                            invoice.invoice_id || invoice.id,
                            invoice.customer_email || ''
                          )}
                        >
                          Remind
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
  };

  // Replace the existing BrandsView function with this enhanced version:
  const BrandsView = () => {
    if (!data || isAgentView) return <EmptyState message="No data available" />;
    
    const [brandData, setBrandData] = useState<any[]>([]);
    const [loadingBrands, setLoadingBrands] = useState(true);
    
    // Fetch brand data from the brands collection
    useEffect(() => {
      const fetchBrandData = async () => {
        try {
          setLoadingBrands(true);
          const brandsSnapshot = await getDocs(collection(db, 'brands'));
          const brands: any[] = [];
          
          brandsSnapshot.forEach(doc => {
            const data = doc.data();
            const metrics = data[`metrics_${dateRange}`] || data.metrics_30_days || {};
            
            // Only include brands with actual data
            if (metrics.total_revenue > 0 || metrics.total_quantity > 0) {
              brands.push({
                id: doc.id,
                name: data.brand_name,
                revenue: metrics.total_revenue || 0,
                quantity: metrics.total_quantity || 0,
                market_share: metrics.market_share || 0,
                marketplace_orders: metrics.marketplace_orders || 0,
                direct_orders: metrics.direct_orders || 0,
                average_order_value: metrics.average_order_value || 0,
                active_products: metrics.active_products || 0,
                best_selling_item: metrics.best_selling_item || null,
                top_selling_items: metrics.top_selling_items || [],
                top_revenue_items: metrics.top_revenue_items || []
              });
            }
          });
          
          // Sort by revenue
          brands.sort((a, b) => b.revenue - a.revenue);
          setBrandData(brands);
        } catch (error) {
          console.error('Error fetching brand data:', error);
        } finally {
          setLoadingBrands(false);
        }
      };
      
      fetchBrandData();
    }, [dateRange]);
    
if (loadingBrands) {
  return (
    <div className="loading-container">
      <ProgressLoader
        progress={loadingProgress}
        message="Generating Dashboard"
        submessage="Loading your brand data..."
        size={100}
      />
    </div>
  );
}
    
    if (brandData.length === 0) {
      return <EmptyState message="No brand data available" />;
    }
    
    // Get top and bottom performers
    const topBrand = brandData[0];
    const bottomBrand = brandData[brandData.length - 1];
    const mostOrdersBrand = [...brandData].sort((a, b) => 
      (b.marketplace_orders + b.direct_orders) - (a.marketplace_orders + a.direct_orders)
    )[0];

    return (
      <div className="view-content">
        <div className="metrics-grid-enhanced">
          <MetricCard
            title={`Top Brand: ${topBrand.name}`}
            value={topBrand.revenue}
            subtitle={`${topBrand.market_share.toFixed(1)}% market share`}
            icon="🥇"
            onAIInsight={() => handleAIInsight('top-brand', 'Top Brand Performance')}
          />
          <MetricCard
            title={`Most Orders: ${mostOrdersBrand.name}`}
            value={mostOrdersBrand.marketplace_orders + mostOrdersBrand.direct_orders}
            subtitle="Total orders"
            icon="📦"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="Active Products"
            value={brandData.reduce((sum, brand) => sum + brand.active_products, 0)}
            subtitle="Across all brands"
            icon="📋"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title={`Bottom Brand: ${bottomBrand.name}`}
            value={bottomBrand.revenue}
            subtitle={`${bottomBrand.market_share.toFixed(1)}% market share`}
            icon="📉"
            onAIInsight={() => handleAIInsight('bottom-brand', 'Bottom Brand Performance')}
          />
        </div>
        
        {/* Mobile-optimized table */}
        <div className="brands-table-enhanced">
          <h3>Brand Performance Analysis</h3>
          {window.innerWidth <= 768 ? (
            // Mobile card view
            <div className="mobile-brand-cards">
              {brandData.map(brand => (
                <div key={brand.id} className="mobile-brand-card">
                  <div className="brand-header">
                    <h4>{brand.name}</h4>
                    <span className="brand-share">{brand.market_share.toFixed(1)}%</span>
                  </div>
                  <div className="brand-metrics">
                    <div className="metric">
                      <span className="label">Revenue</span>
                      <span className="value">£{brand.revenue.toLocaleString()}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Orders</span>
                      <span className="value">{(brand.direct_orders + brand.marketplace_orders).toLocaleString()}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Items Sold</span>
                      <span className="value">{brand.quantity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Desktop table view
            <table className="data-table-enhanced">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Revenue</th>
                  <th>Market Share</th>
                  <th>Items Sold</th>
                  <th>Direct Orders</th>
                  <th>Marketplace</th>
                  <th>Avg Order Value</th>
                  <th>Active Products</th>
                  <th>Best Seller</th>
                </tr>
              </thead>
              <tbody>
                {brandData.map(brand => (
                  <tr key={brand.id}>
                    <td style={{ fontWeight: 'bold' }}>{brand.name}</td>
                    <td>£{brand.revenue.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '60px', 
                          height: '8px', 
                          backgroundColor: '#e5e7eb', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${brand.market_share}%`, 
                            height: '100%', 
                            backgroundColor: '#448382',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span>{brand.market_share.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>{brand.quantity.toLocaleString()}</td>
                    <td>{brand.direct_orders.toLocaleString()}</td>
                    <td>{brand.marketplace_orders.toLocaleString()}</td>
                    <td>£{brand.average_order_value.toFixed(2)}</td>
                    <td>{brand.active_products}</td>
                    <td>
                      {brand.best_selling_item ? (
                        <span className="best-seller">
                          {brand.best_selling_item.item_name} ({brand.best_selling_item.quantity} units)
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="brand-items-container" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            Top Selling Items by Brand
          </h3>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem' 
          }}>
            {brandData.slice(0, 3).map(brand => (
              <div key={brand.id} className="overview-table-card">
                <h3>{brand.name} - Top Items</h3>
                <div className="table-content">
                  {brand.top_selling_items.slice(0, 5).map((item: any, index: number) => (
                    <div key={item.item_id} className="table-row">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{item.item_name}</span>
                      <span className="value">{item.quantity} units</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }; 

  // Customers View (Sales Agent only)
  const CustomersView = () => {
    if (!data || !isAgentView) return <EmptyState message="No data available" />;
    
    const { performance } = data;
    const customers = performance?.top_customers || [];
    
    // Helper function to get date range
    const getDateRange = (dateRange: string) => {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7_days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30_days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      return { startDate, endDate: now };
    };
    
    // Calculate customer metrics
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const activeCustomers = customers.filter(c => {
      const lastOrderDate = c.last_order_date ? new Date(c.last_order_date) : null;
      return lastOrderDate && lastOrderDate > sixMonthsAgo;
    });
    
    const inactiveCustomers = customers.filter(c => {
      const lastOrderDate = c.last_order_date ? new Date(c.last_order_date) : null;
      return !lastOrderDate || lastOrderDate <= sixMonthsAgo;
    });
    
    const { startDate } = getDateRange(dateRange);
    const newCustomers = customers.filter(c => {
      const createdDate = c.created_time ? new Date(c.created_time) : null;
      return createdDate && createdDate >= startDate;
    });
      
    // Pagination for customer list
    const [customerPage, setCustomerPage] = useState(1);
    const customersPerPage = 10;
    const startIndex = (customerPage - 1) * customersPerPage;
    const paginatedCustomers = customers.slice(startIndex, startIndex + customersPerPage);
    const totalCustomerPages = Math.ceil(customers.length / customersPerPage);
    
    return (
      <div className="view-content">
        <div className="metrics-grid-enhanced">
          <MetricCard
            title="Active Customers"
            value={activeCustomers.length}
            subtitle="Ordered in last 6 months"
            icon="✅"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="Inactive Customers"
            value={inactiveCustomers.length}
            subtitle="No orders in 6 months"
            icon="⚠️"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="New Customers"
            value={newCustomers.length}
            subtitle="Added in selected period"
            icon="🆕"
            formatter={(val) => val.toLocaleString()}
          />
        </div>

        <div className="data-table-card-enhanced">
          <div className="AP-table-header">
            <h3 className="table-title">Customer List</h3>
          </div>
          <div className="table-container-enhanced">
            <table className="data-table-enhanced">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Total Spent</th>
                  <th>Order Count</th>
                  <th>Last Order</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((customer) => {
                  const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
                  const isActive = lastOrderDate && lastOrderDate > sixMonthsAgo;
                  
                  return (
                    <tr key={customer.id}>
                      <td>{customer.customer_name || customer.name || 'Unknown'}</td>
                      <td>£{(customer.total_spent || 0).toLocaleString()}</td>
                      <td>{customer.order_count || 0}</td>
                      <td>{lastOrderDate ? lastOrderDate.toLocaleDateString('en-GB') : 'Never'}</td>
                      <td>
                        <span className={`status-badge ${isActive ? 'success' : 'warning'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="view-details-button"
                          onClick={() => {/* Navigate to customer details */}}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalCustomerPages > 1 && (
            <div className="table-pagination">
              <button 
                onClick={() => setCustomerPage(Math.max(1, customerPage - 1))}
                disabled={customerPage === 1}
              >
                Previous
              </button>
              <span>Page {customerPage} of {totalCustomerPages}</span>
              <button 
                onClick={() => setCustomerPage(Math.min(totalCustomerPages, customerPage + 1))}
                disabled={customerPage === totalCustomerPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const EnhancedForecastingView = () => {
    const [forecast, setForecast] = useState<any>(null);
    const [isLoadingForecast, setIsLoadingForecast] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    const generateComprehensiveForecast = async () => {
      setIsLoadingForecast(true);
      try {
        const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
        
        const response = await fetch(`${apiUrl}/api/ai-insights/enhanced-forecast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': currentUserId
          },
          body: JSON.stringify({
            dashboardData: {
              ...data,
              historicalRange: '12_months', // Request more historical data
              includeSeasonalAnalysis: true,
              includeCustomerSegmentation: true,
              includeAgentPerformance: true
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          setForecast(result.data);
        }
      } catch (error) {
        console.error('Forecast generation error:', error);
        setForecast({ error: 'Unable to generate forecast' });
      } finally {
        setIsLoadingForecast(false);
      }
    };

    useEffect(() => {
      generateComprehensiveForecast();
    }, []);

    const forecastTabs = [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'revenue', label: 'Revenue Forecast', icon: '💰' },
      { id: 'seasonal', label: 'Seasonal Trends', icon: '📅' },
      { id: 'customers', label: 'Customer Analysis', icon: '👥' },
      { id: 'agents', label: 'Agent Performance', icon: '💼' },
      { id: 'risks', label: 'Risk Assessment', icon: '⚠️' }
    ];

    return (
      <div className="view-content forecasting-enhanced">
        {/* Tab Navigation */}
        <div className="forecast-tabs">
          {forecastTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`forecast-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="forecast-content">
          {isLoadingForecast ? (
            <div className="ai-loading">
              <Lottie animationData={loaderAnimation} loop={true} autoplay={true} style={{ width: 150, height: 150 }} />
              <p>Generating comprehensive forecast analysis...</p>
            </div>
          ) : forecast ? (
            <>
              {activeTab === 'overview' && <ForecastOverview forecast={forecast} />}
              {activeTab === 'revenue' && <RevenueForecast forecast={forecast} />}
              {activeTab === 'seasonal' && <SeasonalAnalysis forecast={forecast} />}
              {activeTab === 'customers' && <CustomerForecast forecast={forecast} />}
              {activeTab === 'agents' && <AgentForecast forecast={forecast} />}
              {activeTab === 'risks' && <RiskAssessment forecast={forecast} />}
            </>
          ) : (
            <div className="forecast-error">
              <p>Unable to generate forecast</p>
              <button onClick={generateComprehensiveForecast}>Retry</button>
            </div>
          )}
        </div>

        {/* Regenerate Button */}
        <div className="forecast-actions">
          <button 
            className="regenerate-button" 
            onClick={generateComprehensiveForecast}
            disabled={isLoadingForecast}
          >
            🔄 Regenerate Forecast
          </button>
        </div>
      </div>
    );
  };

  // Add forecast sub-components
  const ForecastOverview = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Forecast Overview</h3>
      <p>{forecast.overview || 'Loading overview...'}</p>
    </div>
  );

  const RevenueForecast = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Revenue Forecast</h3>
      <p>{forecast.revenueForecast || 'Loading revenue forecast...'}</p>
    </div>
  );

  const SeasonalAnalysis = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Seasonal Analysis</h3>
      <p>{forecast.seasonalAnalysis || 'Loading seasonal analysis...'}</p>
    </div>
  );

  const CustomerForecast = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Customer Forecast</h3>
      <p>{forecast.customerForecast || 'Loading customer forecast...'}</p>
    </div>
  );

  const AgentForecast = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Agent Performance Forecast</h3>
      <p>{forecast.agentForecast || 'Loading agent forecast...'}</p>
    </div>
  );

  const RiskAssessment = ({ forecast }: { forecast: any }) => (
    <div className="forecast-section">
      <h3>Risk Assessment</h3>
      <p>{forecast.riskAssessment || 'Loading risk assessment...'}</p>
    </div>
  );

  const EnhancedAIInsightModal = () => {
    if (!aiInsightModal.isOpen) return null;
    
    const insight = aiInsightModal.insight;
    const isEnhanced = aiInsightModal.enhanced && insight?.itemTrends;
    
    return (
      <div className="ai-insight-overlay" onClick={() => setAiInsightModal({ ...aiInsightModal, isOpen: false })}>
        <div className="ai-insight-modal enhanced" onClick={(e) => e.stopPropagation()}>
          <div className="ai-modal-header">
            <div className="ai-header-content">
              <div className="ai-icon">💡</div>
              <div>
                <h3 className="ai-modal-title">AI Insights: {aiInsightModal.cardTitle}</h3>
                <p className="ai-modal-subtitle">Powered by Google Gemini Pro</p>
              </div>
            </div>
            <button className="ai-close-button" onClick={() => setAiInsightModal({ ...aiInsightModal, isOpen: false })}>×</button>
          </div>
          
          <div className="ai-modal-content-scrollable">
            {aiInsightModal.isLoading ? (
              <div className="ai-loading">
                <Lottie animationData={loaderAnimation} loop={true} autoplay={true} style={{ width: 100, height: 100 }} />
                <p>Analyzing data and generating deep insights...</p>
              </div>
            ) : insight ? (
              <>
                <div className="ai-insight-section">
                  <h4>💡 Key Insight</h4>
                  <p className="ai-insight-text">{insight.insight}</p>
                </div>
                
                {isEnhanced && (
                  <>
                    {/* Item Trends for Orders */}
                    {insight.itemTrends && (
                      <div className="ai-insight-section">
                        <h4>📈 Item Analysis</h4>
                        <div className="item-trends-grid">
                          <div className="trend-card">
                            <h5>Top Performing Item</h5>
                            <p>{insight.itemTrends.topItem}</p>
                          </div>
                          {insight.itemTrends.emergingTrends?.length > 0 && (
                            <div className="trend-card">
                              <h5>Emerging Trends</h5>
                              <ul>
                                {insight.itemTrends.emergingTrends.map((trend: string, idx: number) => (
                                  <li key={idx}>{trend}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {insight.itemTrends.decliningItems?.length > 0 && (
                            <div className="trend-card warning">
                              <h5>Declining Items</h5>
                              <ul>
                                {insight.itemTrends.decliningItems.map((item: string, idx: number) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Value Analysis */}
                    {insight.valueAnalysis && (
                      <div className="ai-insight-section">
                        <h4>💰 Value Analysis</h4>
                        <div className="value-metrics">
                          <div className="metric">
                            <span>Current AOV</span>
                            <span className="value">£{insight.valueAnalysis.currentAOV}</span>
                          </div>
                          <div className="metric">
                            <span>Historical Comparison</span>
                            <span className={`value ${insight.valueAnalysis.historicalComparison.includes('+') ? 'positive' : 'negative'}`}>
                              {insight.valueAnalysis.historicalComparison}
                            </span>
                          </div>
                        </div>
                        {insight.valueAnalysis.recommendations && (
                          <div className="recommendations">
                            <h5>Recommendations</h5>
                            <ul>
                              {insight.valueAnalysis.recommendations.map((rec: string, idx: number) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Volume Trends */}
                    {insight.volumeTrends && (
                      <div className="ai-insight-section">
                        <h4>📊 Volume Trends</h4>
                        <div className="volume-analysis">
                          <p><strong>Historical Comparison:</strong> {insight.volumeTrends.comparison}</p>
                          <p><strong>Seasonal Pattern:</strong> {insight.volumeTrends.seasonalPattern}</p>
                          <p><strong>Monthly Trend:</strong> {insight.volumeTrends.monthlyTrend}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                <div className="ai-insight-grid">
                  <div className="ai-insight-card">
                    <h5>📈 Current Trend</h5>
                    <p className={`trend-${insight.trend}`}>{insight.trend}</p>
                  </div>
                  
                  <div className="ai-insight-card">
                    <h5>🎯 Recommended Action</h5>
                    <p>{insight.action}</p>
                  </div>
                  
                  <div className="ai-insight-card">
                    <h5>📊 Business Impact</h5>
                    <p>{insight.impact}</p>
                  </div>
                  
                  <div className={`ai-insight-card priority-card priority-${insight.priority}`}>
                    <h5>⚡ Priority Level</h5>
                    <p className="priority-text">{insight.priority.toUpperCase()}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="ai-error">
                <p>Unable to generate insights at this time. Please try again.</p>
              </div>
            )}
          </div>
          
          <div className="ai-modal-footer">
            <p className="ai-disclaimer">
              AI insights are generated based on current and historical data trends.
            </p>
          </div>
        </div>
      </div>
    );
  };

if (loading) {
  return (
    <div className="loading-container">
      <ProgressLoader
        progress={loadingProgress}
        message="Generating Dashboard"
        submessage="Loading your business metrics..."
        size={100}
      />
    </div>
  );
}

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3 className="error-title">Dashboard Loading Error</h3>
          <p className="error-message">{error}</p>
          <button onClick={refresh} className="error-button">Try Again</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <p className="loading-text">No data available</p>
          <button onClick={refresh} className="error-button">Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-enhanced">
      <div className="dashboard-container-enhanced">
        {/* Enhanced Header with integrated tabs */}
        <header className="dashboard-header-enhanced">
          <div className="header-top-row">
            <div className="header-left">
              <div className="logo-placeholder">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload}
                  id="logo-upload"
                />
                {logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" />
                ) : (
                  <span>Logo</span>
                )}
              </div>
              <div className="header-title-section">
                <h1 className="dashboard-title">Dashboard</h1>
                <p className="header-subtitle">
                  {isAgentView ? 
                    'Track your individual performance' : 
                    'Monitor business performance'
                  }
                </p>
              </div>
            </div>
            
            <div className="header-controls-enhanced">
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className="date-selector-enhanced"
              >
                <option value="today">Today</option>
                <option value="7_days">Last 7 days</option>
                <option value="30_days">Last 30 days</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
              
              {dateRange === 'custom' && (
                <div className="custom-date-range-enhanced">
                  <DatePicker
                    selected={customDateRange.start}
                    onChange={(date: Date | null) => {
                      if (date) setCustomDateRange(prev => ({ ...prev, start: date }));
                    }}
                    className="date-input-enhanced"
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Start"
                  />
                  <DatePicker
                    selected={customDateRange.end}
                    onChange={(date: Date | null) => {
                      if (date) setCustomDateRange(prev => ({ ...prev, end: date }));
                    }}
                    className="date-input-enhanced"
                    dateFormat="dd/MM/yyyy"
                    placeholderText="End"
                  />
                </div>
              )}
              
              <button onClick={refresh} className="refresh-button-enhanced">
                <svg className="refresh-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Sliding tabs inside header */}
          <div className="sliding-tabs-container">
            <div className="sliding-tabs" ref={tabsContainerRef}>
              <div ref={tabIndicatorRef} className="tab-indicator" />
              {availableViews.map(view => (
                <button
                  key={view.id}
                  ref={activeView === view.id ? activeTabRef : null}
                  onClick={() => setActiveView(view.id)}
                  className={`tab-buttondash ${activeView === view.id ? 'active' : ''}`}
                >
                  <span>{view.icon}</span>
                  <span>{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Dynamic View Content */}
        {activeView === 'overview' && <OverviewView />}
        {activeView === 'orders' && <OrdersView />}
        {activeView === 'revenue' && !isAgentView && <RevenueView />}
        {activeView === 'invoices' && <InvoicesView />}
        {activeView === 'brands' && !isAgentView && <BrandsView />}
        {activeView === 'forecasting' && !isAgentView && <EnhancedForecastingView />}
        {activeView === 'customers' && isAgentView && <CustomersView />}

        {/* AI Insight Modal */}
        <EnhancedAIInsightModal />
      </div>
    </div>
  );
};

export default EnhancedDashboard;