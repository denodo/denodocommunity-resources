/**
 * VQL Lexer - Stateful lexer with quotes/comments awareness
 * Based on the proven lexer from vql_insights.ts but adapted for browser/worker use
 */

export interface LexerState {
  inSQ: boolean;
  inDQ: boolean;
  inBQ: boolean;
  inLineComment: boolean;
  inBlockComment: boolean;
  bufferLength: number;
}

export interface LexerStats {
  totalStatements: number;
  wrapperStatements: number;
  createStatements: number;
  alterViewStatements: number;
  alterRoleStatements?: number;
  userStatements?: number;
  customDatasourceStatements: number;
  excelDatasourceStatements: number;
  tagStatements?: number;
  bytesProcessed: number;
  parseStartTime: number;
}

export class VQLLexer {
  private inSQ: boolean = false;          // in single quotes
  private inDQ: boolean = false;          // in double quotes
  private inBQ: boolean = false;          // in backticks
  private inLineComment: boolean = false; // in -- comment
  private inBlockComment: boolean = false; // in /* comment */
  private buf: string[] = [];             // current statement buffer

  // Track statement counts
  public totalStatements: number = 0;
  public wrapperStatements: number = 0;
  public createStatements: number = 0;
  public alterViewStatements: number = 0;
  public alterRoleStatements: number = 0;
  public userStatements: number = 0;
  public customDatasourceStatements: number = 0;
  public excelDatasourceStatements: number = 0;
  public tagStatements: number = 0;
  public bytesProcessed: number = 0;
  public parseStartTime: number = Date.now();

  constructor() {
    this.reset();
  }

  /**
   * Reset lexer state for new parsing session
   */
  reset(): void {
    this.inSQ = false;
    this.inDQ = false;
    this.inBQ = false;
    this.inLineComment = false;
    this.inBlockComment = false;
    this.buf = [];

    // Track statement counts
    this.totalStatements = 0;
    this.wrapperStatements = 0;
    this.createStatements = 0;
    this.alterViewStatements = 0;
    this.customDatasourceStatements = 0;
    this.excelDatasourceStatements = 0;
    this.bytesProcessed = 0;
    this.parseStartTime = Date.now();
  }

  /**
   * Feed chunk of text to lexer, returns completed statements
   */
  feed(chunk: string): string[] {
    const statements: string[] = [];
    let i = 0;
    const n = chunk.length;

    this.bytesProcessed += n;

    while (i < n) {
      const ch = chunk.charAt(i);
      const nxt = i + 1 < n ? chunk.charAt(i + 1) : '';

      // Handle line comments (-- comment)
      if (this.inLineComment) {
        this.buf.push(ch);
        if (ch === '\n') this.inLineComment = false;
        i++;
        continue;
      }

      // Handle block comments (/* comment */)
      if (this.inBlockComment) {
        this.buf.push(ch);
        if (ch === '*' && nxt === '/') {
          this.buf.push(nxt);
          i += 2;
          this.inBlockComment = false;
          continue;
        }
        i++;
        continue;
      }

      // Comment entry only if not inside quotes
      if (!(this.inSQ || this.inDQ || this.inBQ)) {
        // Line comment: --
        if (ch === '-' && nxt === '-') {
          this.buf.push(ch, nxt);
          i += 2;
          this.inLineComment = true;
          continue;
        }
        // Block comment: /*
        if (ch === '/' && nxt === '*') {
          this.buf.push(ch, nxt);
          i += 2;
          this.inBlockComment = true;
          continue;
        }
      }

      // Handle single quotes with improved handling for folder paths with spaces
      if (!(this.inDQ || this.inBQ) && ch === "'") {
        this.buf.push(ch);
        if (this.inSQ) {
          // Check for escaped quote ''
          if (nxt === "'") {
            this.buf.push(nxt);
            i += 2;
            continue;
          } else {
            this.inSQ = false;
            i++;
            continue;
          }
        } else {
          this.inSQ = true;
          i++;
          continue;
        }
      }

      // Handle double quotes
      if (!(this.inSQ || this.inBQ) && ch === '"') {
        this.buf.push(ch);
        if (this.inDQ) {
          // Check for escaped quote ""
          if (nxt === '"') {
            this.buf.push(nxt);
            i += 2;
            continue;
          } else {
            this.inDQ = false;
            i++;
            continue;
          }
        } else {
          this.inDQ = true;
          i++;
          continue;
        }
      }

      // Handle backticks (rare but for completeness)
      if (!(this.inSQ || this.inDQ) && ch === '`') {
        this.buf.push(ch);
        this.inBQ = !this.inBQ;
        i++;
        continue;
      }

      // End-of-statement detection (semicolon outside quotes/comments)
      if (ch === ';') {
        const potentialStatement = this.buf.join('').trim() + ';';

        // Check if this could be a valid statement boundary
        const couldBeValidBoundary = !this.inLineComment && !this.inBlockComment &&
          (potentialStatement.length > 10) &&
          this.isValidVQLStatement(potentialStatement);

        // If we're confident this is a statement boundary, reset quote state and proceed
        if (couldBeValidBoundary || !(this.inSQ || this.inDQ || this.inBQ || this.inLineComment || this.inBlockComment)) {
          // Reset quote state at confident statement boundaries to prevent corruption
          if (couldBeValidBoundary && (this.inSQ || this.inDQ || this.inBQ)) {
            this.inSQ = false;
            this.inDQ = false;
            this.inBQ = false;
          }

          // Include the semicolon in the statement for proper validation
          this.buf.push(ch);
          const statement = this.buf.join('').trim();

          if (statement && this.isValidVQLStatement(statement)) {
            this.totalStatements++;
            statements.push(statement);

            // Track specific statement types (reduced logging)
            const upperStatement = statement.toUpperCase();
            if (upperStatement.includes('CREATE')) {
              this.createStatements++;
            }
            if (upperStatement.includes('ALTER VIEW')) {
              this.alterViewStatements++;
            }
            if (upperStatement.includes('ALTER ROLE')) {
              this.alterRoleStatements = (this.alterRoleStatements || 0) + 1;
            }
            if (upperStatement.includes('CREATE') && upperStatement.includes('USER')) {
              this.userStatements = (this.userStatements || 0) + 1;
            }
            if (upperStatement.includes('WRAPPER')) {
              if (upperStatement.match(/^CREATE\s+(OR\s+REPLACE\s+)?WRAPPER\s+/)) {
                this.wrapperStatements++;
              }
            }

            // Track DATASOURCE CUSTOM statements
            if (upperStatement.match(/^CREATE\s+(OR\s+REPLACE\s+)?DATASOURCE\s+CUSTOM\s+(?:"[^"]+"|[A-Za-z_][\w.-]*)/)) {
              this.customDatasourceStatements = (this.customDatasourceStatements || 0) + 1;

              // Check for ExcelWrapper className
              if (statement.includes('com.denodo.vdb.contrib.wrapper.xls.ExcelWrapper')) {
                this.excelDatasourceStatements = (this.excelDatasourceStatements || 0) + 1;
              }

              // Debug TAG statements in VQLLexer
              if (statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TAGS?\s+/i)) {
                this.tagStatements = (this.tagStatements || 0) + 1;
              }
            }
          }

          // Clear buffer immediately after processing statement
          this.buf = [];
          i++;
          continue;
        }
      }

      // Regular character - add to buffer
      this.buf.push(ch);

      // Prevent buffer from growing too large
      if (this.buf.length > 10485760) { // 10MB character limit per statement
        console.warn('Statement buffer exceeded 10MB - forcing break');
        const partialStatement = this.buf.join('').trim();

        if (partialStatement && this.isValidVQLStatement(partialStatement)) {
          statements.push(partialStatement);
          this.totalStatements++;
        }
        this.buf = [];
      }

      i++;
    }

    return statements;
  }

  /**
   * Finalize parsing and return any remaining statement
   */
  finalize(): string[] {
    const statement = this.buf.join('').trim();
    const results: string[] = [];

    if (statement && this.isValidVQLStatement(statement)) {
      this.totalStatements++;
      results.push(statement);

      // Track final statement types
      const upperStatement = statement.toUpperCase();
      if (upperStatement.includes('CREATE')) {
        this.createStatements++;
      }
      if (upperStatement.includes('ALTER VIEW')) {
        this.alterViewStatements++;
      }
      if (upperStatement.includes('ALTER ROLE')) {
        this.alterRoleStatements = (this.alterRoleStatements || 0) + 1;
      }
      if (upperStatement.includes('WRAPPER')) {
        if (upperStatement.match(/^CREATE\s+(OR\s+REPLACE\s+)?WRAPPER\s+/)) {
          this.wrapperStatements++;
        }
      }

      // Track CUSTOM DATASOURCE statements
      if (upperStatement.match(/^CREATE\s+(OR\s+REPLACE\s+)?DATASOURCE\s+CUSTOM\s+(?:"[^"]+"|[A-Za-z_][\w.-]*)/)) {
        this.customDatasourceStatements = (this.customDatasourceStatements || 0) + 1;

        if (statement.includes('com.denodo.vdb.contrib.wrapper.xls.ExcelWrapper')) {
          this.excelDatasourceStatements = (this.excelDatasourceStatements || 0) + 1;
        }
      }
    }

    this.buf = [];

    // Simple final summary (reduced logging)
    const elapsed = Date.now() - this.parseStartTime;
    const mbProcessed = (this.bytesProcessed / 1024 / 1024).toFixed(2);

    return results;
  }

  /**
   * Check if statement is a valid VQL statement we want to parse
   */
  isValidVQLStatement(statement: string): boolean {
    const upperStatement = statement.toUpperCase();

    // Skip empty statements and pure comments
    if (!upperStatement.trim() || upperStatement.startsWith('--') || upperStatement.startsWith('/*')) {
      return false;
    }

    // Must contain CREATE for VQL statements we care about
    if (!upperStatement.includes('CREATE')) {
      // Allow USE/SET/CONNECT/ALTER DATABASE for context tracking
      // Also allow ALTER VIEW for cache configuration
      return upperStatement.includes('USE DATABASE') ||
             upperStatement.includes('SET DATABASE') ||
             upperStatement.includes('CONNECT DATABASE') ||
             upperStatement.includes('ALTER DATABASE') ||
             upperStatement.includes('ALTER VIEW') ||
             upperStatement.includes('ALTER ROLE');
    }

    // Validate CREATE statement types we handle
    const isValid = upperStatement.includes('DATABASE') ||
                   upperStatement.includes('DATASOURCE') ||
                   upperStatement.includes('VIEW') ||
                   upperStatement.includes('TABLE') ||
                   upperStatement.includes('WRAPPER') ||
                   upperStatement.includes('RESOURCE') ||
                   upperStatement.includes('WEBSERVICE') ||
                   upperStatement.includes('USER') ||
                   upperStatement.includes('ROLE') ||
                   upperStatement.includes('JAR') ||
                   upperStatement.includes('MAP') ||
                   upperStatement.includes('TAG');

    // DEBUG: Log if a DATASOURCE CUSTOM statement is being rejected
    if (!isValid && upperStatement.includes('DATASOURCE') && upperStatement.includes('CUSTOM')) {
      console.warn(`DATASOURCE CUSTOM REJECTED: ${statement.substring(0, 200)}...`);
    }

    return isValid;
  }

  /**
   * Get current lexer state (for debugging)
   */
  getState(): LexerState {
    return {
      inSQ: this.inSQ,
      inDQ: this.inDQ,
      inBQ: this.inBQ,
      inLineComment: this.inLineComment,
      inBlockComment: this.inBlockComment,
      bufferLength: this.buf.length
    };
  }

  /**
   * Get lexer statistics
   */
  getStats(): LexerStats {
    return {
      totalStatements: this.totalStatements,
      wrapperStatements: this.wrapperStatements,
      createStatements: this.createStatements,
      alterViewStatements: this.alterViewStatements,
      alterRoleStatements: this.alterRoleStatements,
      userStatements: this.userStatements,
      customDatasourceStatements: this.customDatasourceStatements,
      excelDatasourceStatements: this.excelDatasourceStatements,
      tagStatements: this.tagStatements,
      bytesProcessed: this.bytesProcessed,
      parseStartTime: this.parseStartTime
    };
  }
}

/**
 * Convenience function to parse entire VQL content at once
 */
export function parseVQLStatements(content: string): string[] {
  const lexer = new VQLLexer();
  const statements = lexer.feed(content);
  const finalStatements = lexer.finalize();
  const allStatements = [...statements, ...finalStatements];
  return allStatements;
}
