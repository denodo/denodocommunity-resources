#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Standalone SQL Complexity Analyzer using SQLGlot
- Analyzes individual SQL SELECT statements for complexity metrics
- Designed to integrate with VQL metadata analyzer lexer architecture
- Returns structured complexity data for view analysis

Usage:
  pip install sqlglot
  python sql_complexity_analyzer.py --sql "SELECT * FROM table1 JOIN table2 ON table1.id = table2.id"
"""

import argparse
import json
import sys
from typing import Dict, Optional

from sqlglot import parse_one, exp
try:
    from sqlglot.dialects.dialect import Dialect
except Exception:
    Dialect = None

# ----------------------------
# SQLGlot complexity analysis
# ----------------------------
ANALYTIC_FN = {
    "row_number", "rank", "dense_rank", "lag", "lead", "ntile",
    "first_value", "last_value", "nth_value", "percent_rank", "cume_dist"
}
AGG_FNS = {"sum", "count", "avg", "min", "max"}

def safe_parse_one(sql: str, dialect: str = "ansi"):
    """Safe SQL parsing with dialect fallback"""
    if dialect and Dialect is not None:
        try:
            Dialect.get_or_raise(dialect)
            return parse_one(sql, read=dialect, error_level="ignore")
        except Exception:
            pass
    return parse_one(sql, error_level="ignore")

def join_kind(j: exp.Join) -> str:
    """Extract join type from join expression"""
    # Get both kind and side to handle different join syntax
    kind = (j.args.get("kind") or "").lower()
    side = (j.args.get("side") or "").lower()
    
    # Handle different join types
    if side == "left":
        return "left"
    elif side == "right": 
        return "right"
    elif side == "full":
        return "full"
    elif kind == "cross":
        return "cross"
    elif kind == "inner" or (not kind and not side):
        return "inner"
    else:
        # For any unrecognized pattern, return the combination
        combined = f"{side}_{kind}" if side and kind else (side or kind or "inner")
        return combined

def count_tables(expr: exp.Expression) -> int:
    """Count number of tables referenced"""
    return sum(1 for _ in expr.find_all(exp.Table))

def get_table_names(expr: exp.Expression) -> list:
    """Get actual table names referenced"""
    tables = []
    for table in expr.find_all(exp.Table):
        name = None
        if hasattr(table, 'name') and table.name:
            name = table.name
        elif hasattr(table, 'this') and table.this:
            name = str(table.this)
        
        if name:
            # Clean up the name (remove quotes, etc.)
            name = name.strip('"\'`')
            if name and name not in tables:
                tables.append(name)
    return sorted(tables)

def count_scalar_subqueries(expr: exp.Expression) -> int:
    """Count scalar subqueries"""
    return sum(1 for _ in expr.find_all(exp.Subquery))

def max_select_depth(expr: exp.Expression) -> int:
    """Calculate maximum nesting depth of SELECT statements"""
    maxd = 0

    def walk(node: exp.Expression, d: int):
        nonlocal maxd
        if isinstance(node, exp.Select):
            maxd = max(maxd, d)
        for c in node.iter_expressions():
            walk(c, d + (1 if isinstance(c, exp.Subquery) else 0))

    walk(expr, 0)
    return max(0, maxd - 1)

def set_ops(expr: exp.Expression) -> Dict[str, int]:
    """Count set operations (UNION, INTERSECT, EXCEPT, MINUS)"""
    union = sum(1 for u in expr.find_all(exp.Union) if u.args.get("distinct") is not False)
    union_all = sum(1 for u in expr.find_all(exp.Union) if u.args.get("distinct") is False)
    intersect = sum(1 for _ in expr.find_all(exp.Intersect))
    except_ = sum(1 for _ in expr.find_all(exp.Except))
    
    # Handle different SQLGlot versions
    minus_cls = getattr(exp, "Minus", None)
    minus = sum(1 for _ in expr.find_all(minus_cls)) if minus_cls else 0

    return {
        "union": union, 
        "unionAll": union_all, 
        "intersect": intersect, 
        "except": except_, 
        "minus": minus
    }

def cte_info(expr: exp.Expression) -> tuple[int, bool]:
    """Extract CTE (Common Table Expression) information"""
    w = expr.args.get("with")
    if not isinstance(w, exp.With):
        return 0, False
    return len(w.expressions), bool(w.args.get("recursive"))

def logic_cmp_counts(expr: exp.Expression) -> tuple[int, int, int]:
    """Count logical and comparison operations"""
    ands = sum(1 for _ in expr.find_all(exp.And))
    ors = sum(1 for _ in expr.find_all(exp.Or))
    cmps = sum(1 for _ in expr.find_all((exp.EQ, exp.NEQ, exp.GT, exp.GTE, exp.LT, exp.LTE, exp.Is)))
    return ands, ors, cmps

def count_windows(expr: exp.Expression) -> int:
    """Count window functions"""
    return sum(1 for _ in expr.find_all(exp.Window))

def count_analytic(expr: exp.Expression) -> int:
    """Count analytic functions"""
    n = 0
    for f in expr.find_all(exp.Func):
        name = (f.name or "").lower()
        if name in ANALYTIC_FN:
            n += 1
    return n

def count_aggs(expr: exp.Expression) -> int:
    """Count aggregate functions"""
    return sum(1 for f in expr.find_all(exp.Func) if (f.name or "").lower() in AGG_FNS)

def count_cases(expr: exp.Expression) -> int:
    """Count CASE expressions"""
    return sum(1 for _ in expr.find_all(exp.Case))

def count_funcs(expr: exp.Expression) -> int:
    """Count total function calls"""
    # Common SQL function names to validate against (same as in get_function_names)
    KNOWN_SQL_FUNCTIONS = {
        # String functions
        'concat', 'substring', 'substr', 'upper', 'lower', 'trim', 'ltrim', 'rtrim',
        'replace', 'length', 'len', 'charindex', 'patindex', 'left', 'right',
        # Math functions  
        'abs', 'ceiling', 'floor', 'round', 'sqrt', 'power', 'exp', 'log', 'sin', 'cos', 'tan',
        # Date functions
        'getdate', 'dateadd', 'datediff', 'datepart', 'year', 'month', 'day', 'hour', 'minute', 'second',
        'current_date', 'current_time', 'current_timestamp', 'now', 'extract',
        # Aggregate functions
        'sum', 'count', 'avg', 'min', 'max', 'stddev', 'variance',
        # Window functions
        'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value', 'nth_value',
        # Other common functions
        'coalesce', 'nullif', 'isnull', 'nvl', 'decode', 'cast', 'convert', 'case'
    }
    
    # Count only recognized SQL functions
    named_funcs = sum(1 for func in expr.find_all(exp.Func) 
                     if func.name and func.name.lower() in KNOWN_SQL_FUNCTIONS)
    
    # Count SQL functions that SQLGlot parses as expressions
    concat_count = sum(1 for _ in expr.find_all(exp.Concat))
    coalesce_count = sum(1 for _ in expr.find_all(exp.Coalesce))
    cast_count = sum(1 for _ in expr.find_all(exp.Cast))
    extract_count = sum(1 for _ in expr.find_all(exp.Extract))
    
    return named_funcs + concat_count + coalesce_count + cast_count + extract_count

def get_function_names(expr: exp.Expression) -> list:
    """Get actual function names called"""
    functions = []
    
    # Common SQL function names to validate against
    KNOWN_SQL_FUNCTIONS = {
        # String functions
        'concat', 'substring', 'substr', 'upper', 'lower', 'trim', 'ltrim', 'rtrim',
        'replace', 'length', 'len', 'charindex', 'patindex', 'left', 'right',
        # Math functions  
        'abs', 'ceiling', 'floor', 'round', 'sqrt', 'power', 'exp', 'log', 'sin', 'cos', 'tan',
        # Date functions
        'getdate', 'dateadd', 'datediff', 'datepart', 'year', 'month', 'day', 'hour', 'minute', 'second',
        'current_date', 'current_time', 'current_timestamp', 'now', 'extract',
        # Aggregate functions
        'sum', 'count', 'avg', 'min', 'max', 'stddev', 'variance',
        # Window functions
        'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value', 'nth_value',
        # Other common functions
        'coalesce', 'nullif', 'isnull', 'nvl', 'decode', 'cast', 'convert', 'case'
    }
    
    # Add named functions only if they're recognized SQL functions
    for func in expr.find_all(exp.Func):
        if func.name:
            name = func.name.lower()
            if name in KNOWN_SQL_FUNCTIONS and name not in functions:
                functions.append(name)
    
    # SQLGlot parses some SQL functions as expression types instead of Func types
    # Only add these if they are actual SQL functions (not column names)
    
    # CONCAT function
    if list(expr.find_all(exp.Concat)) and 'concat' not in functions:
        functions.append('concat')
    
    # COALESCE function  
    if list(expr.find_all(exp.Coalesce)) and 'coalesce' not in functions:
        functions.append('coalesce')
    
    # CAST function
    if list(expr.find_all(exp.Cast)) and 'cast' not in functions:
        functions.append('cast')
    
    # EXTRACT function
    if list(expr.find_all(exp.Extract)) and 'extract' not in functions:
        functions.append('extract')
    
    return sorted(functions)

def get_window_function_names(expr: exp.Expression) -> list:
    """Get actual window function names"""
    window_functions = []
    for window in expr.find_all(exp.Window):
        if hasattr(window, 'this') and hasattr(window.this, 'name'):
            name = window.this.name.lower()
            if name and name not in window_functions:
                window_functions.append(name)
    return sorted(window_functions)

def get_analytic_function_names(expr: exp.Expression) -> list:
    """Get actual analytic function names"""
    analytic_functions = []
    for func in expr.find_all(exp.Func):
        if func.name:
            name = func.name.lower()
            if name in ANALYTIC_FN and name not in analytic_functions:
                analytic_functions.append(name)
    return sorted(analytic_functions)

def get_aggregate_function_names(expr: exp.Expression) -> list:
    """Get actual aggregate function names"""
    agg_functions = []
    for func in expr.find_all(exp.Func):
        if func.name:
            name = func.name.lower()
            if name in AGG_FNS and name not in agg_functions:
                agg_functions.append(name)
    return sorted(agg_functions)

def extract_select_body_from_create_view(statement: str) -> Optional[str]:
    """
    Extract SELECT body from CREATE VIEW statement
    Used by batch analyzer when views contain full CREATE statements
    """
    try:
        # Find SELECT keyword position, avoiding quoted strings and comments
        select_pos = -1
        in_single_quote = False
        in_double_quote = False
        i = 0
        
        while i < len(statement):
            char = statement[i]
            
            # Handle quotes
            if char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote
            elif not in_single_quote and not in_double_quote:
                # Check for SELECT keyword
                if statement[i:i+6].upper() == 'SELECT' and (i == 0 or not statement[i-1].isalnum()):
                    # Make sure it's a word boundary after SELECT
                    if i + 6 >= len(statement) or not statement[i+6].isalnum():
                        select_pos = i
                        break
            
            i += 1
        
        if select_pos == -1:
            return None
        
        # Extract everything from SELECT onwards, trimming whitespace
        select_body = statement[select_pos:].strip()
        
        # Remove trailing semicolon if present
        return select_body.rstrip(';').strip()
        
    except Exception:
        return None

def analyze_sql_complexity(sql: str, dialect: str = "ansi") -> dict:
    """
    Analyze SQL SELECT statement complexity using SQLGlot
    
    Args:
        sql: SQL SELECT statement to analyze
        dialect: SQLGlot dialect (ansi, postgres, trino, etc.)
    
    Returns:
        Dictionary with complexity metrics and scoring
    """
    try:
        tree = safe_parse_one(sql, dialect)
        if not tree:
            return {
                "error": "Failed to parse SQL statement",
                "sql": sql[:100] + "..." if len(sql) > 100 else sql
            }
        
        # Join analysis
        joins = list(tree.find_all(exp.Join))
        joins_by: Dict[str, int] = {}
        for j in joins:
            k = join_kind(j)
            joins_by[k] = joins_by.get(k, 0) + 1
        joins_total = len(joins)

        # Basic metrics
        tables = count_tables(tree)
        table_names = get_table_names(tree)
        scalar_subq = count_scalar_subqueries(tree)
        depth = max_select_depth(tree)

        # Set operations
        sops = set_ops(tree)
        cte_count, cte_recursive = cte_info(tree)

        # SELECT clause analysis
        sel = next(tree.find_all(exp.Select), None)
        has_distinct = bool(sel and sel.args.get("distinct"))
        group_by = bool(sel and sel.args.get("group"))
        having = bool(sel and sel.args.get("having"))

        # Function analysis
        windows = count_windows(tree)
        window_function_names = get_window_function_names(tree)
        analytic = count_analytic(tree)
        analytic_function_names = get_analytic_function_names(tree)
        aggs = count_aggs(tree)
        agg_function_names = get_aggregate_function_names(tree)
        cases = count_cases(tree)
        funcs = count_funcs(tree)
        function_names = get_function_names(tree)
        ands, ors, cmps = logic_cmp_counts(tree)

        # Complexity scoring (tunable weights)
        score = 0.0
        score += joins_total * 3.0
        score += max(0, tables - 2) * 1.0
        score += cte_count * 2.0 + (6.0 if cte_recursive else 0.0)
        score += sops["union"] * 3.0 + sops["unionAll"] * 2.0 
        score += sops["intersect"] * 4.0 + sops["except"] * 4.0 + sops["minus"] * 4.0
        score += depth * 4.0 + scalar_subq * 3.0
        score += (2.0 if has_distinct else 0.0) + (2.0 if group_by else 0.0) + (3.0 if having else 0.0)
        score += min(aggs, 10) * 1.0
        score += min(windows, 5) * 3.0 + min(analytic, 5) * 2.0
        score += min(cases, 5) * 1.5
        score += min(funcs, 20) * 0.3
        score += (ands + ors) * 0.4 + cmps * 0.2

        # Complexity tier classification
        tier = "low" if score <= 12 else "medium" if score <= 28 else "high" if score <= 45 else "veryHigh"

        return {
            "joinsTotal": joins_total,
            "joinsByType": joins_by,
            "tables": tables,
            "tableNames": table_names,
            "ctes": cte_count,
            "recursiveCte": cte_recursive,
            "setOps": sops,
            "subqueryDepth": depth,
            "scalarSubqueries": scalar_subq,
            "hasDistinct": has_distinct,
            "groupBy": group_by,
            "having": having,
            "windows": windows,
            "windowFunctionNames": window_function_names,
            "analyticFns": analytic,
            "analyticFunctionNames": analytic_function_names,
            "aggFns": aggs,
            "aggFunctionNames": agg_function_names,
            "caseExprs": cases,
            "fnCalls": funcs,
            "functionNames": function_names,
            "andCount": ands,
            "orCount": ors,
            "cmpCount": cmps,
            "score": round(float(score), 1),
            "tier": tier,
        }

    except Exception as e:
        return {
            "error": f"Analysis failed: {str(e)}",
            "sql": sql[:100] + "..." if len(sql) > 100 else sql
        }

def main():
    """Command line interface for standalone testing"""
    parser = argparse.ArgumentParser(description="Analyze SQL SELECT statement complexity using SQLGlot")
    parser.add_argument("--sql", required=True, help="SQL SELECT statement to analyze")
    parser.add_argument("--dialect", default="ansi", help="SQLGlot dialect (ansi|postgres|trino|...)")
    parser.add_argument("--format", choices=["json", "summary"], default="summary", help="Output format")
    
    args = parser.parse_args()
    
    result = analyze_sql_complexity(args.sql, args.dialect)
    
    if args.format == "json":
        print(json.dumps(result, indent=2))
    else:
        if "error" in result:
            print(f"❌ Error: {result['error']}")
            return 1
        
        print("📊 SQL Complexity Analysis")
        print("=" * 50)
        print(f"Score: {result['score']} ({result['tier']} complexity)")
        print(f"Tables: {result['tables']}")
        print(f"Joins: {result['joinsTotal']} {result['joinsByType']}")
        print(f"Subquery Depth: {result['subqueryDepth']}")
        print(f"CTEs: {result['ctes']} ({'recursive' if result['recursiveCte'] else 'non-recursive'})")
        print(f"Set Operations: {sum(result['setOps'].values())}")
        print(f"Window Functions: {result['windows']}")
        print(f"Analytic Functions: {result['analyticFns']}")
        print(f"Aggregate Functions: {result['aggFns']}")
        print(f"CASE Expressions: {result['caseExprs']}")
        print(f"Function Calls: {result['fnCalls']}")
        print(f"Logic Operators: AND({result['andCount']}) OR({result['orCount']})")
        print(f"Comparisons: {result['cmpCount']}")
        
        if result['hasDistinct'] or result['groupBy'] or result['having']:
            features = []
            if result['hasDistinct']: features.append("DISTINCT")
            if result['groupBy']: features.append("GROUP BY") 
            if result['having']: features.append("HAVING")
            print(f"Features: {', '.join(features)}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())