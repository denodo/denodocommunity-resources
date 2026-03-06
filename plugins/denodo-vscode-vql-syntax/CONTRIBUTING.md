# Contributing to Dendodo VQL Syntax Highlighting for VS Code

Thank you for your interest in contributing to the Denodo VQL Syntax Highlighter! We welcome improvements, bug fixes, and new features.

## Prerequisites
To work on this extension, you need:
* **Node.js**: v20 or higher.
* **pnpm**: This project uses `pnpm` instead of `npm`. (Enable it via `corepack enable`).
* **Visual Studio Code**: v1.90.0 or newer.

## Getting Started

1. **Clone** the repository.
2. **Install Dependencies**:
   ```bash
   # Enable pnpm if you haven't already (requires Node.js v20+)
   corepack enable
   
   # Install project dependencies
   pnpm install
   ```
3. **Open in VS Code**:
   ```bash
   code .
   ```
   Please note all development work has been done in WSL to maximize compatability, but standard Windows/macOS/Linux environments will work perfectly.

## Development Workflow

1. Running the Extension (Visual Test)
    - Press `F5` inside VS Code.  This opens a new window call the Extension Development Host.
    - In the new window, open the `test.vql` file located in the root directory.
    - Verify your changes to the `syntaxes/vql.tmLanguage.json` file visually.
    - If you edit the grammar file while the host window is open, simply press `Ctrl+R` (`Cmd+R` on Mac) in the host window to reload it and instantly see your changes.
2. Validating the Grammar
    - JSONLint is used in the CI pipeline to ensure the grammar file is valid. Perform this test locally to catch syntax errors before pushing:
        ```bash
        pnpm dlx jsonlint syntaxes/vql.tmLanguage.json -q
        ```
3. Debugging Scopes
    If a keyword is not highlighting as expected or conflicting with another rule:
      - Open the Extension Development Host `F5`.
      - Open the Command Palette (`Ctrl+Shift+P`/`Cmd+Shift+P`).
      - Run `Developer: Inspect Editor Tokens and Scopes`.
      - Click on the code in `test.vql` of interest.  This will show you exactly which regex rule is capturing the text and specific TextMate scope being applied.

## Submitting a Pull Request

1. Create a new branch for your feature or bug fix (git switch -c feat/my-new-feature).
2. Make your changes and ensure they pass the local JSONLint validation.
3. Commit your changes with a descriptive message.
4. Push your branch to your fork and open a Pull Request against the main branch.

## Reporting Issues

1. Please use the provided Issue Templates when reporting an issue:
    - **Bug Report**: For reporting errors or incorrect highlighting behaviors.
    - **Feature Request**: For requesting support for new VQL Functions or syntax. Please provide VQL code snippets in your request for testing.

## License

By contributing you agree that your contiributions will be licensed under the [MIT License](./LICENSE).
     
    