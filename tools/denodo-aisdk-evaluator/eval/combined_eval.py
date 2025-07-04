import argparse
import pandas as pd
from f1_eval import main as f1_main
from ves_eval import main as ves_main
import logging
from ai_sdk_utils import generate_aisdk_responses_as_dataframe, generate_responses
import numpy as np
from db_utils import initialize_data_catalog, execute_vql 
import tempfile
import os
import traceback
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

def merge_evaluations(f1_output=None, ves_output=None, combined_output=None, 
                     f1_details_df=None, ves_details_df=None, 
                     f1_summary_df=None, ves_summary_df=None):
    """
    Merge the outputs of F1 and VES evaluations into a single Excel file.
    """
    try:
        if all([f1_details_df is not None, ves_details_df is not None, 
                f1_summary_df is not None, ves_summary_df is not None]):
            logger.info("Using provided DataFrames for merging")
        else:
            if not all([f1_output, ves_output]):
                raise ValueError("Either provide all four DataFrames or both Excel file paths")
                
            logger.info(f"Reading from Excel files: {f1_output} and {ves_output}")
            f1_details_df = pd.read_excel(f1_output, sheet_name="Details")
            ves_details_df = pd.read_excel(ves_output, sheet_name="Details")
            f1_summary_df = pd.read_excel(f1_output, sheet_name="Summary")
            ves_summary_df = pd.read_excel(ves_output, sheet_name="Summary")
        
        logger.info(f"F1 details columns: {f1_details_df.columns.tolist()}")
        logger.info(f"VES details columns: {ves_details_df.columns.tolist()}")
        
        def is_description_row(df, from_raw_df=False):
            if from_raw_df:
                return False
                
            if len(df) == 0:
                return False
            first_row = df.iloc[0]
            str_lengths = [len(str(x)) for x in first_row.values if isinstance(x, str)]
            if str_lengths and sum(str_lengths)/len(str_lengths) > 20:
                return True
            return False
        
        if is_description_row(f1_details_df):
            f1_details_df = f1_details_df.iloc[1:].reset_index(drop=True)
        if is_description_row(ves_details_df, from_raw_df=True):
            ves_details_df = ves_details_df.iloc[1:].reset_index(drop=True)
        if is_description_row(f1_summary_df):
            f1_summary_df = f1_summary_df.iloc[1:].reset_index(drop=True)
        if is_description_row(ves_summary_df):
            ves_summary_df = ves_summary_df.iloc[1:].reset_index(drop=True)
        
        f1_details_df['Question ID'] = pd.to_numeric(f1_details_df['Question ID'], errors='coerce')
        ves_details_df['Question ID'] = pd.to_numeric(ves_details_df['Question ID'], errors='coerce')

        ves_details_df = ves_details_df.rename(columns={"difficulty": "Difficulty"})
        
        # Create column mappings for renaming
        f1_column_map = {
            'Difficulty': 'Difficulty',
            'VQL Generated': 'VQL Generated',
            'sol_sql': 'Ground Truth VQL',
            'precision': 'Percent Overlap',
            'same_row_count': 'Have Same Row Count',
            'same_column_count': 'Have Same Column Count',
            'f1score': 'Bird Standard F1',  
            'set_precision': 'Subsetting Percentage'
        }
        
        ves_column_map = {
            'reward': 'VES Score',
            'Results Match': 'Results Match',
            'sql_execution_time': 'sql_execution_time',
            'vector_store_search_time': 'vector_store_search_time',
            'llm_time': 'llm_time',
            'total_execution_time': 'total_execution_time'
        }
        
        f1_renamed = f1_details_df.rename(columns=f1_column_map)
        ves_renamed = ves_details_df.rename(columns=ves_column_map)
        
        f1_cols = ['Question ID'] + list(f1_column_map.values())
        f1_cols = [col for col in f1_cols if col in f1_renamed.columns]
        
        ves_cols = ['Question ID'] + list(ves_column_map.values())
        ves_cols = [col for col in ves_cols if col in ves_renamed.columns]
        
        f1_subset = f1_renamed[f1_cols]
        if 'Have Same Column Count' in f1_subset.columns:
            f1_subset = f1_subset.drop(columns=['Have Same Column Count'])
        ves_subset = ves_renamed[ves_cols]
        
        merged_details = pd.merge(f1_subset, ves_subset, on='Question ID', how='outer')
        if 'Have Same Row Count' not in merged_details.columns:
            logger.warning("Column 'Have Same Row Count' not found, adding with default values")
            merged_details['Have Same Row Count'] = 0
        numeric_cols = ['Percent Overlap', 'Have Same Row Count', 
                        'VES Score', 'Bird Standard F1', 'Results Match', 'Subsetting Percentage']
        for col in numeric_cols:
            if col in merged_details.columns:
                merged_details[col] = pd.to_numeric(merged_details[col], errors='coerce').fillna(0)
        logger.info(f"VES Score column in merged_details: {merged_details['VES Score'].tolist()[:5]} (first 5 values)")
        
        all_difficulties = set()
        if 'Difficulty' in f1_summary_df.columns:
            all_difficulties.update(f1_summary_df['Difficulty'])
        if 'Difficulty' in ves_summary_df.columns:
            all_difficulties.update(ves_summary_df['Difficulty'])
        
        if not all_difficulties:
            all_difficulties = {"Overall"}
        
        difficulties = sorted([d for d in all_difficulties if d.lower() != "overall"])
        if "Overall" in all_difficulties:
            difficulties.append("Overall")
        
        percent_correct_queries_dict = {}
        percent_subset_dict = {}
        percent_row_match_dict = {}
        count_dict = {}
        
        # Populate from VES summary
        if 'Results Match' in ves_details_df.columns:
            ves_details_df['Results Match'] = pd.to_numeric(ves_details_df['Results Match'], errors='coerce').fillna(0)
            
            if 'Difficulty' in ves_details_df.columns:
                match_by_difficulty = ves_details_df.groupby('Difficulty')['Results Match'].mean() * 100
                for difficulty, value in match_by_difficulty.items():
                    percent_correct_queries_dict[difficulty] = value
            
            overall_match = ves_details_df['Results Match'].mean() * 100
            percent_correct_queries_dict["Overall"] = overall_match
        else:
            logger.debug("'Results Match' column not found in VES details")
            for difficulty in difficulties:
                percent_correct_queries_dict[difficulty] = 0
            percent_correct_queries_dict["Overall"] = 0

        
        if 'Percent Match' in f1_summary_df.columns:
            for _, row in f1_summary_df.iterrows():
                if 'Difficulty' in f1_summary_df.columns:
                    difficulty = row['Difficulty']
                    percent_subset_dict[difficulty] = row['Percent Match']
                    if 'Count' in f1_summary_df.columns:
                        count_dict[difficulty] = row['Count']
        
        if 'Difficulty' in merged_details.columns and 'Have Same Row Count' in merged_details.columns:
            row_match_by_difficulty = merged_details.groupby('Difficulty')['Have Same Row Count'].mean() * 100
            for difficulty, value in row_match_by_difficulty.items():
                percent_row_match_dict[difficulty] = value
        
        if "Overall" in difficulties and "Overall" not in percent_row_match_dict:
            percent_row_match_dict["Overall"] = merged_details['Have Same Row Count'].mean() * 100
        
        time_stats = None
        if 'total_execution_time' in merged_details.columns:
            results_list = merged_details.to_dict('records')
            time_stats = compute_time_stats_by_group(results_list, 'Difficulty', 'total_execution_time')
        
        difficulties_array = difficulties
        percent_correct_queries_array = [percent_correct_queries_dict.get(diff, 0) for diff in difficulties_array]
        
        calculated_percent_subset_array = []
        if 'Subsetting Percentage' in merged_details.columns and not merged_details.empty:
            # The 'Subsetting Percentage' column should already be numeric from earlier processing (around line 108)
            for diff_level in difficulties_array:
                if diff_level == "Overall":
                    mean_val = merged_details['Subsetting Percentage'].mean()
                    calculated_percent_subset_array.append(float(mean_val) if pd.notna(mean_val) else 0.0)
                else:
                    # Average for the specific difficulty level
                    if 'Difficulty' in merged_details.columns:
                        subset_for_diff = merged_details[merged_details['Difficulty'] == diff_level]
                        if not subset_for_diff.empty:
                            mean_val = subset_for_diff['Subsetting Percentage'].mean()
                            calculated_percent_subset_array.append(float(mean_val) if pd.notna(mean_val) else 0.0)
                        else:
                            calculated_percent_subset_array.append(0.0) 
                    else:
                        # 'Difficulty' column missing, cannot calculate for specific non-overall levels
                        logger.warning(f"Cannot calculate 'Percent Subset' for difficulty '{diff_level}': 'Difficulty' column missing in merged_details.")
                        calculated_percent_subset_array.append(0.0)
        else:
            # Fallback if 'Subsetting Percentage' column is missing or merged_details is empty
            logger.warning(
                "Could not calculate 'Percent Subset' for summary: "
                "'Subsetting Percentage' column missing in merged_details or merged_details is empty. "
                "All 'Percent Subset' values in summary will be 0."
            )
            calculated_percent_subset_array = [0.0 for _ in difficulties_array]
            
        percent_subset_array = calculated_percent_subset_array

        count_array = [count_dict.get(diff, 0) for diff in difficulties_array]  # count_dict is from f1_summary_df
        
        # Add time statistics to summary DataFrame
        summary_data = {
            'Difficulty': difficulties_array,
            'Percent Correct Queries': percent_correct_queries_array,
            'Percent Subset': percent_subset_array,
            'Number of Samples': count_array
        }
        
        # Add time statistics if available
        if time_stats:
            summary_data['Mean Time (s)'] = [
                time_stats['time_mean'].get(diff, 0) 
                for diff in difficulties_array
            ]
            summary_data['Time Std Dev'] = [
                time_stats['time_std'].get(diff, 0)
                for diff in difficulties_array
            ]
           
                
        # Create DataFrame with columns in the desired order
        merged_summary = pd.DataFrame(summary_data)
        
        column_order = [
            'Question ID', 
            'Difficulty', 
            'VQL Generated', 
            'Ground Truth VQL',
            'Results Match',
            'Subsetting Percentage',
            'Percent Overlap',
            'Have Same Row Count',
            'Bird Standard F1',
            'VES Score',
            'sql_execution_time',
            'vector_store_search_time',
            'llm_time',
            'total_execution_time'
        ]
        
        # Only include columns that actually exist in the DataFrame
        column_order = [col for col in column_order if col in merged_details.columns]
        merged_details = merged_details[column_order]
        
        
        # Create the Excel file with visualizations if an output path is provided
        if combined_output:
            create_excel_with_visualizations(merged_details, merged_summary, combined_output)
            print(f"Combined results saved to {combined_output}")
            
        return merged_summary.reset_index(drop=True)
        
    except Exception as e:
        logger.error(f"Error merging evaluations: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def create_excel_with_visualizations(merged_details, merged_summary, output_file):
    """
    Create an Excel file with visualizations based on the merged data.
    """
    logger.info("Creating Excel file with visualizations")
    
    # Define column descriptions
    detail_descriptions = {
        'Question ID': 'Unique identifier for each question',
        'Difficulty': 'Query difficulty level (simple, moderate, challenging)',
        'VQL Generated': 'The VQL query generated by the AI model',
        'Ground Truth VQL': 'The reference (ground truth) VQL query',
        'Results Match': '1 if generated query results exactly match ground truth results, 0 otherwise',
        'Subsetting Percentage': 'The percentage of generated results that are found in the ground truth (precision). High values indicate the model generates fewer irrelevant results. Order Of Rows matters but not order of Columns',
        'Percent Overlap': 'Represents the percentage of expected elements from the ground truth set that are included in the generated result. A value of 100% means all expected elements are present in the generated set. Order Of Rows and Columns matter',
        'Have Same Row Count':  '1 if the number of rows match between generated and ground truth queries, 0 otherwise',
        'Bird Standard F1': 'F1 exactly as defined within BIRD BENCHMARK. (Skews toward recall with uneven dataframe sizes.)',
        'VES Score': 'Valid Efficiency Score, which indicates the efficiency of a query. A higher score suggests a more efficient query, while a score of 0 means the query\'s result does not perfectly match the ground truth.',
        'sql_execution_time': 'Time taken to execute the SQL query',
        'vector_store_search_time': 'Time taken for vector store search',
        'llm_time': 'Time taken by the language model',
        'total_execution_time': 'Total time taken for query execution'
    }
    
    summary_descriptions = {
        'Difficulty': 'Query difficulty level or Overall summary',
        'Percent Subset': 'Average percentage across all questions of matching values between rows of matching index',  
        'Percent Correct Queries': 'The percentage of generated queries whose result sets completely contain all expected elements from the ground truth.',
        'Number of Samples': 'Number of samples in each difficulty grouping or category',
        'Mean Time (s)': 'Average total execution time in seconds',
        'Time Std Dev': 'Standard deviation of execution times',
    }
    
    try:
        # Save to Excel with nan_inf_to_errors=True option
        with pd.ExcelWriter(output_file, engine='xlsxwriter', engine_kwargs={'options': {'nan_inf_to_errors': True}}) as writer:
            logger.info("Writing data to Excel sheets with proper structure")
            workbook = writer.book
            
            # Create the worksheets
            summary_worksheet = workbook.add_worksheet('Summary')
            details_worksheet = workbook.add_worksheet('Details')
            
            # FORMAT DEFINITIONS
            header_format = workbook.add_format({
                'bold': True,
                'italic': True,
                'border': 1,
                'bg_color': '#D9E1F2',
                'valign': 'top'  
            })

            description_format = workbook.add_format({
                'italic': True,
                'valign': 'top',
                'fg_color': '#F2F2F2',  # Light gray background
                'font_size': 9
            })

            # Create a specific format for wrapped cells
            wrapped_description_format = workbook.add_format({
                'italic': True,
                'text_wrap': True,  
                'valign': 'top',
                'fg_color': '#F2F2F2', 
                'font_size': 9
            })
            
            # Write column headers in row 1
            for col_num, column in enumerate(merged_details.columns):
                details_worksheet.write(1, col_num, column, header_format)

            for col_num, column in enumerate(merged_details.columns):
                if column in detail_descriptions:
                    if col_num <= 13:  # Columns A-N
                        details_worksheet.write(2, col_num, detail_descriptions[column], wrapped_description_format)
                    else:
                        details_worksheet.write(2, col_num, detail_descriptions[column], description_format)
                    
                    width = max(15, min(30, len(detail_descriptions[column]) // 10))
                    details_worksheet.set_column(col_num, col_num, width)
            
            # Write data starting from row 3
            for row_idx, row in merged_details.iterrows():
                for col_idx, value in enumerate(row):
                    if pd.isna(value) or (isinstance(value, float) and (np.isinf(value) or np.isnan(value))):
                        details_worksheet.write_string(row_idx + 3, col_idx, "N/A")
                    else:
                        details_worksheet.write(row_idx + 3, col_idx, value)
            
            # Add super header row to Details sheet (row 0)
            add_super_header_row(details_worksheet, workbook)
            
           
            for col_num, column in enumerate(merged_summary.columns):
                summary_worksheet.write(1, col_num, column, header_format)
    
            # Write descriptions in row 2, with wrapping only in specific columns
            for col_num, column in enumerate(merged_summary.columns):
                if column in summary_descriptions:
                    if col_num <= 5:  # Columns A-F
                        summary_worksheet.write(2, col_num, summary_descriptions[column], wrapped_description_format)
                    else:
                        summary_worksheet.write(2, col_num, summary_descriptions[column], description_format)
                                
            for row_idx, row in merged_summary.iterrows():
                for col_idx, value in enumerate(row):
                    # Handle NaN and Infinity values
                    if pd.isna(value) or (isinstance(value, float) and (np.isinf(value) or np.isnan(value))):
                        summary_worksheet.write_string(row_idx + 3, col_idx, "N/A")
                    else:
                        summary_worksheet.write(row_idx + 3, col_idx, value)
            
            percent_format = workbook.add_format({'num_format': '0"%"', 'align': 'center'})
            
            # Define formats for different percentage ranges
            red_format = workbook.add_format({'bg_color': '#FF9999'})  # Light red (0-65%)
            orange_format = workbook.add_format({'bg_color': '#FFCC99'})  # Orange (65-79%)
            light_green_format = workbook.add_format({'bg_color': '#C6E0B4'})  # Light green (80-90%)
            dark_green_format = workbook.add_format({'bg_color': '#70AD47'})  # Dark green (90-100%)
            
            # Apply formats to each cell individually
            percent_columns = [col_num for col_num, column in enumerate(merged_summary.columns) if 'Percent' in column]
            
            for col_num in percent_columns:
                summary_worksheet.set_column(col_num, col_num, None, percent_format)
                
                # Iterate up to the correct number of rows
                for row_num in range(3, merged_summary.shape[0] + 3):
                    cell_value = merged_summary.iloc[row_num - 3, col_num]
                    
                    if not isinstance(cell_value, (int, float)) or pd.isna(cell_value):
                        continue
                    
                    if cell_value < 50:
                        summary_worksheet.write(row_num, col_num, cell_value, red_format)
                    elif cell_value < 70:
                        summary_worksheet.write(row_num, col_num, cell_value, orange_format)
                    elif cell_value < 90:
                        summary_worksheet.write(row_num, col_num, cell_value, light_green_format)
                    else:
                        summary_worksheet.write(row_num, col_num, cell_value, dark_green_format)

            create_summary_column_chart_with_offset(workbook, summary_worksheet, merged_summary, row_offset=3)
            create_pie_charts_with_offset(workbook, summary_worksheet, merged_details, row_offset=3)
            create_time_stats_chart(workbook, summary_worksheet, merged_summary)
            logger.info("Excel file created successfully with proper structure")
    except Exception as e:
        logger.error(f"Error creating Excel file: {e}")
        raise

def create_summary_column_chart_with_offset(workbook, summary_worksheet, merged_summary, row_offset=3):
    """Create column charts with proper row offset for headers and descriptions"""
    try:
        logger.info("Creating summary column charts with row offset")
        
        correct_chart = workbook.add_chart({'type': 'column'})
        
        correct_chart.add_series({
            'name': 'Percent Correct Queries',
            'categories': ['Summary', row_offset, 0, len(merged_summary) + row_offset - 1, 0],
            'values': ['Summary', row_offset, 1, len(merged_summary) + row_offset - 1, 1],
            'fill': {'color': '#70AD47'},
            'data_labels': {'value': True, 'num_format': '0.0'}
        })
        
        correct_chart.set_title({'name': 'Query Correctness by Difficulty Level'})
        correct_chart.set_x_axis({'name': 'Difficulty Level'})
        correct_chart.set_y_axis({'name': 'Percentage (%)', 'max': 100})
        
        # Set chart size and position
        correct_chart.set_size({'width': 400, 'height': 150})
        summary_worksheet.insert_chart('N1', correct_chart)
        
        # Create chart for Percent Overlap (should be column 2)
        overlap_chart = workbook.add_chart({'type': 'column'})
        
        # Add the Percent Overlap series
        overlap_chart.add_series({
            'name': 'Percent Overlap',
            'categories': ['Summary', row_offset, 0, len(merged_summary) + row_offset - 1, 0],
            'values': ['Summary', row_offset, 2, len(merged_summary) + row_offset - 1, 2],
            'fill': {'color': '#5B9BD5'},
            'data_labels': {'value': True, 'num_format': '0.0'}
        })
        
        overlap_chart.set_title({'name': 'Result Set Overlap by Difficulty Level'})
        overlap_chart.set_x_axis({'name': 'Difficulty Level'})
        overlap_chart.set_y_axis({'name': 'Percentage (%)', 'max': 100})
        
        # Set chart size and position
        overlap_chart.set_size({'width': 400, 'height': 300})
        summary_worksheet.insert_chart('H9', overlap_chart)
                
        
        logger.info("Summary column charts created successfully")
    except Exception as e:
        logger.error(f"Error creating summary column charts: {e}")
        raise

def create_time_stats_chart(workbook, summary_worksheet, merged_summary):
    """
    Creates a column chart showing mean and standard deviation for each difficulty level.
    """
    try:
        logger.info("Creating time statistics chart by difficulty level")
        
        chart = workbook.add_chart({'type': 'column'})
        row_offset = 3
        num_rows = len(merged_summary)
        time_data_sheet = workbook.add_worksheet('TimeStatsData')
        time_data_sheet.hide()
        
        # Add headers to the data sheet
        time_data_sheet.write(0, 0, 'Difficulty')
        time_data_sheet.write(0, 1, 'Mean Time (s)')
        time_data_sheet.write(0, 2, 'Standard Deviation')
        
        # Copy data from summary to data sheet
        for i, diff in enumerate(merged_summary['Difficulty']):
            time_data_sheet.write(i+1, 0, diff)
            time_data_sheet.write(i+1, 1, merged_summary.iloc[i]['Mean Time (s)'])
            time_data_sheet.write(i+1, 2, merged_summary.iloc[i]['Time Std Dev'])
        
        # Add mean time series
        chart.add_series({
            'name': 'Mean Time (s)',
            'categories': ['TimeStatsData', 1, 0, num_rows, 0],  
            'values': ['TimeStatsData', 1, 1, num_rows, 1],      
            'fill': {'color': '#5B9BD5'},  # Blue
            'data_labels': {'value': True, 'num_format': '0.00'}
        })
        
        # Add standard deviation series
        chart.add_series({
            'name': 'Standard Deviation (σ)',
            'categories': ['TimeStatsData', 1, 0, num_rows, 0],  
            'values': ['TimeStatsData', 1, 2, num_rows, 2],     
            'fill': {'color': '#A5A5A5'},  # Gray
            'data_labels': {'value': True, 'num_format': '0.00'}
        })
        
        chart.set_title({'name': 'Execution Time Statistics by Difficulty'})
        chart.set_x_axis({
            'name': 'Difficulty Level',
            'name_font': {'size': 10},
        })
        chart.set_y_axis({
            'name': 'Time (seconds)',
            'name_font': {'size': 10},
            'major_gridlines': {'visible': True},
        })
        
        chart.set_legend({'position': 'bottom'})
        
        # Set chart size and position
        chart.set_size({'width': 400, 'height': 300})
        summary_worksheet.insert_chart('A9', chart)
        
        logger.info("Time statistics chart created successfully")
    except Exception as e:
        logger.error(f"Error creating time statistics chart: {e}")
        logger.error(f"Exception details: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

def create_pie_charts_with_offset(workbook, summary_worksheet, details_data, row_offset=3):
    """Create pie charts for visualizing query results with proper row offset"""
    try:
        logger.info(f"Creating pie charts with {len(details_data)} data points")
        
        logger.info("Creating data worksheet for pie chart")
        simple_pie_sheet = workbook.add_worksheet('SimplePieData')
        simple_pie_sheet.hide()  
        
        logger.debug(f"VES Score column before conversion: {details_data['VES Score'].tolist()[:5]}...")
        
        try:
            details_data['VES Score'] = pd.to_numeric(details_data['VES Score'], errors='coerce').fillna(0)
            logger.debug(f"VES Score column after conversion: {details_data['VES Score'].tolist()[:5]}...")
        except Exception as e:
            logger.error(f"Error converting VES Score to numeric: {e}")
            details_data['VES Score'] = 0  
        
        # Count correct queries (those with VES Score > 0)
        correct_queries = sum(details_data['VES Score'] > 0)
        incorrect_queries = len(details_data) - correct_queries
        logger.info(f"Pie chart data: Correct={correct_queries}, Incorrect={incorrect_queries}")
        
        # Write data for the simple pie chart
        simple_pie_data = [
            ['Result', 'Count'],
            ['Correct', correct_queries],
            ['Incorrect', incorrect_queries]
        ]
        
        # Write the data to the pie data sheet
        for row_num, row_data in enumerate(simple_pie_data):
            for col_num, cell_data in enumerate(row_data):
                simple_pie_sheet.write(row_num, col_num, cell_data)
        
        logger.info("Creating pie chart")
        simple_pie_chart = workbook.add_chart({'type': 'pie'})
        

        simple_pie_chart.add_series({
            'name': 'Query Results',
            'categories': ['SimplePieData', 1, 0, 2, 0],
            'values': ['SimplePieData', 1, 1, 2, 1],
            'points': [
                {'fill': {'color': '#5ec962'}},  # Correct - Green
                {'fill': {'color': '#D2042D'}}   # Incorrect - Red
            ],
            'data_labels': {
                'value': True,
                'percentage': True,
                'category': True,
                'position': 'outside_end',
                'font': {'bold': True, 'color': 'black', 'size': 9}
            }
        })
        
        # Add title
        simple_pie_chart.set_title({
            'name': 'Query Correctness Distribution',
            'name_font': {'size': 12, 'bold': True}
        })
        
        # Set chart size and position 
        simple_pie_chart.set_size({'width': 400, 'height': 150})
        logger.info("Inserting pie chart into worksheet")
        summary_worksheet.insert_chart('H1', simple_pie_chart)  
        logger.info("Pie chart created successfully")
    except Exception as e:
        logger.error(f"Error creating pie charts: {e}")
        logger.warning("Continuing without pie chart")

def add_super_header_row(details_worksheet, workbook):
    """
    Adds an informational super header row above the column headers in the Details worksheet.
    Merges columns into logical groups with appropriate headers.
    """
    ai_sdk_format = workbook.add_format({
        'bold': True,
        'font_size': 11,
        'bg_color': '#d12020', 
        'font_color': 'white',
        'align': 'center',
        'valign': 'vcenter',
        'border': 1
    })
    super_header_format = workbook.add_format({
        'bold': True,
        'font_size': 11,
        'bg_color': '#4472C4',  
        'font_color': 'white',
        'align': 'center',
        'valign': 'vcenter',
        'border': 1
    })
    
    bird_super_header_format = workbook.add_format({
        'bold': True,
        'font_size': 11,
        'bg_color': '#FFC000',  
        'font_color': 'black',
        'align': 'center',
        'valign': 'vcenter',
        'border': 1
    })

    time_metric_format = workbook.add_format({
        'bold': True,
        'font_size': 11,
        'bg_color': '#be5fd8',  
        'font_color': 'black',
        'align': 'center',
        'valign': 'vcenter',
        'border': 1
    })
    
    
    column_groups = {
        (0, 3): ('AI SDK Results and Answer', ai_sdk_format),
        (4, 7): ('Evaluation Metrics', super_header_format), 
        (8, 9): ('BIRD Bench Metrics', bird_super_header_format),
        (10, 13): ('Timing Metrics', time_metric_format)  
    }
    
    for (start_col, end_col), (header_text, format_obj) in column_groups.items():
        details_worksheet.merge_range(0, start_col, 0, end_col, header_text, format_obj)
    
    return

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
    
    difficulty_map = {
        1: "simple",
        2: "moderate", 
        3: "challenging",
        "1": "simple",
        "2": "moderate",
        "3": "challenging"
    }
    
    # Predefined categories with descriptive labels
    categories = ["simple", "moderate", "challenging"]
    grouped_results = {category: [] for category in categories}
    
    all_times = []  # Track all times for overall statistics
    
    for result in exec_results:
        if time_column in result:
            exec_time = result.get(time_column, 0)
            if pd.isna(exec_time):
                exec_time = 0
            
            # Add to all_times for overall statistics
            all_times.append(exec_time)
            
            # Add to appropriate difficulty category
            if group_column in result:
                diff_value = result[group_column]
                
                # Map numeric or string difficulty to category label
                if diff_value in difficulty_map:
                    difficulty = difficulty_map[diff_value]
                elif isinstance(diff_value, str) and diff_value.lower() in [c.lower() for c in categories]:
                    difficulty = next(c for c in categories if c.lower() == diff_value.lower())
                else:
                    continue
                
                result[time_column] = exec_time
                grouped_results[difficulty].append(result)
    
    # Calculate time statistics for each category
    time_mean = {}
    time_median = {}
    time_variance = {}
    time_std = {}
    
    for category, results in grouped_results.items():
        if results:
            times = []
            for res in results:
                exec_time = res.get(time_column, 0)
                if pd.isna(exec_time):
                    exec_time = 0
                times.append(exec_time)
            
            time_mean[category] = np.mean(times)
            time_median[category] = np.median(times)
            time_variance[category] = np.var(times)
            time_std[category] = np.std(times)
    
    all_time_mean = np.mean(all_times) if all_times else 0
    all_time_median = np.median(all_times) if all_times else 0
    all_time_variance = np.var(all_times) if all_times else 0
    all_time_std = np.std(all_times) if all_times else 0
    
    time_mean["Overall"] = all_time_mean
    time_median["Overall"] = all_time_median
    time_variance["Overall"] = all_time_variance
    time_std["Overall"] = all_time_std
    
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

def run_initialization_check(actual_api_url: str, actual_username: str, actual_password: str, path_to_excel: str, question_column:str):
    """
    Runs an initialization check by calling generate_aisdk_responses_as_dataframe for one question
    and processes the output. Also performs a VQL execution check to test DB connectivity.
    Returns True if AI SDK provides a VQL query and DB connection is successful, False otherwise.
    """
    sdk_operational = False
    db_connection_ok = False
    
    df_excel_test_row = pd.read_excel(path_to_excel).head(1)

    if df_excel_test_row.empty:
        logger.error("Initialization check: Input Excel file is empty or has no rows for test.")
        return False

    try:
        test_question_text = df_excel_test_row[question_column].iloc[0]
        if pd.isna(test_question_text):
            logger.error(f"Initialization check: Question in column '{question_column}' for the first row is empty.")
            return False
        test_question_text = [test_question_text]
    except KeyError:
        logger.error(f"Initialization check: Question column '{question_column}' not found in the Excel file.")
        return False
    except IndexError:
        logger.error("Initialization check: Excel file seems empty after trying to access the first row's question.")
        return False

    logger.info("Starting initialization check for AI SDK (generate_aisdk_responses_as_dataframe)...")
    
    final_seven_value_tuple = (test_question_text, None, None, None, None, None, None)
    sdk_generated_vql = None

    try:
        df_sdk_output = generate_aisdk_responses_as_dataframe(
            df=df_excel_test_row,
            question_column=question_column,
            expected_column=None, 
            difficulty_column=None,
            evidence_column=None, 
            api_url=actual_api_url,
            username=actual_username,
            password=actual_password,
            max_workers=1,
            numrows=1 
        )

        if df_sdk_output is not None :
            first_row = df_sdk_output
            sdk_generated_vql = first_row['VQL Generated'][0]
            
            current_question = first_row[question_column][0]
            answer = first_row['Answer'][0]
            tables_used = first_row['Tables Used'][0]
            sql_exec_time = first_row['sql_execution_time'][0]
            vector_time = first_row['vector_store_search_time'][0]
            llm_time = first_row['llm_time'][0]

            final_seven_value_tuple = (
                current_question, answer, sdk_generated_vql, tables_used,
                sql_exec_time, vector_time, llm_time
            )
            
            if pd.notna(sdk_generated_vql) and isinstance(sdk_generated_vql, str) and sdk_generated_vql.strip():
                logger.info(f"Initialization check: AI SDK call successful. VQL Generated: '{sdk_generated_vql}'")
                sdk_operational = True
            else:
                logger.warning("Initialization check: AI SDK call successful but 'VQL Generated' is missing, empty, or not a string.")
        else:
            logger.error("Initialization check: AI SDK call (generate_aisdk_responses_as_dataframe) returned no results or an empty DataFrame.")

    except Exception as e:
        logger.error(f"Initialization check: Exception during AI SDK call: {str(e)}", exc_info=True)

    logger.info("Attempting VQL execution check for database connection with a static query...")
    static_test_vql_query = "SELECT 1 AS connection_test_status"
    db_connection_params = {
        "user": actual_username,
        "password": actual_password
    }
    try:
        result = execute_vql(
            vql=static_test_vql_query,
            db_params=db_connection_params,
            return_time=False, 
        )
        df_test_vql = result[0] 

        if df_test_vql.empty: 
            logger.error(f"VQL execution check with static query completed, but the result was unexpected or test failed. Result: \n{df_test_vql.to_string()}")             
        else:
            logger.info("VQL execution check with static query successful. Database connection confirmed.")
            db_connection_ok = True
           
    except Exception as e:
        logger.error(f"Exception during VQL execution check with static query: {str(e)}", exc_info=True)

    overall_success = sdk_operational and db_connection_ok

    logger.info(f"Initialization check completed. AI SDK Operational (VQL valid): {sdk_operational}, DB Connection OK: {db_connection_ok}.")
    logger.info(f"AI SDK 7-value tuple from check (for context): {final_seven_value_tuple}")
    
    if not overall_success:
        logger.critical("One or more initialization checks failed. Main evaluation will be aborted.")
        
    return overall_success


def main():
    parser = argparse.ArgumentParser(description='Run AI SDK generation followed by combined F1 and VES evaluations')
    parser.add_argument('--input', '-i', required=True, help='Input Excel file with source data')
    parser.add_argument('--output', '-o', default='combined_results.xlsx', help='Output Excel file for merged results')
    parser.add_argument('--f1-output', default=None, help='F1 evaluation output file')
    parser.add_argument('--ves-output', default=None, help='VES evaluation output file')
    parser.add_argument('--timeout', '-t', type=float, default=30.0, help='Query execution timeout (seconds)')
    parser.add_argument('--output-original', default='original_results.xlsx', help='Output Excel file from AI SDK')
    parser.add_argument('--question-column', type=str, default='Question', help='Column name containing questions')
    parser.add_argument('--expected-column', type=str, default='Solution', help='Column name containing expected answer/VQL')
    parser.add_argument('--difficulty-col', type=str, default='difficulty', help='Column name containing difficulty level')    
    parser.add_argument('--api-url', type=str, default="http://127.0.0.1:8008/answerDataQuestion", help="AI SDK API endpoint URL")
    parser.add_argument('--max-workers', type=int, default=10, help="Max parallel workers for AI SDK calls")
    parser.add_argument('--iterate-num', type=int, default=10, help='Number of iterations for VES time comparison')
    parser.add_argument('--user', type=str, default="admin", help='Database user')
    parser.add_argument('--password', type=str, default="admin", help='Database password')
    parser.add_argument('--db-config', '-d', default=None, help='Database configuration JSON file')
    parser.add_argument('--question-rows', type=int, default=None, help='Limit number of questions to send to the API')    
    parser.add_argument('--evidence-column', type=str, default=None, help='Column name containing evidence/context for questions')
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.CRITICAL, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    load_dotenv('project_config.env')

    host = os.getenv('DATA_CATALOG_HOST')
    port = os.getenv('DATA_CATALOG_PORT')

    initialize_data_catalog(
        user=args.user,
        password=args.password
    )
    
    df_input_full = pd.read_excel(args.input)

    if df_input_full.empty:
        logger.info(f"Input Excel file '{args.input}' is empty. Cannot proceed.")
        return

    # --- 1-row test for AI SDK response structure ---
    logger.critical("Performing 1-row test call to AI SDK for response structure check...")
    df_input_test = df_input_full.head(1)
    
    if df_input_test.empty:
        logger.error("Could not get a row from the input file for the AI SDK test call.")
        return
    
    initialization_successful = run_initialization_check(
        actual_api_url=args.api_url,
        actual_username=args.user,
        actual_password=args.password,
        path_to_excel=args.input,
        question_column=args.question_column
    )

    if not initialization_successful:
        logger.critical("Initialization checks failed. AI SDK or Database connection might be down or misconfigured. Aborting main evaluation.")
        return
    
    main_sdk_output_temp_path = None


    try:
        logger.critical('--- Initialization Succesful, Running Full Evaluation ---')

        # --- Main AI SDK generation ---
        df_input_for_main_run = df_input_full
        if args.question_rows is not None:
            df_input_for_main_run = df_input_full.head(args.question_rows)
            logger.error(f"Limiting main AI SDK generation to {len(df_input_for_main_run)} questions based on --question_rows={args.question_rows}.")
        else:
            logger.error(f"Processing all {len(df_input_for_main_run)} questions for main AI SDK generation.")
        
        if df_input_for_main_run.empty:
            logger.warning("No questions to process for main AI SDK generation after applying --question_rows limit. Subsequent evaluations might be empty.")
 
            df_original = pd.DataFrame() 
        else:
            df_original = generate_aisdk_responses_as_dataframe(
                df_input_for_main_run,
                question_column=args.question_column,
                expected_column=args.expected_column,
                difficulty_column=args.difficulty_col,
                evidence_column=args.evidence_column, 
                api_url=args.api_url,
                username=args.user,
                password=args.password,
                max_workers=args.max_workers,
                numrows=args.question_rows 
            )

        # Create a temporary file to save df_original
        sdk_output_fd, main_sdk_output_temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(sdk_output_fd) 
        df_original.to_excel(main_sdk_output_temp_path, index=False)
        logger.info(f"Main AI SDK responses generated and saved to temporary file: {main_sdk_output_temp_path}")

        # Run F1 evaluation
        logger.info("\n=== Running F1 Evaluation ===")
        f1_args = argparse.Namespace(
            input=main_sdk_output_temp_path, 
            output=args.f1_output,
            num_cpus=args.max_workers, timeout=args.timeout, user=args.user, password=args.password,
            host=host, port=port, db_config=args.db_config,
            ground_truth_col=args.expected_column, generated_col="VQL Generated",
            difficulty_col=args.difficulty_col   
        )
        f1_summary_df,f1_details_df = f1_main(f1_args)  
        
        # Run VES evaluation
        logger.info("\n=== Running VES Evaluation ===")
        ves_args = argparse.Namespace(
            input=main_sdk_output_temp_path, 
            output=args.ves_output,
            num_cpus=args.max_workers,
            timeout=args.timeout,
            iterate_num=args.iterate_num,
            user=args.user,
            password=args.password,
            host=host, 
            port=port,
            db_config=args.db_config,
            ground_truth_col=args.expected_column,
            generated_col="VQL Generated",
            difficulty_col=args.difficulty_col  
        )
        ves_summary_df, ves_details_df = ves_main(ves_args)
        
        merge_evaluations(args.f1_output, args.ves_output, args.output, 
                          f1_details_df=f1_details_df, ves_details_df=ves_details_df, 
                          f1_summary_df=f1_summary_df, ves_summary_df=ves_summary_df)

        logger.info("\n=== Evaluation Complete ===")
        logger.info(f"F1 results: {args.f1_output}")
        logger.info(f"VES results: {args.ves_output}")
        logger.info(f"Combined results: {args.output}")

    except Exception as e:
        logger.error(f"An error occurred in the main processing: {e}")
        logger.error(traceback.format_exc())
    finally:
        if main_sdk_output_temp_path and os.path.exists(main_sdk_output_temp_path):
            try:
                os.remove(main_sdk_output_temp_path)
                logger.info(f"Successfully deleted temporary main SDK output file: {main_sdk_output_temp_path}")
            except OSError as e:
                logger.error(f"Error deleting temporary main SDK output file {main_sdk_output_temp_path}: {e}")
            except Exception as e: 
                logger.error(f"An unexpected error occurred while trying to delete {main_sdk_output_temp_path}: {e}")



if __name__ == "__main__":
    main()