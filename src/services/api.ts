// src/services/api.ts
import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      
      // Handle common errors
      if (error.response.status === 401) {
        // Unauthorized - maybe redirect to login
        console.error('Unauthorized access - token may be expired');
      } else if (error.response.status === 429) {
        // Rate limited
        console.error('Rate limited - too many requests');
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server:', error.request);
    } else {
      // Something else happened
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Dashboard API endpoints
export const dashboardAPI = {
  // Get dashboard data with proper parameters
  getDashboard: async (userId: string, params: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const response = await apiClient.get('/api/reports/dashboard', {
        params: {
          userId,
          dateRange: params.dateRange || '30_days',
          ...(params.startDate && { startDate: params.startDate }),
          ...(params.endDate && { endDate: params.endDate })
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Dashboard API error:', error);
      throw error;
    }
  },

  // Refresh dashboard data
  refreshDashboard: async (userId: string, syncType: 'high' | 'medium' | 'low' = 'medium') => {
    try {
      const response = await apiClient.post('/api/reports/dashboard/refresh', {
        syncType
      }, {
        params: { userId }
      });
      
      return response.data;
    } catch (error) {
      console.error('Dashboard refresh error:', error);
      throw error;
    }
  },

  // Get health status
  getHealth: async () => {
    try {
      const response = await apiClient.get('/api/reports/dashboard/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  // Get specific collection data (for debugging)
  getCollection: async (collection: string, params: {
    userId: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    try {
      const response = await apiClient.get(`/api/reports/collections/${collection}`, {
        params
      });
      
      return response.data;
    } catch (error) {
      console.error(`Collection ${collection} API error:`, error);
      throw error;
    }
  },

  // Get sync status
  getSyncStatus: async (userId: string) => {
    try {
      const response = await apiClient.get('/api/reports/sync-status', {
        params: { userId }
      });
      
      return response.data;
    } catch (error) {
      console.error('Sync status error:', error);
      throw error;
    }
  }
};

// AI Insights API endpoints
export const aiInsightsAPI = {
  // Get card insights
  getCardInsights: async (cardType: string, cardData: any, fullDashboardData: any) => {
    try {
      const response = await apiClient.post('/api/ai-insights/card-insights', {
        cardType,
        cardData,
        fullDashboardData
      });
      
      return response.data;
    } catch (error) {
      console.error('AI card insights error:', error);
      throw error;
    }
  },

  // Get dashboard insights
  getDashboardInsights: async (dashboardData: any) => {
    try {
      const response = await apiClient.post('/api/ai-insights/dashboard-insights', {
        dashboardData
      });
      
      return response.data;
    } catch (error) {
      console.error('AI dashboard insights error:', error);
      throw error;
    }
  },

  // Get health status
  getHealth: async () => {
    try {
      const response = await apiClient.get('/api/ai-insights/health');
      return response.data;
    } catch (error) {
      console.error('AI health check error:', error);
      throw error;
    }
  }
};

// Orders API endpoints
export const ordersAPI = {
  // Create order (webhook)
  createOrder: async (orderData: {
    firebaseUID: string;
    customer_id: string;
    line_items: Array<{
      item_id: string;
      name: string;
      quantity: number;
      item_total: number;
    }>;
  }) => {
    try {
      const response = await apiClient.post('/api/create-order', orderData);
      return response.data;
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  },

  // Get order status
  getOrderStatus: async (orderId: string, userId?: string) => {
    try {
      const response = await apiClient.get(`/api/order-status/${orderId}`, {
        params: userId ? { userId } : {}
      });
      
      return response.data;
    } catch (error) {
      console.error('Order status error:', error);
      throw error;
    }
  },

  // Get user orders
  getUserOrders: async (userId: string, limit: number = 10) => {
    try {
      const response = await apiClient.get(`/api/user-orders/${userId}`, {
        params: { limit }
      });
      
      return response.data;
    } catch (error) {
      console.error('User orders error:', error);
      throw error;
    }
  }
};

// Sync API endpoints
export const syncAPI = {
  // Get sync changes
  getSyncChanges: async (agentId?: string, lastSyncTime?: number) => {
    try {
      const response = await apiClient.get('/api/sync/changes', {
        params: {
          ...(agentId && { agentId }),
          ...(lastSyncTime && { lastSyncTime })
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Sync changes error:', error);
      throw error;
    }
  },

  // Acknowledge sync changes
  acknowledgeSyncChanges: async (changeIds: string[]) => {
    try {
      const response = await apiClient.post('/api/sync/acknowledge', {
        changeIds
      });
      
      return response.data;
    } catch (error) {
      console.error('Acknowledge sync error:', error);
      throw error;
    }
  },

  // Get sync status
  getSyncStatus: async () => {
    try {
      const response = await apiClient.get('/api/sync/status');
      return response.data;
    } catch (error) {
      console.error('Sync status error:', error);
      throw error;
    }
  },

  // Force sync
  forceSync: async (collection: string) => {
    try {
      const response = await apiClient.post(`/api/sync/force/${collection}`);
      return response.data;
    } catch (error) {
      console.error('Force sync error:', error);
      throw error;
    }
  }
};

// Products API endpoints
export const productsAPI = {
  // Sync products
  syncProducts: async () => {
    try {
      const response = await apiClient.get('/api/products/sync');
      return response.data;
    } catch (error) {
      console.error('Products sync error:', error);
      throw error;
    }
  },

  // Get products by brand
  getProductsByBrand: async (brandName: string) => {
    try {
      const response = await apiClient.get(`/api/products/brand/${encodeURIComponent(brandName)}`);
      return response.data;
    } catch (error) {
      console.error('Products by brand error:', error);
      throw error;
    }
  },

  // Search products
  searchProducts: async (searchTerm: string) => {
    try {
      const response = await apiClient.get('/api/products/search', {
        params: { q: searchTerm }
      });
      
      return response.data;
    } catch (error) {
      console.error('Products search error:', error);
      throw error;
    }
  },

  // Get products health
  getHealth: async () => {
    try {
      const response = await apiClient.get('/api/products/health');
      return response.data;
    } catch (error) {
      console.error('Products health check error:', error);
      throw error;
    }
  }
};

// CRON API endpoints
export const cronAPI = {
  // Trigger high frequency sync
  triggerHighFrequency: async (secret?: string) => {
    try {
      const response = await apiClient.post('/api/cron/high-frequency', {}, {
        headers: secret ? { 'x-cron-secret': secret } : {}
      });
      
      return response.data;
    } catch (error) {
      console.error('High frequency cron error:', error);
      throw error;
    }
  },

  // Trigger medium frequency sync
  triggerMediumFrequency: async (secret?: string) => {
    try {
      const response = await apiClient.post('/api/cron/medium-frequency', {}, {
        headers: secret ? { 'x-cron-secret': secret } : {}
      });
      
      return response.data;
    } catch (error) {
      console.error('Medium frequency cron error:', error);
      throw error;
    }
  },

  // Trigger low frequency sync
  triggerLowFrequency: async (secret?: string) => {
    try {
      const response = await apiClient.post('/api/cron/low-frequency', {}, {
        headers: secret ? { 'x-cron-secret': secret } : {}
      });
      
      return response.data;
    } catch (error) {
      console.error('Low frequency cron error:', error);
      throw error;
    }
  },

  // Get cron status
  getStatus: async () => {
    try {
      const response = await apiClient.get('/api/cron/status');
      return response.data;
    } catch (error) {
      console.error('Cron status error:', error);
      throw error;
    }
  }
};

// Export all APIs
export default {
  dashboard: dashboardAPI,
  aiInsights: aiInsightsAPI,
  orders: ordersAPI,
  sync: syncAPI,
  products: productsAPI,
  cron: cronAPI
};