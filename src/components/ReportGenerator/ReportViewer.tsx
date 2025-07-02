// src/components/ReportGenerator/ReportViewer.tsx
import React from 'react';
import { ReportData } from '../../types/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import './ReportViewer.css';

interface ReportViewerProps {
  reportData: ReportData;
  theme: 'dashboard' | 'light';
}

const ReportViewer: React.FC<ReportViewerProps> = ({ reportData, theme }) => {
  const { config, data, metadata } = reportData;

  // Chart colors based on theme
  const chartColors = {
    dashboard: {
      primary: '#448382',
      secondary: '#6c8471',
      accent: '#a66b6b',
      background: '#1a202c',
      text: '#ffffff'
    },
    light: {
      primary: '#2563eb',
      secondary: '#059669',
      accent: '#dc2626',
      background: '#ffffff',
      text: '#1f2937'
    }
  };

  const colors = chartColors[theme];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-GB').format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className={`report-viewer ${theme}-theme`}>
      {/* Report Header */}
      <div className="report-header-section">
        <div className="report-title-info">
          <h1>{config.name}</h1>
          {config.description && <p className="report-description">{config.description}</p>}
        </div>
        <div className="report-meta-info">
          <div className="meta-item">
            <strong>Generated:</strong> {formatDate(metadata.generatedAt)}
          </div>
          <div className="meta-item">
            <strong>Period:</strong> {formatDate(metadata.dataRange.start)} - {formatDate(metadata.dataRange.end)}
          </div>
          <div className="meta-item">
            <strong>Date Range:</strong> {config.dateRange.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Overview Section */}
      {config.sections.overview && data.overview && (
        <div className="report-section">
          <h2 className="section-title">📊 Overview</h2>
          <div className="metrics-summary">
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-content">
                <div className="metric-value">{formatCurrency(data.overview.totalRevenue || 0)}</div>
                <div className="metric-label">Total Revenue</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div className="metric-content">
                <div className="metric-value">{formatNumber(data.overview.totalOrders || 0)}</div>
                <div className="metric-label">Total Orders</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">👥</div>
              <div className="metric-content">
                <div className="metric-value">{formatNumber(data.overview.totalCustomers || 0)}</div>
                <div className="metric-label">Active Customers</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">📊</div>
              <div className="metric-content">
                <div className="metric-value">{formatCurrency(data.overview.averageOrderValue || 0)}</div>
                <div className="metric-label">Average Order Value</div>
              </div>
            </div>
          </div>

          {/* Key Performance Indicators */}
          <div className="kpi-grid">
            <div className="kpi-item">
              <h4>Revenue Growth</h4>
              <div className="kpi-value positive">
                +{((data.overview.revenueGrowth || 0) * 100).toFixed(1)}%
              </div>
              <div className="kpi-description">vs previous period</div>
            </div>
            <div className="kpi-item">
              <h4>Order Growth</h4>
              <div className="kpi-value positive">
                +{((data.overview.orderGrowth || 0) * 100).toFixed(1)}%
              </div>
              <div className="kpi-description">vs previous period</div>
            </div>
            <div className="kpi-item">
              <h4>Customer Retention</h4>
              <div className="kpi-value">
                {((data.overview.customerRetention || 0) * 100).toFixed(1)}%
              </div>
              <div className="kpi-description">repeat customers</div>
            </div>
            <div className="kpi-item">
              <h4>Conversion Rate</h4>
              <div className="kpi-value">
                {((data.overview.conversionRate || 0) * 100).toFixed(1)}%
              </div>
              <div className="kpi-description">orders to leads</div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Performance Section */}
      {config.sections.sales && data.sales && (
        <div className="report-section">
          <h2 className="section-title">💰 Sales Performance</h2>
          
          <div className="sales-metrics">
            <div className="sales-breakdown">
              <h3>Revenue Breakdown</h3>
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Gross Revenue:</span>
                  <span className="breakdown-value">{formatCurrency(data.sales.grossRevenue || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Net Revenue:</span>
                  <span className="breakdown-value">{formatCurrency(data.sales.netRevenue || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Tax Amount:</span>
                  <span className="breakdown-value">{formatCurrency(data.sales.taxAmount || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Profit Margin:</span>
                  <span className="breakdown-value">{(data.sales.profitMargin || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Revenue Trend Chart */}
            {config.charts.includeCharts && config.charts.chartTypes?.includes('revenue') && data.charts?.revenueTrend && (
              <div className="chart-container">
                <h3>Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.charts.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                    <XAxis 
                      dataKey="period" 
                      stroke={colors.text}
                      fontSize={12}
                    />
                    <YAxis 
                      stroke={colors.text}
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.primary}`,
                        borderRadius: '8px',
                        color: colors.text
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke={colors.primary}
                      strokeWidth={3}
                      dot={{ fill: colors.primary, strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Section */}
      {config.sections.orders && data.orders && (
        <div className="report-section">
          <h2 className="section-title">📦 Orders Analysis</h2>
          
          <div className="orders-analysis">
            <div className="orders-summary">
              <div className="summary-grid">
                <div className="summary-item">
                  <h4>Total Orders</h4>
                  <div className="summary-value">{formatNumber(data.orders.totalOrders || 0)}</div>
                </div>
                <div className="summary-item">
                  <h4>Completed Orders</h4>
                  <div className="summary-value">{formatNumber(data.orders.completedOrders || 0)}</div>
                </div>
                <div className="summary-item">
                  <h4>Pending Orders</h4>
                  <div className="summary-value">{formatNumber(data.orders.pendingOrders || 0)}</div>
                </div>
                <div className="summary-item">
                  <h4>Average Processing Time</h4>
                  <div className="summary-value">{(data.orders.avgProcessingTime || 0).toFixed(1)} days</div>
                </div>
              </div>
            </div>

            {/* Order Status Distribution */}
            {config.charts.includeCharts && config.charts.chartTypes?.includes('orders') && data.charts?.orderStatus && (
              <div className="chart-container">
                <h3>Order Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.charts.orderStatus}
                      dataKey="value"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill={colors.primary}
                    >
                      {data.charts.orderStatus.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={[colors.primary, colors.secondary, colors.accent, '#fbbf24', '#8b5cf6'][index % 5]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatNumber(value), 'Orders']}
                      contentStyle={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.primary}`,
                        borderRadius: '8px',
                        color: colors.text
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Products */}
            {data.orders.topProducts && (
              <div className="top-products">
                <h3>Top Selling Products</h3>
                <div className="products-table">
                  <div className="table-header">
                    <div>Product Name</div>
                    <div>Quantity Sold</div>
                    <div>Revenue</div>
                    <div>% of Total</div>
                  </div>
                  {data.orders.topProducts.slice(0, 10).map((product: any, index: number) => (
                    <div key={index} className="table-row">
                      <div className="product-name">{product.name}</div>
                      <div>{formatNumber(product.quantity)}</div>
                      <div>{formatCurrency(product.revenue)}</div>
                      <div>{(product.percentage || 0).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customers Section */}
      {config.sections.customers && data.customers && (
        <div className="report-section">
          <h2 className="section-title">👥 Customer Analysis</h2>
          
          <div className="customers-analysis">
            <div className="customer-metrics">
              <div className="metric-row">
                <div className="metric-item">
                  <h4>Total Customers</h4>
                  <div className="metric-number">{formatNumber(data.customers.totalCustomers || 0)}</div>
                </div>
                <div className="metric-item">
                  <h4>New Customers</h4>
                  <div className="metric-number">{formatNumber(data.customers.newCustomers || 0)}</div>
                </div>
                <div className="metric-item">
                  <h4>Repeat Customers</h4>
                  <div className="metric-number">{formatNumber(data.customers.repeatCustomers || 0)}</div>
                </div>
                <div className="metric-item">
                  <h4>Customer LTV</h4>
                  <div className="metric-number">{formatCurrency(data.customers.averageLTV || 0)}</div>
                </div>
              </div>
            </div>

            {/* Customer Segments */}
            {data.customers.segments && (
              <div className="customer-segments">
                <h3>Customer Segments</h3>
                <div className="segments-grid">
                  {Object.entries(data.customers.segments).map(([segment, count]: [string, any]) => (
                    <div key={segment} className="segment-card">
                      <div className="segment-name">{segment.toUpperCase()}</div>
                      <div className="segment-count">{formatNumber(count)}</div>
                      <div className="segment-percentage">
                        {((count / data.customers.totalCustomers) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Customers */}
            {data.customers.topCustomers && (
              <div className="top-customers">
                <h3>Top Customers by Revenue</h3>
                <div className="customers-table">
                  <div className="table-header">
                    <div>Customer Name</div>
                    <div>Total Spent</div>
                    <div>Orders</div>
                    <div>Avg Order Value</div>
                    <div>Last Order</div>
                  </div>
                  {data.customers.topCustomers.slice(0, 10).map((customer: any, index: number) => (
                    <div key={index} className="table-row">
                      <div className="customer-name">{customer.name}</div>
                      <div>{formatCurrency(customer.totalSpent)}</div>
                      <div>{formatNumber(customer.orderCount)}</div>
                      <div>{formatCurrency(customer.avgOrderValue)}</div>
                      <div>{customer.lastOrder ? formatDate(customer.lastOrder) : 'N/A'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices Section */}
      {config.sections.invoices && data.invoices && (
        <div className="report-section">
          <h2 className="section-title">📄 Invoice Analysis</h2>
          
          <div className="invoices-analysis">
            <div className="invoice-summary">
              <div className="summary-cards">
                <div className="summary-card paid">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <div className="card-value">{formatCurrency(data.invoices.totalPaid || 0)}</div>
                    <div className="card-label">Paid Invoices</div>
                    <div className="card-count">{formatNumber(data.invoices.paidCount || 0)} invoices</div>
                  </div>
                </div>
                <div className="summary-card outstanding">
                  <div className="card-icon">⏳</div>
                  <div className="card-content">
                    <div className="card-value">{formatCurrency(data.invoices.totalOutstanding || 0)}</div>
                    <div className="card-label">Outstanding</div>
                    <div className="card-count">{formatNumber(data.invoices.outstandingCount || 0)} invoices</div>
                  </div>
                </div>
                <div className="summary-card overdue">
                  <div className="card-icon">⚠️</div>
                  <div className="card-content">
                    <div className="card-value">{formatCurrency(data.invoices.totalOverdue || 0)}</div>
                    <div className="card-label">Overdue</div>
                    <div className="card-count">{formatNumber(data.invoices.overdueCount || 0)} invoices</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Performance */}
            <div className="payment-performance">
              <h3>Payment Performance</h3>
              <div className="performance-metrics">
                <div className="performance-item">
                  <span>Average Payment Time:</span>
                  <span>{(data.invoices.avgPaymentDays || 0).toFixed(1)} days</span>
                </div>
                <div className="performance-item">
                  <span>On-time Payment Rate:</span>
                  <span>{((data.invoices.onTimeRate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div className="performance-item">
                  <span>Collection Efficiency:</span>
                  <span>{((data.invoices.collectionRate || 0) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Aging Analysis */}
            {data.invoices.agingBuckets && (
              <div className="aging-analysis">
                <h3>Invoice Aging Analysis</h3>
                <div className="aging-buckets">
                  {data.invoices.agingBuckets.map((bucket: any, index: number) => (
                    <div key={index} className="aging-bucket">
                      <div className="bucket-period">{bucket.period}</div>
                      <div className="bucket-amount">{formatCurrency(bucket.amount)}</div>
                      <div className="bucket-count">{formatNumber(bucket.count)} invoices</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brand Performance Section (Brand Managers only) */}
      {config.sections.brands && data.brands && config.userRole === 'brandManager' && (
        <div className="report-section">
          <h2 className="section-title">🏷️ Brand Performance</h2>
          
          <div className="brands-analysis">
            {/* Brand Performance Chart */}
            {config.charts.includeCharts && data.charts?.brandPerformance && (
              <div className="chart-container">
                <h3>Brand Revenue Comparison</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.charts.brandPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                    <XAxis 
                      dataKey="brandName" 
                      stroke={colors.text}
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke={colors.text}
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.primary}`,
                        borderRadius: '8px',
                        color: colors.text
                      }}
                    />
                    <Bar dataKey="revenue" fill={colors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Brand Performance Table */}
            <div className="brands-table">
              <h3>Brand Performance Summary</h3>
              <div className="table-header">
                <div>Brand</div>
                <div>Revenue</div>
                <div>Market Share</div>
                <div>Orders</div>
                <div>Growth</div>
              </div>
              {data.brands.slice(0, 10).map((brand: any, index: number) => (
                <div key={index} className="table-row">
                  <div className="brand-name">{brand.name}</div>
                  <div>{formatCurrency(brand.revenue)}</div>
                  <div>{(brand.marketShare || 0).toFixed(1)}%</div>
                  <div>{formatNumber(brand.orderCount)}</div>
                  <div className={`growth ${(brand.growth || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(brand.growth || 0) >= 0 ? '+' : ''}{(brand.growth || 0).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent Performance Section (Brand Managers only) */}
      {config.sections.agents && data.agents && config.userRole === 'brandManager' && (
        <div className="report-section">
          <h2 className="section-title">💼 Sales Agent Performance</h2>
          
          <div className="agents-analysis">
            {/* Agent Performance Chart */}
            {config.charts.includeCharts && data.charts?.agentPerformance && (
              <div className="chart-container">
                <h3>Agent Revenue Performance</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.charts.agentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                    <XAxis 
                      dataKey="agentName" 
                      stroke={colors.text}
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke={colors.text}
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.primary}`,
                        borderRadius: '8px',
                        color: colors.text
                      }}
                    />
                    <Bar dataKey="revenue" fill={colors.secondary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Agent Performance Table */}
            <div className="agents-table">
              <h3>Agent Performance Summary</h3>
              <div className="table-header">
                <div>Agent Name</div>
                <div>Revenue</div>
                <div>Orders</div>
                <div>Customers</div>
                <div>Avg Order Value</div>
                <div>Commission</div>
              </div>
              {data.agents.slice(0, 10).map((agent: any, index: number) => (
                <div key={index} className="table-row">
                  <div className="agent-name">{agent.name}</div>
                  <div>{formatCurrency(agent.revenue)}</div>
                  <div>{formatNumber(agent.orderCount)}</div>
                  <div>{formatNumber(agent.customerCount)}</div>
                  <div>{formatCurrency(agent.avgOrderValue)}</div>
                  <div>{formatCurrency(agent.commission)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data Summary Footer */}
      <div className="report-footer">
        <div className="data-summary">
          <h3>Data Summary</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span>Orders Analyzed:</span>
              <span>{formatNumber(metadata.recordCounts.orders)}</span>
            </div>
            <div className="stat-item">
              <span>Invoices Processed:</span>
              <span>{formatNumber(metadata.recordCounts.invoices)}</span>
            </div>
            <div className="stat-item">
              <span>Customers Included:</span>
              <span>{formatNumber(metadata.recordCounts.customers)}</span>
            </div>
            <div className="stat-item">
              <span>Transactions Analyzed:</span>
              <span>{formatNumber(metadata.recordCounts.transactions)}</span>
            </div>
          </div>
        </div>
        <div className="report-disclaimer">
          <p><strong>Note:</strong> This report was generated on {formatDate(metadata.generatedAt)} based on data available at that time. Figures are calculated using the selected date range and filters.</p>
        </div>
      </div>
    </div>
  );
};

export default ReportViewer;