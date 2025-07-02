import { NormalizedDashboardData } from '../types/dashboard'; // Add this import

export const optimizeDataForAI = (data: any, options: {
  maxArrayLength?: number;
  maxDepth?: number;
  excludeFields?: string[];
  includeFields?: string[] | null;
} = {}) => {
  const {
    maxArrayLength = 100,
    maxDepth = 3,
    excludeFields = [],
    includeFields = null,
  } = options;

  function truncateArray(arr: any[], maxLength: number): any[] {
    if (!Array.isArray(arr)) return arr;
    if (arr.length <= maxLength) return arr;
    
    const keepStart = Math.floor(maxLength * 0.7);
    const keepEnd = Math.floor(maxLength * 0.3);
    
    return [
      ...arr.slice(0, keepStart),
      { _truncated: true, totalItems: arr.length },
      ...arr.slice(-keepEnd)
    ];
  }

  function optimizeObject(obj: any, currentDepth: number = 0): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (currentDepth >= maxDepth) return { _truncated: true };
    
    const optimized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (excludeFields.includes(key)) continue;
      if (includeFields && !includeFields.includes(key)) continue;
      
      if (Array.isArray(value)) {
        optimized[key] = truncateArray(value, maxArrayLength);
      } else if (value && typeof value === 'object') {
        optimized[key] = optimizeObject(value, currentDepth + 1);
      } else {
        optimized[key] = value;
      }
    }
    
    return optimized;
  }

  return optimizeObject(data);
};

export const optimizeDashboardData = (dashboardData: NormalizedDashboardData) => {
  if (!dashboardData) return {};
  
  return {
    dateRange: dashboardData.dateRange,
    role: dashboardData.role,
    userId: dashboardData.userId,
    
    // Metrics
    metrics: dashboardData.metrics,
    
    // Limited orders
    orders: dashboardData.orders?.slice(0, 10).map(order => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      date: order.date,
      total: order.total,
      status: order.status
    })) || [],
    
    // Summary of invoices
    invoices: {
      summary: {
        outstanding: dashboardData.invoices?.outstanding?.length || 0,
        overdue: dashboardData.invoices?.overdue?.length || 0,
        paid: dashboardData.invoices?.paid?.length || 0,
        total: dashboardData.metrics?.outstandingInvoices || 0
      }
    },
    
    // Limited performance data
    performance: {
      brands: dashboardData.performance?.brands?.slice(0, 5) || [],
      top_customers: dashboardData.performance?.top_customers?.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        total_spent: c.total_spent
      })) || [],
      top_items: dashboardData.performance?.top_items?.slice(0, 5) || []
    },
    
    // Agent performance (if available)
    agentPerformance: dashboardData.agentPerformance ? {
      summary: dashboardData.agentPerformance.summary,
      agents: dashboardData.agentPerformance.agents?.slice(0, 3) || []
    } : null,
    
    // Commission (if available)
    commission: dashboardData.commission || null
  };
};

export const getDataSizeInMB = (data: any): number => {
  const jsonString = JSON.stringify(data);
  const sizeInBytes = new TextEncoder().encode(jsonString).length;
  return sizeInBytes / (1024 * 1024);
};

export const validateDataSize = (data: any, maxSizeMB: number = 10) => {
  const sizeMB = getDataSizeInMB(data);
  
  if (sizeMB > maxSizeMB) {
    console.warn(`Data size (${sizeMB.toFixed(2)}MB) exceeds limit (${maxSizeMB}MB)`);
    return {
      isValid: false,
      size: sizeMB,
      message: `Data too large: ${sizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`,
    };
  }
  
  return {
    isValid: true,
    size: sizeMB,
  };
};