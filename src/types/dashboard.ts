// src/types/dashboard.ts

// Normalized Order Interface
export interface NormalizedOrder {
  id: string;
  order_number: string;
  salesorder_number?: string; // Optional for Zoho compatibility
  customer_id: string;
  customer_name: string;
  salesperson_id: string | null;
  salesperson_name: string | null;
  salesperson_uid?: string | null;
  date: string;
  created_time?: string;
  total: number;
  status?: string; // Normalized status
  order_status?: string; // Zoho's original field
  line_items: Array<{
    item_id: string;
    item_name: string;
    sku: string;
    brand: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  // Marketplace fields
  is_marketplace_order?: boolean;
  marketplace_source?: string | null;
  // Order details
  reference_number?: string;
  shipment_date?: string;
  invoiced_status?: string;
  shipped_status?: string;
  paid_status?: string;
  delivery_date?: string;
  balance?: number;
  currency_code?: string;
  currency_symbol?: string;
  quantity?: number;
  quantity_invoiced?: number;
  quantity_packed?: number;
  quantity_shipped?: number;
  sales_channel?: string;
  branch_name?: string;
  email?: string;
  billing_address?: any;
  shipping_address?: any;
  brand?: string; // For backward compatibility
}

// Normalized Line Item Interface
export interface NormalizedLineItem {
  item_id: string;
  name: string;
  sku: string;
  brand: string;
  quantity: number;
  price: number;
  total: number;
}

// Normalized Invoice Interface
export interface NormalizedInvoice {
  id: string;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string; // Add this
  total: number;
  balance: number;
  status: 'paid' | 'sent' | 'overdue' | 'draft' | 'void';
  date: string;
  due_date: string;
  days_overdue?: number;
  lastReminded?: string; // Add this
  paid: number;
  _source: string;
  _originalId: string;
}

// Normalized Customer Interface
export interface NormalizedCustomer {
  customer_id?: string;
  id: string;
  name: string;
  email?: string;
  phone?: string;
  total_spent: number;
  order_count: number;
  last_order_date?: string;
  first_order_date?: string;
  created_time?: string; // This might be what you need instead of created_date
  segment: 'VIP' | 'High' | 'Medium' | 'Low';
  status: string;
  assigned_agent_id: string | null;
  _source: string;
  _originalId: string;
  customer_name?: string;
  company_name?: string;
}

export interface NormalizedAgent {
  agentId: string;
  agentName: string;
  agentUid?: string;
  totalRevenue: number;
  totalOrders: number;
  orderCount?: number; // Add for compatibility
  customers: number;
  averageOrderValue: number;
  // Add these fields that come from the users collection
  email?: string;
  phone?: string;
  region?: string[];
  brandsAssigned?: { [key: string]: boolean };
  lastOrderDate?: string;
  // Remove or make optional the old properties
  id?: string;
  name?: string;
  total_revenue?: number;
}
// Dashboard Metrics
export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  outstandingInvoices: number;
  marketplaceOrders: number;
}

// Invoice Categories
export interface InvoiceCategories {
  all: NormalizedInvoice[];
  outstanding: NormalizedInvoice[];
  overdue: NormalizedInvoice[];
  paid: NormalizedInvoice[];
}

// Brand Performance
export interface BrandPerformance {
  name: string;
  revenue: number;
  quantity: number;
  market_share: number;
}

// Top Item
 export interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  // Add these optional fields
  product_name?: string;
  item_name?: string;
}

// Performance Data
export interface PerformanceData {
  brands: BrandPerformance[];
  top_customers: NormalizedCustomer[];
  top_items: TopItem[];
}

// Commission (for agents)
export interface Commission {
  rate: number;
  total: number;
  salesValue: number;
}

// Agent Performance Summary
export interface AgentPerformanceSummary {
  totalAgents: number;
  totalRevenue: number;
  averageRevenue: number;
  topPerformer: NormalizedAgent | null;
}

// Agent Performance (for managers)
export interface AgentPerformanceData {
  agents: NormalizedAgent[];
  summary: AgentPerformanceSummary;
}

// Main Normalized Dashboard Data Interface
export interface NormalizedDashboardData {
  userId: string;
  role: 'salesAgent' | 'brandManager' | 'admin' | 'unknown';
  dateRange: string;
  
  // Core metrics
  metrics: DashboardMetrics;
  
  // Orders (normalized)
  orders: NormalizedOrder[];
  
  // Invoices (categorized)
  invoices: InvoiceCategories;
  
  // Performance data
  performance: PerformanceData;
  
  // Agent-specific data (only for sales agents)
  commission: Commission | null;
  
  // Manager-specific data (only for brand managers)
  agentPerformance: AgentPerformanceData | null;
  
  // Metadata
  lastUpdated: string;
  dataSource: string;
  loadTime: number;
}

// API Response wrapper
export interface APIResponse<T> {
  success: boolean;
  data: T;
  userContext?: {
    role: string;
    userId: string;
    name: string;
  };
  timestamp: string;
  error?: string;
  suggestion?: string;
}

// Hook options
export interface UseDashboardOptions {
  userId?: string;
  dateRange?: string;
  customDateRange?: {
    start: string;
    end: string;
  };
  autoRefresh?: boolean;
  refreshInterval?: number;
  isAgentView?: boolean;
}

// Hook return type
export interface UseDashboardReturn {
  data: NormalizedDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

// Date range option
export interface DateRangeOption {
  value: string;
  label: string;
}

// For backward compatibility, map old interfaces to new ones
export type DashboardData = NormalizedDashboardData;

// Helper type for role-based data access
export type RoleSpecificData<T extends 'salesAgent' | 'brandManager'> = 
  T extends 'salesAgent' 
    ? { commission: Commission }
    : { agentPerformance: AgentPerformanceData };

// Utility type for filtering data by agent
export interface AgentFilteredData {
  orders: NormalizedOrder[];
  invoices: InvoiceCategories;
  customers: NormalizedCustomer[];
}

// Chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

export interface TrendDataPoint {
  period: string;
  date: string;
  orders: number;
  revenue: number;
}

// Summary statistics
export interface DashboardSummary {
  isLimited?: boolean;
  warning?: string;
  note?: string;
}

// Extended dashboard data with summary
export interface ExtendedDashboardData extends NormalizedDashboardData {
  summary?: DashboardSummary;
}

// Export all types
export type {
  NormalizedOrder as Order,
  NormalizedLineItem as LineItem,
  NormalizedInvoice as Invoice,
  NormalizedCustomer as Customer,
  NormalizedAgent as Agent
};