// src/hooks/useDashboard.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardAPI } from '../services/api';
import { 
  NormalizedDashboardData, 
  UseDashboardOptions, 
  UseDashboardReturn,
  APIResponse 
} from '../types/dashboard';

export const useDashboard = ({
  userId,
  dateRange = '30_days',
  customDateRange,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  isAgentView = false
}: UseDashboardOptions): UseDashboardReturn => {
  const [data, setData] = useState<NormalizedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Use refs to track mounted state and interval
  const isMounted = useRef(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔄 Fetching dashboard for user: ${userId}, range: ${dateRange}`);

      const params: any = {
        dateRange,
        ...(customDateRange && dateRange === 'custom' && {
          startDate: customDateRange.start,
          endDate: customDateRange.end
        })
      };

      const response: APIResponse<NormalizedDashboardData> = await dashboardAPI.getDashboard(
        userId,
        params
      );

      if (!isMounted.current) return;

      if (response.success && response.data) {
        // Validate the normalized data structure
        const dashboardData = response.data;
        
        console.log('✅ Dashboard data received:', {
          role: dashboardData.role,
          ordersCount: dashboardData.orders?.length || 0,
          totalRevenue: dashboardData.metrics?.totalRevenue || 0,
          hasCommission: !!dashboardData.commission,
          hasAgentPerformance: !!dashboardData.agentPerformance,
          dataSource: dashboardData.dataSource
        });

        setData(dashboardData);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(response.error || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      if (!isMounted.current) return;

      console.error('❌ Dashboard fetch error:', err);
      
      // Handle specific error types
      if (err.response?.status === 408) {
        setError('Dashboard query timed out. Try a smaller date range.');
      } else if (err.response?.status === 404) {
        setError('User not found');
      } else if (err.response?.status === 403) {
        setError('Access denied');
      } else {
        setError(err.message || 'Failed to load dashboard');
      }
      
      // Keep existing data if available
      if (!data) {
        setData(null);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [userId, dateRange, customDateRange]);

  // Refresh function
  const refresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchDashboard();
  }, [fetchDashboard]);

  // Initial fetch
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      console.log(`⏰ Setting up auto-refresh every ${refreshInterval / 1000} seconds`);
      
      refreshIntervalRef.current = setInterval(() => {
        console.log('⏰ Auto-refresh triggered');
        fetchDashboard();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchDashboard]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated
  };
};

// Helper hook to access specific dashboard sections
export const useDashboardSection = <K extends keyof NormalizedDashboardData>(
  sectionKey: K,
  options: UseDashboardOptions
): {
  data: NormalizedDashboardData[K] | null;
  loading: boolean;
  error: string | null;
} => {
  const { data, loading, error } = useDashboard(options);
  
  return {
    data: data ? data[sectionKey] : null,
    loading,
    error
  };
};

// Helper hook for role-specific data
export const useRoleSpecificDashboard = (
  userId: string,
  role: 'salesAgent' | 'brandManager',
  options?: Partial<UseDashboardOptions>
) => {
  const dashboardData = useDashboard({
    userId,
    isAgentView: role === 'salesAgent',
    ...options
  });

  // Extract role-specific data
  const roleSpecificData = {
    ...dashboardData,
    commission: role === 'salesAgent' ? dashboardData.data?.commission : null,
    agentPerformance: role === 'brandManager' ? dashboardData.data?.agentPerformance : null
  };

  return roleSpecificData;
};