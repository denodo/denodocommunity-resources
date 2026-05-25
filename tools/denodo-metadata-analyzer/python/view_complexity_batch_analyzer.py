#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
View Complexity Batch Analyzer
- Takes JSON input with extracted view SQL statements from metadata analyzer
- Uses SQLGlot to analyze complexity for each view 
- Outputs results as JSON and CSV for UI integration

Usage:
  python3 view_complexity_batch_analyzer.py --input views_data.json --output results
"""

import argparse
import csv
import json
import os
import sys
from typing import Dict, List
from datetime import datetime

# Import the enhanced VQL complexity analysis functions 
from vql_view_complexity import analyze_select_complexity, extract_select_body_from_create_view

def load_views_data(input_file: str) -> List[Dict]:
    """Load views data from JSON file"""
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        print(f"📁 Loaded {len(data)} views from {input_file}")
        return data
    except FileNotFoundError:
        raise SystemExit(f"❌ Input file not found: {input_file}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"❌ Invalid JSON in input file: {e}")

def extract_sql_from_view_data(view_data: Dict) -> str:
    """Extract SQL statement from view data"""
    # Try different possible fields for the full view definition
    full_statement = (
        view_data.get('fullDefinition') or 
        view_data.get('fullStatement') or 
        view_data.get('statement') or
        view_data.get('definition') or
        view_data.get('selectBody')  # If SQL already extracted
    )
    
    if not full_statement:
        return None
        
    # If it's already just the SELECT body, return it
    if full_statement.strip().upper().startswith('SELECT'):
        return full_statement
        
    # Otherwise, extract SELECT body from CREATE VIEW statement
    return extract_select_body_from_create_view(full_statement)

def analyze_view_batch(views_data: List[Dict], dialect: str = "ansi") -> List[Dict]:
    """
    Analyze complexity for a batch of views
    """
    results = []
    processed = 0
    skipped = 0
    errors = 0
    
    print(f"🔄 Starting complexity analysis for {len(views_data)} views...")
    
    for i, view in enumerate(views_data):
        view_name = view.get('name', f'view_{i}')
        database = view.get('database', 'unknown')
        kind = view.get('kind', 'view')
        
        try:
            # Extract SQL statement
            sql_statement = extract_sql_from_view_data(view)
            
            if not sql_statement:
                results.append({
                    'database': database,
                    'name': view_name,
                    'kind': kind,
                    'score': None,
                    'tier': 'n/a',
                    'error': 'No SELECT statement found',
                    'analyzed': False
                })
                skipped += 1
                continue
            
            # Analyze complexity using enhanced Denodo-aware analyzer
            complexity = analyze_select_complexity(sql_statement, dialect)
            
            # Check if analysis succeeded
            if 'error' in complexity:
                results.append({
                    'database': database,
                    'name': view_name, 
                    'kind': kind,
                    'score': None,
                    'tier': 'error',
                    'error': complexity['error'],
                    'analyzed': False
                })
                errors += 1
            else:
                results.append({
                    'database': database,
                    'name': view_name,
                    'kind': kind,
                    'analyzed': True,
                    'sqlLength': len(sql_statement),
                    **complexity  # Include all complexity metrics
                })
                processed += 1
                
        except Exception as e:
            results.append({
                'database': database,
                'name': view_name,
                'kind': kind,
                'score': None,
                'tier': 'error', 
                'error': f'Analysis exception: {str(e)}',
                'analyzed': False
            })
            errors += 1
        
        # Production-ready progress indicator
        if (i + 1) % 500 == 0 or i + 1 == len(views_data):
            print(f"📊 Progress: {i + 1}/{len(views_data)} views processed")
    
    print(f"✅ Analysis completed: {processed} successful, {skipped} skipped, {errors} errors")
    
    return results

def save_results(results: List[Dict], output_prefix: str):
    """Save results as both JSON and CSV"""
    
    # Sort by score (highest first), handling None values
    def sort_key(item):
        score = item.get('score')
        return score if score is not None else -1
    
    sorted_results = sorted(results, key=sort_key, reverse=True)
    
    # Save as JSON
    json_file = f"{output_prefix}.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump({
            'metadata': {
                'generated': datetime.now().isoformat(),
                'total_views': len(results),
                'analyzed_successfully': len([r for r in results if r.get('analyzed', False)]),
                'top_score': sorted_results[0].get('score') if sorted_results and sorted_results[0].get('score') else None
            },
            'results': sorted_results
        }, f, indent=2)
    
    # Save as CSV
    csv_file = f"{output_prefix}.csv"
    if sorted_results:
        fieldnames = [
            'database', 'name', 'kind', 'score', 'tier', 'analyzed',
            'joinsTotal', 'tables', 'ctes', 'recursiveCte', 'subqueryDepth', 
            'scalarSubqueries', 'hasDistinct', 'groupBy', 'having',
            'windows', 'analyticFns', 'aggFns', 'caseExprs', 'fnCalls',
            'andCount', 'orCount', 'cmpCount', 'sqlLength', 'error'
        ]
        
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            
            for result in sorted_results:
                # Flatten setOps dict for CSV
                row = result.copy()
                if 'setOps' in row and isinstance(row['setOps'], dict):
                    set_ops = row.pop('setOps')
                    row['setOps_total'] = sum(set_ops.values()) if set_ops else 0
                
                # Flatten joinsByType dict for CSV  
                if 'joinsByType' in row and isinstance(row['joinsByType'], dict):
                    joins_by_type = row.pop('joinsByType')
                    row['joinsByType_detail'] = str(joins_by_type) if joins_by_type else ''
                
                writer.writerow(row)
    
    print(f"💾 Results saved:")
    print(f"  📄 JSON: {os.path.abspath(json_file)}")
    print(f"  📊 CSV: {os.path.abspath(csv_file)}")
    
    # Show top 5 most complex views
    analyzed_results = [r for r in sorted_results if r.get('analyzed', False)]
    if analyzed_results:
        print(f"\n🏆 Top 5 Most Complex Views:")
        for i, result in enumerate(analyzed_results[:5], 1):
            print(f"  {i}. {result['database']}.{result['name']} - Score: {result['score']} ({result['tier']})")

def main():
    parser = argparse.ArgumentParser(description="Analyze view complexity from extracted SQL statements")
    parser.add_argument("--input", required=True, help="Input JSON file with views data")
    parser.add_argument("--output", default="view_complexity_results", help="Output file prefix (default: view_complexity_results)")
    parser.add_argument("--dialect", default="ansi", help="SQL dialect for analysis (default: ansi)")
    
    args = parser.parse_args()
    
    # Load views data
    views_data = load_views_data(args.input)
    
    if not views_data:
        print("❌ No views data found in input file")
        return 1
    
    # Analyze complexity
    results = analyze_view_batch(views_data, args.dialect)
    
    # Save results
    save_results(results, args.output)
    
    print(f"\n🎉 Batch analysis complete! Use the JSON file for UI integration and CSV for detailed analysis.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())