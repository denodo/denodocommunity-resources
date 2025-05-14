import sys
import json
import time
import math
import numpy as np
import argparse
import pandas as pd
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from db_utils import execute_vql, add_query_execution_data
import logging


logger = logging.getLogger(__name__)

def clean_abnormal(input):
    """
    Cleans abnormal values from the input list using mean and standard deviation.
    
    Parameters:
    input (list): List of numerical values.
    
    Returns:
    list: List of cleaned numerical values.
    """
    input = np.asarray(input)
    processed_list = []
    mean = np.mean(input, axis=0)
    std = np.std(input, axis=0)
    for x in input:
        if x < mean + 3 * std and x > mean - 3 * std:
            processed_list.append(x)
            
    return processed_list

def normalize_value(val):
    """Normalize values for consistent comparison"""
    # Handle NaN values
    if pd.isna(val):
        return "NA"
    
    # Try to normalize numbers
    if isinstance(val, (int, float)):
        # Convert 1.0 to 1 for better comparison
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
    
    # Default string conversion
    return str(val)

def compare_vql_execution(generated_vql, ground_truth, datacatalog_params):
    """
    Executes both generated and ground truth VQL queries and compares their results.
    Returns 1 if generated results exactly match ground truth, 0 otherwise.
    
    Parameters:
    generated_vql (str): The generated VQL query
    ground_truth (str): The ground truth VQL query
    datacatalog_params (dict): Database connection parameters
    
    Returns:
    int: 1 if results match perfectly, 0 otherwise
    """
    max_attempts = 5
    
    for attempt in range(1, max_attempts + 1):
        logger.debug(f"Comparison attempt {attempt}/{max_attempts}")
        
        # Try to execute generated query
        try:
            generated_df, _ = execute_vql(generated_vql, return_time=True)
            if generated_df is None:
                logger.warning(f"Attempt {attempt}: Generated query returned None results")
                continue
            logger.info(f"Attempt {attempt}: Generated query executed successfully. Result rows: {len(generated_df)}")
        except Exception as e:
            logger.error(f"Attempt {attempt}: Error executing generated VQL: {e}")
            continue
        
        # Try to execute ground truth query
        try:
            gt_df, _ = execute_vql(ground_truth, return_time=True)
            if gt_df is None:
                logger.warning(f"Attempt {attempt}: Ground truth query returned None results")
                continue
            logger.info(f"Attempt {attempt}: Ground truth query executed successfully. Result rows: {len(gt_df)}")
        except Exception as e:
            logger.error(f"Attempt {attempt}: Error executing ground truth VQL: {e}")
            continue
        
        # If both empty, that's a match
        if len(generated_df) == 0 and len(gt_df) == 0:
            return 1
        
        try:
            # First compare shapes
            gt_shape = gt_df.shape
            generated_shape = generated_df.shape            
            # If both empty, that's a match
            if gt_shape[0] == 0 and generated_shape[0] == 0:
                return 1
            # Convert to sets of tuple column names
            ground_truth_res = set(tuple(row) for row in gt_df.values)
            predicted_res = set(tuple(row) for row in generated_df.values)
            
            if list(predicted_res) == list(ground_truth_res):
                logger.info(f"Attempt {attempt}: Perfect match - all ground truth cells matched, no extra values")
                return 1
            else:
                return 0
                
        except Exception as e:
            logger.error(f"Attempt {attempt}: Error comparing result sets: {e}")
    
    # If we got here, no successful comparison found a match
    logger.warning(f"All {max_attempts} comparison attempts failed or had non-matching results")
    return 0

def iterated_execute_vql(predicted_vql, ground_truth, datacatalog_params, iterate_num):
    """
    Executes the predicted and ground truth SQL queries iteratively and computes the reward based on execution time.
    
    Parameters:
    predicted_sql (str): The predicted SQL query.
    ground_truth (str): The ground truth SQL query.
    datacatalog_params (dict): Database connection parameters.
    iterate_num (int): Number of iterations to execute the queries.
    
    Returns:
    float: The computed reward based on execution time.
    """
    diff_list = []
    
    # Log the database connection parameters for debugging
    logger.debug(f"Database connection parameters: {json.dumps(datacatalog_params, default=str)}")
    
    reward = 0
    time_ratio = 0

    sql_exec_bool = compare_vql_execution(predicted_vql, ground_truth, datacatalog_params) == 1
    if sql_exec_bool == 1:
        logger.info("Results match, proceeding with time comparison")
        for i in range(iterate_num):
            logger.debug(f"Iteration {i+1}/{iterate_num}")
            # Measure predicted query time
            try:
                _, predicted_time = execute_vql(predicted_vql)
            except Exception as e:
                logger.error(f"Error executing predicted SQL in iteration {i+1}: {e}")
                continue
            # Measure ground truth query time
            try:
                _, ground_truth_time = execute_vql(ground_truth)
            except Exception as e:
                logger.error(f"Error executing ground truth SQL in iteration {i+1}: {e}")
                continue
            diff_list.append(ground_truth_time / predicted_time)
        processed_diff_list = clean_abnormal(diff_list)
        time_ratio = sum(processed_diff_list) / len(processed_diff_list)
    else:
        logger.warning("Results do not match, skipping time comparison")
        return 0
    
    if time_ratio == 0:
        reward = 0
    elif time_ratio >= 2:
        reward = 1.25
    elif 1 <= time_ratio < 2:
        reward = 1
    elif 0.5 <= time_ratio < 1:
        reward = 0.75
    elif 0.25 <= time_ratio < 0.5:
        reward = 0.5
    else:
        reward = 0.25
    return reward


def execute_model_with_timeout(predicted_vql, ground_truth, datacatalog_params, idx, iterate_num, timeout):
    """
    Executes the model by running the predicted and ground truth SQL queries with a timeout.
    
    Parameters:
    predicted_vql (str): The predicted SQL query.
    ground_truth (str): The ground truth SQL query.
    datacatalog_params (dict): Database connection parameters.
    idx (int): Index of the query pair.
    iterate_num (int): Number of iterations to execute the queries.
    timeout (float): Timeout in seconds.
    
    Returns:
    dict: Dictionary containing the index and computed reward.
    """
    try:
        # Start with a simple validation to avoid long execution on clearly invalid queries
        if not predicted_vql or not ground_truth:
            return {"sql_idx": idx, "reward": 0}
        
        # Use a shorter timeout for the first execution to quickly filter out problematic queries
        start_time = time.time()
        reward = iterated_execute_vql(predicted_vql, ground_truth, datacatalog_params, iterate_num)
        
        # If it's taking too long, abort
        if time.time() - start_time > timeout:
            logger.warning(f"Query execution timed out for index {idx}")
            return {"sql_idx": idx, "reward": 0}
            
        return {"sql_idx": idx, "reward": reward}
    except Exception as e:
        logger.error(f"Error executing query for index {idx}: {e}")
        return {"sql_idx": idx, "reward": 0}


def run_sqls_parallel(vqls, datacatalog_params_list, num_cpus=1, iterate_num=100, meta_time_out=30.0):
    """
    Runs the SQL queries in parallel using ThreadPoolExecutor.
    """
    results = []
    
    with ThreadPoolExecutor(max_workers=num_cpus) as executor:
        # Submit all tasks without tqdm
        future_to_idx = {}
        for i, (predicted_sql, ground_truth) in enumerate(vqls):
            future = executor.submit(
                execute_model_with_timeout,
                predicted_sql,
                ground_truth,
                datacatalog_params_list[i] if i < len(datacatalog_params_list) else datacatalog_params_list[0],
                i,
                iterate_num,
                meta_time_out
            )
            future_to_idx[future] = i
        
        # Create progress bar for tracking completions
        pbar = tqdm(total=len(vqls), desc='Calculating VES')
        
        # Collect results as they complete
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                result = future.result()
                results.append(result)
                logger.info(f"Completed query {idx+1}/{len(vqls)}")
            except Exception as exc:
                logger.error(f"Query {idx} generated an exception: {exc}")
                results.append({"sql_idx": idx, "reward": 0})
            
            # Update progress bar on each completion
            pbar.update(1)
        
        pbar.close()
    
    # Sort results by index
    results.sort(key=lambda x: x["sql_idx"])
    return results


def compute_ves(exec_results):
    """
    Computes the VES based on the execution results.
    compute the average reward.
    """
    num_queries = len(exec_results)
    total_reward = 0
    count = 0

    for i, result in enumerate(exec_results):
        if result["reward"] != 0:
            count += 1
        total_reward += math.sqrt(result["reward"]) * 100
    ves = total_reward / num_queries 
    return ves


def compute_ves_by_group(exec_results, group_column):
    """
    Computes the VES by grouping results based on difficulty categories.
    Uses predefined categories: simple, moderate, challenging.
    """
    num_queries = len(exec_results)
    if num_queries == 0:
        return {
            'group_scores': {},
            'group_counts': {},
            'all_ves': 0.0,
            'total_count': 0
        }
    
    # Group results by difficulty
    simple_results = []
    moderate_results = []
    challenging_results = []
    
    for result in exec_results:
        if group_column in result:
            difficulty = result[group_column]
            # Handle non-string difficulties
            if isinstance(difficulty, str):
                difficulty = difficulty.lower()
                if difficulty == "simple":
                    simple_results.append(result)
                elif difficulty == "moderate":
                    moderate_results.append(result)
                elif difficulty == "challenging":
                    challenging_results.append(result)
    
    # Calculate VES for each group
    simple_ves = compute_ves(simple_results) if simple_results else 0
    moderate_ves = compute_ves(moderate_results) if moderate_results else 0
    challenging_ves = compute_ves(challenging_results) if challenging_results else 0
    all_ves = compute_ves(exec_results)
    
    # Prepare return structure in the original format
    group_scores = {
        'simple': simple_ves,
        'moderate': moderate_ves,
        'challenging': challenging_ves
    }
    
    group_counts = {
        'simple': len(simple_results),
        'moderate': len(moderate_results),
        'challenging': len(challenging_results)
    }
    
    return {
        'group_scores': group_scores,
        'group_counts': group_counts,
        'all_ves': all_ves,
        'total_count': num_queries
    }

    
def main(args=None):
    if args is None:
        
        parser = argparse.ArgumentParser(description='Calculate VES for VQL queries.')
        parser.add_argument('--input', '-i', required=True, help='Input Excel file with VQL queries')
        parser.add_argument('--output', '-o', default=None, help='Output Excel file (default: ves_results.xlsx)')
        parser.add_argument('--num-cpus', '-n', type=int, default=6, help='Number of CPUs for parallel processing')
        parser.add_argument('--timeout', '-t', type=float, default=30.0, help='Query execution timeout (seconds)')
        parser.add_argument('--iterate-num', type=int, default=3, help='Number of iterations for time comparison (default: 3)')
        
        # Database connection parameters
        parser.add_argument('--user', type=str, default="admin", required=False, help='Database user for Denodo')
        parser.add_argument('--password', type=str, default="admin", required=False, help='Database password for Denodo')
        parser.add_argument('--host', type=str, default="localhost", help='Database host for Denodo')
        parser.add_argument('--port', type=int, default=9996, help='Database port for Denodo')
        parser.add_argument('--database', type=str, default="spider", help='Database name')
        
        # Keep db-config as alternative option for compatibility
        parser.add_argument('--db-config', '-d', default=None, help='Database configuration JSON file (alternative to individual parameters)')
        
        # Column name parameters
        parser.add_argument('--ground-truth-col', '-g', default='ground_truth_vql', 
                            help='Column name containing ground truth VQL (default: ground_truth_vql)')
        parser.add_argument('--generated-col', '-p', default='generated_vql', 
                            help='Column name containing generated VQL (default: generated_vql)')
        parser.add_argument('--difficulty-col', '-c', default='difficulty',
                            help='Column name containing difficulty level (default: difficulty)')
        
        args = parser.parse_args()
        
    # Configure logging
    logging.basicConfig(level=logging.CRITICAL)    
    # Read input Excel file
    try:
        df = pd.read_excel(args.input)
    except Exception as e:
        logger.error(f"Error reading input file: {e}")
        sys.exit(1)
    
    # Check for required columns using specified column names
    required_cols = [args.ground_truth_col, args.generated_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        logger.error(f"Missing required columns: {', '.join(missing_cols)}")
        sys.exit(1)
    
    # Extract VQL pairs
    vql_pairs = list(zip(df[args.generated_col], df[args.ground_truth_col]))
    if 'index' in df.columns:
        original_indexes = df['index'].tolist()
    else:
        # If there's no explicit index column, use the DataFrame index
        original_indexes = df.index.tolist()
    # Set up database parameters
    if args.db_config:
        # Use database config file if provided
        try:
            with open(args.db_config, 'r') as f:
                db_params = json.load(f)
        except Exception as e:
            sys.exit(1)
    else:
        # Use individual connection parameters
        db_params = {
            "user": args.user,
            "password": args.password,
            "host": args.host,
            "port": args.port,
            "databaseName": args.database
        }
    
    db_params_list = [db_params] * len(vql_pairs)
    
    # Process with add_query_execution_data to get binary match indicators
    df = add_query_execution_data(df, db_params, args.ground_truth_col, args.generated_col)
    
    # Run VES calculation
    results = run_sqls_parallel(
        vql_pairs, 
        db_params_list, 
        num_cpus=args.num_cpus, 
        iterate_num=args.iterate_num, 
        meta_time_out=args.timeout, 
    )
    results = sorted(results, key=lambda x: x["sql_idx"])

    # Add the VES results directly to the dataframe
    for result in results:
        idx = result['sql_idx']
        if idx < len(df):
            df.loc[idx, 'reward'] = result['reward']
            # Add Question ID using original indexes
            if idx < len(original_indexes):
                df.loc[idx, 'Question ID'] = original_indexes[idx]
    
    df['Results Match'] = 0  
    for result in results:
        idx = result['sql_idx']
        if idx < len(df) and result['reward'] > 0:
            df.loc[idx, 'Results Match'] = 1
    
    # Copy same_row_count and same_column_count to results for visualization
    for result in results:
        idx = result['sql_idx']
        if idx < len(df):
            result['same_row_count'] = df.loc[idx, 'same_row_count'] if 'same_row_count' in df.columns else 0
            result['same_column_count'] = df.loc[idx, 'same_column_count'] if 'same_column_count' in df.columns else 0
            # Add the Question ID to results for use in visualizations
            if 'Question ID' in df.columns:
                result['Question ID'] = df.loc[idx, 'Question ID']
    
    if args.difficulty_col in df.columns:
        for result in results:
            idx = result['sql_idx']
            if idx < len(df):
                result[args.difficulty_col] = df.loc[idx, args.difficulty_col]
    
    # Compute aggregated results by difficulty if difficulty column exists
    if args.difficulty_col in df.columns:
        # Now the results contain difficulty values
        agg_results = compute_ves_by_group(results, args.difficulty_col)
        
        # Calculate match percentages by difficulty
        match_percentages = {}
        for difficulty in agg_results['group_scores'].keys():
            # Get results for this difficulty
            difficulty_results = [r for r in results if r.get(args.difficulty_col, '').lower() == difficulty.lower()]
            matching_count = sum(1 for r in difficulty_results if r.get('reward', 0) > 0)
            total_count = len(difficulty_results)
            match_percentages[difficulty] = (matching_count / total_count * 100) if total_count > 0 else 0
        
        # Calculate overall match percentage
        all_matches = sum(1 for r in results if r.get('reward', 0) > 0)
        all_total = len(results)
        overall_match_percent = (all_matches / all_total * 100) if all_total > 0 else 0
        
        # Create DataFrame for summary statistics
        difficulties = list(agg_results['group_scores'].keys())
        agg_df = pd.DataFrame({
            'Difficulty': difficulties,
            'VES Score': [agg_results['group_scores'].get(diff, 0) for diff in difficulties],
            'Count': [agg_results['group_counts'].get(diff, 0) for diff in difficulties],
            'Match %': [match_percentages.get(diff, 0) for diff in difficulties]
        })
        
        # Add overall row
        overall_row = pd.DataFrame({
            'Difficulty': ['Overall'],
            'VES Score': [agg_results['all_ves']],
            'Count': [agg_results['total_count']],
            'Match %': [overall_match_percent]
        })
        agg_df = pd.concat([agg_df, overall_row], ignore_index=True)

    # If no difficulty column, just calculate overall VES
    overall_ves = compute_ves(results)
    
    # Calculate overall match percentage
    all_matches = sum(1 for r in results if r.get('reward', 0) > 0)
    all_total = len(results)
    overall_match_percent = (all_matches / all_total * 100) if all_total > 0 else 0
    
    agg_df = pd.DataFrame({
        'Difficulty': ['Overall'],
        'VES Score': [overall_ves],
        'Count': [len(results)],
        'Match %': [overall_match_percent]
    })
    # Prepare descriptions for Details DataFrame
    column_descriptions = {
        'Question ID': 'Original index of the query from the input file',
        args.ground_truth_col: 'Ground truth VQL query',
        args.generated_col: 'Generated VQL query',
        'reward': 'Reward based on execution time',
        'Results Match': 'Binary indicator for exact match',
        'same_row_count': 'Number of rows in both results',
        'same_column_count': 'Number of columns in both results',
        args.difficulty_col: 'Difficulty level',
        'sql_execution_time': 'Time taken for SQL execution (AI SDK) (seconds)',
        'vector_store_search_time': 'Time taken for vector store search (AI SDK) (seconds)',
        'llm_time': 'Time taken for LLM processing (AI SDK) (seconds)',
        'total_execution_time': 'Total execution time (AI SDK) (seconds)'
    }
        
        # Move Question ID to the front if it exists
    if 'Question ID' in df.columns:
        cols = ['Question ID'] + [col for col in df.columns if col != 'Question ID']
        df = df[cols]
    
    # Create description row for details
    desc_row = pd.DataFrame([{col: column_descriptions.get(col, '') for col in df.columns}])
    details_with_desc = pd.concat([desc_row, df], ignore_index=True)
    
    # Prepare descriptions for Summary DataFrame
    summary_descriptions = {
        'Difficulty': 'Query difficulty level or Overall summary',
        'VES Score': 'Average VES for this category',
        'Count': 'Number of queries in this category',
        'Match %': 'Percentage of queries matching ground truth'
    }
    
    # Create description row for summary
    summary_desc_row = pd.DataFrame([{col: summary_descriptions.get(col, '') for col in agg_df.columns}])
    summary_with_desc = pd.concat([summary_desc_row, agg_df], ignore_index=True)
    if args.output is not None:

        # Write to Excel with pandas
        with pd.ExcelWriter(args.output, engine='xlsxwriter') as writer:
            # Write DataFrames with descriptions
            summary_with_desc.to_excel(writer, sheet_name='Summary', index=False)
            details_with_desc.to_excel(writer, sheet_name='Details', index=False)
            
            # Get workbook and sheets for chart creation
            workbook = writer.book
            summary_worksheet = writer.sheets['Summary']
            
            # Create and add chart
            chart = workbook.add_chart({'type': 'column'})
            chart.add_series({
                'name': 'VES Score',
                'categories': ['Summary', 1, 0, len(summary_with_desc), 0],  # Adjust for description row
                'values': ['Summary', 1, 1, len(summary_with_desc), 1],      # Adjust for description row
                'data_labels': {'value': True}
            })
            chart.set_title({'name': 'VES Scores by Difficulty'})
            chart.set_x_axis({'name': 'Difficulty'})
            chart.set_y_axis({'name': 'VES Score'})
            chart.set_size({'width': 500, 'height': 300})
            summary_worksheet.insert_chart('E1', chart)
            
            # Apply formatting to header and description rows
            header_format = workbook.add_format({
                'bold': True,
                'italic': True,
                'border': 1,
                'bg_color': '#D9E1F2'
            })
            
            description_format = workbook.add_format({
                'italic': True,
                'border': 1,
                'bg_color': '#E9EDF4',
                'text_wrap': True
            })
            
            # Apply formats to both sheets
            for worksheet in [summary_worksheet, writer.sheets['Details']]:
                # Format header row (row 0)
                for col_num in range(len(df.columns)):
                    worksheet.set_row(0, None, header_format)
                
                # Format description row (row 1)
                for col_num in range(len(df.columns)):
                    worksheet.set_row(1, None, description_format)
        
        # Print summary
        print("\nSummary of VES Scores by Difficulty:")
        print(agg_df.to_string(index=False))
        return agg_df, df

    print("\nSummary of VES Scores by Difficulty:")
    print(agg_df.to_string(index=False))
    return agg_df, df


if __name__ == "__main__":
    main()
