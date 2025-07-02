// src/components/ReportGenerator/ReportGenerator.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { ReportConfig, ReportData, SavedReport } from '../../types/reports';
import ReportConfigurator from './ReportConfigurator';
import ReportViewer from './ReportViewer';
import ReportExporter from './ReportExporter';
import './ReportGenerator.css';

interface ReportGeneratorProps {
  userId?: string;
  userRole?: 'brandManager' | 'salesAgent';
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ userId, userRole }) => {
  const location = useLocation();
  const [currentConfig, setCurrentConfig] = useState<ReportConfig | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'configure' | 'view' | 'saved'>('configure');

  const currentUserId = userId || auth.currentUser?.uid;
  const currentUserRole = userRole || 'salesAgent';
  
  useEffect(() => {
    if (location.pathname.includes('/saved')) {
      setActiveTab('saved');
    } else if (location.pathname.includes('/templates')) {
      setActiveTab('saved');
    } else {
      setActiveTab('configure');
    }
  }, [location.pathname]);

  // Initialize default config
  useEffect(() => {
    if (currentUserId) {
      const defaultConfig: ReportConfig = {
        id: `temp-${Date.now()}`,
        name: '',
        reportType: 'customer', // Default to customer report
        dateRange: '30_days',
        sections: {
          overview: true,
          sales: true,
          orders: true,
          customers: false,
          invoices: false,
          brands: currentUserRole === 'brandManager',
          agents: currentUserRole === 'brandManager',
        },
        filters: {
          excludeMarketplace: false
        },
        exportTheme: 'dashboard',
        charts: {
          includeCharts: true,
          chartTypes: ['revenue', 'orders'],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUserId,
        userRole: currentUserRole,
      };
      setCurrentConfig(defaultConfig);
      loadSavedReports();
    }
  }, [currentUserId, currentUserRole]);

  const loadSavedReports = async () => {
    try {
      const response = await fetch(`/api/report-generator/saved?userId=${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` }
      });
      
      if (response.ok) {
        const { data } = await response.json();
        setSavedReports(data);
      } else {
        console.warn('Saved reports API not available');
        setSavedReports([]);
      }
    } catch (error) {
      console.error('Error loading saved reports:', error);
      setSavedReports([]);
    }
  };

  const generateReport = async (config: ReportConfig) => {
    if (!config || !config.reportType) {
      setError('Please select a report type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/report-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          config,
          userId: currentUserId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setReportData(result.data);
        setActiveTab('view');
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async (config: ReportConfig) => {
    if (!config.reportType) {
      setError('Please select a report type before saving');
      return;
    }

    try {
      const response = await fetch('/api/report-generator/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          config: {
            ...config,
            updatedAt: new Date().toISOString()
          }
        })
      });

      if (response.ok) {
        const { data } = await response.json();
        setSavedReports(prev => {
          const existing = prev.find(r => r.id === data.id);
          if (existing) {
            return prev.map(r => r.id === data.id ? data : r);
          }
          return [...prev, data];
        });
        return data;
      } else {
        throw new Error('Failed to save report configuration');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  };

  const loadReport = (savedReport: SavedReport) => {
    setCurrentConfig(savedReport.config);
    setActiveTab('configure');
  };

  if (!currentUserId) {
    return (
      <div className="report-generator-container">
        <div className="error-message">
          Please log in to access the report generator.
        </div>
      </div>
    );
  }

  return (
    <div className="report-generator-container">
      {/* Header */}
      <div className="report-header">
        <div className="report-title-section">
          <h1>Report Generator</h1>
          <p>Create custom business reports and export to PDF</p>
        </div>
        
        <div className="report-actions">
          {currentConfig && (
            <>
              <button 
                className="generate-button"
                onClick={() => generateReport(currentConfig)}
                disabled={loading || !currentConfig.name.trim() || !currentConfig.reportType}
              >
                {loading ? '⏳ Generating...' : '📊 Generate Report'}
              </button>
              
              <button 
                className="save-button"
                onClick={() => saveReport(currentConfig)}
                disabled={!currentConfig.reportType}
              >
                💾 Save Configuration
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          className={`tab-button ${activeTab === 'configure' ? 'active' : ''}`}
          onClick={() => setActiveTab('configure')}
        >
          ⚙️ Configure
        </button>
        <button
          className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
          disabled={!reportData}
        >
          📋 View Report
        </button>
        <button
          className={`tab-button ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved')}
        >
          💾 Saved Reports ({savedReports.length})
        </button>
      </div>

      {/* Content */}
      <div className="report-content">
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {activeTab === 'configure' && currentConfig && (
          <ReportConfigurator
            config={currentConfig}
            onChange={setCurrentConfig}
            userRole={currentUserRole}
            onGenerate={() => generateReport(currentConfig)}
            loading={loading}
          />
        )}

        {activeTab === 'view' && reportData && (
          <div className="report-view-container">
            <ReportViewer 
              reportData={reportData}
              theme={currentConfig?.exportTheme || 'dashboard'}
            />
            <ReportExporter 
              reportData={reportData}
              config={currentConfig}
            />
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="saved-reports-container">
            <h3>Saved Report Configurations</h3>
            {savedReports.length === 0 ? (
              <div className="empty-state">
                <p>No saved reports yet. Create and save a report configuration to see it here.</p>
              </div>
            ) : (
              <div className="saved-reports-grid">
                {savedReports.map(report => (
                  <div key={report.id} className="saved-report-card">
                    <h4>{report.config.name}</h4>
                    <p>{report.config.description || 'No description'}</p>
                    <div className="report-meta">
                      <span>📊 {report.config.reportType}</span>
                      <span>📅 {report.config.dateRange}</span>
                      <span>🎨 {report.config.exportTheme}</span>
                    </div>
                    <div className="report-actions">
                      <button 
                        onClick={() => loadReport(report)}
                        className="load-button"
                      >
                        📋 Load
                      </button>
                      <button 
                        onClick={() => generateReport(report.config)}
                        className="generate-button"
                        disabled={loading}
                      >
                        🚀 Generate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;