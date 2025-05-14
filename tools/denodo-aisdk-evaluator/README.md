# Denodo AI SDK Evaluator

## Introduction

**Denodo AI SDK Evaluator** is a specialized tool for assessing the performance and accuracy of queries generated using the Denodo AI SDK.The tool provides quick feedback on the effectiveness of AI integrations with Denodo AI SDK, facilitating improvements in accuracy and performance through prompt and context improvement.

## Features

- **Result Set Correctness:** Executes each generated VQL query and compares its results against the ground truth using F1 score metrics. This handles uneven result sets through precision/recall calculation, ensuring accurate comparison even when dimensions differ.

- **Result Set Overlap Percentage:** Measures the percentage of overlapping values between generated and reference result sets, providing an intuitive metric for how closely the outputs match.

- **Efficiency Evaluation:** Measures execution duration across multiple iterations to determine query efficiency on the Denodo platform. A higher VES indicates more efficient query execution where 100 is the benchmark standard.

- **Difficulty-Based Analysis:** Groups and analyzes all metrics by difficulty levels (simple, moderate, challenging) to provide insights into query performance across complexity levels.

# Generated Excel

The generated Excel file provides a view of the benchmark results in two main sheets:

Summary Sheet:
This sheet offers an aggregated overview of the assessments grouped by difficulty level. It displays key metrics—such as the Percentage of Correct Queries, Percent Overlap of the result sets, and Number of Samples—along with AI SDK time statistics like Mean and Standard Deviation. Charts are also embedded to visually represent these metrics.

Details Sheet:
This sheet contains the individual evaluation results for each query pair, including the generated VQL, the ground truth VQL, and binary indicators such as Results Match, Subsetting Percentage, Have Same Row Count, Bird Standard F1, and VES Score. Each row corresponds to a specific question, allowing you to inspect the performance on a per-query basis. 

## Understanding The Results

The evaluator produces an Excel sheet with key metrics to help you quickly assess query performance:

### Key Summary Metrics

Percent Overlap: Represents how much of the expected data is retrieved by generated queries. Calculated as the percentage of values that appear in both the generated and ground truth result sets. Higher values indicate better results accuracy.

Percent Correct Queries: Shows the percentage of queries that produce exactly matching result sets when compared to ground truth queries. This is a strict measurement even a small difference will mark a query as incorrect.

Percent Row Count Match: Indicates how often generated queries return the correct number of rows, regardless of content. This helps identify queries that may be structurally correct  even if the specific values differ. This could possibly indicate a failure of a filter.

Results are broken down by difficulty categories (simple, moderate, challenging)


## How It Works

The evaluation process is composed of several stages that systematically process each query:

### 1. **Valid Efficiency Score (VES Calculation):**

### ves_eval.py

Provides time-based efficiency measurements:

- Repeatedly executes both the predicted VQL query and the ground-truth VQL query
- Takes the ratio of their execution times (after removing extreme outliers)
- Translates that ratio into a "reward" or score (the "Value Execution Score," VES) that indicates how fast or efficient the predicted query runs compared to the ground-truth query
- Logs any timeouts or execution issues, defaulting to a reward of 0 if queries fail or timeout

This module helps identify whether a predicted query is not only correct but also efficient.

### 2. **Correctness Evaluation:**

#### f1_eval.py

Offers correctness metrics based on the F1 score:

- Compares the returned results from a predicted VQL query to those of a ground-truth VQL query
- Handles result sets with different dimensions (e.g., comparing a 2×3 result with a 3×2 result)
- Converts each result set into tuples of string values for comparison
- Calculates true positives (matching cells), false positives, and false negatives using a confusion matrix approach
- Derives precision, recall, and F1 scores from these values
- Calculates the percentage of overlapping result values
- Allows parallel execution of queries using multiprocessing

#### Example

```Ground Truth Expected Result:```

|       | 0    | 1     | 2  |
|-------|------|-------|----|
| 0     | John | Doe   | 35 |
| 1     | Jane | Smith | 28 |

```Generated Result```

|  | A    | B       |
|--|------|---------|
| 0| John | Doe     |
| 1| Jane | Smith   |
| 2| Bob  | Johnson |

#### Confusion Matrix Calculation

```Ground Truth Rows```

|Row 1                |                   Row 2|
|---------------------|------------------------|
|('John', 'Doe', '35')| ('Jane', 'Smith', '28')|

```Generated Rows```

|Row 1          | Row 2           | Row 3             |
|---------------|-----------------|-------------------|
|('John', 'Doe')|('Jane', 'Smith')| ('Bob', 'Johnson')|

- True Positives (TP) = 4 (matching cells)
- False Positives (FP) = 2 (extra cells in prediction)
- False Negatives (FN) = 2 (missing cells from ground truth)

### Calculate F1

- Precision = TP / (TP + FP) = 4 / (4 + 2) = 4/6 = 0.667
- Recall = TP / (TP + FN) = 4 / (4 + 2) = 4/6 = 0.667
- F1 = 2 * (Precision * Recall) / (Precision + Recall) = 2 * (0.667 * 0.667) / (0.667 + 0.667) = 0.667

### Percent Subset

Measures how much of the expected data is retrieved by the generated query. Unlike Percent Overlap (precision), this is not column order sensitive.

```Ground Truth Rows:```


|Row 1          |              Row 2|
|---------------|-------------------|
|('John', 'Doe')| ('Jane', 'Smith',)|

```Generated Rows:```

|Row 1            | Row 2         |
|-----------------|---------------|
|('Jane', 'Smith')|('John', 'Doe')| 

Here, for the first row the generated dataframe has the first two elements swapped compared to the ground truth. However, because the Subset calculation is order-insensitive, all cells are still recognized as present. The counts remain:

Percent Subset = 1


## Installing the Environment

#### Requirements

- **Python:** 3.12+
- **Denodo:** 9.0.5 or higher (either Express or Enterprise Plus license is required) instance, with cache enabled.
- **Denodo AI SDK**
- **Denodo VDP**

Once you have installed the prerequisites, you will proceed by creating the Python virtual environment and installing the required dependencies. The steps are the same for both Windows and Linux, unless otherwise specified.

#### Steps

1. **Move to the AI SDK Evaluator root directory:**

```bash
cd [path to the Denodo AI SDK Evaluator]
```

2. **Create the Python virtual environment:**

```bash
python -m venv venv
```

This will create a venv folder inside your AI SDK folder where all the specific dependencies for this project will be installed.

3. **Activate the virtual environment:**

Windows:

```bash
venv\Scripts\activate
```

Linux:

```bash
source venv/bin/activate
```

4. **Install the required dependencies:**

```bash
python -m pip install -r requirements.txt
```

## Usage

The AI SDK Evaluator is a python executable that takes command line parameters. Below is a comprehensive list of all command line parameters available in the Denodo AI SDK Evaluator:

Usage
The AI SDK Evaluator consists of several modules that can be used independently or together. Below are usage parameters available for each component.


### **ai_sdk_utils.py**

Parameters:

- **--input_file** – Path to the input Excel file with questions.
- **--output_excel** – Path to save the output Excel file (default: `vql_results.xlsx`).
- **--question_column** – Name of the column containing questions (default: `"Question"`).
- **--expected_column** – Name of the column containing the expected VQL (default: `"Solution"`).
- **--difficulty_column** – Name of the column containing difficulty levels (default: `"difficulty"`).
- **--api_url** – AI SDK API endpoint URL (default: `http://127.0.0.1:8008/answerDataQuestion`).
- **--api_username** – API authentication username (default: `admin`).
- **--api_password** – API authentication password (default: `admin`).
- **--max_workers** – Maximum number of parallel API requests (default: `10`).
- **--sheet_name** – Sheet name in the Excel file (default: `None` — if not specified, the first sheet is used).
- **--header** – Row to use as header (0-indexed; default: `0`).
- **--rows** – Number of rows to process (default: all rows).
- **--question_rows** – Limit on the number of questions to send to the API (default: process all questions).

---

### **f1_eval.py**

Parameters:

- **--input** – Input Excel file with VQL queries (required).
- **--output** – Output Excel file (default: `results.xlsx`).
- **--num-cpus** – Number of CPUs for parallel processing (default: `2`).
- **--timeout** – Query execution timeout in seconds (default: `30.0`).
- **--user** – Database user for Denodo (default: `admin`).
- **--password** – Database password for Denodo (default: `admin`).
- **--host** – Database host for Denodo (default: `localhost`).
- **--port** – Database port for Denodo (default: `9996`).
- **--database** – Database name (default: `spider`).
- **--db-config** – Database configuration JSON file (alternative to individual parameters).
- **--ground-truth-col** – Column name containing the ground truth VQL (default: `ground_truth_vql`).
- **--generated-col** – Column name containing the generated VQL (default: `generated_vql`).
- **--difficulty-col** – Column name containing the difficulty level (default: `difficulty`).

---

### **ves_eval.py**

Parameters:

This module uses the same parameters as the F1 evaluation, plus:

- **--iterate-num** – Number of iterations for time comparison (default: `3`).

---

### **combined_eval.py**

Runs the entire evaluation pipeline—generating AI SDK responses, performing F1 and VES evaluations, and merging results.

Parameters:

- **--input** – Input Excel file with source data (required).
- **--output** – Output Excel file for merged results .
- **--f1-output** – F1 evaluation output file (default: `None`).
- **--ves-output** – VES evaluation output file (default:`None`).
- **--output-original** – Output Excel file from AI SDK responses (default: `None`).
- **--question-column** – Column name containing questions (default: `"Question"`).
- **--expected-column** – Column name containing the expected answer/VQL (default: `"Solution"`).
- **--difficulty-col** – Column name containing difficulty levels (default: `"difficulty"`).
- **--api-url** – AI SDK API endpoint URL (default: `http://127.0.0.1:8008/answerDataQuestion`).
- **--api-username** – AI SDK API username (default: `admin`).
- **--api-password** – AI SDK API password (default: `admin`).
- **--max-workers** – Maximum number of parallel workers for AI SDK calls (default: `10`).
- **--num-cpus** – Number of CPUs for parallel processing (default: `2`).
- **--timeout** – Query execution timeout in seconds (default: `30.0`).
- **--iterate-num** – Number of iterations for VES time comparison (default: `3`).
- **--user** – Database user (default: `admin`).
- **--password** – Database password (default: `admin`).
- **--host** – Database host (default: `localhost`).
- **--port** – Database port (default: `9996`).
- **--database** – Database name (default: `minibird`).
- **--db-config** – Database configuration JSON file (alternative to individual parameters).
- **--question_rows** – Limit on the number of questions to send to the API (default: process all questions).
- **--evidence-column** -Column name contianing additional context or evidence. To be added to /AnswerQuestion Additional Context Parameter.

## Example Workflow

```bash
# Step 1: Navigate to the project directory
cd path/to/aisdk_eval_suite

# Step 2: Activate the virtual environment
# Windows
venv\Scripts\activate
# Linux
source venv/bin/activate

cd eval

# Step 3: Run the combined evaluation
python -m combined_eval \
  --input "data/questions.xlsx" \
  --output "results/evaluation.xlsx" \
  --question-column "Query" \
  --expected-column "ExpectedVQL" \
  --difficulty-col "difficulty" \
  --api-url "http://your-server:8008/answerDataQuestion" \
  --user "your_username" \
  --password "your_password" \
  --host "localhost" \
  --port 9996 \
  --database "your_database" \
  --question_rows 20
```

