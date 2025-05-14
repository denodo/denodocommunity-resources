import os
import json
import argparse
import requests
import pandas as pd
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
import logging

logger = logging.getLogger(__name__)

def call_answer_question_api(question: str, evidence: str, api_url: str = "http://127.0.0.1:8008/answerDataQuestion",  username: str = "admin", password: str = "admin", pbar=None):
    """
    Call the Q&A API with a single question and evidence.

    Args:
    question: The question to answer
    evidence: Supporting evidence to use for answering
    api_url: API endpoint URL
    username: Authentication username
    password: Authentication password
    pbar: Optional progress bar to update

    Returns:
    dict: JSON response from API or error dict
    """
     
    url = api_url
    params = {
        "question": question,
        "custom_instructions": evidence,
        "markdown_response": "false",
        "disclaimer": "false"
    }
    logger.info("Submitting question to API endpoint: '%s'", api_url)
    logger.debug("Full question: '%s', Evidence: '%s'", question, evidence)
    try:
        response = requests.get(url, params=params, auth=(username, password))
        response.raise_for_status()

        result = response.json()
    except requests.RequestException as err: # import requests
        logger.error("Error for question '%s': %s", question, err)
        result = {"error": str(err)}
    

    if pbar:
        pbar.update(1)
    
    return result



def call_answer_question_api_multiple(questions, evidences, api_url: str = "http://127.0.0.1:8008/answerDataQuestion", username: str = "admin", password: str = "admin", max_workers: int = 10):
    '''
    Call the AI SDK API in parallel.
    Args:
    questions: List of questions to answer
    evidences: List of supporting evidence for each question
    api_url: API endpoint URL
    username: Authentication username
    password: Authentication password
    max_workers: Maximum number of parallel workers
    
    Returns:
    List of JSON responses from the API

    '''
    with tqdm(total=len(questions), desc="Making API calls") as pbar:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            try:
                responses = list(executor.map(
                    lambda q_e: call_answer_question_api(q_e[0], q_e[1], api_url, username, password, pbar), 
                    zip(questions, evidences)
                ))
            except Exception as e:
                logger.error(f"Error during API calls: {str(e)}")
                responses = [{"error": str(e)}] * len(questions)
    return responses





def generate_responses(questions, evidences, api_url: str = "http://127.0.0.1:8008/answerDataQuestion", username: str = "admin", password: str = "admin", max_workers = 10):
    '''
    Generate responses for a list of questions using the AI SDK API.
    Args:
    questions: List of questions to answer
    evidences: List of supporting evidence for each question    
    api_url: API endpoint URL
    username: Authentication username
    password: Authentication password
    max_workers: Maximum number of parallel workers

    Returns:
    List of tuples containing question, answer, SQL query, and tables used

    '''
    try:
        all_responses = call_answer_question_api_multiple(
            questions, evidences, api_url, username, password, max_workers
        )
    except Exception as e:
        logger.error(f"Error calling API: {str(e)}")
        return [(question, None, None, None) for question in questions]

    results = []
    for question, response_dict in tqdm(zip(questions, all_responses), desc="Processing API responses", total=len(all_responses)):
        if "error" in response_dict:

            logger.error("Error processing question '%s': %s", question, response_dict["error"])
            results.append((question, None, None, None))
        else:
            results.append((
                question,
                response_dict.get("answer"),
                response_dict.get("sql_query"),
                response_dict.get("tables_used"),
                response_dict.get('sql_execution_time'),
                response_dict.get('vector_store_search_time'),
                response_dict.get('llm_time'),
                response_dict.get('total_execution_time')
            ))
            logger.debug("Full API response: %s", json.dumps(response_dict, indent=2))
    return results



def generate_aisdk_responses_as_dataframe(df: pd.DataFrame, question_column: str, expected_column: str = None, 
                                         difficulty_column: str = None, evidence_column: str = None,
                                         api_url: str = "http://127.0.0.1:8008/answerDataQuestion",

                                         username: str = "admin", password: str = "admin", max_workers: int = 10, numrows: int = None):
    
    """
    Generate AI SDK responses and return results as a DataFrame.
    Args:
        df: Input DataFrame containing questions
        question_column: Column name containing questions
        expected_column: Optional column name for expected answers
        difficulty_column: Optional column for difficulty ratings
        evidence_column: Optional column name for evidence/context
        api_url: API endpoint URL
        username: Authentication username
        password: Authentication password
        max_workers: Maximum number of parallel workers
        
    Returns:
        pd.DataFrame: DataFrame with questions, answers, and metadata
    """
    df = df.head(numrows) if numrows else df
    questions = df[question_column].tolist()
    # Use evidence column if provided, otherwise use empty strings
    evidences = df[evidence_column].tolist() if evidence_column and evidence_column in df.columns else [""] * len(df)

    logger.info("Generating AI SDK responses for %d questions.", len(df))
    all_results = generate_responses(questions, evidences, api_url, username, password, max_workers)
    result_df = pd.DataFrame(all_results, columns=[question_column, "Answer", "VQL Generated", "Tables Used", "sql_execution_time", "vector_store_search_time", "llm_time", "total_execution_time"])
    result_df["Tables Used"] = result_df["Tables Used"].astype(object)

    result_df['index'] = range(1, len(result_df) + 1)

    
    if expected_column and expected_column in df.columns:

        df["cleaned_question"] = df[question_column].fillna("").astype(str).str.strip().str.lower()
        expected_map = df.drop_duplicates("cleaned_question").set_index("cleaned_question")[expected_column].to_dict()
        
        # Then ensure strings in the result dataframe
        result_df["cleaned_question"] = result_df[question_column].fillna("").astype(str).str.strip().str.lower()
        result_df[expected_column] = result_df["cleaned_question"].map(expected_map)
        result_df.drop(columns=["cleaned_question"], inplace=True)
        
        # Reorder columns
        cols = ['index',question_column, "Answer", "VQL Generated", expected_column, "Tables Used", "sql_execution_time", "vector_store_search_time", "llm_time", "total_execution_time"]
        result_df = result_df[cols]
    
    if difficulty_column and difficulty_column in df.columns:
        result_df[difficulty_column] = df[difficulty_column].values
    
    logger.info("Completed generating AI SDK responses.")
    return result_df


def main():
    # Configure logging
    logging.basicConfig(level=logging.CRITICAL, format='%(asctime)s [%(levelname)s] %(name)s - %(message)s')   
    logger = logging.getLogger(__name__)
    parser = argparse.ArgumentParser(description="Generate VQL queries with AI SDK and save results to Excel")
    
    # Required parameters
    parser.add_argument("--input_file", type=str, required=True, help="Path to the input Excel file")
    parser.add_argument("--output_excel", type=str, default="vql_results.xlsx", help="Path to save the output Excel file")
    parser.add_argument("--question_column", type=str, default="Question", help="Column name containing questions")
    parser.add_argument("--expected_column", type=str, default="Solution", help="Column name containing expected VQL")
    parser.add_argument("--difficulty_column", type=str, default="difficulty", help="Column name containing difficulty levels")
    parser.add_argument("--api_url", type=str, default="http://127.0.0.1:8008/answerDataQuestion", help="AI SDK API endpoint URL")
    parser.add_argument("--api_username", type=str, default="admin", help="API authentication username")
    parser.add_argument("--api_password", type=str, default="admin", help="API authentication password")
    parser.add_argument("--max_workers", type=int, default=10, help="Maximum number of parallel API requests")
    parser.add_argument("--sheet_name", type=str, default=None, help="Sheet name in the Excel file")
    parser.add_argument("--header", type=int, default=0, help="Row to use as header (0-indexed)")
    parser.add_argument("--rows", type=int, default=None, help="Number of rows to process (None for all)")
    parser.add_argument("--question_rows", type=int, default=None, help="Limit number of questions to send to the API")
    parser.add_argument("--evidence_column", type=str, default=None, help="Column name containing evidence/context for questions")

    args = parser.parse_args()
    try:
        excel_kwargs = {}
        if args.sheet_name:
            excel_kwargs['sheet_name'] = args.sheet_name
        if args.header is not None:
            excel_kwargs['header'] = args.header
        
        df_input = pd.read_excel(args.input_file, **excel_kwargs)
        logger.info(f"Successfully loaded {len(df_input)} rows from {args.input_file}")
        
        # Limit rows if specified by --rows argument
        if args.rows is not None:
            df_input = df_input.head(args.rows)
            logger.info(f"Limited to {args.rows} rows due to --rows parameter")
        
        if args.question_rows is not None:
            df_input = df_input.head(args.question_rows)
            logger.info(f"Limited to {args.question_rows} questions due to --question_rows parameter")
            
        # Log column information
        logger.info(f"Columns found: {df_input.columns.tolist()}")
        
        # Check for required columns
        required_columns = [args.question_column]
        missing_columns = [col for col in required_columns if col not in df_input.columns]
        if missing_columns:
            logger.error(f"Missing required columns: {missing_columns}")
            return 1
            
    except pd.errors.EmptyDataError:
        logger.error("The Excel file is empty.")
        return 1
    except pd.errors.ParserError:
        logger.error("Error parsing the Excel file. Please check the file format.")
        return 1
    except FileNotFoundError:
        logger.error(f"The file {args.input_file} was not found.")
        return 1
    except PermissionError:
        logger.error(f"Permission denied when trying to read {args.input_file}.")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error reading Excel file: {str(e)}")
        return 1
    
    # Generate AI responses
    logger.info("Generating AI SDK responses...")
    try:
        df_responses = generate_aisdk_responses_as_dataframe(
            df_input,
            question_column=args.question_column,
            expected_column=args.expected_column,
            difficulty_column=args.difficulty_column,
            evidence_column=args.evidence_column,
            api_url=args.api_url,
            username=args.api_username,
            password=args.api_password,
            max_workers=args.max_workers
        )
        logger.info(f"Generated {len(df_responses)} responses")
        
    except requests.exceptions.RequestException as e:
        logger.error(f"API request error: {str(e)}")
        return 1
    except ValueError as e:
        logger.error(f"Value error in generate_aisdk_responses_as_dataframe: {str(e)}")
        return 1
    except Exception as e:

        logger.error(f"Error generating responses: {str(e)}")
        return 1
    
    # Ensure we have the needed columns
    required_output_columns = [args.question_column, 'Answer', 'VQL Generated', args.expected_column, 'Tables Used', 'index', "sql_execution_time", "vector_store_search_time", "llm_time", "total_execution_time"]
    missing_output_columns = [col for col in required_output_columns if col not in df_responses.columns]
    
    if missing_output_columns:
        logger.warning(f"Some columns are missing in the output: {missing_output_columns}")
    
    # Ensure difficulty column is copied if it exists
    if args.difficulty_column in df_input.columns and args.difficulty_column not in df_responses.columns:
        df_responses[args.difficulty_column] = df_input[args.difficulty_column]
        logger.info(f"Copied difficulty column from input DataFrame")
    
    # Save results to Excel

    logger.info(f"Saving results to {args.output_excel}")
    try:
        # Make sure the output directory exists
        os.makedirs(os.path.dirname(os.path.abspath(args.output_excel)), exist_ok=True)
        
        # Save directly without adding description row
        df_responses.to_excel(args.output_excel, index=False)
        
        logger.info(f"Successfully saved results to {args.output_excel}")
        return 0
        
    except Exception as e:
        logger.error(f"Error saving Excel file: {str(e)}")
        return 1
    

if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)