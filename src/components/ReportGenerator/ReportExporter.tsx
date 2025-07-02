// src/components/ReportGenerator/ReportExporter.tsx
import React, { useState, useRef } from 'react';
import { ReportData, ReportConfig } from '../../types/reports';
import ReportViewer from './ReportViewer';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './ReportExporter.css';

interface ReportExporterProps {
  reportData: ReportData;
  config: ReportConfig | null;
}

interface ExportOptions {
  format: 'pdf' | 'print';
  theme: 'dashboard' | 'light';
  includeCharts: boolean;
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  quality: 'standard' | 'high';
}

const ReportExporter: React.FC<ReportExporterProps> = ({ reportData, config }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    theme: config?.exportTheme || 'dashboard',
    includeCharts: true,
    pageSize: 'a4',
    orientation: 'portrait',
    quality: 'standard'
  });
  
  const printRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const updateExportOption = <K extends keyof ExportOptions>(
    key: K, 
    value: ExportOptions[K]
  ) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  };

  const generateFileName = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportName = config?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'report';
    return `${reportName}_${timestamp}`;
  };

  const exportToPDF = async () => {
    if (!exportRef.current || !config) return;

    setIsExporting(true);
    setExportProgress(10);

    try {
      // Show progress
      setExportProgress(20);

      // Configure PDF options
      const pageSize = exportOptions.pageSize === 'a4' ? [210, 297] : [216, 279]; // mm
      const isLandscape = exportOptions.orientation === 'landscape';
      
      const pdf = new jsPDF({
        orientation: exportOptions.orientation,
        unit: 'mm',
        format: exportOptions.pageSize,
        compress: true
      });

      setExportProgress(30);

      // Configure html2canvas options
      const canvasOptions = {
        scale: exportOptions.quality === 'high' ? 2 : 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: exportOptions.theme === 'light' ? '#ffffff' : '#1a202c',
        width: exportRef.current.scrollWidth,
        height: exportRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: exportRef.current.scrollWidth,
        windowHeight: exportRef.current.scrollHeight
      };

      setExportProgress(40);

      // Capture the report content
      const canvas = await html2canvas(exportRef.current, canvasOptions);
      const imgData = canvas.toDataURL('image/png', 0.9);

      setExportProgress(60);

      // Calculate dimensions
      const pageWidth = isLandscape ? pageSize[1] : pageSize[0];
      const pageHeight = isLandscape ? pageSize[0] : pageSize[1];
      const margins = 10; // mm
      const contentWidth = pageWidth - (margins * 2);
      const contentHeight = pageHeight - (margins * 2);

      // Calculate image dimensions
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      setExportProgress(80);

      // Add image to PDF
      const x = (pageWidth - scaledWidth) / 2;
      const y = margins;

      // If content is taller than one page, we need to split it
      if (scaledHeight > contentHeight) {
        let currentY = 0;
        let pageCount = 0;
        const pageImageHeight = contentHeight / ratio;

        while (currentY < imgHeight) {
          if (pageCount > 0) {
            pdf.addPage();
          }

          const sourceY = currentY;
          const sourceHeight = Math.min(pageImageHeight, imgHeight - currentY);
          const destHeight = sourceHeight * ratio;

          // Create a canvas for this page section
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sourceHeight;

          if (pageCtx) {
            pageCtx.drawImage(
              canvas, 
              0, sourceY, imgWidth, sourceHeight,
              0, 0, imgWidth, sourceHeight
            );
            
            const pageImgData = pageCanvas.toDataURL('image/png', 0.9);
            pdf.addImage(pageImgData, 'PNG', x, y, scaledWidth, destHeight);
          }

          currentY += pageImageHeight;
          pageCount++;
        }
      } else {
        // Single page
        pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
      }

      setExportProgress(90);

      // Add metadata
      pdf.setProperties({
        title: config.name,
        subject: 'Business Report',
        author: 'Splitfin Report Generator',
        creator: 'Splitfin',
        keywords: 'business, report, analytics'
      });

      setExportProgress(95);

      // Download the PDF
      const fileName = generateFileName();
      pdf.save(`${fileName}.pdf`);

      setExportProgress(100);
      
      // Success feedback
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);

    } catch (error) {
      console.error('PDF export error:', error);
      setIsExporting(false);
      setExportProgress(0);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const printReport = () => {
    if (!printRef.current) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get the report HTML
    const reportHTML = printRef.current.innerHTML;
    
    // Create print styles
    const printStyles = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: white;
          padding: 20mm;
        }
        
        .report-viewer {
          background: white !important;
          color: #1f2937 !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        
        .report-section {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          page-break-inside: avoid;
          margin-bottom: 2rem;
        }
        
        .section-title {
          color: #1f2937 !important;
          border-bottom-color: #d1d5db !important;
        }
        
        .metric-card,
        .summary-card,
        .breakdown-item,
        .performance-metrics,
        .aging-bucket,
        .segment-card,
        .stat-item,
        .kpi-item {
          background: white !important;
          border-color: #e5e7eb !important;
          box-shadow: none !important;
        }
        
        .table-header {
          background: #f3f4f6 !important;
        }
        
        .table-row {
          border-bottom-color: #e5e7eb !important;
        }
        
        .metric-value,
        .kpi-value,
        .breakdown-value,
        .card-value,
        .bucket-amount,
        .segment-count,
        .performance-item span:last-child {
          color: #1f2937 !important;
        }
        
        .chart-container {
          page-break-inside: avoid;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #1f2937 !important;
          page-break-after: avoid;
        }
        
        @page {
          margin: 20mm;
          size: ${exportOptions.pageSize} ${exportOptions.orientation};
        }
        
        @media print {
          .no-print {
            display: none !important;
          }
        }
      </style>
    `;

    // Write the print document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config?.name || 'Business Report'}</title>
          ${printStyles}
        </head>
        <body>
          ${reportHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  const exportToCSV = () => {
    if (!reportData || !config) return;

    const csvData: string[] = [];
    
    // Add header
    csvData.push(`Report: ${config.name}`);
    csvData.push(`Generated: ${new Date(reportData.metadata.generatedAt).toLocaleDateString()}`);
    csvData.push(`Period: ${reportData.metadata.dataRange.start} to ${reportData.metadata.dataRange.end}`);
    csvData.push(''); // Empty line

    // Add overview data if available
    if (config.sections.overview && reportData.data.overview) {
      csvData.push('OVERVIEW');
      csvData.push('Metric,Value');
      csvData.push(`Total Revenue,${reportData.data.overview.totalRevenue || 0}`);
      csvData.push(`Total Orders,${reportData.data.overview.totalOrders || 0}`);
      csvData.push(`Total Customers,${reportData.data.overview.totalCustomers || 0}`);
      csvData.push(`Average Order Value,${reportData.data.overview.averageOrderValue || 0}`);
      csvData.push(''); // Empty line
    }

    // Add orders data if available
    if (config.sections.orders && reportData.data.orders?.topProducts) {
      csvData.push('TOP PRODUCTS');
      csvData.push('Product Name,Quantity Sold,Revenue,Percentage');
      reportData.data.orders.topProducts.forEach((product: any) => {
        csvData.push(`"${product.name}",${product.quantity},${product.revenue},${product.percentage}`);
      });
      csvData.push(''); // Empty line
    }

    // Add customers data if available
    if (config.sections.customers && reportData.data.customers?.topCustomers) {
      csvData.push('TOP CUSTOMERS');
      csvData.push('Customer Name,Total Spent,Order Count,Avg Order Value,Last Order');
      reportData.data.customers.topCustomers.forEach((customer: any) => {
        csvData.push(`"${customer.name}",${customer.totalSpent},${customer.orderCount},${customer.avgOrderValue},"${customer.lastOrder || 'N/A'}"`);
      });
      csvData.push(''); // Empty line
    }

    // Create and download CSV
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${generateFileName()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!reportData || !config) {
    return (
      <div className="report-exporter">
        <div className="export-placeholder">
          <p>Generate a report to see export options</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-exporter">
      {/* Export Options Panel */}
      <div className="export-options-panel">
        <h3>📄 Export Options</h3>
        
        <div className="export-options-grid">
          {/* Format Selection */}
          <div className="option-group">
            <label>Export Format</label>
            <div className="format-buttons">
              <button
                className={`format-button ${exportOptions.format === 'pdf' ? 'active' : ''}`}
                onClick={() => updateExportOption('format', 'pdf')}
              >
                📄 PDF
              </button>
              <button
                className={`format-button ${exportOptions.format === 'print' ? 'active' : ''}`}
                onClick={() => updateExportOption('format', 'print')}
              >
                🖨️ Print
              </button>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="option-group">
            <label>Theme</label>
            <div className="theme-buttons">
              <button
                className={`theme-button ${exportOptions.theme === 'dashboard' ? 'active' : ''}`}
                onClick={() => updateExportOption('theme', 'dashboard')}
              >
                🌙 Dashboard
              </button>
              <button
                className={`theme-button ${exportOptions.theme === 'light' ? 'active' : ''}`}
                onClick={() => updateExportOption('theme', 'light')}
              >
                ☀️ Light
              </button>
            </div>
          </div>

          {/* Page Settings */}
          <div className="option-group">
            <label>Page Size</label>
            <select
              value={exportOptions.pageSize}
              onChange={(e) => updateExportOption('pageSize', e.target.value as 'a4' | 'letter')}
              className="option-select"
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </div>

          <div className="option-group">
            <label>Orientation</label>
            <select
              value={exportOptions.orientation}
              onChange={(e) => updateExportOption('orientation', e.target.value as 'portrait' | 'landscape')}
              className="option-select"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          {/* Quality Settings */}
          <div className="option-group">
            <label>Quality</label>
            <select
              value={exportOptions.quality}
              onChange={(e) => updateExportOption('quality', e.target.value as 'standard' | 'high')}
              className="option-select"
            >
              <option value="standard">Standard</option>
              <option value="high">High Quality</option>
            </select>
          </div>

          {/* Include Charts */}
          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={exportOptions.includeCharts}
                onChange={(e) => updateExportOption('includeCharts', e.target.checked)}
              />
              <span className="checkmark"></span>
              Include Charts
            </label>
          </div>
        </div>

        {/* Export Actions */}
        <div className="export-actions">
          <button
            onClick={exportToPDF}
            disabled={isExporting}
            className="export-button pdf-button"
          >
            {isExporting ? (
              <>
                <span className="loading-spinner"></span>
                Generating PDF... {exportProgress}%
              </>
            ) : (
              <>
                📄 Export PDF
              </>
            )}
          </button>

          <button
            onClick={printReport}
            disabled={isExporting}
            className="export-button print-button"
          >
            🖨️ Print Report
          </button>

          <button
            onClick={exportToCSV}
            disabled={isExporting}
            className="export-button csv-button"
          >
            📊 Export CSV Data
          </button>
        </div>

        {/* Export Progress */}
        {isExporting && (
          <div className="export-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${exportProgress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {exportProgress < 30 && "Preparing export..."}
              {exportProgress >= 30 && exportProgress < 60 && "Capturing report content..."}
              {exportProgress >= 60 && exportProgress < 90 && "Generating PDF..."}
              {exportProgress >= 90 && "Finalizing..."}
            </div>
          </div>
        )}
      </div>

      {/* Hidden Export Preview */}
      <div 
        ref={exportRef} 
        className="export-preview"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '1200px',
          background: exportOptions.theme === 'light' ? '#ffffff' : '#1a202c'
        }}
      >
        <ReportViewer 
          reportData={reportData} 
          theme={exportOptions.theme}
        />
      </div>

      {/* Print Preview (Hidden) */}
      <div ref={printRef} style={{ display: 'none' }}>
        <ReportViewer 
          reportData={reportData} 
          theme="light" // Always use light theme for printing
        />
      </div>

      {/* Preview Section */}
      <div className="export-preview-section">
        <h3>📋 Export Preview</h3>
        <div className="preview-container">
          <div className="preview-header">
            <span>Theme: {exportOptions.theme === 'dashboard' ? '🌙 Dashboard' : '☀️ Light'}</span>
            <span>Size: {exportOptions.pageSize.toUpperCase()}</span>
            <span>Orientation: {exportOptions.orientation}</span>
          </div>
          <div className="preview-content">
            <ReportViewer 
              reportData={reportData} 
              theme={exportOptions.theme}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportExporter;