// src/components/PurchaseOrderSuggestions.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { FaLightbulb, FaCheckCircle, FaDownload, FaChartLine, FaArrowUp, FaExclamationTriangle } from 'react-icons/fa';
import './PurchaseOrderSuggestions.css';
import { 
  generatePurchaseOrderInsights, 
  generateProductPurchaseInsights,
  validatePurchaseAdjustments 
} from '../services/aiAnalyticsService.js';
import { fetchComprehensiveData, fetchSearchTrends } from '../api/zoho';
import { ProgressLoader } from './ProgressLoader';
import { useProgressTracking } from '../hooks/useProgressTracking';

interface Suggestion {
  sku: string;
  product_name: string;
  recommendedQuantity: number;
  confidence: number;
  reasoning: string;
  features?: number[];
  searchVolume?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  competitorStock?: number;
}

const BRAND_TO_VENDOR_MAP: { [key: string]: string } = {
  'elvang': '310656000000061064',
  'remember': '310656000000194675',
  'relaxound': '310656000001750908',
  'rader': '310656000001553100',
  'myflame': '310656000002243458'
};

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  retailPrice: number;
  brand: string;
  brand_normalized: string;
  imageUrl?: string;
  competitorUrls?: string[];
  currentStock?: number;
  reorderLevel?: number;
}

interface SearchTrend {
  keyword: string;
  volume: number;
  trend: 'rising' | 'falling' | 'stable';
  percentageChange: number;
  relatedQueries: string[];
}

interface MarketData {
  searchTrends: SearchTrend[];
  competitorPricing: { [sku: string]: number[] };
  marketShare: number;
  categoryGrowth: number;
}

interface ComprehensiveData {
  salesTransactions: any;
  salesOrders: any;
  customerInsights: any;
  invoiceMetrics: any;
  purchaseHistory: any;
  zohoMetrics: any;
}

export const PurchaseOrderSuggestions: React.FC = () => {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [brands, setBrands] = useState<Array<{value: string, label: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  
  // AI States
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [productInsights, setProductInsights] = useState<Map<string, any>>(new Map());
  
  // Market Data States
  const [searchTrends, setSearchTrends] = useState<SearchTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  
  // Comprehensive Data State
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveData | null>(null);
  
  // Manual Adjustments
  const [adjustedQuantities, setAdjustedQuantities] = useState<Map<string, number>>(new Map());
  const [validationFeedback, setValidationFeedback] = useState<any>(null);
  
  const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
  const userId = auth.currentUser?.uid || localStorage.getItem('userId') || '';

  // Load brands from Firebase
  useEffect(() => {
    const loadBrands = async () => {
      try {
        console.log('Starting to load brands...');
        
        const brandsQuery = collection(db, 'brands');
        const snapshot = await getDocs(brandsQuery);
        
        console.log('Total brands found:', snapshot.size);
        
        const brandList: Array<{value: string, label: string}> = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const brandName = data.brand_name || data.name || doc.id;
          const brandNormalized = data.brand_normalized || brandName.toLowerCase().replace(/\s+/g, '_');
          
          brandList.push({
            value: brandNormalized,
            label: brandName
          });
        });
        
        console.log('Brand list:', brandList);
        
        // Sort by label
        brandList.sort((a, b) => a.label.localeCompare(b.label));
        
        setBrands(brandList);
        
      } catch (err) {
        console.error('Failed to load brands:', err);
      }
    };
    
    loadBrands();
  }, []);

  // Fetch comprehensive data from all sources
  const fetchAllData = async (brandId: string, brandName: string): Promise<ComprehensiveData | null> => {
    try {
      console.log(`🔄 Fetching comprehensive data for ${brandName}`);
      
      // Use the API to fetch comprehensive data
      const response = await fetch(`${apiUrl}/api/analytics/comprehensive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify({ brandId, brandName })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Comprehensive data fetched successfully');
        return data;
      } else {
        // Fallback to local Firebase fetching
        console.log('API failed, fetching from Firebase directly...');
        return await fetchLocalComprehensiveData(brandId, brandName);
      }
      
    } catch (error) {
      console.error('Failed to fetch comprehensive data:', error);
      // Fallback to local Firebase fetching
      return await fetchLocalComprehensiveData(brandId, brandName);
    }
  };

  // Local fallback for comprehensive data
  const fetchLocalComprehensiveData = async (brandId: string, brandName: string): Promise<ComprehensiveData> => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Parallel fetch all data
    const [
      salesTransactions,
      salesOrders,
      customerData,
      invoices,
      purchaseOrders
    ] = await Promise.all([
      // Sales Transactions
      getDocs(query(
        collection(db, 'sales_transactions'),
        where('brand_normalized', '==', brandId),
        where('order_date', '>=', sixMonthsAgo.toISOString().split('T')[0]),
        orderBy('order_date', 'desc'),
        limit(1000)
      )),
      
      // Sales Orders
      getDocs(query(
        collection(db, 'salesorders'),
        where('date', '>=', sixMonthsAgo.toISOString().split('T')[0]),
        orderBy('date', 'desc'),
        limit(500)
      )),
      
      // Customer Data
      getDocs(query(
        collection(db, 'customer_data'),
        where('last_order_date', '>=', sixMonthsAgo.toISOString().split('T')[0]),
        limit(500)
      )),
      
      // Invoices
      getDocs(query(
        collection(db, 'invoices'),
        where('date', '>=', sixMonthsAgo.toISOString().split('T')[0]),
        limit(500)
      )),
      
      // Purchase Orders
      getDocs(query(
        collection(db, 'purchaseorders'),
        where('vendor_id', '==', BRAND_TO_VENDOR_MAP[brandId] || ''),
        orderBy('date', 'desc'),
        limit(50)
      ))
    ]);
    
    // Process the data
    const processedData = {
      salesTransactions: processSalesData(salesTransactions),
      salesOrders: processOrdersData(salesOrders, brandName),
      customerInsights: processCustomerData(customerData),
      invoiceMetrics: processInvoiceData(invoices),
      purchaseHistory: processPurchaseOrders(purchaseOrders),
      zohoMetrics: null // Would come from Zoho API
    };
    
    return processedData;
  };

  // Process sales data
  const processSalesData = (snapshot: any) => {
    const productSales = new Map();
    const monthlyRevenue: { [key: string]: number } = {};
    let totalRevenue = 0;
    let totalUnits = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const sale = doc.data();
      const saleDate = new Date(sale.order_date);
      const month = saleDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const quantity = parseInt(sale.quantity?.toString() || '0');
      const total = parseFloat(sale.total?.toString() || '0');
      
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + total;
      totalRevenue += total;
      totalUnits += quantity;
      
      if (sale.sku) {
        if (!productSales.has(sale.sku)) {
          productSales.set(sale.sku, { 
            sku: sale.sku,
            name: sale.item_name || sale.sku,
            units: 0, 
            revenue: 0, 
            customers: new Set(),
            orders: 0
          });
        }
        const current = productSales.get(sale.sku);
        current.units += quantity;
        current.revenue += total;
        current.orders += 1;
        if (sale.customer_id) {
          current.customers.add(sale.customer_id);
        }
      }
    });
    
    const productMetrics = Array.from(productSales.values()).map(data => ({
      ...data,
      uniqueCustomers: data.customers.size,
      velocity: data.units / 6,
      customerDiversity: data.customers.size / Math.max(data.units, 1),
      avgOrderSize: data.units / Math.max(data.orders, 1)
    }));
    
    return {
      totalRevenue,
      totalUnits,
      monthlyRevenue,
      productMetrics: productMetrics.sort((a, b) => b.revenue - a.revenue),
      topProducts: productMetrics.slice(0, 10),
      seasonalPattern: monthlyRevenue
    };
  };

  // Process orders data
  const processOrdersData = (snapshot: any, brandName: string) => {
    const orderPatterns = {
      totalOrders: 0,
      totalValue: 0,
      avgOrderValue: 0,
      orderFrequency: new Map(),
      bundleAnalysis: new Map(),
      channelBreakdown: { direct: 0, marketplace: 0 },
      topBundles: []
    };
    
    snapshot.docs.forEach((doc: any) => {
      const order = doc.data();
      const brandItems = (order.line_items || []).filter((item: any) => 
        item.brand === brandName || item.brand_normalized === brandName.toLowerCase()
      );
      
      if (brandItems.length > 0) {
        orderPatterns.totalOrders += 1;
        const orderValue = brandItems.reduce((sum: number, item: any) => 
          sum + (item.quantity * item.rate), 0
        );
        orderPatterns.totalValue += orderValue;
        
        if (order.customer_id) {
          orderPatterns.orderFrequency.set(
            order.customer_id, 
            (orderPatterns.orderFrequency.get(order.customer_id) || 0) + 1
          );
        }
        
        if (brandItems.length > 1) {
          const skus = brandItems.map((item: any) => item.sku).sort();
          const bundleKey = skus.join('|');
          orderPatterns.bundleAnalysis.set(
            bundleKey, 
            (orderPatterns.bundleAnalysis.get(bundleKey) || 0) + 1
          );
        }
        
        if (order.is_marketplace_order) {
          orderPatterns.channelBreakdown.marketplace += 1;
        } else {
          orderPatterns.channelBreakdown.direct += 1;
        }
      }
    });
    
    orderPatterns.avgOrderValue = orderPatterns.totalValue / Math.max(orderPatterns.totalOrders, 1);
    
    // Get top bundles
    const bundleArray = Array.from(orderPatterns.bundleAnalysis.entries());
    orderPatterns.topBundles = bundleArray
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bundle, count]) => ({
        items: bundle.split('|'),
        count,
        percentage: (count / orderPatterns.totalOrders) * 100
      }));
    
    return orderPatterns;
  };
  
  const analysisSteps = [
  { name: 'Fetching comprehensive data', weight: 30 },
  { name: 'Loading products', weight: 20 },
  { name: 'Analyzing trends', weight: 20 },
  { name: 'Generating AI insights', weight: 30 }
];

const { 
  progress, 
  currentStep, 
  startStep, 
  completeStep, 
  updateStepProgress,
  reset: resetProgress 
} = useProgressTracking(analysisSteps);

// Update the analyzeBrand function:
const analyzeBrand = async () => {
  if (!selectedBrand) return;
  
  setLoading(true);
  setError(null);
  setSuggestions([]);
  setComprehensiveData(null);
  resetProgress(); // Reset progress
  
  try {
    const brandName = brands.find(b => b.value === selectedBrand)?.label || selectedBrand;
    
    console.log(`Analyzing brand: ${brandName} (normalized: ${selectedBrand})`);
    
    // Step 1: Fetch comprehensive data
    startStep('Fetching comprehensive data');
    const allData = await fetchAllData(selectedBrand, brandName);
    if (allData) {
      setComprehensiveData(allData);
      console.log('Comprehensive data loaded:', allData);
    }
    completeStep('Fetching comprehensive data');
    
    // Step 2: Load products
    startStep('Loading products');
    let productsQuery = query(
      collection(db, 'products'),
      where('brand', '==', brandName)
    );
    
    // Simulate progress for product loading
    updateStepProgress('Loading products', 20);
    
    let productsSnapshot = await getDocs(productsQuery);
    
    updateStepProgress('Loading products', 60);
    
    if (productsSnapshot.empty) {
      console.log(`No products found with brand: ${brandName}, trying normalized...`);
      productsQuery = query(
        collection(db, 'products'),
        where('brand_normalized', '==', selectedBrand)
      );
      productsSnapshot = await getDocs(productsQuery);
    }
    
    updateStepProgress('Loading products', 80);
    
    const productsMap = new Map<string, Product>();
    productsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      productsMap.set(data.sku || data.SKU, {
        id: doc.id,
        sku: data.sku || data.SKU,
        name: data.item_name || data.name || data.Name,
        category: data.category || data.Category || '',
        retailPrice: data.rate || data.retailPrice || data.RRP || 0,
        brand: brandName,
        brand_normalized: selectedBrand,
        imageUrl: data.imageUrl || data.ImageURL,
        competitorUrls: data.competitorUrls,
        currentStock: data.stock_on_hand || 0,
        reorderLevel: data.reorder_level || 10
      });
    });
    
    console.log(`Found ${productsMap.size} products for brand ${brandName}`);
    setProducts(productsMap);
    completeStep('Loading products');
    
    // Step 3: Fetch search trends
    startStep('Analyzing trends');
    const trends = await fetchSearchTrends(brandName);
    setSearchTrends(trends);
    updateStepProgress('Analyzing trends', 50);
    
    // Check for cached analysis
    const cacheResponse = await fetch(
      `${apiUrl}/api/purchase-analysis/${selectedBrand}/latest`
    );
    
    const cacheData = await cacheResponse.json();
    completeStep('Analyzing trends');
    
    let suggestionData: Suggestion[];
    
// Step 4: Generate AI insights
startStep('Generating AI insights');

if (cacheData.success && cacheData.data && cacheData.data.age < 86400000) {
  suggestionData = cacheData.data.predictions || [];
  completeStep('Generating AI insights');
} else {
  // Track progress manually
  let aiProgress = 10;
  const progressInterval = setInterval(() => {
    if (aiProgress < 90) {
      aiProgress += 10;
      updateStepProgress('Generating AI insights', aiProgress);
    }
  }, 500);
  
  try {
    const response = await fetch(`${apiUrl}/api/purchase-analysis/analyze-brand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brandId: selectedBrand,
        limit: 100,
        includeSearchTrends: true,
        comprehensiveData: allData
      })
    });
    
    clearInterval(progressInterval);
    
    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      suggestionData = result.data.predictions || [];
    } else {
      throw new Error(result.error || 'Analysis failed');
    }
  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

completeStep('Generating AI insights');
    
    const enhancedSuggestions = suggestionData.map(suggestion => {
      const productTrend = trends.find(t => 
        t.keyword.toLowerCase().includes(suggestion.product_name.toLowerCase())
      );
      
      return {
        ...suggestion,
        searchVolume: productTrend?.volume || 0,
        trendDirection: (productTrend?.trend === 'rising' ? 'up' : 
                        productTrend?.trend === 'falling' ? 'down' : 
                        'stable') as 'up' | 'down' | 'stable'
      };
    });
    
    setSuggestions(enhancedSuggestions);
    
    // Get AI insights
    await getAIInsights(enhancedSuggestions, allData);
    
  } catch (err: any) {
    console.error('Analysis error:', err);
    setError(err.message || 'Failed to analyze brand. Please try again.');
  } finally {
    setLoading(false);
  }
};

// Update the loading display:
{loading && (
  <div className="loading-state">
    <ProgressLoader
      progress={progress}
      message="Analyzing Comprehensive Data"
      submessage={currentStep}
      size={150}
    />
  </div>
)}

  // Process customer data
  const processCustomerData = (snapshot: any) => {
    const customerMetrics = {
      totalActiveCustomers: 0,
      newCustomers: 0,
      repeatCustomers: 0,
      customerLifetimeValues: [] as number[],
      avgOrdersPerCustomer: 0,
      customerSegments: {
        vip: [] as any[],
        regular: [] as any[],
        occasional: [] as any[]
      },
      retentionRate: 0,
      churnRisk: [] as any[]
    };
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    snapshot.docs.forEach((doc: any) => {
      const customer = doc.data();
      customerMetrics.totalActiveCustomers += 1;
      
      if (new Date(customer.created_at) > threeMonthsAgo) {
        customerMetrics.newCustomers += 1;
      }
      if ((customer.order_count || 0) > 1) {
        customerMetrics.repeatCustomers += 1;
      }
      
      const ltv = customer.total_spent || 0;
      customerMetrics.customerLifetimeValues.push(ltv);
      
      if (ltv > 5000) {
        customerMetrics.customerSegments.vip.push({
          id: customer.id,
          name: customer.customer_name,
          email: customer.email,
          value: ltv,
          orders: customer.order_count || 0,
          lastOrder: customer.last_order_date
        });
      } else if (ltv > 1000) {
        customerMetrics.customerSegments.regular.push({
          id: customer.id,
          name: customer.customer_name,
          email: customer.email,
          value: ltv,
          orders: customer.order_count || 0,
          lastOrder: customer.last_order_date
        });
      } else {
        customerMetrics.customerSegments.occasional.push({
          id: customer.id,
          name: customer.customer_name,
          email: customer.email,
          value: ltv,
          orders: customer.order_count || 0,
          lastOrder: customer.last_order_date
        });
      }
      
      const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
      if (lastOrderDate && lastOrderDate < oneMonthAgo && customer.order_count > 2) {
        customerMetrics.churnRisk.push({
          id: customer.id,
          name: customer.customer_name,
          daysSinceLastOrder: Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalSpent: ltv,
          orderCount: customer.order_count
        });
      }
    });
    
    const totalOrders = snapshot.docs.reduce((sum: number, doc: any) => 
      sum + (doc.data().order_count || 0), 0
    );
    customerMetrics.avgOrdersPerCustomer = totalOrders / Math.max(customerMetrics.totalActiveCustomers, 1);
    customerMetrics.retentionRate = (customerMetrics.repeatCustomers / customerMetrics.totalActiveCustomers) * 100;
    
    return customerMetrics;
  };

  // Process invoice data
  const processInvoiceData = (snapshot: any) => {
    const invoiceMetrics = {
      totalOutstanding: 0,
      totalPaid: 0,
      totalOverdue: 0,
      avgPaymentDays: 0,
      overdueAmount: 0,
      cashFlowProjection: {} as any,
      paymentTrends: {} as any,
      riskAssessment: {
        high: [] as any[],
        medium: [] as any[],
        low: [] as any[]
      }
    };
    
    let totalPaymentDays = 0;
    let paidCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const invoice = doc.data();
      const amount = invoice.amount || invoice.total || 0;
      
      if (invoice.status === 'paid') {
        invoiceMetrics.totalPaid += amount;
        
        if (invoice.paid_date && invoice.date) {
          const daysToPay = Math.floor(
            (new Date(invoice.paid_date).getTime() - new Date(invoice.date).getTime()) 
            / (1000 * 60 * 60 * 24)
          );
          totalPaymentDays += daysToPay;
          paidCount += 1;
          
          const paidMonth = new Date(invoice.paid_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          if (!invoiceMetrics.paymentTrends[paidMonth]) {
            invoiceMetrics.paymentTrends[paidMonth] = {
              total: 0,
              count: 0,
              avgDays: 0
            };
          }
          invoiceMetrics.paymentTrends[paidMonth].total += amount;
          invoiceMetrics.paymentTrends[paidMonth].count += 1;
        }
      } else if (invoice.status === 'outstanding' || invoice.status === 'overdue') {
        invoiceMetrics.totalOutstanding += invoice.balance || amount;
        
        if (invoice.days_overdue > 0) {
          invoiceMetrics.totalOverdue += invoice.balance || amount;
          invoiceMetrics.overdueAmount += invoice.balance || amount;
          
          if (invoice.days_overdue > 60) {
            invoiceMetrics.riskAssessment.high.push({
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer_name,
              amount: invoice.balance || amount,
              daysOverdue: invoice.days_overdue
            });
          } else if (invoice.days_overdue > 30) {
            invoiceMetrics.riskAssessment.medium.push({
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer_name,
              amount: invoice.balance || amount,
              daysOverdue: invoice.days_overdue
            });
          } else {
            invoiceMetrics.riskAssessment.low.push({
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer_name,
              amount: invoice.balance || amount,
              daysOverdue: invoice.days_overdue
            });
          }
        }
      }
    });
    
    invoiceMetrics.avgPaymentDays = paidCount > 0 ? totalPaymentDays / paidCount : 30;
    
    const next30Days = invoiceMetrics.totalOutstanding * 0.6;
    const next60Days = invoiceMetrics.totalOutstanding * 0.3;
    const beyond60Days = invoiceMetrics.totalOutstanding * 0.1;
    
    invoiceMetrics.cashFlowProjection = {
      next30Days,
      next60Days,
      beyond60Days,
      totalExpected: invoiceMetrics.totalOutstanding
    };
    
    return invoiceMetrics;
  };

  // Process purchase orders
  const processPurchaseOrders = (snapshot: any) => {
    const purchaseMetrics = {
      recentOrders: [] as any[],
      avgLeadTime: 0,
      stockTurnover: 0,
      reorderPatterns: {} as any,
      pendingOrders: [] as any[],
      completedOrders: [] as any[],
      totalPending: 0,
      totalCompleted: 0
    };
    
    let totalLeadTime = 0;
    let completedCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const po = doc.data();
      const orderInfo = {
        id: doc.id,
        date: po.date,
        expectedDate: po.expected_delivery_date,
        status: po.status,
        items: po.line_items?.length || 0,
        total: po.total || 0,
        vendor: po.vendor_name
      };
      
      purchaseMetrics.recentOrders.push(orderInfo);
      
      if (po.status === 'open' || po.status === 'pending') {
        purchaseMetrics.pendingOrders.push(orderInfo);
        purchaseMetrics.totalPending += po.total || 0;
      } else if (po.status === 'billed' || po.status === 'closed') {
        purchaseMetrics.completedOrders.push(orderInfo);
        purchaseMetrics.totalCompleted += po.total || 0;
        
        if (po.date && po.delivery_date) {
          const leadTime = Math.floor(
            (new Date(po.delivery_date).getTime() - new Date(po.date).getTime()) 
            / (1000 * 60 * 60 * 24)
          );
          totalLeadTime += leadTime;
          completedCount += 1;
        }
      }
      
      (po.line_items || []).forEach((item: any) => {
        const sku = item.sku || item.item_code;
        if (sku) {
          if (!purchaseMetrics.reorderPatterns[sku]) {
            purchaseMetrics.reorderPatterns[sku] = {
              count: 0,
              quantities: [],
              avgQuantity: 0
            };
          }
          purchaseMetrics.reorderPatterns[sku].count += 1;
          purchaseMetrics.reorderPatterns[sku].quantities.push(item.quantity);
        }
      });
    });
    
    purchaseMetrics.avgLeadTime = completedCount > 0 ? totalLeadTime / completedCount : 14;
    
    Object.keys(purchaseMetrics.reorderPatterns).forEach(sku => {
      const pattern = purchaseMetrics.reorderPatterns[sku];
      pattern.avgQuantity = pattern.quantities.reduce((a: number, b: number) => a + b, 0) / pattern.quantities.length;
    });
    
    return purchaseMetrics;
  };

  // Enhanced AI insights with comprehensive data
  const getAIInsights = async (suggestionsList?: Suggestion[], comprehensiveDataParam?: ComprehensiveData | null) => {
    const suggestionsToAnalyze = suggestionsList || suggestions;
    const dataToUse = comprehensiveDataParam || comprehensiveData;
    
    if (suggestionsToAnalyze.length === 0) return;
    
    setLoadingAI(true);
    try {
      // Prepare enhanced market data
      const enhancedMarketData: MarketData = {
        searchTrends: searchTrends,
        competitorPricing: {},
        marketShare: calculateMarketShare(dataToUse),
        categoryGrowth: calculateCategoryGrowth(dataToUse)
      };
      
      // Use the comprehensive data for insights
      const enhancedHistoricalData = dataToUse ? {
        // Sales metrics
        totalRevenue: dataToUse.salesTransactions?.totalRevenue || 0,
        totalUnits: dataToUse.salesTransactions?.totalUnits || 0,
        topProducts: dataToUse.salesTransactions?.topProducts || [],
        seasonalPattern: dataToUse.salesTransactions?.seasonalPattern || {},
        
        // Order patterns
        salesOrders: dataToUse.salesOrders,
        
        // Customer insights
        customerMetrics: dataToUse.customerInsights,
        
        // Financial metrics
        invoiceMetrics: dataToUse.invoiceMetrics,
        
        // Supply chain
        purchaseHistory: dataToUse.purchaseHistory,
        
        // Inventory
        zohoMetrics: dataToUse.zohoMetrics
      } : {};
      
      const response = await fetch(`${apiUrl}/api/ai-insights/purchase-order-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({
          brand: brands.find(b => b.value === selectedBrand)?.label || selectedBrand,
          suggestions: suggestionsToAnalyze,
          historicalSales: enhancedHistoricalData,
          marketData: enhancedMarketData
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setAiInsights(result.data);
        setMarketData(enhancedMarketData);
      } else {
        console.error('Failed to get AI insights');
      }
    } catch (error) {
      console.error('Failed to get AI insights:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  // Get detailed AI insights for individual products
  const getProductInsight = async (suggestion: Suggestion) => {
    const product = products.get(suggestion.sku);
    if (!product || productInsights.has(suggestion.sku)) return;
    
    try {
      const productTrend = searchTrends.find(t => 
        t.keyword.toLowerCase().includes(product.name.toLowerCase())
      );
      
      const response = await fetch(`${apiUrl}/api/ai-insights/product-purchase-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({
          product,
          suggestion,
          competitorData: { competitorStock: suggestion.competitorStock || 0 },
          searchTrends: { trend: productTrend, volume: suggestion.searchVolume }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setProductInsights(prev => new Map(prev).set(suggestion.sku, result.data));
        }
      }
    } catch (error) {
      console.error('Failed to get product insight:', error);
    }
  };

  // Handle quantity adjustments
  const handleQuantityAdjustment = async (sku: string, newQuantity: number) => {
    setAdjustedQuantities(prev => new Map(prev).set(sku, newQuantity));
    
    // Debounce validation
    setTimeout(async () => {
      const adjustments = Array.from(adjustedQuantities.entries()).map(([sku, qty]) => ({
        sku,
        originalQuantity: suggestions.find(s => s.sku === sku)?.recommendedQuantity || 0,
        adjustedQuantity: qty,
        quantity: qty
      }));
      
      if (adjustments.length > 0) {
        try {
          const response = await fetch(`${apiUrl}/api/ai-insights/validate-adjustments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': userId
            },
            body: JSON.stringify({
              originalSuggestions: suggestions,
              userAdjustments: adjustments,
              brand: brands.find(b => b.value === selectedBrand)?.label || selectedBrand
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            setValidationFeedback(result.data);
          }
        } catch (error) {
          console.error('Failed to validate adjustments:', error);
        }
      }
    }, 1000);
  };

  // Toggle product insight expansion
  const handleToggleProductInsight = (sku: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
      } else {
        newSet.add(sku);
        getProductInsight(suggestions.find(s => s.sku === sku)!);
      }
      return newSet;
    });
  };

  // Enhanced purchase order generation
  const generatePurchaseOrder = () => {
    const selected = suggestions.filter(s => selectedSuggestions.has(s.sku));
    
    if (selected.length === 0) {
      alert('Please select at least one item');
      return;
    }

    // Generate enhanced CSV with AI insights and comprehensive data
    const csvRows = [
      ['=== PURCHASE ORDER SUMMARY ==='],
      [`Brand: ${brands.find(b => b.value === selectedBrand)?.label}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [`Total Items: ${selected.length}`],
      [],
      ['=== AI STRATEGIC ANALYSIS ==='],
      [`Executive Summary: ${aiInsights?.executiveSummary || 'Analysis pending'}`],
      [`Market Timing: ${aiInsights?.marketTiming || 'N/A'}`],
      [`Risk Assessment: ${aiInsights?.riskAssessment || 'N/A'}`],
      [`Cash Flow Impact: ${aiInsights?.cashFlowImpact || 'N/A'}`],
      [`Customer Impact: ${aiInsights?.customerImpact || 'N/A'}`],
      [`Channel Strategy: ${aiInsights?.channelStrategy || 'N/A'}`],
      [`Inventory Optimization: ${aiInsights?.inventoryOptimization || 'N/A'}`],
      [],
      ['=== BUSINESS METRICS ===']
    ];
    
    // Add comprehensive data insights
    if (comprehensiveData) {
      csvRows.push(
        [`Total Revenue (6 months): £${comprehensiveData.salesTransactions?.totalRevenue?.toFixed(0) || 0}`],
        [`Total Units Sold: ${comprehensiveData.salesTransactions?.totalUnits || 0}`],
        [`Active Customers: ${comprehensiveData.customerInsights?.totalActiveCustomers || 0}`],
        [`VIP Customers: ${comprehensiveData.customerInsights?.customerSegments?.vip?.length || 0}`],
        [`Outstanding Invoices: £${comprehensiveData.invoiceMetrics?.totalOutstanding?.toFixed(0) || 0}`],
        [`Average Payment Days: ${comprehensiveData.invoiceMetrics?.avgPaymentDays?.toFixed(0) || 30}`],
        [`Low Stock Items: ${comprehensiveData.zohoMetrics?.lowStockItems?.length || 0}`],
        []
      );
    }
    
    csvRows.push(
      ['=== PRODUCT RECOMMENDATIONS ==='],
      ['SKU', 'Product Name', 'Category', 'RRP', 'Current Stock', 'Reorder Level', 
       'Recommended Qty', 'Adjusted Qty', 'Total Value', 'Confidence', 
       'Search Volume', 'Trend', 'AI Reasoning', 'Target Customers', 
       'Seasonal Notes', 'Competitive Advantage']
    );
    
    let totalValue = 0;
    
    selected.forEach(suggestion => {
      const product = products.get(suggestion.sku);
      const aiInsight = productInsights.get(suggestion.sku);
      const adjustedQty = adjustedQuantities.get(suggestion.sku) || suggestion.recommendedQuantity;
      
      if (product) {
        const value = product.retailPrice * adjustedQty;
        totalValue += value;
        
        csvRows.push([
          suggestion.sku,
          suggestion.product_name,
          product.category || '',
          `£${product.retailPrice.toFixed(2)}`,
          product.currentStock?.toString() || '0',
          product.reorderLevel?.toString() || '10',
          suggestion.recommendedQuantity.toString(),
          adjustedQty.toString(),
          `£${value.toFixed(2)}`,
          `${(suggestion.confidence * 100).toFixed(0)}%`,
          suggestion.searchVolume?.toString() || 'N/A',
          suggestion.trendDirection || 'stable',
          suggestion.reasoning,
          aiInsight?.targetCustomers || 'General market',
          aiInsight?.seasonalConsiderations || 'Standard seasonality',
          aiInsight?.competitiveAdvantage || 'Standard positioning'
        ]);
      }
    });
    
    // Add summary
    csvRows.push([]);
    csvRows.push(['=== ORDER SUMMARY ===']);
    csvRows.push([`Total Order Value: £${totalValue.toFixed(2)}`]);
    
    // Add trend-based recommendations
    if (aiInsights?.trendBasedRecommendations?.length > 0) {
      csvRows.push([]);
      csvRows.push(['=== TREND-BASED RECOMMENDATIONS ===']);
      aiInsights.trendBasedRecommendations.forEach((rec: string, idx: number) => {
        csvRows.push([`${idx + 1}. ${rec}`]);
      });
    }
    
    // Add category optimization
    if (aiInsights?.categoryOptimization?.length > 0) {
      csvRows.push([]);
      csvRows.push(['=== CATEGORY OPTIMIZATION ===']);
      aiInsights.categoryOptimization.forEach((cat: string, idx: number) => {
        csvRows.push([`${idx + 1}. ${cat}`]);
      });
    }
    
    // Add search trends summary
    if (searchTrends.length > 0) {
      csvRows.push([]);
      csvRows.push(['=== SEARCH TRENDS ===']);
      searchTrends.slice(0, 5).forEach(trend => {
        csvRows.push([
          trend.keyword,
          `Volume: ${trend.volume}`,
          `Trend: ${trend.trend}`,
          `Change: ${trend.percentageChange > 0 ? '+' : ''}${trend.percentageChange}%`
        ]);
      });
    }
    
    const csv = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-order-${selectedBrand}-${new Date().toISOString().split('T')[0]}-comprehensive.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return '#059669';
    if (confidence > 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <FaArrowUp className="trend-icon trend-up" />;
    if (trend === 'down') return <FaArrowUp className="trend-icon trend-down" style={{transform: 'rotate(180deg)'}} />;
    return <span className="trend-icon trend-stable">—</span>;
  };

  // Helper functions
  const calculateMarketShare = (data: ComprehensiveData | null): number => {
    if (!data) return 0;
    const totalMarket = 1000000; // Example total market size
    const ourRevenue = data.salesTransactions?.totalRevenue || 0;
    return (ourRevenue / totalMarket) * 100;
  };

  const calculateCategoryGrowth = (data: ComprehensiveData | null): number => {
    if (!data) return 0;
    const months = Object.keys(data.salesTransactions?.monthlyRevenue || {}).sort();
    if (months.length < 2) return 0;
    
    const lastMonth = data.salesTransactions.monthlyRevenue[months[months.length - 1]] || 0;
    const previousMonth = data.salesTransactions.monthlyRevenue[months[months.length - 2]] || 0;
    
    return previousMonth > 0 ? ((lastMonth - previousMonth) / previousMonth) * 100 : 0;
  };

  // Auto-load AI insights when suggestions change
  useEffect(() => {
    if (suggestions.length > 0 && !loadingAI && comprehensiveData) {
      getAIInsights(undefined, comprehensiveData);
    }
  }, [suggestions, comprehensiveData]);
  
  const handleToggleSuggestion = (sku: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
      } else {
        newSet.add(sku);
      }
      return newSet;
    });
  };

  return (
    <div className="purchase-suggestions-container">
      <div className="suggestions-header">
        <div className="header-content">
          <h1>AI Purchase Order Suggestions</h1>
          <p className="subtitle">
            Powered by comprehensive data analysis from Firebase and Zoho, including sales history, 
            customer patterns, cash flow, and market trends
          </p>
        </div>
      </div>

      <div className="controls-section">
        <div className="brand-selector-wrapper">
          <select 
            value={selectedBrand} 
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="brand-dropdown"
          >
            <option value="">Select a brand...</option>
            {brands.map(brand => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
              </option>
            ))}
          </select>
          
          <button 
            onClick={analyzeBrand}
            disabled={!selectedBrand || loading}
            className="analyze-btn"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Analyzing...
              </>
            ) : (
              <>
                <FaLightbulb />
                Analyze Brand
              </>
            )}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="actions-section">
            <div className="selection-info">
              <FaCheckCircle />
              <span>{selectedSuggestions.size} items selected</span>
              {adjustedQuantities.size > 0 && (
                <span className="adjusted-badge">
                  {adjustedQuantities.size} adjusted
                </span>
              )}
            </div>
            <button 
              onClick={generatePurchaseOrder}
              disabled={selectedSuggestions.size === 0}
              className="generate-btn"
            >
              <FaDownload />
              Generate Comprehensive Purchase Order
            </button>
          </div>
        )}
      </div>

      {/* Comprehensive Data Summary */}
      {comprehensiveData && !loading && (
        <div className="comprehensive-data-summary">
          <h3>Business Intelligence Summary</h3>
          <div className="data-summary-grid">
            <div className="summary-card">
              <h4>Sales Performance</h4>
              <p>Revenue: £{comprehensiveData.salesTransactions?.totalRevenue?.toLocaleString() || 0}</p>
              <p>Units: {comprehensiveData.salesTransactions?.totalUnits?.toLocaleString() || 0}</p>
            </div>
            <div className="summary-card">
              <h4>Customer Base</h4>
              <p>Active: {comprehensiveData.customerInsights?.totalActiveCustomers || 0}</p>
              <p>VIP: {comprehensiveData.customerInsights?.customerSegments?.vip?.length || 0}</p>
            </div>
            <div className="summary-card">
              <h4>Cash Flow</h4>
              <p>Outstanding: £{comprehensiveData.invoiceMetrics?.totalOutstanding?.toLocaleString() || 0}</p>
              <p>Avg Days: {comprehensiveData.invoiceMetrics?.avgPaymentDays?.toFixed(0) || 30}</p>
            </div>
            <div className="summary-card">
              <h4>Inventory</h4>
              <p>Low Stock: {comprehensiveData.zohoMetrics?.lowStockItems?.length || 0} items</p>
              <p>Out of Stock: {comprehensiveData.zohoMetrics?.outOfStockItems?.length || 0} items</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Panel - Enhanced */}
      {aiInsights && !loadingAI && (
        <div className="ai-insights-panel enhanced">
          <div className="insights-header">
            <FaLightbulb className="insights-icon" />
            <h3>AI Strategic Analysis (Comprehensive Data)</h3>
          </div>
          
          <div className="insights-content">
            <div className="insight-section">
              <h4>Executive Summary</h4>
              <p>{aiInsights.executiveSummary}</p>
            </div>
            
            <div className="insights-grid">
              <div className="insight-card">
                <FaChartLine className="card-icon" />
                <h5>Market Timing</h5>
                <p>{aiInsights.marketTiming}</p>
              </div>
              
              <div className="insight-card">
                <h5>Cash Flow Impact</h5>
                <p>{aiInsights.cashFlowImpact}</p>
              </div>
              
              <div className="insight-card">
                <h5>Customer Impact</h5>
                <p>{aiInsights.customerImpact}</p>
              </div>
              
              <div className="insight-card">
                <h5>Channel Strategy</h5>
                <p>{aiInsights.channelStrategy}</p>
              </div>
              
              <div className="insight-card risk">
                <FaExclamationTriangle className="card-icon" />
                <h5>Risk Assessment</h5>
                <p>{aiInsights.riskAssessment}</p>
              </div>
              
              <div className="insight-card">
                <h5>Inventory Optimization</h5>
                <p>{aiInsights.inventoryOptimization}</p>
              </div>
              
              <div className="insight-card">
                <h5>Confidence Assessment</h5>
                <p>{aiInsights.confidenceAssessment}</p>
              </div>
            </div>
            
            {aiInsights.trendBasedRecommendations?.length > 0 && (
              <div className="recommendations-section">
                <h4>Trend-Based Recommendations</h4>
                <ul>
                  {aiInsights.trendBasedRecommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiInsights.categoryOptimization?.length > 0 && (
              <div className="category-section">
                <h4>Category Optimization</h4>
                <ul>
                  {aiInsights.categoryOptimization.map((cat: string, idx: number) => (
                    <li key={idx}>{cat}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Trends Panel */}
      {searchTrends.length > 0 && !loadingTrends && (
        <div className="search-trends-panel">
          <div className="trends-header">
            <FaChartLine className="trends-icon" />
            <h3>Market Search Trends</h3>
          </div>
          <div className="trends-grid">
            {searchTrends.slice(0, 4).map((trend, idx) => (
              <div key={idx} className="trend-card">
                <h5>{trend.keyword}</h5>
                <div className="trend-metrics">
                  <span className="volume">Volume: {trend.volume.toLocaleString()}</span>
                  <span className={`trend-change ${trend.trend}`}>
                    {trend.percentageChange > 0 ? '+' : ''}{trend.percentageChange}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjustment Validation Feedback */}
      {validationFeedback && (
        <div className={`validation-feedback ${validationFeedback.confidenceInAdjustments > 70 ? 'positive' : 'warning'}`}>
          <h4>Adjustment Analysis</h4>
          <p>{validationFeedback.adjustmentAssessment}</p>
          <div className="confidence-score">
            Confidence: {validationFeedback.confidenceInAdjustments}%
          </div>
          {validationFeedback.potentialRisks?.length > 0 && (
            <div className="risks">
              <h5>Potential Risks:</h5>
              <ul>
                {validationFeedback.potentialRisks.map((risk: string, idx: number) => (
                  <li key={idx}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {loading && (
        <div className="loading-state">
          <Lottie 
            animationData={loaderAnimation}
            loop={true}
            autoplay={true}
            style={{ width: 150, height: 150 }}
          />
          <h3>Analyzing Comprehensive Data</h3>
          <p>Gathering data from Firebase and Zoho...</p>
          <p className="loading-subtitle">
            Analyzing sales history, customer patterns, invoices, and inventory levels
          </p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <div>
            <h4>Analysis Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {!loading && suggestions.length > 0 && (
        <>
          <div className="results-header">
            <h2>Purchase Recommendations for {brands.find(b => b.value === selectedBrand)?.label}</h2>
            <p>{suggestions.length} products analyzed with comprehensive business data</p>
          </div>
          
          <div className="suggestions-grid">
            {suggestions.map((suggestion) => {
              const product = products.get(suggestion.sku);
              const isSelected = selectedSuggestions.has(suggestion.sku);
              const isExpanded = expandedProducts.has(suggestion.sku);
              const productInsight = productInsights.get(suggestion.sku);
              const adjustedQty = adjustedQuantities.get(suggestion.sku);
              
              return (
                <div 
                  key={suggestion.sku} 
                  className={`suggestion-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => handleToggleSuggestion(suggestion.sku)}
                >
                  <div className="card-header">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSuggestion(suggestion.sku)}
                      onClick={(e) => e.stopPropagation()}
                      className="suggestion-checkbox"
                    />
                    <div className="product-info">
                      {product?.imageUrl && (
                        <img 
                          src={product.imageUrl} 
                          alt={suggestion.product_name}
                          className="product-thumbnail"
                        />
                      )}
                      <div>
                        <h4>{suggestion.product_name}</h4>
                        <span className="sku">{suggestion.sku}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="metrics-row">
                    <div className="metric">
                      <span className="metric-label">Current Stock</span>
                      <span className="metric-value">
                        {product?.currentStock || 0} units
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Reorder Level</span>
                      <span className="metric-value">
                        {product?.reorderLevel || 10} units
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Recommended Qty</span>
                      <div className="quantity-controls">
                        <span className="metric-value">{suggestion.recommendedQuantity}</span>
                        {isSelected && (
                          <input
                            type="number"
                            value={adjustedQty || suggestion.recommendedQuantity}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleQuantityAdjustment(suggestion.sku, parseInt(e.target.value) || 0);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="quantity-input"
                            min="0"
                          />
                        )}
                      </div>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Confidence</span>
                      <span 
                        className="metric-value confidence"
                        style={{ color: getConfidenceColor(suggestion.confidence) }}
                      >
                        {(suggestion.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {product && (
                      <div className="metric">
                        <span className="metric-label">Value</span>
                        <span className="metric-value">
                          £{(product.retailPrice * (adjustedQty || suggestion.recommendedQuantity)).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {suggestion.searchVolume !== undefined && (
                      <div className="metric">
                        <span className="metric-label">Search Volume</span>
                        <span className="metric-value search-volume">
                          {suggestion.searchVolume.toLocaleString()}
                          {getTrendIcon(suggestion.trendDirection)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {suggestion.reasoning && (
                    <div className="reasoning-section">
                      <p className="reasoning-text">{suggestion.reasoning}</p>
                    </div>
                  )}
                  
                  <button 
                    className="insight-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleProductInsight(suggestion.sku);
                    }}
                  >
                    <FaLightbulb /> {isExpanded ? 'Hide' : 'Show'} AI Analysis
                  </button>
                  
                  {isExpanded && productInsight && (
                    <div className="product-ai-insights">
                      <div className="insight-detail">
                        <strong>Purchase Rationale:</strong>
                        <p>{productInsight.purchaseRationale}</p>
                      </div>
                      
                      <div className="insight-detail">
                        <strong>Target Customers:</strong>
                        <p>{productInsight.targetCustomers}</p>
                      </div>
                      
                      <div className="insight-detail">
                        <strong>Seasonal Considerations:</strong>
                        <p>{productInsight.seasonalConsiderations}</p>
                      </div>
                      
                      <div className="insight-detail">
                        <strong>Competitive Advantage:</strong>
                        <p>{productInsight.competitiveAdvantage}</p>
                      </div>
                      
                      <div className="insight-detail">
                        <strong>Pricing Strategy:</strong>
                        <p>{productInsight.pricingStrategy}</p>
                      </div>
                      
                      <div className="insight-detail">
                        <strong>Display Suggestions:</strong>
                        <p>{productInsight.displaySuggestions}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && suggestions.length === 0 && selectedBrand && !error && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No recommendations available</h3>
          <p>Try selecting a different brand or check back later.</p>
        </div>
      )}
    </div>
  );
};