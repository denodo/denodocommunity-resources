/**
 * Professional PDF Export Service
 * Generates clean, professional PDF reports with tabular data
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFExportOptions {
  includeSummary: boolean;
  includeVDBBreakdown: boolean;
  vdbColumns: string[];
  includeViewComplexity: boolean;
  viewComplexityTop: number;
  includeServerConfig: boolean;
}

interface AnalysisData {
  databases: any[];
  dataSources: any[];
  views: any[];
  globalElements: any[];
  serverConfiguration: any;
  denodoVersion?: string;
  fileName?: string;
  additionalCounts?: {
    cacheEnabled: number;
    associations: number;
    statsEnabled: number;
    resourcePlans: number;
    resourceRules: number;
  };
  duplicateRows?: any[];
  complexityData?: any[]; // Python complexity results
}

export class PDFExportService {
  private pdf: jsPDF;
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private readonly margin: number = 20;
  private yPosition: number = 20;

  // Professional color palette
  private readonly colors = {
    primary: [37, 99, 235], // Blue
    secondary: [100, 116, 139], // Slate
    success: [34, 197, 94], // Green
    warning: [234, 179, 8], // Yellow
    danger: [239, 68, 68], // Red
    tableHeader: [241, 245, 249], // Light gray
    tableAlt: [248, 250, 252], // Very light gray
    text: [15, 23, 42], // Dark slate
    textLight: [100, 116, 139], // Light slate
  };

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
  }

  async generateReport(data: AnalysisData, options: PDFExportOptions): Promise<void> {
    // Title Page
    this.addTitlePage(data);

    // Summary Section
    if (options.includeSummary) {
      this.addNewPage();
      this.addSummarySection(data);
    }

    // VDB Breakdown
    if (options.includeVDBBreakdown) {
      this.addNewPage();
      this.addVDBBreakdown(data, options.vdbColumns);
    }

    // View Complexity
    if (options.includeViewComplexity) {
      this.addNewPage();
      this.addViewComplexity(data, options.viewComplexityTop);
    }

    // Server Configuration
    if (options.includeServerConfig) {
      this.addNewPage();
      this.addServerConfiguration(data);
    }

    // Footer on all pages
    this.addPageNumbers();

    // Download
    const fileName = `Denodo_Analysis_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    this.pdf.save(fileName);
  }

  private addTitlePage(data: AnalysisData): void {
    // Logo area / Header
    this.pdf.setFillColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
    this.pdf.rect(0, 0, this.pageWidth, 60, 'F');

    // Title
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(28);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Denodo Platform', this.pageWidth / 2, 30, { align: 'center' });

    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Metadata Analysis Report', this.pageWidth / 2, 45, { align: 'center' });

    // Metadata box
    this.yPosition = 80;
    this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');

    const metadata = [
      ['Generated Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Generated Time', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })],
      ['Denodo Version', data.denodoVersion || 'N/A'],
      ['Source File', data.fileName || 'N/A'],
      ['Total Databases', data.databases?.length?.toString() || '0'],
      ['Total Views', data.views?.length?.toString() || '0'],
      ['Total Data Sources', data.dataSources?.length?.toString() || '0'],
    ];

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [],
      body: metadata,
      theme: 'plain',
      styles: {
        fontSize: 11,
        cellPadding: 5,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    // Executive Summary Box
    this.yPosition = (this.pdf as any).lastAutoTable.finalY + 20;

    this.pdf.setFillColor(this.colors.tableHeader[0], this.colors.tableHeader[1], this.colors.tableHeader[2]);
    this.pdf.roundedRect(this.margin, this.yPosition, this.pageWidth - 2 * this.margin, 50, 3, 3, 'F');

    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
    this.pdf.text('Executive Summary', this.margin + 10, this.yPosition + 10);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    const summary = `This report provides a comprehensive analysis of the Denodo virtual data platform, including database structures, view complexity metrics, data source configurations, and server settings. The analysis covers ${data.databases?.length || 0} databases with ${data.views?.length || 0} views and ${data.dataSources?.length || 0} data sources.`;

    const lines = this.pdf.splitTextToSize(summary, this.pageWidth - 2 * this.margin - 20);
    this.pdf.text(lines, this.margin + 10, this.yPosition + 20);
  }

  private addSummarySection(data: AnalysisData): void {
    this.addSectionHeader('Summary Statistics', 1);

    // Count global elements by type (types are lowercase in the database)
    const globalElementCounts: { [key: string]: number } = {};
    data.globalElements?.forEach(el => {
      const type = (el.type || 'unknown').toLowerCase();
      globalElementCounts[type] = (globalElementCounts[type] || 0) + 1;
    });

    // Use additional counts from separate tables if available
    const cacheEnabledCount = data.additionalCounts?.cacheEnabled || 0;
    const statsEnabledCount = data.additionalCounts?.statsEnabled || 0;
    const associationCount = data.additionalCounts?.associations || 0;
    const resourcePlansCount = data.additionalCounts?.resourcePlans || 0;
    const resourceRulesCount = data.additionalCounts?.resourceRules || 0;

    // Overall counts
    const summaryData = [
      ['Total Databases', data.databases?.length?.toString() || '0'],
      ['Total Views', data.views?.length?.toString() || '0'],
      ['Total Data Sources', data.dataSources?.length?.toString() || '0'],
      ['Users', (globalElementCounts['user'] || 0).toString()],
      ['Roles', (globalElementCounts['role'] || 0).toString()],
      ['JARs', (globalElementCounts['jar'] || 0).toString()],
      ['Tags', (globalElementCounts['tag'] || 0).toString()],
      ['Resource Manager Rules', resourceRulesCount.toString()],
      ['Resource Manager Plans', resourcePlansCount.toString()],
      ['Maps', (globalElementCounts['map'] || 0).toString()],
      ['Associations', associationCount.toString()],
      ['Stats Enabled Views', statsEnabledCount.toString()],
      ['Cache Enabled Views', cacheEnabledCount.toString()],
    ];

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [['Metric', 'Count']],
      body: summaryData,
      theme: 'grid',
      headStyles: {
        fillColor: this.colors.primary as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11
      },
      styles: {
        fontSize: 10,
        cellPadding: 6,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 'auto' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;

    // Data Source Type Distribution
    this.addSubsectionHeader('Data Source Type Distribution');

    const dsTypes: { [key: string]: number } = {};
    const totalDataSources = data.dataSources?.length || 0;

    // Count types efficiently
    data.dataSources?.forEach(ds => {
      const type = ds.type || 'Unknown';
      dsTypes[type] = (dsTypes[type] || 0) + 1;
    });

    const dsData = Object.entries(dsTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Limit to top 20 types
      .map(([type, count]) => [type, count.toString(), `${((count / (totalDataSources || 1)) * 100).toFixed(1)}%`]);

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [['Type', 'Count', 'Percentage']],
      body: dsData,
      theme: 'striped',
      headStyles: {
        fillColor: this.colors.tableHeader as [number, number, number],
        textColor: this.colors.text as [number, number, number],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;

    // JDBC Vendor Breakdown
    this.addSubsectionHeader('JDBC Vendor Breakdown');

    const jdbcDataSources = data.dataSources?.filter(ds => ds.type === 'JDBC') || [];
    const jdbcVendorCounts: { [key: string]: number } = {};

    jdbcDataSources.forEach(ds => {
      const vendor = ds.databaseName || 'Unknown';
      jdbcVendorCounts[vendor] = (jdbcVendorCounts[vendor] || 0) + 1;
    });

    const jdbcData = Object.entries(jdbcVendorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([vendor, count]) => [vendor, count.toString(), `${((count / (jdbcDataSources.length || 1)) * 100).toFixed(1)}%`]);

    if (jdbcData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [['Vendor', 'Count', 'Percentage']],
        body: jdbcData,
        theme: 'striped',
        headStyles: {
          fillColor: this.colors.tableHeader as [number, number, number],
          textColor: this.colors.text as [number, number, number],
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        margin: { left: this.margin, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No JDBC data sources found.', this.margin, this.yPosition);
      this.yPosition += 10;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // Custom Wrapper Breakdown
    this.addSubsectionHeader('Custom Wrapper Breakdown');

    const customDataSources = data.dataSources?.filter(ds => ds.type === 'Custom' || ds.type === 'CUSTOM') || [];
    const customClassCounts: { [key: string]: number } = {};

    customDataSources.forEach(ds => {
      let classKey = 'Generic Custom';

      if (ds.className) {
        // Extract just the class name (last part after the dot)
        classKey = ds.className.split('.').pop() || ds.className;
      }

      customClassCounts[classKey] = (customClassCounts[classKey] || 0) + 1;
    });

    const customData = Object.entries(customClassCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([className, count]) => [className, count.toString(), `${((count / (customDataSources.length || 1)) * 100).toFixed(1)}%`]);

    if (customData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [['Class Name', 'Count', 'Percentage']],
        body: customData,
        theme: 'striped',
        headStyles: {
          fillColor: this.colors.tableHeader as [number, number, number],
          textColor: this.colors.text as [number, number, number],
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        margin: { left: this.margin, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No custom data sources found.', this.margin, this.yPosition);
      this.yPosition += 10;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // Delimited File Breakdown
    this.addSubsectionHeader('Delimited File Breakdown');

    const delimitedDataSources = data.dataSources?.filter(ds => ds.type === 'DelimitedFile') || [];
    const delimitedRouteCounts: { [key: string]: number } = {};

    delimitedDataSources.forEach(ds => {
      let routeKey = 'Local Files';

      if (ds.routeType) {
        const routeType = ds.routeType.toUpperCase();
        switch (routeType) {
          case 'LOCAL':
            routeKey = 'Local Files';
            break;
          case 'FTP':
          case 'FTPS':
            routeKey = 'FTP/FTPS';
            break;
          case 'SFTP':
            routeKey = 'SFTP';
            break;
          case 'HTTP':
          case 'HTTPS':
            routeKey = 'HTTP/HTTPS';
            break;
          case 'S3':
            routeKey = 'Amazon S3';
            break;
          default:
            routeKey = routeType;
        }
      }

      delimitedRouteCounts[routeKey] = (delimitedRouteCounts[routeKey] || 0) + 1;
    });

    const delimitedData = Object.entries(delimitedRouteCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([routeType, count]) => [routeType, count.toString(), `${((count / (delimitedDataSources.length || 1)) * 100).toFixed(1)}%`]);

    if (delimitedData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [['Route Type', 'Count', 'Percentage']],
        body: delimitedData,
        theme: 'striped',
        headStyles: {
          fillColor: this.colors.tableHeader as [number, number, number],
          textColor: this.colors.text as [number, number, number],
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        margin: { left: this.margin, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No delimited file data sources found.', this.margin, this.yPosition);
      this.yPosition += 10;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // LDAP Breakdown
    this.addSubsectionHeader('LDAP Breakdown');

    const ldapDataSources = data.dataSources?.filter(ds => ds.type === 'LDAP') || [];

    if (ldapDataSources.length > 0) {
      const ldapData = ldapDataSources.map(ds => [
        ds.name || 'N/A',
        ds.database || 'N/A'
      ]);

      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [['DataSource Name', 'Database']],
        body: ldapData,
        theme: 'striped',
        headStyles: {
          fillColor: this.colors.tableHeader as [number, number, number],
          textColor: this.colors.text as [number, number, number],
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
        },
        margin: { left: this.margin, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No LDAP data sources found.', this.margin, this.yPosition);
      this.yPosition += 10;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // View Type Distribution
    this.addSubsectionHeader('View Type Distribution');

    // Count by kind (table=base, view=derived, interface view=interface)
    const baseViewCount = data.views?.filter(v => v.kind === 'table').length || 0;
    const derivedViewCount = data.views?.filter(v => v.kind === 'view').length || 0;
    const interfaceViewCount = data.views?.filter(v => v.kind === 'interface view').length || 0;
    const totalViews = data.views?.length || 1;

    const viewData = [
      ['Base Views', baseViewCount.toString(), `${((baseViewCount / totalViews) * 100).toFixed(1)}%`],
      ['Derived Views', derivedViewCount.toString(), `${((derivedViewCount / totalViews) * 100).toFixed(1)}%`],
      ['Interface Views', interfaceViewCount.toString(), `${((interfaceViewCount / totalViews) * 100).toFixed(1)}%`],
    ].filter(row => parseInt(row[1]) > 0);

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [['Type', 'Count', 'Percentage']],
      body: viewData,
      theme: 'striped',
      headStyles: {
        fillColor: this.colors.tableHeader as [number, number, number],
        textColor: this.colors.text as [number, number, number],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    this.yPosition = (this.pdf as any).lastAutoTable.finalY + 15;

    // JDBC Duplicates Analysis - Use pre-computed duplicates from DuckDB
    this.addSubsectionHeader('JDBC Duplicate Data Sources');

    // Query the duplicates table directly (same as duplicates page does)
    const duplicateRows = data.duplicateRows || [];

    // Transform to format expected by PDF rendering
    const duplicates = duplicateRows.map((dup: any) => {
      const sources = typeof dup.sources === 'string' ? JSON.parse(dup.sources) : (dup.sources || []);
      return {
        normalizedUri: dup.connectionString,
        originalUri: dup.connectionString,
        count: dup.count,
        dataSources: sources.map((s: any) => ({
          database: s.databaseName || s.database || 'Unknown',
          name: s.dataSourceName || s.name || 'Unknown',
          username: s.username
        }))
      };
    }).sort((a: any, b: any) => b.count - a.count);

    if (duplicates.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No duplicate JDBC data sources found.', this.margin, this.yPosition);
      this.yPosition += 10;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    } else {
      // Limit to top 10 duplicate groups to prevent memory issues
      const limitedDuplicates = duplicates.slice(0, 10);

      limitedDuplicates.forEach((duplicate, index) => {
        // Check if we need a new page
        if (this.yPosition > this.pageHeight - 80) {
          this.addNewPage();
        }

        // Show the JDBC URL
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
        this.pdf.text(`${index + 1}. Connection URL (${duplicate.dataSources.length} duplicates):`, this.margin, this.yPosition);
        this.yPosition += 6;

        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setFontSize(9);
        this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);

        // Wrap long URLs
        const urlLines = this.pdf.splitTextToSize(duplicate.originalUri, this.pageWidth - 2 * this.margin - 10);
        this.pdf.text(urlLines, this.margin + 5, this.yPosition);
        this.yPosition += urlLines.length * 5 + 3;

        // Create table with duplicate data sources
        const tableData = duplicate.dataSources.map((ds: any) => [
          ds.database || 'N/A',
          ds.name || 'N/A',
          ds.username || 'N/A'
        ]);

        autoTable(this.pdf, {
          startY: this.yPosition,
          head: [['Database', 'Data Source Name', 'Username']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: this.colors.tableHeader as [number, number, number],
            textColor: this.colors.text as [number, number, number],
            fontStyle: 'bold',
            fontSize: 9
          },
          styles: {
            fontSize: 8,
            cellPadding: 4,
          },
          margin: { left: this.margin + 5, right: this.margin },
          tableWidth: 'auto'
        });

        this.yPosition = (this.pdf as any).lastAutoTable.finalY + 10;
      });

      // Add note if duplicates were truncated
      if (duplicates.length > 10) {
        this.pdf.setFontSize(9);
        this.pdf.setTextColor(this.colors.warning[0], this.colors.warning[1], this.colors.warning[2]);
        this.pdf.text(`Note: Showing top 10 of ${duplicates.length} duplicate groups`, this.margin, this.yPosition);
        this.yPosition += 8;
        this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
      }
    }
  }

  private addVDBBreakdown(data: AnalysisData, selectedColumns: string[]): void {
    this.addSectionHeader('VDB Breakdown', 2);

    // Build table based on selected columns
    const columnMap: { [key: string]: { header: string; getValue: (db: any) => string } } = {
      name: {
        header: 'Database Name',
        getValue: (db) => db.name || 'N/A'
      },
      viewCount: {
        header: 'Views',
        getValue: (db) => data.views?.filter(v => v.database === db.name).length.toString() || '0'
      },
      dataSourceCount: {
        header: 'Data Sources',
        getValue: (db) => data.dataSources?.filter(ds => ds.database === db.name).length.toString() || '0'
      },
      cacheStatus: {
        header: 'Cache Status',
        getValue: (db) => db.cacheStatus || 'N/A'
      },
      denodoVersion: {
        header: 'Version',
        getValue: (db) => db.denodoVersion || 'N/A'
      }
    };

    const headers = selectedColumns.map(col => columnMap[col]?.header || col);

    // Limit to first 100 databases to prevent memory issues
    const limitedDatabases = (data.databases || []).slice(0, 100);
    const rows = limitedDatabases.map(db =>
      selectedColumns.map(col => columnMap[col]?.getValue(db) || 'N/A')
    );

    // Add note if data was truncated
    if ((data.databases || []).length > 100) {
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(this.colors.warning[0], this.colors.warning[1], this.colors.warning[2]);
      this.pdf.text(`Note: Showing top 100 of ${data.databases?.length} databases`, this.margin, this.yPosition);
      this.yPosition += 8;
      this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: this.colors.primary as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: selectedColumns.reduce((acc, col, idx) => {
        if (col === 'viewCount' || col === 'dataSourceCount') {
          acc[idx] = { halign: 'right' };
        }
        return acc;
      }, {} as any),
      margin: { left: this.margin, right: this.margin }
    });
  }

  private addViewComplexity(data: AnalysisData, topN: number): void {
    this.addSectionHeader('View Complexity Analysis', 3);

    // Use Python complexity data if available, otherwise fall back to views data
    const complexitySource = data.complexityData && data.complexityData.length > 0
      ? data.complexityData
      : data.views?.filter(v => v.complexityScore !== undefined) || [];

    if (complexitySource.length === 0) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text('No complexity analysis data available. Please run complexity analysis from the View Complexity tab.', this.margin, this.yPosition);
      this.yPosition += 10;
      return;
    }

    this.pdf.setFontSize(10);
    this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
    this.pdf.text(`Top ${topN} Most Complex Views (Analyzed by Python Backend)`, this.margin, this.yPosition);
    this.yPosition += 10;

    // Sort by score and take top N
    const complexViews = complexitySource
      .sort((a, b) => (b.score || b.complexityScore || 0) - (a.score || a.complexityScore || 0))
      .slice(0, topN);

    // Create rows with only essential columns: View Name, Database, Score, Tier, Tables
    const rows = complexViews.map((view, index) => [
      (index + 1).toString(),
      view.name || 'N/A',
      view.database || 'N/A',
      (view.score || view.complexityScore || 0).toFixed(0),
      view.tier || this.getComplexityTier(view.score || view.complexityScore || 0),
      (view.tables || view.tables_used || 0).toString()
    ]);

    autoTable(this.pdf, {
      startY: this.yPosition,
      head: [['#', 'View Name', 'Database', 'Score', 'Tier', 'Tables']],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: this.colors.primary as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 45 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 20 }
      },
      margin: { left: this.margin, right: this.margin }
    });

    this.yPosition = (this.pdf as any).lastAutoTable.finalY + 10;

    // Add legend for complexity tiers
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
    this.pdf.text('Complexity Tiers: Low (0-50) | Medium (51-100) | High (101-200) | Critical (>200)', this.margin, this.yPosition);
  }

  private getComplexityTier(score: number): string {
    if (score > 200) return 'Critical';
    if (score > 100) return 'High';
    if (score > 50) return 'Medium';
    return 'Low';
  }

  private addServerConfiguration(data: AnalysisData): void {
    this.addSectionHeader('Server Configuration', 4);

    const config = data.serverConfiguration || {};

    // Cache Configuration
    this.addSubsectionHeader('Cache Configuration');
    const cacheData = [
      ['Cache Status', this.formatConfigValue(config.cacheStatus)],
      ['Cache Maintenance', this.formatConfigValue(config.cacheMaintenance)],
      ['Server Cache Data Source', this.formatConfigValue(config.serverCacheDataSource)],
      ['Time To Live (seconds)', this.formatConfigValue(config.timeToLiveInSecs)],
    ].filter(row => row[1] !== '-');

    if (cacheData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [],
        body: cacheData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: this.margin + 5, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 10;
    }

    // Security Configuration
    this.addSubsectionHeader('Security & Authentication');
    const securityData = [
      ['Kerberos', this.formatBooleanValue(config.useKerberos)],
      ['LDAP', this.formatBooleanValue(config.useLDAP)],
      ['OAuth2', this.formatBooleanValue(config.useOAuth2)],
      ['SAML', this.formatBooleanValue(config.useSAML)],
      ['SSO Token', this.formatBooleanValue(config.ssoTokenEnabled)],
      ['Vault Integration', this.formatBooleanValue(config.vaultEnabled)],
    ].filter(row => row[1] !== '-');

    if (securityData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [],
        body: securityData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: this.margin + 5, right: this.margin }
      });
      this.yPosition = (this.pdf as any).lastAutoTable.finalY + 10;
    }

    // Web Container
    this.addSubsectionHeader('Web Container');
    const webData = [
      ['Tomcat HTTP Port', this.formatConfigValue(config.tomcatPort)],
      ['Tomcat JVM Options', this.formatConfigValue(config.tomcatJvmOptions, true)],
    ].filter(row => row[1] !== '-');

    if (webData.length > 0) {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: [],
        body: webData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: this.margin + 5, right: this.margin }
      });
    }
  }

  private formatConfigValue(value: any, truncate: boolean = false): string {
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'string' && value.startsWith('${config.')) return '-';

    const str = String(value);
    if (truncate && str.length > 80) {
      return str.substring(0, 80) + '...';
    }
    return str;
  }

  private formatBooleanValue(value: any): string {
    if (value === 'true' || value === true) return '✓ Enabled';
    if (value === 'false' || value === false) return '✗ Disabled';
    return '-';
  }

  private addSectionHeader(title: string, number: number): void {
    this.pdf.setFillColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
    this.pdf.rect(this.margin, this.yPosition, this.pageWidth - 2 * this.margin, 10, 'F');

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`${number}. ${title}`, this.margin + 5, this.yPosition + 7);

    this.yPosition += 15;
    this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
  }

  private addSubsectionHeader(title: string): void {
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
    this.pdf.text(title, this.margin, this.yPosition);
    this.yPosition += 8;
    this.pdf.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
  }

  private addNewPage(): void {
    this.pdf.addPage();
    this.yPosition = this.margin;
  }

  private addPageNumbers(): void {
    const totalPages = this.pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(this.colors.textLight[0], this.colors.textLight[1], this.colors.textLight[2]);
      this.pdf.text(
        `Page ${i} of ${totalPages}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );

      // Footer line
      this.pdf.setDrawColor(this.colors.tableHeader[0], this.colors.tableHeader[1], this.colors.tableHeader[2]);
      this.pdf.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
    }
  }

}
