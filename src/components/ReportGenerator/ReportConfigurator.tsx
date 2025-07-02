// src/components/ReportGenerator/ReportConfigurator.tsx
import React, { useState, useEffect } from 'react';
import { ReportConfig } from '../../types/reports';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { auth } from '../../firebase';
import './ReportConfigurator.css';

interface ReportConfiguratorProps {
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
  userRole: 'brandManager' | 'salesAgent';
  onGenerate: () => void;
  loading: boolean;
}

interface FilterOptions {
  brands: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string }>;
}

const ReportConfigurator: React.FC<ReportConfiguratorProps> = ({
  config,
  onChange,
  userRole,
  onGenerate,
  loading
}) => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    brands: [],
    agents: [],
    regions: []
  });
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Custom date range state
  const [customDateRange, setCustomDateRange] = useState({
    start: config.customDateRange?.start ? new Date(config.customDateRange.start) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: config.customDateRange?.end ? new Date(config.customDateRange.end) : new Date()
  });

  // Report type options
  const reportTypes = [
    { value: 'agent_brand', label: 'Sales, Orders, Revenue by Agent / Brand', available: ['brandManager'] },
    { value: 'agent', label: 'Sales, Orders, Revenue by Agent', available: ['brandManager'] },
    { value: 'brand', label: 'Sales, Orders, Revenue by Brand', available: ['brandManager'] },
    { value: 'customer', label: 'Sales, Orders, Revenue by Customer', available: ['brandManager', 'salesAgent'] },
    { value: 'region', label: 'Sales, Orders, Revenue by Region', available: ['brandManager'] },
    { value: 'popular_items_brand', label: 'Popular Items by Brand', available: ['brandManager'] },
    { value: 'popular_items_all', label: 'Popular Items by Item', available: ['brandManager', 'salesAgent'] }
  ];

  // Filter available report types by user role
  const availableReportTypes = reportTypes.filter(type => 
    type.available.includes(userRole)
  );

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      setLoadingOptions(true);
      // Try to load real filter options from API
      const response = await fetch('/api/report-generator/filter-options', {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });
      
      if (response.ok) {
        const { data } = await response.json();
        setFilterOptions(data);
      } else {
        // If API not available, don't provide fallbacks - let user know
        console.error('Filter options API not available');
        setFilterOptions({
          brands: [],
          agents: [],
          regions: []
        });
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
      setFilterOptions({
        brands: [],
        agents: [],
        regions: []
      });
    } finally {
      setLoadingOptions(false);
    }
  };

  const updateConfig = (updates: Partial<ReportConfig>) => {
    onChange({
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    });
  };

  const updateSection = (section: keyof ReportConfig['sections'], enabled: boolean) => {
    updateConfig({
      sections: {
        ...config.sections,
        [section]: enabled
      }
    });
  };

  const updateFilter = (filterType: keyof ReportConfig['filters'], values: string[] | boolean) => {
    updateConfig({
      filters: {
        ...config.filters,
        [filterType]: values
      }
    });
  };

  const updateChartType = (chartType: string, enabled: boolean) => {
    const currentTypes = config.charts.chartTypes || [];
    const newTypes = enabled 
      ? [...currentTypes, chartType].filter((v, i, a) => a.indexOf(v) === i)
      : currentTypes.filter(t => t !== chartType);
    
    updateConfig({
      charts: {
        ...config.charts,
        chartTypes: newTypes as any[]
      }
    });
  };

  // Update custom date range in config when local state changes
  useEffect(() => {
    if (config.dateRange === 'custom') {
      updateConfig({
        customDateRange: {
          start: customDateRange.start.toISOString().split('T')[0],
          end: customDateRange.end.toISOString().split('T')[0]
        }
      });
    }
  }, [customDateRange.start, customDateRange.end, config.dateRange]);

  return (
    <div className="report-configurator">
      {/* Report Type Selection */}
      <div className="config-section">
        <h3 className="section-title">📊 Report Type</h3>
        <div className="config-grid">
          <div className="config-item full-width">
            <label htmlFor="report-type">Select Report Type</label>
            <select
              id="report-type"
              value={config.reportType}
              onChange={(e) => updateConfig({ reportType: e.target.value as any })}
              className="config-select"
            >
              <option value="">Select a report type...</option>
              {availableReportTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="config-section">
        <h3 className="section-title">📋 Report Information</h3>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="report-name">Report Name</label>
            <input
              id="report-name"
              type="text"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="Enter report name..."
              className="config-input"
            />
          </div>
          <div className="config-item full-width">
            <label htmlFor="report-description">Description (Optional)</label>
            <textarea
              id="report-description"
              value={config.description || ''}
              onChange={(e) => updateConfig({ description: e.target.value })}
              placeholder="Describe what this report shows..."
              className="config-textarea"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="config-section">
        <h3 className="section-title">📅 Date Range</h3>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="date-range">Time Period</label>
            <select
              id="date-range"
              value={config.dateRange}
              onChange={(e) => updateConfig({ dateRange: e.target.value as any })}
              className="config-select"
            >
              <option value="today">Today</option>
              <option value="7_days">Last 7 days</option>
              <option value="30_days">Last 30 days</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {config.dateRange === 'custom' && (
            <div className="config-item full-width">
              <div className="custom-date-range">
                <div className="date-input-group">
                  <label>Start Date</label>
                  <DatePicker
                    selected={customDateRange.start}
                    onChange={(date: Date | null) => {
                      if (date) setCustomDateRange(prev => ({ ...prev, start: date }));
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="config-input"
                    placeholderText="Select start date"
                  />
                </div>
                <div className="date-input-group">
                  <label>End Date</label>
                  <DatePicker
                    selected={customDateRange.end}
                    onChange={(date: Date | null) => {
                      if (date) setCustomDateRange(prev => ({ ...prev, end: date }));
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="config-input"
                    placeholderText="Select end date"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="config-section">
        <h3 className="section-title">🔍 Filters</h3>
        <div className="filters-grid">
          {/* Marketplace Orders Filter */}
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.filters.excludeMarketplace || false}
                onChange={(e) => updateFilter('excludeMarketplace', e.target.checked)}
              />
              <span className="checkmark"></span>
              Exclude Marketplace Orders
            </label>
            <small>Excludes Amazon UK and other marketplace orders</small>
          </div>

          {/* Sales Agent Filter - Only for brand managers */}
          {userRole === 'brandManager' && (
            <div className="filter-group">
              <label>Sales Agents</label>
              <div className="multi-select">
                {loadingOptions ? (
                  <div className="loading-text">Loading agents...</div>
                ) : (
                  <select
                    multiple
                    value={config.filters.agents || []}
                    onChange={(e) => updateFilter('agents', Array.from(e.target.selectedOptions, option => option.value))}
                    className="config-select multi"
                  >
                    {filterOptions.agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
                <small>Hold Ctrl/Cmd to select multiple</small>
              </div>
            </div>
          )}

          {/* Brand Filter */}
          <div className="filter-group">
            <label>Brands</label>
            <div className="multi-select">
              {loadingOptions ? (
                <div className="loading-text">Loading brands...</div>
              ) : (
                <select
                  multiple
                  value={config.filters.brands || []}
                  onChange={(e) => updateFilter('brands', Array.from(e.target.selectedOptions, option => option.value))}
                  className="config-select multi"
                >
                  {filterOptions.brands.map(brand => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              )}
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Invoice Status Filter */}
          <div className="filter-group">
            <label>Invoice Status</label>
            <div className="multi-select">
              <select
                multiple
                value={config.filters.invoiceStatus || []}
                onChange={(e) => updateFilter('invoiceStatus', Array.from(e.target.selectedOptions, option => option.value))}
                className="config-select multi"
              >
                <option value="paid">Paid</option>
                <option value="outstanding">Outstanding</option>
                <option value="overdue">Overdue</option>
                <option value="draft">Draft</option>
              </select>
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Customer Segments Filter */}
          <div className="filter-group">
            <label>Customer Segments</label>
            <div className="multi-select">
              <select
                multiple
                value={config.filters.customerSegments || []}
                onChange={(e) => updateFilter('customerSegments', Array.from(e.target.selectedOptions, option => option.value))}
                className="config-select multi"
              >
                <option value="VIP">VIP Customers</option>
                <option value="High">High Value</option>
                <option value="Medium">Medium Value</option>
                <option value="Low">Low Value</option>
                <option value="New">New Customers</option>
              </select>
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Shipping Status Filter */}
          <div className="filter-group">
            <label>Shipping Status</label>
            <div className="multi-select">
              <select
                multiple
                value={config.filters.shippingStatus || []}
                onChange={(e) => updateFilter('shippingStatus', Array.from(e.target.selectedOptions, option => option.value))}
                className="config-select multi"
              >
                <option value="pending">Pending</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
          </div>

          {/* Region Filter - Only for brand managers */}
          {userRole === 'brandManager' && (
            <div className="filter-group">
              <label>Regions</label>
              <div className="multi-select">
                {loadingOptions ? (
                  <div className="loading-text">Loading regions...</div>
                ) : (
                  <select
                    multiple
                    value={config.filters.regions || []}
                    onChange={(e) => updateFilter('regions', Array.from(e.target.selectedOptions, option => option.value))}
                    className="config-select multi"
                  >
                    {filterOptions.regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                )}
                <small>Hold Ctrl/Cmd to select multiple</small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Configuration */}
      <div className="config-section">
        <h3 className="section-title">📈 Charts & Visualizations</h3>
        <div className="charts-config">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={config.charts.includeCharts}
              onChange={(e) => updateConfig({
                charts: { ...config.charts, includeCharts: e.target.checked }
              })}
            />
            <span className="checkmark"></span>
            <div className="checkbox-content">
              <strong>Include Charts in Report</strong>
              <span>Add visual charts and graphs</span>
            </div>
          </label>

          {config.charts.includeCharts && (
            <div className="chart-types">
              <h4>Chart Types to Include:</h4>
              <div className="checkbox-grid">
                <label className="checkbox-item small">
                  <input
                    type="checkbox"
                    checked={config.charts.chartTypes?.includes('revenue') || false}
                    onChange={(e) => updateChartType('revenue', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span>Revenue Trends</span>
                </label>

                <label className="checkbox-item small">
                  <input
                    type="checkbox"
                    checked={config.charts.chartTypes?.includes('orders') || false}
                    onChange={(e) => updateChartType('orders', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span>Order Volume</span>
                </label>

                <label className="checkbox-item small">
                  <input
                    type="checkbox"
                    checked={config.charts.chartTypes?.includes('customers') || false}
                    onChange={(e) => updateChartType('customers', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span>Customer Metrics</span>
                </label>

                <label className="checkbox-item small">
                  <input
                    type="checkbox"
                    checked={config.charts.chartTypes?.includes('trends') || false}
                    onChange={(e) => updateChartType('trends', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span>Performance Trends</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Settings */}
      <div className="config-section">
        <h3 className="section-title">🎨 Export Settings</h3>
        <div className="export-settings">
          <div className="theme-selector">
            <label>PDF Theme</label>
            <div className="theme-options">
              <label className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value="dashboard"
                  checked={config.exportTheme === 'dashboard'}
                  onChange={(e) => updateConfig({ exportTheme: 'dashboard' })}
                />
                <div className="theme-preview dashboard-theme">
                  <div className="theme-header">Dashboard Theme</div>
                  <div className="theme-content">
                    <div className="theme-bar dark"></div>
                    <div className="theme-bar dark"></div>
                    <div className="theme-bar dark short"></div>
                  </div>
                </div>
                <span>Dark theme matching your dashboard</span>
              </label>

              <label className="theme-option">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={config.exportTheme === 'light'}
                  onChange={(e) => updateConfig({ exportTheme: 'light' })}
                />
                <div className="theme-preview light-theme">
                  <div className="theme-header">Light Theme</div>
                  <div className="theme-content">
                    <div className="theme-bar light"></div>
                    <div className="theme-bar light"></div>
                    <div className="theme-bar light short"></div>
                  </div>
                </div>
                <span>Clean light theme for printing</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="config-section">
        <div className="generate-section">
          <button
            onClick={onGenerate}
            disabled={loading || !config.name.trim() || !config.reportType}
            className="generate-report-button"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Generating Report...
              </>
            ) : (
              <>
                📊 Generate Report
              </>
            )}
          </button>
          {!config.name.trim() && (
            <small className="validation-message">Please enter a report name</small>
          )}
          {!config.reportType && (
            <small className="validation-message">Please select a report type</small>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportConfigurator;