import sys
import argparse
import multiprocessing as mp
import pandas as pd
from tqdm import tqdm
from func_timeout import func_timeout, FunctionTimedOut
from db_utils import execute_vql, add_query_execution_data
import logging
import numpy as np
from  collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed # Added import


logger = logging.getLogger(__name__)

def normalize_value(val):
    """Normalize values for consistent comparison"""
    # Handle NaN values
    if pd.isna(val):
        return "NA"
    
    if isinstance(val, (int, float)):
        # Convert 1.0 to 1 for better comparison
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
    
    # Default string conversion
    return str(val)

def calculate_row_match(predicted_row, ground_truth_row):
    """
    Calculate the matching percentage for a single row, and return the list of matches.

    Args:
    predicted_row (tuple): The predicted row values.
    ground_truth_row (tuple): The actual row values from ground truth.

    Returns:
    tuple: (match_percentage, pred_only_percentage, truth_only_percentage, matches_list)
    """
    total_columns = len(ground_truth_row)
    matches = 0
    element_in_pred_only = 0
    element_in_truth_only = 0
    matches_list = []
    for pred_val in predicted_row:
        if pred_val in ground_truth_row:
            matches += 1
            matches_list.append(pred_val)
        else:
            element_in_pred_only += 1
    for truth_val in ground_truth_row:
        if truth_val not in predicted_row:
            element_in_truth_only += 1

    match_percentage = matches / total_columns
    pred_only_percentage = element_in_pred_only / total_columns
    truth_only_percentage = element_in_truth_only / total_columns
    matches_list.append(match_percentage)
   
    return match_percentage, pred_only_percentage, truth_only_percentage, matches_list


def f1_score(predicted_res, ground_truth_res):
    """
    Compute an F1 score adapted for your data and return match details.

    Returns:
    - f1_score: float
    - precision: float
    - set_precision: float
    - all_matches: list of lists (matched values per row)
    - all_set_matches: list of lists (set intersection per row)
    """

    if predicted_res is None:
        predicted_res = []
    if ground_truth_res is None:
        ground_truth_res = []
    if isinstance(predicted_res, pd.DataFrame):
        predicted_res = predicted_res.astype(str)
        pred_as_tuples = list(predicted_res.itertuples(index=False, name=None))
    else:
        pred_as_tuples = predicted_res
    if isinstance(ground_truth_res, pd.DataFrame):
        ground_truth_res = ground_truth_res.astype(str)
        gt_as_tuples = list(ground_truth_res.itertuples(index=False, name=None))
    else:
        gt_as_tuples = ground_truth_res

    predicted = list(dict.fromkeys(pred_as_tuples))
    ground_truth = list(dict.fromkeys(gt_as_tuples))
    match_scores = []
    pred_only_scores = []
    truth_only_scores = []
    all_matches = []
    all_set_matches = []

    for i, gt_row in enumerate(ground_truth):
        if i >= len(predicted):
            match_scores.append(0)
            pred_only_scores.append(0)
            truth_only_scores.append(1)
            all_matches.append([])
            all_set_matches.append([])
            continue

        pred_row = predicted[i]
        match_score, pred_only_score, truth_only_score, matches_list = calculate_row_match(
            pred_row, gt_row
        )
        match_scores.append(match_score)
        pred_only_scores.append(pred_only_score)
        truth_only_scores.append(truth_only_score)
        all_matches.append(matches_list)
        all_set_matches.append(list(set(gt_row) & set(pred_row)))

    for i in range(len(predicted) - len(ground_truth)):
        match_scores.append(0)
        pred_only_scores.append(1)
        truth_only_scores.append(0)
        all_matches.append([])
        all_set_matches.append([])

    tp = sum(match_scores)
    fp = sum(pred_only_scores)
    fn = sum(truth_only_scores)
    precision = tp / (tp + fp) if tp + fp > 0 else 0
    recall = tp / (tp + fn) if tp + fn > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0
    row_scores = []
    for gt_row, pred_row in zip(ground_truth, predicted):
        correct = len(set(gt_row) & set(pred_row))
        score = correct / len(gt_row) if len(gt_row) > 0 else 0
        row_scores.append(score)
    ground_truth_len = len(ground_truth_res) if not isinstance(ground_truth_res, pd.DataFrame) else len(ground_truth_res.index)
    set_precision = sum(row_scores) / ground_truth_len if ground_truth_len > 0 else 0

    return f1, precision*100, set_precision *100, all_matches, all_set_matches


def percent_overlapp(ground_truth_res, predicted_res):

    if predicted_res is None:
        predicted_res = pd.DataFrame()
    if ground_truth_res is None:
        ground_truth_res = pd.DataFrame()

    gt_flat = ground_truth_res.values.flatten()
    pred_flat = predicted_res.values.flatten()
    pred_elements = pred_flat[~pd.isna(pred_flat)]
    gt_elements = gt_flat[~pd.isna(gt_flat)]
    gt_counts = Counter(gt_elements)
    pred_counts = Counter(pred_elements)
    total_gt_elements = len(gt_elements)
    if total_gt_elements == 0:
        return 0.0
    total_matches = 0
    all_unique_elements = gt_counts.keys() | pred_counts.keys()

    for element in all_unique_elements:
        match_count = min(gt_counts[element], pred_counts[element])
        total_matches += match_count
    percent_overlap = total_matches / total_gt_elements

    return percent_overlap*100


def execute_model(predicted_vql, ground_truth_vql, db_params, idx, meta_time_out):
    """
    Execute both queries and calculate F1 score.
    
    Args:
    predicted_vql: Predicted SQL query
    ground_truth_vql: Ground truth SQL query
    db_params: Database connection parameters
    idx: Index for tracking
    meta_time_out: Timeout value in seconds
    
    Returns:
    dict: Result with SQL index, F1 score and additional metrics
    """
    result = {"sql_idx": idx, "res": 0.0, 'percent_match': 0.0, 'original_f1': 0.0}
    
    try:
        logger.info(f"Executing model for index {idx}")
        # Execute predicted query
        # Ensure VQL is a string, even if it was NaN (becomes "nan" or empty if pre-cleaned)
        str_predicted_vql = str(predicted_vql)
        predicted_res, test_exec_time = func_timeout(
            meta_time_out,
            execute_vql,
            args=(str_predicted_vql, True),  
        )
        test_row_counts = len(predicted_res) if predicted_res is not None else 0
        test_column_counts = len(predicted_res.columns) if predicted_res is not None else 0

        # Ensure VQL is a string
        str_ground_truth_vql = str(ground_truth_vql)
        ground_truth_res, truth_exec_time = func_timeout(
            meta_time_out,
            execute_vql,
            args=(str_ground_truth_vql, True),  
        )
        truth_row_counts = len(ground_truth_res) if ground_truth_res is not None else 0
        truth_column_counts = len(ground_truth_res.columns) if ground_truth_res is not None else 0
        # Compute enhanced F1 score with the new function - corrected argument order
        f1_val, percent_match, set_precision, all_matches, all_set_matches = f1_score(predicted_res, ground_truth_res)
        
        # Also compute original F1 score
        precision = percent_overlapp(ground_truth_res, predicted_res)  
        logger.info(f"F1 score for index {idx}: {f1_val}, original F1:, match: {percent_match}%")
        
        # Update result with metrics including the new match details
        result = {
            "sql_idx": idx, 
            "res": f1_val, 
            'percent_match': percent_match,
            'precision': precision,
            'set_precision': set_precision,
            'all_matches': all_matches,
            'all_set_matches': all_set_matches,
            'test_exec_time': test_exec_time,
            'test_row_counts': test_row_counts,
            'test_column_counts': test_column_counts,
            'truth_exec_time': truth_exec_time,
            'truth_row_counts': truth_row_counts,
            'truth_column_counts': truth_column_counts,
        }

    except KeyboardInterrupt:
        sys.exit(0)
    except FunctionTimedOut:
        # If timed out, we set F1=0
        logger.error(f"Function timed out for index {idx}")
   
    except Exception as e:
        # On error, set F1=0
       
        logger.error(f"Error executing model for index {idx}: {e}")

    return result

exec_result = []

def result_callback(result):
    """
    Called when a worker finishes. 
    Result is the dict with {"sql_idx": i, "res": f1_val}
    """
    exec_result.append(result)


def run_sqls_parallel(vql_pairs, db_params_list, num_cpus=6, meta_time_out=30.0):
    """
    vql_pairs: list of (predicted_vql, ground_truth_vql)
    db_params_list: if each query has different credentials, pass them in a parallel list
                    or reuse the same DB params if identical. 
    """
    
    collected_results = [] # Local list to store results from futures

    with ThreadPoolExecutor(max_workers=num_cpus) as executor:
        future_to_idx = {}
        for i, (predicted_vql, ground_truth_vql) in enumerate(vql_pairs):
            
            future = executor.submit(
                execute_model,
                predicted_vql, 
                ground_truth_vql, 
                db_params_list,
                i, 
                meta_time_out
            )
            future_to_idx[future] = i
        
        with tqdm(total=len(vql_pairs), desc='Calculating F1 Scores') as pbar:
            for future in as_completed(future_to_idx):
                original_idx = future_to_idx[future]
                try:
                    result = future.result()
                    collected_results.append(result)
                except Exception as exc:
                    logger.error(f"Query at original index {original_idx} generated an exception: {exc}")
                    pass 
                finally:
                    pbar.update(1)
    
    # Sort results by the original SQL index to maintain order
    collected_results.sort(key=lambda x: x.get("sql_idx", -1))
    
    return collected_results


def compute_f1_by_group(exec_results, group_column):
    """
    Computes F1 scores and percent match by grouping results based on difficulty categories.
    """
    num_queries = len(exec_results)
    if num_queries == 0:
        return {
            'group_scores': {},
            'group_counts': {},
            'all_f1': 0.0,
            'total_count': 0,
            'group_percent_match': {},
            'all_percent_match': 0.0
        }
    
    f1_key = 'res'
    percent_match_key = 'percent_match'  
    # Predefined categories
    categories = ["simple", "moderate", "challenging"]
   
    grouped_results = {category: [] for category in categories}
    # Group results by difficulty
    for result in exec_results:
        if group_column in result:
           
            difficulty = result[group_column].lower() if isinstance(result[group_column], str) else str(result[group_column]).lower()
            if difficulty in categories:
                grouped_results[difficulty].append(result)
    
    # Calculate scores and counts for each category
    group_scores = {}
    group_counts = {}
    group_percent_match = {}
    
    for category, results in grouped_results.items():
        if results:  
            # Calculate average F1 score for this category
            category_f1 = sum(res.get(f1_key, 0) for res in results) / len(results) * 100
            group_scores[category] = category_f1
            group_counts[category] = len(results)
            
            # Calculate average percent match for this category
            category_percent = sum(res.get(percent_match_key, 0) for res in results) / len(results)
            group_percent_match[category] = category_percent
    
    # Calculate overall F1
    all_f1 = sum(res.get(f1_key, 0) for res in exec_results) / num_queries * 100
    
    # Calculate overall percent match
    all_percent_match = sum(res.get(percent_match_key, 0) for res in exec_results) / num_queries
    
    return {
        'group_scores': group_scores,
        'group_counts': group_counts,
        'all_f1': all_f1,
        'total_count': num_queries,
        'group_percent_match': group_percent_match,
        'all_percent_match': all_percent_match
    }

def compute_time_stats_by_group(exec_results, group_column, time_column='total_execution_time'):
    """
    Computes statistical measures (variance, std, mean, and median) for execution time
    by grouping results based on difficulty categories.
    
    Args:
        exec_results (list): List of result dictionaries
        group_column (str): Column name to group by (typically 'Difficulty')
        time_column (str): Column name for the time metric (default: 'total_execution_time')
        
    Returns:
        dict: Dictionary with statistics for each difficulty group
    """
    import numpy as np
    
    # Check if we have any results
    num_queries = len(exec_results)
   
    if num_queries == 0:
        return {
            'time_mean': {},
            'time_median': {},
            'time_variance': {},
            'time_std': {},
            'all_time_mean': 0.0,
            'all_time_median': 0.0,
            'all_time_variance': 0.0,
            'all_time_std': 0.0
        }
    
    # Predefined categories
   
    categories = ["simple", "moderate", "challenging"]
    grouped_results = {category: [] for category in categories}
    
    # Group results by difficulty
    for result in exec_results:
        if group_column in result:
            difficulty = result[group_column].lower() if isinstance(result[group_column], str) else str(result[group_column]).lower()
            if difficulty in categories:
                # Get execution time (default to 0 if not available)
                exec_time = result.get(time_column, 0)
                if pd.isna(exec_time):
                    exec_time = 0
                result[time_column] = exec_time
                grouped_results[difficulty].append(result)
    
    # Calculate time statistics for each category
    time_mean = {}
    time_median = {}
    time_variance = {}
    time_std = {}
    
    # Collect all execution times for overall statistics
    all_times = []
    
    for category, results in grouped_results.items():
        if results:
            # Extract execution times for this category
           
            times = [res.get(time_column, 0) for res in results]
            all_times.extend(times)
            
            # Calculate statistics
            time_mean[category] = np.mean(times)
            time_median[category] = np.median(times)
            time_variance[category] = np.var(times)
            time_std[category] = np.std(times)
    
    # Calculate overall statistics
    all_time_mean = np.mean(all_times) if all_times else 0
    all_time_median = np.median(all_times) if all_times else 0
    all_time_variance = np.var(all_times) if all_times else 0
    all_time_std = np.std(all_times) if all_times else 0
    
    return {
        'time_mean': time_mean,
        'time_median': time_median,
        'time_variance': time_variance,
        'time_std': time_std,
        'all_time_mean': all_time_mean,
        'all_time_median': all_time_median,
        'all_time_variance': all_time_variance,
        'all_time_std': all_time_std
    }      
        

def main(args=None):
    if args is None: 
        parser = argparse.ArgumentParser(description='Calculate F1 scores for VQL queries.')
        parser.add_argument('--input', '-i', required=True, help='Input Excel file with VQL queries')
        parser.add_argument('--output', '-o', default=None, help='Output Excel file (default: results.xlsx)')
        parser.add_argument('--num-cpus', '-n', type=int, default=2, help='Number of CPUs for parallel processing')
        parser.add_argument('--timeout', '-t', type=float, default=30.0, help='Query execution timeout (seconds)')
        parser.add_argument('--user', type=str, default="username", required=False, help='Database user for Denodo')
        parser.add_argument('--password', type=str, default="password", required=False, help='Database password for Denodo')
        parser.add_argument('--host', type=str, default="localhost", help='Database host for Denodo')
        parser.add_argument('--port', type=int, default=9090, help='Database port for Denodo')
        parser.add_argument('--db-config', '-d', default=None, help='Database configuration JSON file (alternative to individual parameters)')
        parser.add_argument('--ground-truth-col', '-g', default='ground_truth_vql', help='Column name containing ground truth VQL (default: ground_truth_vql)')
        parser.add_argument('--generated-col', '-p', default='generated_vql', help='Column name containing generated VQL (default: generated_vql)')
        parser.add_argument('--difficulty-col', '-c', default='difficulty',help='Column name containing difficulty level (default: difficulty)')
        
        args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Read input Excel file
   
    try:
        df = pd.read_excel(args.input)
        logger.info(f"Read {len(df)} rows from {args.input}")
    except Exception as e:
        logger.error(f"Error reading input file: {e}")
        sys.exit(1)
    
    # Check for required columns using specified column names
    required_cols = [args.ground_truth_col, args.generated_col, args.difficulty_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        logger.error(f"Missing required columns: {', '.join(missing_cols)}")
        sys.exit(1)
    
    # Extract VQL pairs and difficulties using specified column names
    vql_pairs = list(zip(df[args.generated_col], df[args.ground_truth_col]))
    difficulties = df[args.difficulty_col].tolist()

    if 'index' in df.columns:
        original_indexes = df['index'].tolist()
    else:
        # If there's no explicit index column, use the DataFrame index
        original_indexes = df.index.tolist()

        # Use individual connection parameters
    db_params = {
        "user": args.user,
        "password": args.password,
        "host": args.host,
        "port": args.port,
    }
    df = add_query_execution_data(df, db_params, args.ground_truth_col, args.generated_col)

    db_params_list = [db_params] * len(vql_pairs)
    
    # Run F1 score calculation
    logger.info(f"Calculating F1 scores for {len(vql_pairs)} query pairs...")
    results = run_sqls_parallel(vql_pairs, db_params_list, args.num_cpus, args.timeout)
    results = sorted(results, key=lambda x: x["sql_idx"])
    # Add difficulty to results
    for result in results:
        idx = result['sql_idx']
        if idx < len(difficulties):
            result['Difficulty'] = difficulties[idx]
            if idx < len(original_indexes):
                result['Question ID'] = original_indexes[idx]
    
    # Create DataFrame with individual results and clean up data types
    individual_df = pd.DataFrame(results)
    
    if 'res' in individual_df.columns:
        individual_df.rename(columns={'res': 'f1score'}, inplace=True)
    
    for idx, result in enumerate(results):
        sql_idx = result['sql_idx']
        if sql_idx < len(vql_pairs):
            individual_df.at[idx, 'VQL Generated'] = vql_pairs[sql_idx][0]
            individual_df.at[idx, 'sol_sql'] = vql_pairs[sql_idx][1]
            
            # Copy the binary match indicators from df to individual_df
            if 'same_row_count' in df.columns and 'same_column_count' in df.columns:
                individual_df.at[idx, 'same_row_count'] = df.iloc[sql_idx]['same_row_count']
                individual_df.at[idx, 'same_column_count'] = df.iloc[sql_idx]['same_column_count']
            
            if 'all_matches' in result:
                individual_df.at[idx, 'all_matches'] = str(result['all_matches'])
            if 'all_set_matches' in result:
                individual_df.at[idx, 'all_set_matches'] = str(result['all_set_matches'])
            if 'set_precision' in result:
                individual_df.at[idx, 'set_precision'] = result['set_precision']
    
    for idx, result in enumerate(results):
        if 'set_f1' in result:
            individual_df.at[idx, 'set_f1_score'] = result['set_f1']

    # Define columns we want in the detailed output
    core_columns = ['Question ID', 'f1score', 'precision', 'set_precision', 'percent_match', 
                'Difficulty', 'same_row_count', 'same_column_count', 'VQL Generated', 
                'sol_sql', 'all_matches', 'all_set_matches']

    detailed_df = individual_df[core_columns]
    
    agg_results = compute_f1_by_group(results, 'Difficulty')
    
    difficulties = list(agg_results['group_scores'].keys())
    agg_df = pd.DataFrame({
        'Difficulty': difficulties,
        'F1 Score': [agg_results['group_scores'].get(diff, 0) for diff in difficulties],
        'Percent Match': [agg_results['group_percent_match'].get(diff, 0) for diff in difficulties],
        'Count': [agg_results['group_counts'].get(diff, 0) for diff in difficulties]
    })
    
    # Add overall row
    overall_row = pd.DataFrame({
        'Difficulty': ['Overall'],
        'F1 Score': [agg_results['all_f1']],
        'Percent Match': [agg_results['all_percent_match']],
        'Count': [agg_results['total_count']]
    })
    agg_df = pd.concat([agg_df, overall_row], ignore_index=True)
    #  description rows
    column_descriptions = {
        'Question ID': 'Original index of the query from the input file',
        'f1score': 'F1 score (harmonic mean of precision and recall) for result set comparison. Converts each row into a set (ignoring duplicate values and order within a row). It then uses a best-matching (greedy) approach: for each ground-truth row it finds the prediction row with maximum overlap',
        'percent_match': 'Percentage of overlapping values between result sets',
        'same_row_count': '1 if the number of rows match between generated and ground truth queries, 0 otherwise',
        'same_column_count': '1 if the number of columns match between generated and ground truth queries, 0 otherwise',
        'Difficulty': 'Query difficulty level (simple, moderate, challenging)',
        'VQL Generated': 'The VQL query generated by the AI model',
        'sol_sql': 'The reference (ground truth) VQL query',
        'all_matches': 'List of matched values per row',
        'all_set_matches': 'List of set intersections per row',
        'set_precision': 'Precision score based on set intersection'
    }
    
    #  description rows
    desc_row = pd.DataFrame([{col: column_descriptions.get(col, '') for col in detailed_df.columns}])
    details_with_desc = pd.concat([desc_row, detailed_df], ignore_index=True)
    
    # Summary descriptions
    summary_descriptions = {
        'Difficulty': 'Query difficulty level or Overall summary',
        'F1 Score': 'Average F1 score (0-100) for this difficulty level',
        'Percent Match': 'Average percentage of overlapping values between result sets',
        'Count': 'Number of queries in this difficulty category'
    }
    
    summary_desc_row = pd.DataFrame([{col: summary_descriptions.get(col, '') for col in agg_df.columns}])
    summary_with_desc = pd.concat([summary_desc_row, agg_df], ignore_index=True)

    # Return DataFrames if output is None
    if args.output is not None:    
        with pd.ExcelWriter(args.output, engine='xlsxwriter') as writer:
           
            summary_with_desc.to_excel(writer, sheet_name='Summary', index=False)
            details_with_desc.to_excel(writer, sheet_name='Details', index=False)
            
            workbook = writer.book
            summary_worksheet = writer.sheets['Summary']
            details_worksheet = writer.sheets['Details']
            
            header_format = workbook.add_format({
                'bold': True,
                'italic': True,
                'border': 1,
                'bg_color': '#D9E1F2',  # Light blue background
                'text_wrap': True,
                'valign': 'top'
            })
            
            # Format the Summary sheet
            for col_num, value in enumerate(agg_df.columns.values):
                summary_worksheet.write(0, col_num, value, header_format)
            
            for col_num in range(len(agg_df.columns)):
                summary_worksheet.write(1, col_num, summary_with_desc.iloc[0, col_num], header_format)
            
            # Set column widths for Summary sheet
            for col_num, column in enumerate(agg_df.columns):
                width = max(15, len(str(column)) + 2)
                summary_worksheet.set_column(col_num, col_num, width)
            
            # Format the Details sheet
            for col_num, value in enumerate(detailed_df.columns.values):
                details_worksheet.write(0, col_num, value, header_format)
            
            for col_num in range(len(detailed_df.columns)):
                details_worksheet.write(1, col_num, details_with_desc.iloc[0, col_num], header_format)
            
            # Set column widths for Details sheet
            for col_num, column in enumerate(detailed_df.columns):
                width = max(15, len(str(column)) + 2)
                details_worksheet.set_column(col_num, col_num, width)
            

            data_start_row = 2
            data_end_row = data_start_row + len(agg_df) - 1
            
            chart = workbook.add_chart({'type': 'column'})
            chart.add_series({
                'name':       ['Summary', 0, 1],  # "F1 Score" header from row0, col1
                'categories': ['Summary', data_start_row, 0, data_end_row, 0],  # Difficulty column
                'values':     ['Summary', data_start_row, 1, data_end_row, 1],  # F1 Score column
                'data_labels': {'value': True, 'num_format': '0.0'}
            })
            chart.set_title({'name': 'F1 Scores by Difficulty Level'})
            chart.set_x_axis({'name': 'Difficulty'})
            chart.set_y_axis({'name': 'F1 Score (%)'})
            chart.set_size({'width': 500, 'height': 300})
            
            # Insert the chart at cell E1
            summary_worksheet.insert_chart('E1', chart)
            
        # Print summary
        print("\nSummary of F1 Scores by Difficulty:")
        print(agg_df.to_string(index=False))
        return summary_with_desc, details_with_desc
    else:
        print(agg_df.to_string(index=False))

        return summary_with_desc, details_with_desc

if __name__ == "__main__":
    main()