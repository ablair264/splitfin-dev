// src/api/zoho.ts

// ============================================================
// CONFIGURATION & TYPES
// ============================================================

// Base URL injected via Vite environment variable
const API_BASE = import.meta.env.VITE_API_BASE as string;

// Generic API Response type
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Pagination context from Zoho
interface ZohoPaginationContext {
  per_page: number;
  page: number;
  has_more_page: boolean;
  total_count: number;
}

// ============================================================
// CORE API HANDLER
// ============================================================

/**
 * Generic fetch wrapper that handles API calls consistently
 */
async function handleFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    // Handle non-JSON responses
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`API ${path} error ${res.status}: ${text}`);
      }
      return text as unknown as T;
    }

    // Parse JSON response
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(
        data.message || 
        data.error || 
        `API ${path} error ${res.status}`
      );
    }

    return data;
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`API call to ${path} failed: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================
// INVENTORY INTERFACES & ENDPOINTS
// ============================================================

export interface ZohoItem {
  item_id: string;
  item_code: string;
  item_name: string;
  item_type: string;
  product_type: string;
  description?: string;
  rate: number;
  purchase_rate?: number;
  available_stock: number;
  actual_available_stock: number;
  stock_on_hand?: number;
  sku?: string;
  unit?: string;
  status: 'active' | 'inactive';
  created_time?: string;
  last_modified_time?: string;
  brand?: string;
  category?: string;
}

interface FetchItemsResponse {
  items: ZohoItem[];
  page_context?: ZohoPaginationContext;
}

/**
 * Fetch all items via Zoho's paginated API
 */
export async function fetchItems(
  onProgress?: (loaded: number, total: number) => void
): Promise<ZohoItem[]> {
  const perPage = 200;
  let page = 1;
  let totalCount = 0;
  const allItems: ZohoItem[] = [];

  while (true) {
    try {
      const data = await handleFetch<FetchItemsResponse>(
        `/zoho/items?per_page=${perPage}&page=${page}`
      );
      
      const items = data.items || [];
      const ctx = data.page_context;

      // Capture total count on first page
      if (page === 1 && ctx?.total_count != null) {
        totalCount = ctx.total_count;
      }

      // Append fetched items
      allItems.push(...items);

      // Fire progress callback
      if (onProgress && totalCount > 0) {
        onProgress(allItems.length, totalCount);
      }

      // Check if more pages exist
      if (!ctx?.has_more_page) {
        break;
      }

      page += 1;
    } catch (error) {
      console.error(`Error fetching items page ${page}:`, error);
      throw error;
    }
  }

  return allItems;
}

// ============================================================
// CONTACT INTERFACES & ENDPOINTS
// ============================================================

export interface ZohoAddress {
  attention?: string;
  address: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

export interface ZohoContact {
  contact_id?: string;
  contact_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  mobile?: string;
  website?: string;
  contact_type?: 'customer' | 'vendor' | 'customer_vendor';
  customer_sub_type?: 'business' | 'individual';
  currency_code?: string;
  payment_terms?: number;
  credit_limit?: number;
  notes?: string;
  billing_address?: ZohoAddress;
  shipping_address?: ZohoAddress;
  custom_fields?: Array<{
    field_id: string;
    value: any;
  }>;
  status?: 'active' | 'inactive';
  created_time?: string;
  last_modified_time?: string;
  first_name?: string;
  last_name?: string;
  vat_reg_no?: string;
  tax_reg_no?: string;
  language_code?: string;
  facebook?: string;
  twitter?: string;
}

interface ContactResponse {
  success: boolean;
  contact: ZohoContact;
  message?: string;
}

/**
 * Create a new contact in Zoho Inventory
 */
export async function createZohoContact(
  contactData: Omit<ZohoContact, 'contact_id' | 'created_time' | 'last_modified_time'>
): Promise<ContactResponse> {
  return handleFetch<ContactResponse>('/zoho/create-contact', {
    method: 'POST',
    body: JSON.stringify(contactData),
  });
}

/**
 * Update an existing contact in Zoho Inventory
 */
export async function updateZohoContact(
  contactId: string, 
  updateData: Partial<ZohoContact>
): Promise<ContactResponse> {
  return handleFetch<ContactResponse>('/zoho/update-contact', {
    method: 'PUT',
    body: JSON.stringify({ contactId, updateData }),
  });
}

/**
 * Get a specific contact by ID
 */
export async function getZohoContact(contactId: string): Promise<ZohoContact> {
  const data = await handleFetch<{ contact: ZohoContact }>(
    `/zoho/contacts/${contactId}`
  );
  return data.contact;
}

// ============================================================
// ANALYTICS & INSIGHTS INTERFACES
// ============================================================

export interface BrandAnalytics {
  brandId: string;
  brandName: string;
  totalRevenue: number;
  totalUnits: number;
  topProducts: Array<{
    sku: string;
    name: string;
    units: number;
    revenue: number;
  }>;
  customerMetrics: {
    totalCustomers: number;
    repeatRate: number;
    avgOrderValue: number;
  };
  inventoryMetrics: {
    currentStock: number;
    stockValue: number;
    turnoverRate: number;
  };
}

/**
 * Fetch comprehensive analytics for a brand
 */
export async function fetchBrandAnalytics(
  brandId: string,
  dateRange?: { start: string; end: string }
): Promise<BrandAnalytics> {
  const params = new URLSearchParams({ brandId });
  if (dateRange) {
    params.append('startDate', dateRange.start);
    params.append('endDate', dateRange.end);
  }
  
  return handleFetch<BrandAnalytics>(`/analytics/brand?${params}`);
}

// ============================================================
// COMPREHENSIVE DATA FETCHING
// ============================================================

export interface ComprehensiveData {
  salesTransactions: any;
  salesOrders: any;
  customerInsights: any;
  invoiceMetrics: any;
  purchaseHistory: any;
  zohoMetrics: any;
}

/**
 * Fetch comprehensive data from all sources
 */
export async function fetchComprehensiveData(
  brandId: string,
  brandName: string
): Promise<ComprehensiveData> {
  return handleFetch<ComprehensiveData>('/analytics/comprehensive', {
    method: 'POST',
    body: JSON.stringify({ brandId, brandName }),
  });
}

// ============================================================
// PURCHASE ORDER INTERFACES & ENDPOINTS
// ============================================================

export interface ZohoPurchaseOrderLineItem {
  item_id: string;
  item_name?: string;
  quantity_ordered: number;
  quantity_received: number;
  rate?: number;
  tax_id?: string;
  unit?: string;
}

export interface ZohoPurchaseOrder {
  purchaseorder_id: string;
  purchaseorder_number?: string;
  vendor_id: string;
  vendor_name?: string;
  status: 'draft' | 'open' | 'billed' | 'cancelled' | 'closed';
  date: string;
  delivery_date?: string;
  reference_number?: string;
  line_items: ZohoPurchaseOrderLineItem[];
  sub_total?: number;
  tax_total?: number;
  total?: number;
  notes?: string;
  terms?: string;
  created_time?: string;
  last_modified_time?: string;
}

interface PurchaseOrdersResponse {
  purchaseorders: ZohoPurchaseOrder[];
  page_context?: ZohoPaginationContext;
}

/**
 * Fetch purchase orders with optional status filter
 */
export async function fetchPurchaseOrders(
  status: 'all' | 'draft' | 'open' | 'billed' | 'cancelled' | 'closed' = 'open'
): Promise<ZohoPurchaseOrder[]> {
  const data = await handleFetch<PurchaseOrdersResponse>(
    `/reports/purchase-orders?status=${status}`
  );
  return data.purchaseorders || [];
}

/**
 * Create a new purchase order
 */
export async function createPurchaseOrder(
  vendorId: string,
  lineItems: Array<{ item_id: string; quantity: number; rate?: number }>
): Promise<ZohoPurchaseOrder> {
  const data = await handleFetch<{ purchaseorder: ZohoPurchaseOrder }>(
    '/purchaseorders', 
    {
      method: 'POST',
      body: JSON.stringify({ 
        vendor_id: vendorId, 
        line_items: lineItems 
      }),
    }
  );
  return data.purchaseorder;
}

// ============================================================
// CRM INTERFACES & ENDPOINTS
// ============================================================

export interface ZohoAgent {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  designation?: string;
  department?: string;
  [key: string]: any;
}

export interface ZohoCustomer {
  id: string;
  account_name?: string;
  Primary_Email?: string;
  Phone?: string;
  website?: string;
  industry?: string;
  annual_revenue?: number;
  employees?: number;
  description?: string;
  billing_address?: ZohoAddress;
  shipping_address?: ZohoAddress;
  created_time?: string;
  modified_time?: string;
  [key: string]: any;
}

interface AgentsResponse {
  data: ZohoAgent[];
  info?: {
    count: number;
    more_records: boolean;
  };
}

interface CustomersResponse {
  data: ZohoCustomer[];
  info?: {
    count: number;
    more_records: boolean;
  };
}

/**
 * Fetch all agents from CRM
 */
export async function fetchAgents(): Promise<ZohoAgent[]> {
  const data = await handleFetch<AgentsResponse>('/agents');
  return data.data || [];
}

/**
 * Fetch all customers from CRM
 */
export async function fetchCustomers(): Promise<ZohoCustomer[]> {
  const data = await handleFetch<CustomersResponse>('/customers');
  return data.data || [];
}

// ============================================================
// SALES ORDER INTERFACES & ENDPOINTS
// ============================================================

export interface SalesOrderLineItem {
  item_id: string;
  name?: string;
  description?: string;
  quantity: number;
  rate: number;
  amount?: number;
  tax_id?: string;
  unit?: string;
  brand?: string;
  sku?: string;
}

export interface SalesOrderPayload {
  customer_id: string;
  salesorder_number?: string;
  reference_number?: string;
  date?: string;
  shipment_date?: string;
  line_items: SalesOrderLineItem[];
  notes?: string;
  terms?: string;
  shipping_charge?: number;
  adjustment?: number;
  discount?: number;
  is_discount_before_tax?: boolean;
  discount_type?: 'entity_level' | 'item_level';
  exchange_rate?: number;
  salesperson_name?: string;
  custom_fields?: Array<{
    field_id: string;
    value: any;
  }>;
}

export interface ZohoSalesOrder {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  status: string;
  total: number;
  balance: number;
  customer_id: string;
  customer_name: string;
  created_time: string;
  last_modified_time: string;
  line_items?: SalesOrderLineItem[];
}

/**
 * Create a sales order in Zoho
 */
export async function createSalesOrder(
  orderPayload: SalesOrderPayload
): Promise<ZohoSalesOrder> {
  const data = await handleFetch<{ zohoSalesOrder: ZohoSalesOrder }>(
    '/zoho/salesorder',
    {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    }
  );
  return data.zohoSalesOrder;
}

// ============================================================
// SEARCH & TRENDS ENDPOINTS
// ============================================================

export interface SearchTrend {
  keyword: string;
  volume: number;
  trend: 'rising' | 'falling' | 'stable';
  percentageChange: number;
  relatedQueries: string[];
}

/**
 * Fetch search trends for a brand
 */
export async function fetchSearchTrends(brandName: string): Promise<SearchTrend[]> {
  const data = await handleFetch<{ success: boolean; trends: SearchTrend[] }>(
    `/search-trends/brand/${encodeURIComponent(brandName)}`
  );
  return data.trends || [];
}

// ============================================================
// AI INSIGHTS ENDPOINTS
// ============================================================

export interface AIInsight {
  insight: string;
  trend: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
}

export interface PurchaseOrderInsights {
  executiveSummary: string;
  marketTiming: string;
  trendBasedRecommendations: string[];
  riskAssessment: string;
  categoryOptimization: string[];
  cashFlowImpact: string;
  customerImpact: string;
  channelStrategy: string;
  confidenceAssessment: string;
}

/**
 * Get AI insights for a metric card
 */
export async function getCardInsights(
  cardType: string,
  cardData: any,
  fullDashboardData: any
): Promise<AIInsight> {
  const data = await handleFetch<{ data: AIInsight }>('/ai-insights/card-insights', {
    method: 'POST',
    body: JSON.stringify({ cardType, cardData, fullDashboardData }),
  });
  return data.data;
}

/**
 * Get AI insights for purchase orders
 */
export async function getPurchaseOrderInsights(
  brand: string,
  suggestions: any[],
  historicalSales: any,
  marketData: any
): Promise<PurchaseOrderInsights> {
  const data = await handleFetch<{ data: PurchaseOrderInsights }>(
    '/ai-insights/purchase-order-insights',
    {
      method: 'POST',
      body: JSON.stringify({ brand, suggestions, historicalSales, marketData }),
    }
  );
  return data.data;
}

// ============================================================
// SYNC & UTILITY ENDPOINTS
// ============================================================

interface SyncResponse {
  success: boolean;
  message: string;
  syncedAt?: string;
  itemsCount?: number;
  customersCount?: number;
  agentsCount?: number;
}

/**
 * Trigger a manual sync with Zoho
 */
export async function triggerSync(): Promise<SyncResponse> {
  return handleFetch<SyncResponse>('/sync', { method: 'POST' });
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncResponse> {
  return handleFetch<SyncResponse>('/sync/status');
}

/**
 * Sync a specific customer with Zoho
 */
export async function syncCustomer(customerId: string): Promise<ApiResponse> {
  return handleFetch<ApiResponse>('/customers/sync', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
}

export async function createCustomerInZoho(customerId: string): Promise<string | null> {
  try {
    const response = await fetch('/api/customers/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId })
    });

    const result = await response.json();
    
    if (result.success && result.zohoCustomerId) {
      return result.zohoCustomerId;
    }
    
    return null;
  } catch (error) {
    console.error('Error creating customer in Zoho:', error);
    return null;
  }
}

// ============================================================
// ERROR HANDLING UTILITIES
// ============================================================

/**
 * Type guard to check if an error is a Zoho API error
 */
export function isZohoApiError(error: any): error is { code: number; message: string } {
  return error && typeof error.code === 'number' && typeof error.message === 'string';
}

/**
 * Extract a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isZohoApiError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}