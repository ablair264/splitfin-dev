export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  reportType: 'agent_brand' | 'agent' | 'brand' | 'customer' | 'region' | 'popular_items_brand' | 'popular_items_all';
  dateRange: 'today' | '7_days' | '30_days' | 'quarter' | 'year' | 'custom';
  customDateRange?: {
    start: string;
    end: string;
  };
  sections: {
    overview: boolean;
    sales: boolean;
    orders: boolean;
    customers: boolean;
    invoices: boolean;
    brands?: boolean;
    agents?: boolean;
    forecasting?: boolean;
  };
  filters: {
    brands?: string[];
    agents?: string[];
    customerSegments?: ('VIP' | 'High' | 'Medium' | 'Low' | 'New')[];
    invoiceStatus?: ('paid' | 'outstanding' | 'overdue' | 'draft')[];
    shippingStatus?: ('pending' | 'shipped' | 'delivered' | 'cancelled')[];
    excludeMarketplace?: boolean;
    regions?: string[];
  };
  exportTheme: 'dashboard' | 'light';
  charts: {
    includeCharts: boolean;
    chartTypes: ('revenue' | 'orders' | 'customers' | 'trends')[];
  };
  createdAt: string;
  updatedAt: string;
  userId: string;
  userRole: 'brandManager' | 'salesAgent';
}

export interface ReportData {
  config: ReportConfig;
  data: {
    overview?: any;
    sales?: any;
    orders?: any;
    customers?: any;
    invoices?: any;
    brands?: any;
    agents?: any;
    charts?: any;
    // New report-specific data
    agentBrandPerformance?: any;
    agentPerformance?: any;
    brandPerformance?: any;
    customerPerformance?: any;
    regionPerformance?: any;
    popularItems?: any;
  };
  metadata: {
    generatedAt: string;
    dataRange: {
      start: string;
      end: string;
    };
    recordCounts: {
      orders: number;
      invoices: number;
      customers: number;
      transactions: number;
    };
    filters: {
      excludedMarketplaceOrders?: number;
      appliedFilters: string[];
    };
  };
}

export interface SavedReport {
  id: string;
  config: ReportConfig;
  savedAt: string;
  userId: string;
}