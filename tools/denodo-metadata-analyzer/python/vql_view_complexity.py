#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VQL → View Complexity (SQLGlot)
- Splits a .vql file into statements (quotes/comments aware)
- Tracks DATABASE context (CREATE/USE/SET/CONNECT DATABASE ...)
- Extracts SELECT body from CREATE OR REPLACE (INTERFACE) VIEW ... AS ...
- Parses SELECT with SQLGlot and computes metrics + score/tier
- Prints a summary and optionally writes a CSV

Usage:
  pip install sqlglot
  python vql_view_complexity.py --vql fullExport.vql --out view_complexity.csv --dialect ansi
"""

import argparse
import csv
import json
import math
import os
import re
from typing import Dict, Iterable, Iterator, List, Optional, Tuple

from sqlglot import parse_one, exp
try:
    from sqlglot.dialects.dialect import Dialect
except Exception:
    Dialect = None  # not critical; we'll just skip validation

# ----------------------------
# Statement splitter (lexer-ish)
# ----------------------------
def split_vql_statements(path: str, chunk_size: int = 1024 * 1024) -> Iterator[str]:
    """
    Yield VQL statements by splitting on ';' outside of quotes/comments.
    Works for large files by streaming in chunks.
    """
    in_sq = in_dq = in_bq = False
    in_line = in_block = False
    buf: List[str] = []

    def flush():
        s = "".join(buf).strip()
        buf.clear()
        if s:
            yield s

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            i, n = 0, len(chunk)
            while i < n:
                ch = chunk[i]
                nxt = chunk[i + 1] if i + 1 < n else ""

                # line comment
                if in_line:
                    buf.append(ch)
                    if ch == "\n":
                        in_line = False
                    i += 1
                    continue

                # block comment
                if in_block:
                    buf.append(ch)
                    if ch == "*" and nxt == "/":
                        buf.append(nxt)
                        i += 2
                        in_block = False
                    else:
                        i += 1
                    continue

                # enter comments (only if not in quotes)
                if not (in_sq or in_dq or in_bq):
                    if ch == "-" and nxt == "-":
                        buf.append(ch); buf.append(nxt)
                        i += 2
                        in_line = True
                        continue
                    if ch == "/" and nxt == "*":
                        buf.append(ch); buf.append(nxt)
                        i += 2
                        in_block = True
                        continue

                # strings / quoted identifiers
                if not (in_dq or in_bq) and ch == "'":
                    buf.append(ch)
                    in_sq = not in_sq
                    i += 1
                    continue
                if not (in_sq or in_bq) and ch == '"':
                    buf.append(ch)
                    # handle "" escapes
                    if in_dq:
                        if nxt == '"':
                            buf.append(nxt); i += 2; continue
                        in_dq = False
                    else:
                        in_dq = True
                    i += 1
                    continue
                if not (in_sq or in_dq) and ch == "`":
                    buf.append(ch)
                    in_bq = not in_bq
                    i += 1
                    continue

                # statement boundary
                if ch == ";" and not (in_sq or in_dq or in_bq or in_line or in_block):
                    # end of statement
                    yield from flush()
                    i += 1
                    continue

                buf.append(ch)
                i += 1

    # tail
    if buf:
        yield from flush()


# ----------------------------
# Small helpers
# ----------------------------
def strip_leading_comments(stmt: str) -> str:
    i, n = 0, len(stmt)
    while i < n:
        ch = stmt[i]
        if ch.isspace():
            i += 1
            continue
        if stmt.startswith("--", i) or stmt[i] == "#":
            j = stmt.find("\n", i)
            if j == -1:
                return ""
            i = j + 1
            continue
        if stmt.startswith("/*", i):
            j = stmt.find("*/", i + 2)
            if j == -1:
                return ""
            i = j + 2
            continue
        break
    return stmt[i:]


def parse_identifier_after(pattern: re.Pattern, s: str) -> Optional[str]:
    m = pattern.search(s)
    if not m:
        return None
    i = m.end()
    if i < len(s) and s[i] == '"':
        # quoted with "" escapes
        j = i + 1
        chars: List[str] = []
        while j < len(s):
            c = s[j]
            if c == '"':
                if j + 1 < len(s) and s[j + 1] == '"':
                    chars.append('"'); j += 2; continue
                j += 1
                break
            chars.append(c); j += 1
        return "".join(chars)
    # unquoted
    j = i
    while j < len(s) and not s[j].isspace():
        j += 1
    return s[i:j]

def safe_parse_one(sql: str, dialect: str | None):
    # If dialect is provided but unknown in this sqlglot version, fall back to default parser
    if dialect and Dialect is not None:
        try:
            Dialect.get_or_raise(dialect)
            return parse_one(sql, read=dialect, error_level="ignore")
        except Exception:
            pass
    # default/generic parser
    return parse_one(sql, error_level="ignore")



def find_kw_outside(s: str, kw: str) -> int:
    """
    Find keyword (case-insensitive) position outside of quotes/comments.
    Returns -1 if not found.
    """
    target = kw.lower()
    i, n = 0, len(s)
    in_sq = in_dq = in_bq = False
    in_line = in_block = False

    def is_word_boundary(pos: int) -> bool:
        before = s[pos - 1] if pos > 0 else " "
        after = s[pos + len(kw)] if pos + len(kw) < len(s) else " "
        return not before.isalnum() and before != "_" and not after.isalnum() and after != "_"

    while i < n:
        ch = s[i]
        nxt = s[i + 1] if i + 1 < n else ""

        if in_line:
            if ch == "\n":
                in_line = False
            i += 1
            continue
        if in_block:
            if ch == "*" and nxt == "/":
                in_block = False; i += 2; continue
            i += 1
            continue

        if not (in_sq or in_dq or in_bq):
            if ch == "-" and nxt == "-":
                in_line = True; i += 2; continue
            if ch == "/" and nxt == "*":
                in_block = True; i += 2; continue

        if not (in_dq or in_bq) and ch == "'":
            in_sq = not in_sq; i += 1; continue
        if not (in_sq or in_bq) and ch == '"':
            # skip quoted identifier with "" escapes
            j = i + 1
            while j < n:
                c = s[j]
                if c == '"':
                    if j + 1 < n and s[j + 1] == '"':
                        j += 2; continue
                    j += 1; break
                j += 1
            i = j
            continue
        if not (in_sq or in_dq) and ch == "`":
            in_bq = not in_bq; i += 1; continue

        if in_sq or in_dq or in_bq:
            i += 1; continue

        # keyword check
        if s[i:i + len(kw)].lower() == target and is_word_boundary(i):
            return i

        i += 1
    return -1


def extract_select_body_from_create_view(stmt: str) -> Optional[str]:
    """
    Given a full CREATE ... VIEW statement, return body after AS up to CONTEXT (if any).
    """
    # Find AS outside quotes/comments
    as_pos = find_kw_outside(stmt, "AS")
    if as_pos == -1:
        return None
    body = stmt[as_pos + 2:].strip()

    # Cut off trailing CONTEXT if present
    ctx_pos = find_kw_outside(body, "CONTEXT")
    if ctx_pos != -1:
        body = body[:ctx_pos].strip()

    # Remove trailing semicolons
    return re.sub(r";+\s*$", "", body)


# ----------------------------
# SQLGlot complexity
# ----------------------------
# Denodo-specific function categories with complexity weights
DENODO_FUNCTIONS = {
    # High complexity - AI/ML and advanced operations (weight: 5.0)
    'ai_llm': {
        'classify_ai', 'enrich_ai', 'enrich_ai_binary', 'extract_ai', 
        'sentiment_ai', 'summarize_ai', 'translate_ai'
    },
    
    # High complexity - Spatial operations (weight: 4.0)
    'spatial': {
        'st_area', 'st_area_meters', 'st_boundary', 'st_buffer', 'st_buffer_meters', 
        'st_centroid', 'st_contains', 'st_convexhull', 'st_create_point', 'st_crosses', 
        'st_difference', 'st_dimension', 'st_disjoint', 'st_distance', 'st_distance_meters', 
        'st_endpoint', 'st_envelope', 'st_equals', 'st_exteriorring', 'st_geometrytype', 
        'st_geom_to_struct', 'st_geometryn', 'st_interiorringn', 'st_intersection', 
        'st_intersects', 'st_isclosed', 'st_isempty', 'st_issimple', 'st_isring', 
        'st_length', 'st_length_meters', 'st_numgeometries', 'st_numinteriorrings', 
        'st_numpoints', 'st_overlaps', 'st_pointn', 'st_relate', 'st_startpoint', 
        'st_symdifference', 'st_touches', 'st_transform', 'st_union', 'st_within', 
        'st_wkbtowkt', 'st_wkttowkb', 'st_x', 'st_y'
    },
    
    # Medium-high complexity - XML/JSON processing (weight: 3.0)
    'data_processing': {
        'xmlquery', 'xpath', 'xslt', 'avro_to_json', 'complex_type_to_json', 
        'jsonpath', 'json_to_avro', 'json_to_complex_type', 'createtypefromxml',
        'decode_base64', 'encode_base64', 'from_base64', 'to_base64'
    },
    
    # Medium complexity - Advanced text/analytics (weight: 2.0)
    'advanced_text': {
        'regexp', 'regexp_replace', 'edit_distance', 'soundex', 'md5', 'hash', 
        'hash_function', 'encrypt', 'encrypt_fixed', 'decrypt', 'decrypt_fixed',
        'difference', 'novowels', 'translate', 'format'
    },
    
    # Medium complexity - DateTime operations (weight: 1.5)
    'datetime': {
        'addday', 'addhour', 'addmillis', 'addminute', 'addmonth', 'addsecond', 
        'addweek', 'addyear', 'at_time_zone', 'convert_timezone', 'current_date', 
        'current_timestamp', 'extract', 'firstdayofmonth', 'firstdayofweek', 
        'formatdate', 'getday', 'getdayofweek', 'getdayofyear', 'getdaysbetween', 
        'gethour', 'getmillisecond', 'getminute', 'getmonth', 'getmonthsbetween',
        'getquarter', 'getsecond', 'gettimefrommillis', 'gettimeinmillis', 'getweek',
        'getweeksbetween', 'getyear', 'lastdayofmonth', 'lastdayofweek', 'localtime',
        'localtimestamp', 'nextweekday', 'now', 'previousweekday', 'subtract',
        'to_date', 'to_localdate', 'to_time', 'to_timestamp', 'to_timestamptz', 'trunc'
    },
    
    # Medium complexity - Window functions (weight: 2.0)
    'window': {
        'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'ntile', 'first_value', 
        'last_value', 'nth_value', 'percent_rank', 'cume_dist', 'percentile_cont', 
        'percentile_disc'
    },
    
    # Low-medium complexity - Aggregation functions (weight: 1.0)
    'aggregation': {
        'avg', 'count', 'first', 'group_concat', 'last', 'list', 'listagg', 'max', 'median', 
        'min', 'nest', 'stdev', 'stddev', 'stddevp', 'string_agg', 'sum', 'var', 'varp'
    },
    
    # Low-medium complexity - Numeric functions (weight: 0.8)
    'numeric': {
        'abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'cot', 'degrees', 
        'div', 'exp', 'floor', 'ln', 'log', 'mod', 'mult', 'pi', 'power', 'radians', 
        'rand', 'round', 'sign', 'sin', 'sqrt', 'subtract', 'tan', 'trunc'
    },
    
    # Low complexity - Basic functions (weight: 0.5)
    'basic': {
        'coalesce', 'nullif', 'cast', 'register', 'to_boolean', 'to_char', 'to_decimal', 
        'to_double', 'to_float', 'to_int', 'to_long', 'array_to_string', 'ascii', 
        'bit_length', 'chr', 'concat', 'concat_ws', 'endswith', 'initcap', 'insert', 
        'left', 'length', 'locate', 'lower', 'lpad', 'ltrim', 'repeat', 'replace', 
        'reverse', 'right', 'rpad', 'rtrim', 'split', 'space', 'starts_with', 
        'substring', 'trim', 'upper', 'getvar', 'getsession', 'map', 'pivotregister', 
        'rownum', 'unpivotregister', 'contextualsummary'
    }
}

# Function weights for complexity calculation
FUNCTION_WEIGHTS = {
    'ai_llm': 5.0,
    'spatial': 4.0, 
    'data_processing': 3.0,
    'advanced_text': 2.0,
    'window': 2.0,
    'datetime': 1.5,
    'aggregation': 1.0,
    'numeric': 0.8,
    'basic': 0.5
}

# Legacy function sets for backward compatibility
ANALYTIC_FN = DENODO_FUNCTIONS['window']
AGG_FNS = DENODO_FUNCTIONS['aggregation']


def join_kind(j: exp.Join) -> str:
    side = (j.args.get("side") or "").lower()
    kind = (j.args.get("kind") or "").lower()
    method = (j.args.get("method") or "").lower()
    natural = j.args.get("natural", False)
    
    # Handle NATURAL joins (SQLGlot stores this in 'method' field)
    if method == "natural" or natural:
        if side and kind:
            if side == "left" and kind == "outer":
                return "natural_left"
            elif side == "right" and kind == "outer":
                return "natural_right"
            elif side == "full" and kind == "outer":
                return "natural_full"
        elif side in ("left", "right", "full"):
            return f"natural_{side}"
        else:
            return "natural"
    
    # Handle combinations of side and kind
    if side and kind:
        if side == "left" and kind == "outer":
            return "left"
        elif side == "right" and kind == "outer":
            return "right"
        elif side == "full" and kind == "outer":
            return "full"
    
    # Handle single values
    if kind in ("inner", "cross"):
        return kind
    elif side in ("left", "right", "full"):
        return side
    elif kind in ("left", "right", "full"):
        return kind
    
    # Default for unspecified joins
    return "inner" if isinstance(j, exp.Join) else "unknown"


def count_tables(expr: exp.Expression) -> int:
    return sum(1 for _ in expr.find_all(exp.Table))


def count_scalar_subqueries(expr: exp.Expression) -> int:
    """
    Count only actual SELECT subqueries, not parser artifacts like CASE expressions.
    A true scalar subquery has a SELECT statement inside.
    """
    count = 0
    for subq in expr.find_all(exp.Subquery):
        # Check if this subquery actually contains a SELECT statement
        if subq.this and isinstance(subq.this, exp.Select):
            count += 1
    return count


def max_select_depth(expr: exp.Expression) -> int:
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
    """
    Return counts of set operations. Older sqlglot versions don't expose exp.Minus;
    in those versions, MINUS is parsed as EXCEPT, so our 'except' count already includes MINUS.
    """
    union = sum(1 for u in expr.find_all(exp.Union) if u.args.get("distinct") is not False)
    union_all = sum(1 for u in expr.find_all(exp.Union) if u.args.get("distinct") is False)
    intersect = sum(1 for _ in expr.find_all(exp.Intersect))  # present in all versions
    except_ = sum(1 for _ in expr.find_all(exp.Except))       # includes MINUS on older versions

    # exp.Minus is available only on newer sqlglot builds; guard it.
    minus_cls = getattr(exp, "Minus", None)
    minus = sum(1 for _ in expr.find_all(minus_cls)) if minus_cls else 0
    
    # Fallback: If no explicit MINUS operations found but raw SQL contains MINUS keyword,
    # use regex detection as backup (for cases where SQLGlot fails to parse MINUS correctly)
    if minus == 0:
        import re
        sql_str = str(expr)
        # Look for MINUS not inside quotes/comments
        minus_matches = re.findall(r'\bMINUS\b', sql_str, re.IGNORECASE)
        minus = len(minus_matches)

    return {"union": union, "unionAll": union_all, "intersect": intersect, "except": except_, "minus": minus}



def cte_info(expr: exp.Expression) -> Tuple[int, bool]:
    w = expr.args.get("with")
    if not isinstance(w, exp.With):
        return 0, False
    return len(w.expressions), bool(w.args.get("recursive"))


def count_flatten_operations(expr: exp.Expression) -> int:
    """
    Count FLATTEN operations in the query.
    FLATTEN is a Denodo-specific function that converts arrays/complex types to rows.
    SQLGlot may parse it as a regular function call, so we look for function calls named 'FLATTEN'.
    """
    flatten_count = 0
    
    # Look for FLATTEN as a function call
    for func in expr.find_all(exp.Func):
        if hasattr(func, 'name') and func.name and func.name.upper() == 'FLATTEN':
            flatten_count += 1
    
    # Also check for FLATTEN in the raw SQL (fallback for parsing edge cases)
    # This is a simple regex-based detection as backup
    sql_str = str(expr).upper()
    import re
    flatten_matches = re.findall(r'\bFLATTEN\s*\(', sql_str)
    
    # Use the higher count (SQLGlot parsing vs regex detection)
    return max(flatten_count, len(flatten_matches))


def logic_cmp_counts(expr: exp.Expression) -> Tuple[int, int, int]:
    ands = sum(1 for _ in expr.find_all(exp.And))
    ors = sum(1 for _ in expr.find_all(exp.Or))
    cmps = sum(1 for _ in expr.find_all((exp.EQ, exp.NEQ, exp.GT, exp.GTE, exp.LT, exp.LTE, exp.Is)))
    return ands, ors, cmps


def count_windows(expr: exp.Expression) -> int:
    return sum(1 for _ in expr.find_all(exp.Window))


def count_analytic(expr: exp.Expression) -> int:
    n = 0
    for f in expr.find_all(exp.Func):
        name = (f.name or "").lower()
        if name in ANALYTIC_FN:
            n += 1
    return n


def count_aggs(expr: exp.Expression) -> int:
    return sum(1 for f in expr.find_all(exp.Func) if (f.name or "").lower() in AGG_FNS)


def count_cases(expr: exp.Expression) -> int:
    return sum(1 for _ in expr.find_all(exp.Case))


def categorize_denodo_functions(expr: exp.Expression) -> Dict[str, int]:
    """
    Count Denodo functions by category for more accurate complexity assessment.
    """
    category_counts = {category: 0 for category in DENODO_FUNCTIONS.keys()}
    unknown_funcs = 0
    
    for func in expr.find_all(exp.Func):
        func_name = (func.name or "").lower()
        if not func_name:
            continue
            
        categorized = False
        for category, functions in DENODO_FUNCTIONS.items():
            if func_name in functions:
                category_counts[category] += 1
                categorized = True
                break
        
        if not categorized:
            unknown_funcs += 1
    
    category_counts['unknown'] = unknown_funcs
    return category_counts


def calculate_denodo_function_score(function_counts: Dict[str, int]) -> float:
    """
    Calculate weighted score based on Denodo function categories.
    """
    score = 0.0
    for category, count in function_counts.items():
        if category in FUNCTION_WEIGHTS:
            weight = FUNCTION_WEIGHTS[category]
            # Apply diminishing returns for large counts
            if category in ['ai_llm', 'spatial']:
                # High complexity functions have strong impact
                score += min(count, 10) * weight
            elif category in ['data_processing', 'advanced_text', 'window']:
                # Medium complexity functions with moderate scaling
                score += min(count, 15) * weight
            else:
                # Basic functions with gentle scaling
                score += min(count, 25) * weight
        elif category == 'unknown':
            # Unknown functions get basic weight
            score += min(count, 20) * 0.3
    
    return score


def normalize_score_to_100(raw_score: float) -> int:
    """
    Normalize complexity score to 0-100 scale using logarithmic mapping.
    """
    if raw_score <= 0:
        return 0
    
    # Use logarithmic scaling to handle wide score ranges
    # Formula: min(100, 10 * log10(score + 1) * scaling_factor)
    normalized = min(100, int(10 * math.log10(raw_score + 1) * 3.5))
    return max(0, normalized)


def get_complexity_tier(normalized_score: int) -> str:
    """
    Determine complexity tier based on normalized 0-100 score.
    """
    if normalized_score <= 25:
        return "low"
    elif normalized_score <= 50:
        return "medium" 
    elif normalized_score <= 75:
        return "high"
    else:
        return "veryHigh"


def count_funcs(expr: exp.Expression) -> int:
    """Count actual function calls, excluding internal parsing artifacts."""
    func_count = 0
    for func in expr.find_all(exp.Func):
        # Skip internal parsing artifacts (CASE expressions, etc.)
        if isinstance(func, (exp.If, exp.Case)):
            continue
        
        # Apply same filtering logic as get_function_names
        name = None
        class_name = func.__class__.__name__.lower()
        
        # Handle specific SQLGlot expression types that represent functions
        if class_name in ['concat', 'upper', 'lower', 'substring', 'trim', 'replace',
                        'count', 'sum', 'max', 'min', 'avg', 'coalesce', 'cast',
                        'currentdate', 'currenttimestamp', 'extract']:
            if class_name == 'currentdate':
                name = 'current_date'
            elif class_name == 'currenttimestamp':
                name = 'current_timestamp'
            else:
                name = class_name
        elif hasattr(func, 'name') and func.name:
            name = func.name.lower()
            # Skip numeric literals that might be incorrectly parsed as function names
            if name.isdigit() or name.replace('.', '').replace('-', '').isdigit():
                continue
        
        # Only count valid function names
        if name and len(name) > 1 and name not in ('and', 'or', 'not', 'in', 'is', 'as', 'case', 'if'):
            func_count += 1
    
    return func_count


def get_table_names(expr: exp.Expression) -> list:
    """Get actual table names referenced with occurrence counts"""
    table_counts = {}
    
    for table in expr.find_all(exp.Table):
        name = None
        if hasattr(table, 'name') and table.name:
            name = table.name
        elif hasattr(table, 'this') and table.this:
            name = str(table.this)
        
        if name:
            # Clean up the name (remove quotes, etc.)
            name = name.strip('\"\'`')
            if name:
                table_counts[name] = table_counts.get(name, 0) + 1
    
    # Return sorted list of "table_name (count)" strings
    table_list = []
    for table_name in sorted(table_counts.keys()):
        count = table_counts[table_name]
        table_list.append(f"{table_name} ({count})")
    
    return table_list


def get_function_names(expr: exp.Expression) -> list:
    """Get actual function names called in the query with occurrence counts"""
    function_counts = {}
    
    # Get function names from exp.Func objects
    for func in expr.find_all(exp.Func):
        name = None
        
        # Get function name based on SQLGlot expression class type first (more reliable)
        class_name = func.__class__.__name__.lower()
        
        # Handle specific SQLGlot expression types that represent functions
        if class_name in ['concat', 'upper', 'lower', 'substring', 'trim', 'replace',
                        'count', 'sum', 'max', 'min', 'avg', 'coalesce', 'cast',
                        'currentdate', 'currenttimestamp', 'extract']:
            # Handle special cases for class name to function name mapping
            if class_name == 'currentdate':
                name = 'current_date'
            elif class_name == 'currenttimestamp':
                name = 'current_timestamp'
            else:
                name = class_name
        # If not a known expression type, try to get name from .name attribute
        elif hasattr(func, 'name') and func.name:
            name = func.name.lower()
            # Skip numeric literals that might be incorrectly parsed as function names
            if name.isdigit() or name.replace('.', '').replace('-', '').isdigit():
                continue
        
        # Count valid function names, skip operators and keywords
        if name and len(name) > 1 and name not in ('and', 'or', 'not', 'in', 'is', 'as', 'case', 'if'):
            function_counts[name] = function_counts.get(name, 0) + 1
    
    # Return sorted list of "function_name (count)" strings
    function_list = []
    for func_name in sorted(function_counts.keys()):
        count = function_counts[func_name]
        function_list.append(f"{func_name} ({count})")
    
    return function_list


def get_window_function_names(expr: exp.Expression) -> list:
    """Get actual window function names with occurrence counts"""
    window_function_counts = {}
    for window in expr.find_all(exp.Window):
        if hasattr(window, 'this') and hasattr(window.this, 'name'):
            name = window.this.name.lower()
            if name:
                window_function_counts[name] = window_function_counts.get(name, 0) + 1
    
    # Return sorted list of "function_name (count)" strings
    window_list = []
    for func_name in sorted(window_function_counts.keys()):
        count = window_function_counts[func_name]
        window_list.append(f"{func_name} ({count})")
    
    return window_list


def get_analytic_function_names(expr: exp.Expression) -> list:
    """Get analytic function names with occurrence counts"""
    analytic_function_counts = {}
    for func in expr.find_all(exp.Func):
        name = (func.name or "").lower()
        if name in ANALYTIC_FN:
            analytic_function_counts[name] = analytic_function_counts.get(name, 0) + 1
    
    # Return sorted list of "function_name (count)" strings
    analytic_list = []
    for func_name in sorted(analytic_function_counts.keys()):
        count = analytic_function_counts[func_name]
        analytic_list.append(f"{func_name} ({count})")
    
    return analytic_list


def get_agg_function_names(expr: exp.Expression) -> list:
    """Get aggregate function names with occurrence counts"""
    agg_function_counts = {}
    for func in expr.find_all(exp.Func):
        name = (func.name or "").lower()
        if name in AGG_FNS:
            agg_function_counts[name] = agg_function_counts.get(name, 0) + 1
    
    # Return sorted list of "function_name (count)" strings
    agg_list = []
    for func_name in sorted(agg_function_counts.keys()):
        count = agg_function_counts[func_name]
        agg_list.append(f"{func_name} ({count})")
    
    return agg_list


def analyze_select_complexity(sql: str, dialect: str = "ansi") -> dict:
    #tree = parse_one(sql, read=dialect, error_level="ignore")
    tree = safe_parse_one(sql, dialect)
    joins = list(tree.find_all(exp.Join))
    joins_by: Dict[str, int] = {}
    for j in joins:
        k = join_kind(j)
        joins_by[k] = joins_by.get(k, 0) + 1
    joins_total = len(joins)

    tables = count_tables(tree)
    scalar_subq = count_scalar_subqueries(tree)
    depth = max_select_depth(tree)

    sops = set_ops(tree)
    cte_count, cte_recursive = cte_info(tree)
    flatten_ops = count_flatten_operations(tree)

    sel = next(tree.find_all(exp.Select), None)
    has_distinct = bool(sel and sel.args.get("distinct"))
    group_by = bool(sel and sel.args.get("group"))
    having = bool(sel and sel.args.get("having"))

    windows = count_windows(tree)
    analytic = count_analytic(tree)
    aggs = count_aggs(tree)
    cases = count_cases(tree)
    funcs = count_funcs(tree)  # Legacy total count
    ands, ors, cmps = logic_cmp_counts(tree)

    # NEW: Denodo-specific function categorization
    denodo_func_counts = categorize_denodo_functions(tree)
    denodo_func_score = calculate_denodo_function_score(denodo_func_counts)

    # Enhanced scoring with Denodo function awareness
    score = 0.0
    score += joins_total * 3.0
    score += max(0, tables - 2) * 1.0
    score += cte_count * 2.0 + (6.0 if cte_recursive else 0.0)
    score += sops["union"] * 3.0 + sops["unionAll"] * 2.0 + sops["intersect"] * 4.0 + sops["except"] * 4.0 + sops["minus"] * 4.0
    score += flatten_ops * 5.0  # FLATTEN operations are complex as they modify data structure
    score += depth * 4.0 + scalar_subq * 3.0
    score += (2.0 if has_distinct else 0.0) + (2.0 if group_by else 0.0) + (3.0 if having else 0.0)
    score += min(cases, 5) * 1.5
    score += (ands + ors) * 0.4 + cmps * 0.2
    
    # Replace generic function scoring with Denodo-specific weighted scoring
    score += denodo_func_score

    # Normalize score to 0-100 scale
    normalized_score = normalize_score_to_100(score)
    tier = get_complexity_tier(normalized_score)

    # Extract detailed data arrays for UI
    table_names = get_table_names(tree)
    function_names = get_function_names(tree)
    window_function_names = get_window_function_names(tree)
    analytic_function_names = get_analytic_function_names(tree)
    agg_function_names = get_agg_function_names(tree)

    return {
        "joinsTotal": joins_total,
        "joinsByType": joins_by,
        "tables": tables,
        "ctes": cte_count,
        "recursiveCte": cte_recursive,
        "setOps": sops,
        "flattenOps": flatten_ops,
        "subqueryDepth": depth,
        "scalarSubqueries": scalar_subq,
        "hasDistinct": has_distinct,
        "groupBy": group_by,
        "having": having,
        "windows": windows,
        "analyticFns": analytic,
        "aggFns": aggs,
        "caseExprs": cases,
        "fnCalls": funcs,  # Legacy total function count
        "andCount": ands,
        "orCount": ors,
        "cmpCount": cmps,
        # NEW: Denodo-specific function analysis
        "denodoFunctions": denodo_func_counts,
        "denodoFunctionScore": round(float(denodo_func_score), 1),
        # NEW: Normalized scoring
        "rawScore": round(float(score), 1),
        "score": normalized_score,  # 0-100 normalized score
        "tier": tier,
        # NEW: Detailed arrays for UI
        "tableNames": table_names,
        "functionNames": function_names,
        "windowFunctionNames": window_function_names,
        "analyticFunctionNames": analytic_function_names,
        "aggFunctionNames": agg_function_names,
    }


# ----------------------------
# Main
# ----------------------------
def main():
    ap = argparse.ArgumentParser(description="Compute complexity for CREATE VIEW statements inside a VQL file (SQLGlot-based).")
    ap.add_argument("--vql", required=True, help="Path to .vql export")
    ap.add_argument("--dialect", default="ansi", help="SQLGlot dialect (ansi|postgres|trino|...); default=ansi")
    ap.add_argument("--out", help="Optional CSV output file")
    ap.add_argument("--top", type=int, default=10, help="Show top-N by score in console (default 10)")
    ap.add_argument("--pretty", action="store_true", help="Print a compact summary after processing")
    args = ap.parse_args()

    vql_path = args.vql
    if not os.path.isfile(vql_path):
        raise SystemExit(f"File not found: {vql_path}")

    current_db = "(none)"
    view_rows: List[Dict[str, object]] = []

    # Precompiled patterns
    RE_CREATE_DB = re.compile(r"^\s*CREATE\s+OR\s+REPLACE\s+DATABASE\s+", re.I | re.S)
    RE_USE_DB = re.compile(r"^\s*(?:USE|SET|CONNECT)\s+DATABASE\s+", re.I | re.S)
    RE_CREATE_VIEW = re.compile(r"^\s*CREATE\s+OR\s+REPLACE\s+(?:INTERFACE\s+)?VIEW\s+", re.I | re.S)

    for stmt in split_vql_statements(vql_path):
        s = strip_leading_comments(stmt).strip()
        if not s:
            continue

        # DB context
        if RE_CREATE_DB.search(s):
            name = parse_identifier_after(RE_CREATE_DB, s) or current_db
            current_db = name
            continue
        if RE_USE_DB.search(s):
            name = parse_identifier_after(RE_USE_DB, s) or current_db
            current_db = name
            continue

        # Views
        if RE_CREATE_VIEW.search(s):
            # parse view name (after CREATE ... VIEW)
            name = parse_identifier_after(RE_CREATE_VIEW, s) or ""
            # select body
            body = extract_select_body_from_create_view(s)
            if not body or "select" not in body.lower():
                # interface view with implementation only, or placeholder
                view_rows.append({
                    "database": current_db,
                    "name": name,
                    "kind": "interface view" if "INTERFACE VIEW" in s.upper() else "view",
                    "score": "",
                    "tier": "n/a",
                    "joinsTotal": "",
                    "tables": "",
                    "subqueryDepth": "",
                })
                continue

            metrics = analyze_select_complexity(body, dialect=args.dialect)
            row = {
                "database": current_db,
                "name": name,
                "kind": "interface view" if "INTERFACE VIEW" in s.upper() else "view",
                **metrics,
            }
            view_rows.append(row)

    # Summary
    analyzed = [r for r in view_rows if isinstance(r.get("score"), (int, float))]
    na = [r for r in view_rows if r.get("tier") == "n/a"]
    by_tier = {"low": 0, "medium": 0, "high": 0, "veryHigh": 0, "n/a": len(na)}
    for r in analyzed:
        by_tier[r["tier"]] = by_tier.get(r["tier"], 0) + 1

    print("\n=== Complexity summary ===")
    total = len(view_rows)
    print(f"Views discovered: {total}")
    print(f"Analyzed (with SQL): {len(analyzed)}")
    print(f"Tier counts: {json.dumps(by_tier, indent=2)}")

    # Top-N
    topn = sorted(analyzed, key=lambda r: r["score"], reverse=True)[: max(args.top, 0)]
    if topn:
        print(f"\n=== Top {len(topn)} by score ===")
        print(f"{'DB':20} {'View Name':50} {'Score':>6} {'Tier':>9}  {'Joins':>5} {'Tables':>6} {'Depth':>5} {'SetOps':>6}")
        for r in topn:
            so = r["setOps"]
            set_ops_count = sum(int(v) for v in so.values()) if isinstance(so, dict) else 0
            print(f"{str(r['database'])[:20]:20} {str(r['name'])[:50]:50} {r['score']:>6} {r['tier']:>9}  {r['joinsTotal']:>5} {r['tables']:>6} {r['subqueryDepth']:>5} {set_ops_count:>6}")

    # CSV
    if args.out:
        fieldnames = [
            "database","name","kind","score","tier","rawScore","joinsTotal","tables",
            "ctes","recursiveCte","setOps","subqueryDepth","scalarSubqueries",
            "hasDistinct","groupBy","having","windows","analyticFns","aggFns",
            "caseExprs","fnCalls","andCount","orCount","cmpCount","joinsByType",
            "denodoFunctions","denodoFunctionScore"
        ]
        with open(args.out, "w", newline="", encoding="utf-8") as fh:
            wr = csv.DictWriter(fh, fieldnames=fieldnames)
            wr.writeheader()
            for r in view_rows:
                wr.writerow({k: r.get(k, "") for k in fieldnames})
        print(f"\nCSV written: {os.path.abspath(args.out)}\n")

    if args.pretty:
        print("\nTip: tweak --dialect if your SQL style is closer to Postgres/Trino/etc.")
        print("     You can also adjust metric weights in analyze_select_complexity().")


if __name__ == "__main__":
    main()
