/**
 * Performance monitoring utility for tracking parsing and insertion metrics
 */

export interface PerformanceMetrics {
  parseTime: number;
  insertTime: number;
  totalTime: number;
  rowsProcessed: number;
  rowsPerSecond: number;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private parseStartTime: number = 0;
  private insertStartTime: number = 0;
  private metrics: Partial<PerformanceMetrics> = {};

  start() {
    this.startTime = performance.now();
    this.metrics = {};
  }

  startParsing() {
    this.parseStartTime = performance.now();
  }

  endParsing() {
    this.metrics.parseTime = performance.now() - this.parseStartTime;
  }

  startInsertion() {
    this.insertStartTime = performance.now();
  }

  endInsertion(rowsProcessed: number) {
    this.metrics.insertTime = performance.now() - this.insertStartTime;
    this.metrics.rowsProcessed = rowsProcessed;
    this.metrics.totalTime = performance.now() - this.startTime;
    this.metrics.rowsPerSecond = rowsProcessed / (this.metrics.insertTime / 1000);
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  formatMetrics(): string {
    const m = this.metrics;
    return `
Performance Summary:
- Parse Time: ${(m.parseTime || 0).toFixed(2)}ms
- Insert Time: ${(m.insertTime || 0).toFixed(2)}ms
- Total Time: ${(m.totalTime || 0).toFixed(2)}ms
- Rows Processed: ${m.rowsProcessed || 0}
- Throughput: ${(m.rowsPerSecond || 0).toFixed(0)} rows/sec
    `.trim();
  }
}
