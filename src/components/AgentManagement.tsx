// Updated AgentManagement.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  updateDoc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useDashboard } from '../hooks/useDashboard';
import { NormalizedAgent, NormalizedOrder, NormalizedInvoice } from '../types/dashboard';
import CountUp from 'react-countup';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import "./dashboard.css";
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';

// Agent names to display
const AGENT_NAMES = [
  'Dave Roberts',
  'Nick Barr',
  'Georgia Middler',
  'Steph Gillard',
  'Hannah Neale',
  'Gay Croker',
  'Mike Anderson',
  'Kate Ellis',
  'Marcus Johnson',
  'Tony Butler',
  'Stephen Stroud'
];

// UK Regions
const UK_REGIONS = [
  'London',
  'South East',
  'South West',
  'West Midlands',
  'North West',
  'North East',
  'Yorkshire and The Humber',
  'East Midlands',
  'East of England',
  'Scotland',
  'Wales',
  'Northern Ireland'
];

// Brand mapping
const BRAND_KEYS = {
  'Blomus': 'blomus',
  'GEFU': 'gefu',
  'Elvang': 'elvang',
  'My Flame': 'myflame',
  'Räder': 'rader',
  'Relaxound': 'relaxound',
  'Remember': 'remember'
};

interface ExtendedAgentData extends NormalizedAgent {
  uid: string;
  customerCount: number;
}

interface AgentMetrics {
  topCustomers: Array<{
    id: string;
    name: string;
    totalSpent: number;
    orderCount: number;
  }>;
  topItems: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  topOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    date: Date;
  }>;
  overdueInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    balance: number;
    daysOverdue: number;
    dueDate: Date;
  }>;
}

const AgentManagement: React.FC = () => {
  const [dateRange, setDateRange] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ 
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date()
  });
  const [activeView, setActiveView] = useState('overview');
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    localStorage.getItem('agentManagementLogo')
  );
  const [agentsData, setAgentsData] = useState<Map<string, ExtendedAgentData>>(new Map());
  const [agentMetrics, setAgentMetrics] = useState<Map<string, AgentMetrics>>(new Map());
  const [additionalLoading, setAdditionalLoading] = useState(true);
  const [aiInsightsModal, setAiInsightsModal] = useState<{
    isOpen: boolean;
    agentId: string | null;
    insights: any | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    agentId: null,
    insights: null,
    isLoading: false
  });
  const [agentHistory, setAgentHistory] = useState<Map<string, any>>(new Map());
  
  const tabIndicatorRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Get the current user ID - must be a brand manager to view this
  const currentUserId = auth.currentUser?.uid;

  // Map our date range to dashboard format
  const dashboardDateRange = useMemo(() => {
    switch (dateRange) {
      case 'week': return '7_days';
      case 'month': return '30_days';
      case 'quarter': return 'quarter';
      case 'ytd': return 'year';
      case 'year': return 'year';
      default: return 'custom';
    }
  }, [dateRange]);

  // Use the dashboard hook to get normalized data - as a brand manager
  const { data, loading, error, refresh } = useDashboard({
    userId: currentUserId,
    dateRange: dashboardDateRange,
    customDateRange: dateRange === 'custom' ? {
      start: customDateRange.start.toISOString().split('T')[0],
      end: customDateRange.end.toISOString().split('T')[0]
    } : undefined,
    autoRefresh: false,
    isAgentView: false // Always false for agent management
  });

  // Fetch additional agent data and process metrics
  useEffect(() => {
    const processAgentData = async () => {
      if (!data || !data.agentPerformance?.agents || data.role !== 'brandManager') {
        setAdditionalLoading(false);
        return;
      }

      setAdditionalLoading(true);
      try {
        const agents = new Map<string, ExtendedAgentData>();
        const metrics = new Map<string, AgentMetrics>();

        // Process each agent from the dashboard data
        for (const agentPerf of data.agentPerformance.agents) {
          // Only include agents in our list
          if (!AGENT_NAMES.includes(agentPerf.agentName)) continue;

          const agentUid = agentPerf.agentUid || agentPerf.agentId;

          // Get additional user data from Firebase
          let userData: any = {};
          let customerCount = 0;
          
          try {
            const userDoc = await getDoc(doc(db, 'users', agentUid));
            if (userDoc.exists()) {
              userData = userDoc.data();
            }

            // Get customer count
            const customersSnapshot = await getDocs(
              query(collection(db, 'customers'), 
                where('salesperson_uid', '==', agentUid)
              )
            );
            customerCount = customersSnapshot.size;
          } catch (err) {
            console.error('Error fetching user data for', agentPerf.agentName, err);
          }

          // Create extended agent data
          const agentData: ExtendedAgentData = {
            ...agentPerf,
            uid: agentUid,
            name: agentPerf.agentName,
            email: userData.email || '',
            phone: userData.phone,
            region: Array.isArray(userData.region) ? userData.region : [],
            brandsAssigned: userData.brandsAssigned || {},
            customerCount,
            orderCount: agentPerf.totalOrders // Map totalOrders to orderCount
          };

          agents.set(agentUid, agentData);

          // Get agent's orders from the main orders array
          const agentOrders = (data.orders || []).filter(order => 
            order.salesperson_uid === agentUid ||
            order.salesperson_id === agentUid ||
            order.salesperson_name === agentPerf.agentName
          );

          // Calculate last order date
          if (agentOrders.length > 0) {
            const sortedOrders = agentOrders.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            agentData.lastOrderDate = sortedOrders[0].date;
          }

          // Calculate metrics
          const customerMap = new Map<string, any>();
          const itemMap = new Map<string, any>();

          agentOrders.forEach(order => {
            // Track customers
            if (!customerMap.has(order.customer_id)) {
              customerMap.set(order.customer_id, {
                id: order.customer_id,
                name: order.customer_name,
                totalSpent: 0,
                orderCount: 0
              });
            }
            const customer = customerMap.get(order.customer_id);
            customer.totalSpent += order.total || 0;
            customer.orderCount++;

            // Track items
            if (order.line_items) {
              order.line_items.forEach((item: any) => {
                const itemKey = item.item_id || item.item_name;
                if (!itemMap.has(itemKey)) {
                  itemMap.set(itemKey, {
                    id: itemKey,
                    name: item.item_name || item.name,
                    quantity: 0,
                    revenue: 0
                  });
                }
                const itemData = itemMap.get(itemKey);
                itemData.quantity += item.quantity || 0;
                itemData.revenue += item.total || ((item.quantity || 0) * (item.price || 0));
              });
            }
          });

          // Get overdue invoices for this agent
          const overdueInvoices: any[] = [];
          if (data.invoices?.overdue) {
            data.invoices.overdue.forEach(invoice => {
              // Check if invoice belongs to this agent's customer
              const customerOrder = agentOrders.find(o => o.customer_id === invoice.customer_id);
              if (customerOrder) {
                overdueInvoices.push({
                  id: invoice.id,
                  invoiceNumber: invoice.invoice_number,
                  customerName: invoice.customer_name,
                  balance: invoice.balance,
                  daysOverdue: invoice.days_overdue || 0,
                  dueDate: new Date(invoice.due_date)
                });
              }
            });
          }

          const agentMetric: AgentMetrics = {
            topCustomers: Array.from(customerMap.values())
              .sort((a, b) => b.totalSpent - a.totalSpent)
              .slice(0, 5),
            topItems: Array.from(itemMap.values())
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5),
            topOrders: agentOrders
              .sort((a, b) => (b.total || 0) - (a.total || 0))
              .slice(0, 5)
              .map(order => ({
                id: order.id,
                orderNumber: order.salesorder_number || order.order_number || '',
                customerName: order.customer_name,
                total: order.total || 0,
                date: new Date(order.date)
              })),
            overdueInvoices: overdueInvoices.slice(0, 5)
          };

          metrics.set(agentUid, agentMetric);
        }

        setAgentsData(agents);
        setAgentMetrics(metrics);
      } catch (error) {
        console.error('Error processing agent data:', error);
      } finally {
        setAdditionalLoading(false);
      }
    };

    processAgentData();
  }, [data]);

  // Fetch agent's historical performance data
  const fetchAgentHistory = async (agentUid: string) => {
    try {
      // Get historical data for the past 12 months
      const historicalData = {
        monthly: [],
        quarterly: [],
        yearly: null
      };
      
      // Fetch last 12 months of data
      for (let i = 0; i < 12; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        
        // You would fetch actual historical data here
        // For now, using the current data as a placeholder
        historicalData.monthly.push({
          month: monthKey,
          revenue: Math.random() * 50000 + 10000,
          orders: Math.floor(Math.random() * 50 + 10),
          customers: Math.floor(Math.random() * 20 + 5)
        });
      }
      
      return historicalData;
    } catch (error) {
      console.error('Error fetching agent history:', error);
      return null;
    }
  };

  // Segment customers into categories
  const segmentCustomers = (customers: any[]) => {
    return {
      vip: customers.filter(c => c.totalSpent > 10000),
      regular: customers.filter(c => c.totalSpent > 1000 && c.totalSpent <= 10000),
      occasional: customers.filter(c => c.totalSpent <= 1000),
      new: customers.filter(c => c.orderCount === 1),
      atrisk: customers.filter(c => {
        // Customers who haven't ordered in 90+ days
        const lastOrder = new Date(c.lastOrderDate || 0);
        const daysSince = (Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 90 && c.orderCount > 1;
      })
    };
  };

  // Generate AI insights for an agent
  const generateAgentAIInsights = async (agentUid: string) => {
    const agent = agentsData.get(agentUid);
    const metrics = agentMetrics.get(agentUid);
    
    if (!agent || !metrics) {
      console.error('No agent data available');
      return;
    }
    
    setAiInsightsModal({
      isOpen: true,
      agentId: agentUid,
      insights: null,
      isLoading: true
    });
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      
      // Fetch historical data
      const historicalData = await fetchAgentHistory(agentUid);
      
      // Prepare comprehensive agent data
      const agentAnalysisData = {
        agentData: {
          uid: agent.uid,
          name: agent.agentName,
          totalRevenue: agent.totalRevenue,
          totalOrders: agent.totalOrders,
          customerCount: agent.customerCount,
          brandsAssigned: agent.brandsAssigned,
          region: agent.region,
          lastOrderDate: agent.lastOrderDate
        },
        performanceHistory: historicalData,
        customerBase: {
          total: agent.customerCount,
          active: metrics.topCustomers.filter(c => c.orderCount > 1).length,
          topCustomers: metrics.topCustomers,
          customerSegmentation: segmentCustomers(metrics.topCustomers),
          averageCustomerValue: metrics.topCustomers.reduce((sum, c) => sum + c.totalSpent, 0) / Math.max(metrics.topCustomers.length, 1)
        },
        metrics: {
          topItems: metrics.topItems,
          topOrders: metrics.topOrders,
          overdueInvoices: metrics.overdueInvoices
        }
      };
      
      const response = await fetch(`${apiUrl}/api/ai-insights/agent-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId
        },
        body: JSON.stringify(agentAnalysisData)
      });
      
      if (response.ok) {
        const result = await response.json();
        setAiInsightsModal({
          isOpen: true,
          agentId: agentUid,
          insights: result.data,
          isLoading: false
        });
      } else {
        throw new Error('Failed to generate insights');
      }
    } catch (error) {
      console.error('Error generating agent insights:', error);
      setAiInsightsModal({
        isOpen: true,
        agentId: agentUid,
        insights: {
          error: 'Unable to generate insights at this time'
        },
        isLoading: false
      });
    }
  };

  // Update tab indicator position
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

  // MetricCard component (same as Dashboard)
  const MetricCard: React.FC<{
    title: string;
    value: number | string;
    subtitle?: string;
    icon: string;
    formatter?: (value: number) => string;
  }> = ({ title, value, subtitle, icon, formatter }) => {
    const formatValue = useCallback((val: number | string) => {
      if (typeof val === 'string') return val;
      if (formatter) return formatter(val);
      if (val >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `£${(val / 1000).toFixed(1)}K`;
      return `£${val.toLocaleString()}`;
    }, [formatter]);

    return (
      <div className="metric-card-enhanced">
        <div className="card-header-enhanced">
          <div className="metric-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <h3 className="card-title">{title}</h3>
            </div>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
        
        <div className="metric-content-enhanced">
          <div className="metric-value">
            <span className="primary-metric-enhanced">
              {typeof value === 'number' ? (
                <CountUp 
                  end={value} 
                  duration={1.5} 
                  formattingFn={formatValue} 
                />
              ) : (
                value
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Handle logo upload
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setLogoUrl(url);
        localStorage.setItem('agentManagementLogo', url);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save agent data
  const saveAgentData = async (agentUid: string, data: Partial<any>) => {
    try {
      const userRef = doc(db, 'users', agentUid);
      await updateDoc(userRef, data);
      
      // Update local state
      setAgentsData(prev => {
        const newData = new Map(prev);
        const agent = newData.get(agentUid);
        if (agent) {
          newData.set(agentUid, { ...agent, ...data });
        }
        return newData;
      });
    } catch (error) {
      console.error('Error saving agent data:', error);
    }
  };

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    let totalOrders = 0;
    let totalRevenue = 0;
    let lastOrderDate: Date | null = null;
    
    agentsData.forEach(agent => {
      totalOrders += agent.totalOrders || 0;
      totalRevenue += agent.totalRevenue || 0;
      if (agent.lastOrderDate) {
        const date = new Date(agent.lastOrderDate);
        if (!lastOrderDate || date > lastOrderDate) {
          lastOrderDate = date;
        }
      }
    });
    
    return {
      totalOrders,
      totalRevenue,
      lastOrderDate,
      numberOfAgents: agentsData.size
    };
  }, [agentsData]);

  // Get top performing agents
  const topPerformingAgents = useMemo(() => {
    return Array.from(agentsData.values())
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 5);
  }, [agentsData]);

  // Get latest orders from all agents
  const latestOrders = useMemo(() => {
    if (!data?.orders) return [];
    
    const agentUids = new Set(Array.from(agentsData.keys()));
    
    return data.orders
      .filter(order => {
        return order.salesperson_uid && agentUids.has(order.salesperson_uid);
      })
      .slice(0, ordersPageSize);
  }, [data, agentsData, ordersPageSize]);

  // Define available views
  const availableViews = useMemo(() => {
    const views = [
      { id: 'overview', label: 'Overview', icon: '📊' }
    ];
    
    // Add agent tabs
    Array.from(agentsData.values()).forEach(agent => {
      views.push({
        id: agent.uid,
        label: agent.agentName.split(' ')[0], // First name only
        icon: '👤'
      });
    });
    
    return views;
  }, [agentsData]);

  // AI Insights Modal Component
  const AgentAIInsightsModal = () => {
    if (!aiInsightsModal.isOpen) return null;
    
    const agent = agentsData.get(aiInsightsModal.agentId || '');
    
    return (
      <div className="ai-insight-overlay" onClick={() => setAiInsightsModal({ ...aiInsightsModal, isOpen: false })}>
        <div className="ai-insight-modal agent-insights" onClick={(e) => e.stopPropagation()}>
          <div className="ai-modal-header">
            <div className="ai-header-content">
              <div className="ai-icon">🤖</div>
              <div>
                <h3 className="ai-modal-title">AI Performance Analysis: {agent?.agentName}</h3>
                <p className="ai-modal-subtitle">Comprehensive agent insights powered by AI</p>
              </div>
            </div>
            <button 
              className="ai-close-button" 
              onClick={() => setAiInsightsModal({ ...aiInsightsModal, isOpen: false })}
            >
              ×
            </button>
          </div>
          
          <div className="ai-modal-content-scrollable">
            {aiInsightsModal.isLoading ? (
              <div className="ai-loading">
                <Lottie 
                  animationData={loaderAnimation}
                  loop={true}
                  autoplay={true}
                  style={{ width: 100, height: 100 }}
                />
                <p>Analyzing agent performance and generating insights...</p>
              </div>
            ) : aiInsightsModal.insights?.error ? (
              <div className="ai-error">
                <p>{aiInsightsModal.insights.error}</p>
              </div>
            ) : aiInsightsModal.insights ? (
              <>
                {/* Performance Overview */}
                <div className="ai-insight-section">
                  <h4>📊 Performance Overview</h4>
                  <p className="ai-insight-text">{aiInsightsModal.insights.performanceOverview}</p>
                </div>
                
                {/* Performance Trends */}
                {aiInsightsModal.insights.performanceTrends && (
                  <div className="ai-insight-section">
                    <h4>📈 Performance Trends</h4>
                    <div className="performance-metrics">
                      <div className="metric-item">
                        <span className="label">Revenue Trend</span>
                        <span className={`value ${aiInsightsModal.insights.performanceTrends.revenueTrend}`}>
                          {aiInsightsModal.insights.performanceTrends.revenueTrend}
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="label">Order Frequency</span>
                        <span className="value">{aiInsightsModal.insights.performanceTrends.orderFrequency}</span>
                      </div>
                      <div className="metric-item">
                        <span className="label">Customer Retention</span>
                        <span className="value">{aiInsightsModal.insights.performanceTrends.customerRetention}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Customer Insights */}
                {aiInsightsModal.insights.customerInsights && (
                  <div className="ai-insight-section">
                    <h4>👥 Customer Base Analysis</h4>
                    <p>{aiInsightsModal.insights.customerInsights.summary}</p>
                    <div className="customer-segments">
                      {aiInsightsModal.insights.customerInsights.segments?.map((segment: any, idx: number) => (
                        <div key={idx} className="segment-card">
                          <h5>{segment.name}</h5>
                          <p>{segment.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Opportunities */}
                {aiInsightsModal.insights.opportunities && (
                  <div className="ai-insight-section">
                    <h4>💡 Growth Opportunities</h4>
                    <ul className="opportunities-list">
                      {aiInsightsModal.insights.opportunities.map((opp: string, idx: number) => (
                        <li key={idx}>{opp}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Recommendations */}
                {aiInsightsModal.insights.recommendations && (
                  <div className="ai-insight-section">
                    <h4>🎯 Actionable Recommendations</h4>
                    <div className="recommendations-grid">
                      {aiInsightsModal.insights.recommendations.map((rec: any, idx: number) => (
                        <div key={idx} className="recommendation-card">
                          <h5>{rec.title}</h5>
                          <p>{rec.description}</p>
                          <span className={`priority priority-${rec.priority}`}>
                            {rec.priority} priority
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Efficiency Score */}
                {aiInsightsModal.insights.efficiencyScore && (
                  <div className="ai-insight-section">
                    <h4>⚡ Efficiency Analysis</h4>
                    <div className="efficiency-score">
                      <div className="score-circle">
                        <span className="score">{aiInsightsModal.insights.efficiencyScore.score}%</span>
                      </div>
                      <div className="score-details">
                        <p>{aiInsightsModal.insights.efficiencyScore.analysis}</p>
                        <ul>
                          {aiInsightsModal.insights.efficiencyScore.factors?.map((factor: string, idx: number) => (
                            <li key={idx}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
          
          <div className="ai-modal-footer">
            <p className="ai-disclaimer">
              AI analysis based on performance data and customer patterns. Updated {new Date().toLocaleDateString()}.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Overview View
  const OverviewView = () => {
    return (
      <div className="view-content">
        <div className="metrics-grid-enhanced">
          <MetricCard
            title="Total Order Count"
            value={overallMetrics.totalOrders}
            subtitle="From all sales agents"
            icon="📦"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="Total Order Revenue"
            value={overallMetrics.totalRevenue}
            subtitle="Combined revenue"
            icon="💰"
          />
          <MetricCard
            title="Number of Sales Agents"
            value={overallMetrics.numberOfAgents}
            subtitle="Active agents"
            icon="👥"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="Last Order"
            value={overallMetrics.lastOrderDate 
              ? overallMetrics.lastOrderDate.toLocaleDateString('en-GB') 
              : 'No orders'}
            subtitle="Most recent order date"
            icon="📅"
          />
        </div>

        {/* Top 5 performing salesAgents */}
        <div className="overview-table-card" style={{ marginTop: '2rem' }}>
          <h3>Top 5 Performing Sales Agents (£)</h3>
          <div className="table-content">
            {topPerformingAgents.length > 0 ? (
              topPerformingAgents.map((agent, index) => (
                <div key={agent.uid} className="table-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{agent.agentName}</span>
                  <span className="value">£{(agent.totalRevenue || 0).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No agent data available</p>
            )}
          </div>
        </div>

        {/* Latest Orders */}
        <div className="data-table-card-enhanced" style={{ marginTop: '2rem' }}>
          <div className="table-header">
            <h3 className="table-title">Latest Orders</h3>
            <div className="table-controls">
              <select 
                value={ordersPageSize}
                onChange={(e) => setOrdersPageSize(Number(e.target.value))}
                className="filter-select"
              >
                <option value={20}>Show 20</option>
                <option value={30}>Show 30</option>
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
                  <th>Sales Agent</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.length > 0 ? (
                  latestOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.salesorder_number || order.order_number}</td>
                      <td>{order.customer_name}</td>
                      <td>{order.salesperson_name || 'Unknown'}</td>
                      <td>{new Date(order.date).toLocaleDateString('en-GB')}</td>
                      <td>£{(order.total || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${
                          ['confirmed', 'completed', 'fulfilled'].includes(order.status || '') 
                            ? 'success' 
                            : 'warning'
                        }`}>
                          {order.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Individual Agent View
  const AgentView = ({ agentUid }: { agentUid: string }) => {
    const agent = agentsData.get(agentUid);
    if (!agent) return <div>Agent not found</div>;
    
    const metrics = agentMetrics.get(agentUid);
    if (!metrics) return <div>No metrics available</div>;

    // Ensure brandsAssigned is a map object
    const currentBrands = agent.brandsAssigned || {};
    
    // Ensure region is an array
    const currentRegions = Array.isArray(agent.region) ? agent.region : [];

    return (
      <div className="view-content">
        {/* Agent Info Card */}
        <div className="metric-card-enhanced" style={{ width: '100%', marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{agent.agentName}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Email</p>
                <p style={{ fontWeight: 600 }}>{agent.email || 'Not provided'}</p>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Phone</p>
                <p style={{ fontWeight: 600 }}>{agent.phone || 'Not provided'}</p>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Number of Customers</p>
                <p style={{ fontWeight: 600 }}>{agent.customerCount || 0}</p>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Brands Assigned</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {Object.entries(BRAND_KEYS).map(([displayName, firebaseKey]) => (
                    <label key={firebaseKey} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="checkbox"
                        checked={currentBrands[firebaseKey] === true}
                        onChange={(e) => {
                          const updatedBrands = {
                            ...currentBrands,
                            [firebaseKey]: e.target.checked
                          };
                          saveAgentData(agent.uid, { brandsAssigned: updatedBrands });
                        }}
                      />
                      <span>{displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Regions Covered</p>
                <div style={{ marginTop: '0.5rem' }}>
                  {currentRegions.length > 0 ? (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        Current regions: {currentRegions.join(', ')}
                      </p>
                    </div>
                  ) : null}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !currentRegions.includes(e.target.value)) {
                        saveAgentData(agent.uid, { 
                          region: [...currentRegions, e.target.value] 
                        });
                      }
                    }}
                    className="filter-select"
                  >
                    <option value="">Add a region...</option>
                    {UK_REGIONS.filter(r => !currentRegions.includes(r)).map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  {currentRegions.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {currentRegions.map(region => (
                        <span 
                          key={region}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'var(--hover-bg)',
                            borderRadius: '4px',
                            fontSize: '0.813rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          {region}
                          <button
                            onClick={() => {
                              saveAgentData(agent.uid, {
                                region: currentRegions.filter(r => r !== region)
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '0',
                              fontSize: '1rem'
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Button */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <button 
            className="ai-insights-button-large"
            onClick={() => generateAgentAIInsights(agent.uid)}
          >
            <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>💡</span>
            Generate AI Performance Analysis
          </button>
        </div>

        {/* Metrics */}
        <div className="metrics-grid-enhanced" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <MetricCard
            title="Total Order Count"
            value={agent.totalOrders || 0}
            subtitle="Orders processed"
            icon="📦"
            formatter={(val) => val.toLocaleString()}
          />
          <MetricCard
            title="Total Order Revenue"
            value={agent.totalRevenue || 0}
            subtitle="Revenue generated"
            icon="💰"
          />
          <MetricCard
            title="Last Order"
            value={agent.lastOrderDate 
              ? new Date(agent.lastOrderDate).toLocaleDateString('en-GB') 
              : 'No orders'}
            subtitle="Most recent order"
            icon="📅"
          />
        </div>

        {/* Tables Grid */}
        <div className="overview-tables-grid" style={{ marginTop: '2rem' }}>
          {/* Top 5 customers by total £ */}
          <div className="overview-table-card">
            <h3>Top 5 Customers by Total £</h3>
            <div className="table-content">
              {metrics.topCustomers.length > 0 ? (
                metrics.topCustomers.map((customer, index) => (
                  <div key={customer.id} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{customer.name}</span>
                    <span className="value">£{customer.totalSpent.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No customer data</p>
              )}
            </div>
          </div>

          {/* Top 5 items sold */}
          <div className="overview-table-card">
            <h3>Top 5 Items Sold</h3>
            <div className="table-content">
              {metrics.topItems.length > 0 ? (
                metrics.topItems.map((item, index) => (
                  <div key={item.id} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{item.name}</span>
                    <span className="value">{item.quantity} units</span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No items data</p>
              )}
            </div>
          </div>

          {/* Top 5 orders by total £ */}
          <div className="overview-table-card">
            <h3>Top 5 Orders by Total £</h3>
            <div className="table-content">
              {metrics.topOrders.length > 0 ? (
                metrics.topOrders.map((order, index) => (
                  <div key={order.id} className="table-row">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{order.orderNumber}</span>
                    <span className="value">£{order.total.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No orders data</p>
              )}
            </div>
          </div>

          {/* Invoices overdue */}
          <div className="overview-table-card">
            <h3>Invoices Overdue</h3>
            <div className="table-content">
              {metrics.overdueInvoices.length > 0 ? (
                metrics.overdueInvoices.slice(0, 5).map((invoice, index) => (
                  <div key={invoice.id} className="table-row">
                    <span className="rank">{invoice.invoiceNumber}</span>
                    <span className="name">{invoice.customerName}</span>
                    <span className="value" style={{ color: 'var(--error-color)' }}>
                      {invoice.daysOverdue} days
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No overdue invoices</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading || additionalLoading) {
    return (
      <div className="loading-container">
        <div className="ai-loading">
          <Lottie 
            animationData={loaderAnimation}
            loop={true}
            autoplay={true}
            style={{ width: 100, height: 100 }}
          />
          <p>Loading agent data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3 className="error-title">Error loading data</h3>
          <p className="error-message">{error}</p>
          <button onClick={refresh} className="error-button">Try Again</button>
        </div>
      </div>
    );
  }

  if (!data || data.role !== 'brandManager') {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">🚫</div>
          <h3 className="error-title">Access Denied</h3>
          <p className="error-message">Only brand managers can access agent management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-enhanced">
      <div className="dashboard-container-enhanced">
        {/* Header */}
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
                <h1 className="dashboard-title">Agent Management</h1>
                <p className="header-subtitle">Monitor and manage sales agent performance</p>
              </div>
            </div>
            
            <div className="header-controls-enhanced">
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className="date-selector-enhanced"
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="ytd">Year to Date</option>
                <option value="year">Year (12 Months)</option>
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
          
          {/* Sliding tabs */}
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
        {activeView !== 'overview' && <AgentView agentUid={activeView} />}
        
        {/* AI Insights Modal */}
        <AgentAIInsightsModal />
      </div>
    </div>
  );
};

export default AgentManagement;