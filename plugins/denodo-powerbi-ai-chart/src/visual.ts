// Import necessary modules
import powerbi from "powerbi-visuals-api";
import MarkdownIt from 'markdown-it';
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";
import denodoLogo from './denodo.png';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;


import { VisualFormattingSettingsModel } from "./settings";

// Initialize the Markdown parser
const md = new MarkdownIt({
    html: true, // Allow HTML in Markdown
    linkify: true, // Automatically link URLs
    typographer: true // Enable typographic replacements
});

export class Visual implements IVisual {
    private target: HTMLElement;
    private username: string | null = null;
    private password: string | null = null;
    private server: string | null = "denodo-ai-sdk.api";
    private port: string | null = "8008";
    private updateCount: number;
    private textNode: Text;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private memory: { question: string; response: string }[] = []; // Memory storage;
    private fieldValue: string | null = null;

    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.updateCount = 0;
        if (document) {
            const new_p: HTMLElement = document.createElement("p");
            new_p.appendChild(document.createTextNode("Update count:"));
            const new_em: HTMLElement = document.createElement("em");
            this.textNode = document.createTextNode(this.updateCount.toString());
            new_em.appendChild(this.textNode);
            new_p.appendChild(new_em);
            this.target.appendChild(new_p);
        }
    }
    
    public update(options: VisualUpdateOptions) {

        // Clear the visual container to avoid duplicates
        this.target.innerHTML = '';

        // Access the data from the field
        const categorical = options.dataViews[0].categorical;
        if (categorical && categorical.categories && categorical.categories.length > 0) {
            const value = categorical.categories[0].values[0]; // Get the single value
            this.fieldValue = value !== null && value !== undefined ? String(value) : null;
        }

        // Access the data from the field
        const category = categorical && categorical.categories && categorical.categories[0];
        const isUsedTablesMapped = category && category.values && category.values.length > 0;

        // If `used_tables` is mapped, store the value of the single column
        if (isUsedTablesMapped) {
            const value = category.values[0]; // Get the single value (only one column allowed)
            this.fieldValue = value !== null && value !== undefined ? String(value) : null;
        } else {
            this.fieldValue = null; // No mapping
        }

        // Create a main container
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.padding = '20px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.position = 'relative';
    
        // Denodo logo in the top right corner
        const logoElement = document.createElement('img');
        logoElement.src = denodoLogo;
        logoElement.style.position = 'absolute';
        logoElement.style.top = '10px';
        logoElement.style.right = '10px';
        logoElement.style.width = '100px';
        logoElement.style.height = 'auto';
        container.appendChild(logoElement);
    
        // Title with version label positioned at the top-left corner
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.position = 'absolute';
        titleContainer.style.top = '5px';
        titleContainer.style.left = '5px';
    
        const titleElement = document.createElement('h2');
        titleElement.textContent = 'Ask a Question';
        titleElement.style.color = '#333';
        titleElement.style.marginRight = '5px';
        titleElement.style.fontSize = '18px'; // Slightly smaller font
    
        titleContainer.appendChild(titleElement);
        container.appendChild(titleContainer);
    
        // Question input field and Mode dropdown with adjusted spacing
        const questionInput = document.createElement('input');
        questionInput.type = 'text';
        questionInput.placeholder = 'Enter Your Question';
        questionInput.style.flex = '3'; // Increased width for question input
        questionInput.style.padding = '8px';
        questionInput.style.border = '1px solid #ccc';
        questionInput.style.borderRadius = '5px';
        questionInput.style.fontSize = '14px';
        questionInput.style.backgroundColor = '#f0f0f0';
        questionInput.style.color = 'black';
        questionInput.style.height = '36px';
        questionInput.style.boxSizing = 'border-box';
    
        const modeDropdown = document.createElement('select');
        modeDropdown.style.marginLeft = '10px'; // Increased spacing between question input and dropdown
        modeDropdown.style.padding = '5px';
        modeDropdown.style.border = '1px solid #ccc';
        modeDropdown.style.borderRadius = '5px';
        modeDropdown.style.fontSize = '14px';
        modeDropdown.style.height = '36px';
        //modeDropdown.style.verticalAlign = 'middle';
        modeDropdown.style.flex  = '1';
    
        const defaultOption = document.createElement('option');
        defaultOption.value = 'default';
        defaultOption.textContent = 'Default';
    
        const dataOption = document.createElement('option');
        dataOption.value = 'data';
        dataOption.textContent = 'Data';
    
        const metadataOption = document.createElement('option');
        metadataOption.value = 'metadata';
        metadataOption.textContent = 'Metadata';
    
        modeDropdown.appendChild(defaultOption);
        modeDropdown.appendChild(dataOption);
        modeDropdown.appendChild(metadataOption);
    
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.alignItems = 'center';
        inputContainer.style.width = '100%'; // Parent container width is dynamic
        inputContainer.style.marginTop = '40px'; // Add top margin to position below title
        inputContainer.appendChild(questionInput);
        inputContainer.appendChild(modeDropdown);
    
        container.appendChild(inputContainer);
    
        // Wrapper for both checkboxes
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.style.display = 'flex';
        checkboxWrapper.style.flexDirection = 'column';
        checkboxWrapper.style.alignItems = 'flex-start';
        checkboxWrapper.style.marginTop = '10px';
    
        // First checkbox with label
        const restrictCheckboxContainer = document.createElement('div');
        restrictCheckboxContainer.style.display = 'flex';
        restrictCheckboxContainer.style.alignItems = 'center';
        restrictCheckboxContainer.style.marginTop = '5px';
    
        const restrictCheckbox = document.createElement('input');
        restrictCheckbox.id = 'restrictCheckbox';
        restrictCheckbox.type = 'checkbox';
        restrictCheckbox.style.marginRight = '10px';
        //restrictCheckbox.disabled = true;
        if (!isUsedTablesMapped) {
            restrictCheckbox.disabled = true;
            restrictCheckbox.checked = false;
        } else {
            restrictCheckbox.disabled = false;
        }
    
        const restrictLabel = document.createElement('label');
        restrictLabel.id = 'restrictLabel';
        restrictLabel.textContent = 'Restrict the answer to your question to any report used tables?';
        restrictLabel.style.fontSize = '14px';
        restrictLabel.style.color = 'gray';
    
        restrictCheckboxContainer.appendChild(restrictCheckbox);
        restrictCheckboxContainer.appendChild(restrictLabel);
    
        const noReportNote = document.createElement('p');
        noReportNote.id = 'noReportNote';
        noReportNote.textContent = 'Answer will not be generated base on this dashboard!';
        noReportNote.style.backgroundColor = '#F4E5B9';
        noReportNote.style.color = '#8E722D';
        noReportNote.style.padding = '5px 10px';
        noReportNote.style.borderRadius = '5px';
        noReportNote.style.fontSize = '12px';
        noReportNote.style.marginTop = '5px';
        noReportNote.style.fontStyle = 'italic';

        const yesReportNote = document.createElement('p');
        yesReportNote.id = 'noReportNote';
        yesReportNote.textContent = 'Answer will be generated base on this dashboard!';
        yesReportNote.style.backgroundColor = '#E0EBD8';
        yesReportNote.style.color = '#8E722D';
        yesReportNote.style.padding = '5px 10px';
        yesReportNote.style.borderRadius = '5px';
        yesReportNote.style.fontSize = '12px';
        yesReportNote.style.marginTop = '5px';
        yesReportNote.style.fontStyle = 'italic';
    
        // Second checkbox with label
        const filtersCheckboxContainer = document.createElement('div');
        filtersCheckboxContainer.style.display = 'flex';
        filtersCheckboxContainer.style.alignItems = 'center';
        filtersCheckboxContainer.style.marginTop = '5px';
    
        const filtersCheckbox = document.createElement('input');
        filtersCheckbox.id = 'filtersCheckbox';
        filtersCheckbox.type = 'checkbox';
        filtersCheckbox.style.marginRight = '10px';
        filtersCheckbox.disabled = true;
    
        const filtersLabel = document.createElement('label');
        filtersLabel.id = 'filtersLabel';
        filtersLabel.textContent = 'Apply same filters for your specified Report?';
        filtersLabel.style.fontSize = '14px';
        filtersLabel.style.color = 'gray';
    
        filtersCheckboxContainer.appendChild(filtersCheckbox);
        filtersCheckboxContainer.appendChild(filtersLabel);
    
        checkboxWrapper.appendChild(restrictCheckboxContainer);
        checkboxWrapper.appendChild(filtersCheckboxContainer);
        checkboxWrapper.appendChild(noReportNote);
    
        container.appendChild(checkboxWrapper);
    
        // Submit and Clear buttons with increased spacing
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.marginTop = '20px'; // Increase space above buttons
    
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Submit';
        submitButton.style.backgroundColor = '#A5D56A';
        submitButton.style.border = 'none';
        submitButton.style.color = 'white';
        submitButton.style.padding = '8px 15px';
        submitButton.style.borderRadius = '5px';
        submitButton.style.cursor = 'pointer';
        submitButton.style.fontSize = '14px';
        submitButton.style.marginRight = '45px'; // Increased spacing between buttons
    
        const clearButton = document.createElement('button');
        clearButton.textContent = 'History';
        clearButton.style.backgroundColor = '#8A9DC5';
        clearButton.style.border = 'none';
        clearButton.style.color = 'white';
        clearButton.style.padding = '8px 15px';
        clearButton.style.borderRadius = '5px';
        clearButton.style.cursor = 'pointer';
        clearButton.style.fontSize = '14px';
    
        buttonContainer.appendChild(submitButton);
        buttonContainer.appendChild(clearButton);

        clearButton.addEventListener('click', () => {
            this.displayMemory(); // Show or hide memory on button click
        });
    
        // Modify the Authentication button to use an icon
        // Replace the authButton with an orange dot
        const authButton = document.createElement('div');
        authButton.id = 'authButton';
        authButton.style.position = 'absolute';
        authButton.style.bottom = '30px';
        authButton.style.right = '10px';
        authButton.style.width = '16px'; // Size of the dot
        authButton.style.height = '16px'; // Size of the dot
        authButton.style.borderRadius = '50%'; // Make it circular
        authButton.style.backgroundColor = 'orange'; // Orange color to indicate not logged in
        authButton.style.cursor = 'pointer';
        authButton.title = 'Click to authenticate'; // Tooltip for clarity

        // Add click event to open the authentication page
        authButton.addEventListener('click', () => {
            this.openAuthenticationPage();
        });

        // Append the icon to the button instead of text
        container.appendChild(authButton);

        // Create the clickable text element
        const clickableText = document.createElement('a'); // Anchor element
        clickableText.id = 'clickableText';
        clickableText.style.position = 'absolute';
        clickableText.style.bottom = '10px'; // Place it at the bottom of the page
        clickableText.style.left = '50%'; // Center it horizontally
        clickableText.style.transform = 'translateX(-50%)'; // Adjust for centering
        clickableText.style.color = 'blue'; // Make it look like a link
        clickableText.style.textDecoration = 'underline'; // Add underline to indicate clickability
        clickableText.style.fontSize = '9px'; // Font size
        clickableText.style.cursor = 'pointer'; // Show pointer on hover
        clickableText.style.marginTop = '20px'; // Add space above the clickable text
        clickableText.textContent = `Your Request will be sent to Server: ${this.server}`; // The clickable text
        clickableText.title = 'Click to input AI SDK URL'; // Tooltip for clarity

        // Add click event to call openUrlPage
        clickableText.addEventListener('click', () => {
            this.openUrlPage();
        });

        // Add additional margin to the button container for spacing
        buttonContainer.style.marginBottom = '40px'; // Increase space between buttons and clickable text

        // Append the clickable text to the container
        container.appendChild(clickableText);

        container.appendChild(buttonContainer);
        this.target.appendChild(container);
    
        restrictCheckbox.addEventListener('change', () => {
            if (restrictCheckbox.checked) {
                restrictLabel.style.color = 'green';
                filtersCheckbox.disabled = false;
                checkboxWrapper.removeChild(noReportNote);
                checkboxWrapper.appendChild(yesReportNote);
                
            } else {
                restrictLabel.style.color = 'gray';
                filtersCheckbox.disabled = true;
                filtersCheckbox.checked = false;
                filtersLabel.style.color = 'gray';
                checkboxWrapper.removeChild(yesReportNote);
                checkboxWrapper.appendChild(noReportNote);
            }
        });
    
        filtersCheckbox.addEventListener('change', () => {
            filtersLabel.style.color = filtersCheckbox.checked? 'green' : 'gray';
        });

        // Submit button event listener
        submitButton.addEventListener('click', async () => {
            const question = questionInput.value.trim(); // Trim to ignore leading/trailing spaces
            if (!question) {
                // Show the warning message if no input is provided
                this.openWarningPage();
                return; // Stop further execution
            }
            if (!this.username || !this.password) {
                this.openAuthenticationPage();
            } else if (!this.server || !this.port) {
                this.openUrlPage();
            } else {
                // Proceed with API call
                this.openResponseModal(); // Show loading message
                try {
                    const responseContent = await this.callAPI(
                        question,
                        modeDropdown.value,
                        this.username,
                        this.password,
                        this.fieldValue
                    );
                    this.updateModalContent(responseContent); // Update modal with API response content
                } catch (error) {
                    this.updateModalContent(`Error: ${error.message}`); // Display error in modal if API call fails
                }
            }
        });
        
            clearButton.addEventListener('click', () => {
                questionInput.value = '';
            });
        
            authButton.addEventListener('click', () => {
                this.openAuthenticationPage();
            });
        }
    
    private openWarningPage () {
        // Create overlay and add it to the document
        this.createOverlay();

         // Create the warning modal
        const warningModal = document.createElement('div');
        warningModal.style.position = 'fixed';
        warningModal.style.top = '50%';
        warningModal.style.left = '50%';
        warningModal.style.transform = 'translate(-50%, -50%)';
        warningModal.style.backgroundColor = 'white';
        warningModal.style.border = '1px solid black';
        warningModal.style.borderRadius = '10px';
        warningModal.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
        warningModal.style.padding = '15px';
        warningModal.style.zIndex = '1000'; // Ensure it's above the overlay
        warningModal.style.textAlign = 'center';
        warningModal.style.width = '250px'; // Adjust width as needed

        // Create the warning message
        const warningMessage = document.createElement('p');
        warningMessage.textContent = 'Please enter your question before submitting!';
        warningMessage.style.color = 'red';
        warningMessage.style.fontSize = '14px';
        warningMessage.style.marginBottom = '20px';
        warningModal.appendChild(warningMessage);

        // Create the close button (X)
        const closeButton = document.createElement('button');
        closeButton.textContent = '✖'; // X symbol
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '16px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'black';

        closeButton.addEventListener('click', () => {
            document.body.removeChild(warningModal); // Remove the modal
            this.removeOverlay(); // Remove the overlay
        });

        warningModal.appendChild(closeButton);

        // Append the warning modal to the document body
        document.body.appendChild(warningModal);
    }

    // Function to create a response modal popup
    private openResponseModal(responseContent: string | null = null) {
        // Create overlay and add it to the document
        this.createOverlay();

        const existingModal = document.getElementById('responseModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        const modal = document.createElement('div');
        modal.id = 'responseModal';
        modal.style.position = 'fixed'; // Ensure the modal stays fixed to the viewport
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.padding = '20px';
        modal.style.backgroundColor = 'white';
        modal.style.border = '1px solid black';
        modal.style.zIndex = '1001';
        modal.style.width = '70%'; // Set width to 70% of the viewport
        modal.style.height = '70%'; // Set height to 70% of the viewport
        modal.style.overflow = 'hidden'; // Prevent modal overflow
        modal.style.boxShadow = '0px 4px 6px rgba(0,0,0,0.1)';
        modal.style.borderRadius = '10px'; // Adjust the radius as needed

        // Close button for the modal
        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        closeButton.style.position = 'fixed'; // Fix it within the modal
        closeButton.style.top = 'calc(3% - 5px)'; // Move closer to the top
        closeButton.style.right = 'calc(3% - 5px)'; // Move closer to the right
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '16px';
        closeButton.style.padding = '0'; // Ensure no extra space around the button
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'black';
        closeButton.style.zIndex = '1002'; // Ensure it appears above the modal content
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
            this.removeOverlay();
        });
        modal.appendChild(closeButton);

        // Content container for the modal
        const contentContainer = document.createElement('div');
        contentContainer.id = 'modalContentContainer';
        contentContainer.style.overflowY = 'auto'; // Enable scrolling within the content
        contentContainer.style.height = 'calc(100% - 40px)'; // Leave space for the close button

        // Loader container specifically for the loading animation
        const loaderContainer = document.createElement('div');
        loaderContainer.id = 'loaderContainer';
        loaderContainer.style.position = 'absolute'; // Positioning relative to modal
        loaderContainer.style.top = '50%'; // Center vertically
        loaderContainer.style.left = '50%'; // Center horizontally
        loaderContainer.style.transform = 'translate(-50%, -50%)'; // Adjust for element size
        contentContainer.appendChild(loaderContainer); // Append loader container

        modal.appendChild(contentContainer);
        document.body.appendChild(modal);

        // Add loading indicator if no response content is provided
        if (!responseContent) {
            this.createLoader(loaderContainer); // Use loaderContainer specifically for loading
        } else {
            this.updateModalContent(responseContent);
        }
    }


    // Function to update the modal content after loading
    private updateModalContent(responseContent: string) {
        const contentContainer = document.getElementById('modalContentContainer');
        if (contentContainer) {
            contentContainer.innerHTML = ''; // Clear the loading indicator
            const responseElement = document.createElement('div');
            responseElement.innerHTML = responseContent;
            contentContainer.appendChild(responseElement); // Add the actual response
        }
    }
    
    // Add overlay creation function to use for all modals
    private createOverlay(): HTMLElement {
        let overlay = document.getElementById('modalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modalOverlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.55)'; // Fully transparent overlay
            overlay.style.zIndex = '999'; // Layer below the modal
            overlay.style.pointerEvents = 'auto'; // Allow overlay to intercept clicks
            overlay.style.cursor = 'default'; // Optional: Set cursor to indicate non-interactive
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    // Function to remove the overlay
    private removeOverlay(): void {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }

    // Function to open the authentication page
    private openAuthenticationPage() {

        // Create overlay and add it to the document
        this.createOverlay();
        
        const existingModal = document.getElementById('authModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        const modal = document.createElement('div');
        modal.id = 'authModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.padding = '20px';
        modal.style.backgroundColor = 'white';
        modal.style.border = '1px solid black';
        modal.style.zIndex = '1000';
        modal.style.width = '250px';
        modal.style.boxShadow = '0px 4px 6px rgba(0,0,0,0.1)';
        modal.style.borderRadius = '10px'; // Adjust the radius as needed

        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'black';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
            this.removeOverlay();
        });

        const warningDiv = document.createElement('div');
        warningDiv.style.display = 'none'; // Initially hidden
        warningDiv.style.color = 'red';
        warningDiv.style.fontSize = '12px';
        warningDiv.style.marginTop = '10px';
        warningDiv.style.backgroundColor = '#ffe6e6';
        warningDiv.style.padding = '5px';
        warningDiv.style.border = '1px solid red';
        warningDiv.style.borderRadius = '5px';
        warningDiv.style.width = '80%';
        warningDiv.style.marginLeft = '0'; // Keep the left point unchanged
        warningDiv.style.marginRight = 'auto'; // Automatically adjust the right side
        warningDiv.textContent = 'Please make sure you have input in both username and password!';

        modal.appendChild(closeButton);
        const authButton = document.getElementById('authButton');

        if (this.username && this.password) {
            const loggedInMessage = document.createElement('p');
            loggedInMessage.textContent = `Logged in as: ${this.username}`;
            const logoutButton = document.createElement('button');
            logoutButton.textContent = 'Logout';
            logoutButton.style.backgroundColor = '#8A9DC5';
            logoutButton.style.borderRadius = '5px';  
            logoutButton.style.marginTop = '10px';
            logoutButton.addEventListener('click', () => {
                this.logout();
                //outputElement.textContent = 'Logged out. Please log in again.';
                document.body.removeChild(modal);
                authButton.style.backgroundColor = 'orange';
                this.removeOverlay();
            });

            modal.appendChild(loggedInMessage);
            modal.appendChild(logoutButton);            
        } else {
            const usernameInput = document.createElement('input');
            usernameInput.type = 'text';
            usernameInput.placeholder = 'Enter username';
            usernameInput.style.display = 'block';
            usernameInput.style.marginBottom = '10px';

            const passwordInput = document.createElement('input');
            passwordInput.type = 'password';
            passwordInput.placeholder = 'Enter password';
            passwordInput.style.display = 'block';
            passwordInput.style.marginBottom = '10px';

            const loginButton = document.createElement('button');
            loginButton.textContent = 'Login';
            loginButton.style.marginTop = '10px';
            loginButton.style.borderRadius = '5px';          
            loginButton.style.backgroundColor = '#A5D56A';
            loginButton.addEventListener('click', () => {
                const usernameValue = usernameInput.value.trim();
                const passwordValue = passwordInput.value.trim();
        
                if (!usernameValue || !passwordValue) {
                    warningDiv.style.display = 'block'; // Show the warning message
                    return; // Stop execution if inputs are invalid
                }
                this.username = usernameInput.value;
                this.password = passwordInput.value;
                //outputElement.textContent = `Logged in as: ${this.username}`;
                document.body.removeChild(modal);
                authButton.style.backgroundColor = 'lightgreen';
                this.removeOverlay();
            });

            modal.appendChild(usernameInput);
            modal.appendChild(passwordInput);
            // Append warningDiv to the modal so it can be displayed when needed
            modal.appendChild(warningDiv);
            modal.appendChild(loginButton);
        }

        document.body.appendChild(modal);
    }

    // Function to open the authentication page
    private openUrlPage() {

        // Create overlay and add it to the document
        this.createOverlay();
        
        const existingModal = document.getElementById('urlModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        const modal = document.createElement('div');
        modal.id = 'urlModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.padding = '20px';
        modal.style.backgroundColor = 'white';
        modal.style.border = '1px solid black';
        modal.style.zIndex = '1000';
        modal.style.width = '250px';
        modal.style.boxShadow = '0px 4px 6px rgba(0,0,0,0.1)';
        modal.style.borderRadius = '10px'; // Adjust the radius as needed

        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'black';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
            this.removeOverlay();
        });

        modal.appendChild(closeButton);

        if (this.server && this.port) {
            const urlMessage = document.createElement('p');
            urlMessage.textContent = `Your AI SDK Server is: ${this.server}, Port Number is: ${this.port}`;
            const modifyButton = document.createElement('button');
            modifyButton.textContent = 'Modify';
            modifyButton.style.backgroundColor = '#8A9DC5';
            modifyButton.style.borderRadius = '5px';  
            modifyButton.style.marginTop = '10px';
            modifyButton.addEventListener('click', () => {
                this.inputUrlPage();
                document.body.removeChild(modal);
                this.removeOverlay();
            });

            modal.appendChild(urlMessage);
            modal.appendChild(modifyButton);
        } else {
            this.inputUrlPage();
        }
        document.body.appendChild(modal);
    }

    private inputUrlPage() {
        // Create overlay and add it to the document
        this.createOverlay();
    
        const existingModal = document.getElementById('urlinputModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }
    
        const modal = document.createElement('div');
        modal.id = 'urlinputModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.padding = '20px';
        modal.style.backgroundColor = 'white';
        modal.style.border = '1px solid black';
        modal.style.zIndex = '1000';
        modal.style.width = '250px';
        modal.style.boxShadow = '0px 4px 6px rgba(0,0,0,0.1)';
        modal.style.borderRadius = '10px';
    
        const serverInput = document.createElement('input');
        serverInput.type = 'text';
        serverInput.placeholder = 'Server of your AI SDK';
        serverInput.style.display = 'block';
        serverInput.style.marginBottom = '10px';
    
        const portInput = document.createElement('input');
        portInput.type = 'text';
        portInput.placeholder = 'Port of your AI SDK';
        portInput.style.display = 'block';
        portInput.style.marginBottom = '10px';
    
        const warningDiv = document.createElement('div');
        warningDiv.style.display = 'none'; // Initially hidden
        warningDiv.style.color = 'red';
        warningDiv.style.fontSize = '12px';
        warningDiv.style.marginTop = '10px';
        warningDiv.style.backgroundColor = '#ffe6e6';
        warningDiv.style.padding = '5px';
        warningDiv.style.border = '1px solid red';
        warningDiv.style.borderRadius = '5px';
        warningDiv.textContent = 'Please make sure you have input in both Server and Port!';
    
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.marginTop = '10px';
        saveButton.style.borderRadius = '5px';
        saveButton.style.backgroundColor = '#A5D56A';
        saveButton.addEventListener('click', () => {
            const serverValue = serverInput.value.trim();
            const portValue = portInput.value.trim();
    
            if (!serverValue || !portValue) {
                warningDiv.style.display = 'block'; // Show the warning message
                return; // Stop execution if inputs are invalid
            }
            const clickableText = document.getElementById('clickableText')
            this.server = serverValue;
            this.port = portValue;  
            clickableText.textContent = `Your Request will be sent to Server: ${this.server}`;
            document.body.removeChild(modal);
            saveButton.style.backgroundColor = 'lightgreen';
            this.removeOverlay();
        });
    
        const closeButton = document.createElement('button');
        closeButton.textContent = '✖';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'black';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
            this.removeOverlay();
        });
    
        modal.appendChild(closeButton);
        modal.appendChild(serverInput);
        modal.appendChild(portInput);
        modal.appendChild(warningDiv); // Add the warning div to the modal
        modal.appendChild(saveButton);
    
        // Append the modal to the document body
        document.body.appendChild(modal);
    }
    
    // Function to log out by clearing the stored credentials
    private logout() {
        this.username = null;
        this.password = null;
        console.log('User logged out. Credentials cleared.');
    }

    // Function to calculate Basic Authentication header in TypeScript
    public calculateBasicAuthHeader(username: string, password: string): string {
        const userPass = `${username}:${password}`;
        const asciiBytes = new TextEncoder().encode(userPass);
        const base64String = btoa(String.fromCharCode(...asciiBytes));
        return 'Basic ' + base64String;
    }

    private createLoader(outputElement: HTMLElement): HTMLElement {
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.border = '16px solid #f3f3f3'; // Light grey
        loader.style.borderTop = '16px solid #3498db'; // Blue
        loader.style.borderRadius = '50%';
        loader.style.width = '60px';
        loader.style.height = '60px';
        loader.style.animation = 'spin 2s linear infinite'; // Ensure spinner rotates
        loader.style.margin = 'auto';
        loader.style.display = 'block';
        
        //outputElement.innerHTML = '';  // Clear the existing content in loaderContainer
        outputElement.appendChild(loader);
    
        // Inject keyframes if they aren't already present in your CSS
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styleElement);
    
        return loader;
    }

    // Call the API and handle errors with loader animation
    public generateOutput(
        question: string,
        with_filters: string,
    ): string {
    
        // Generate the final output using the question and views
        // const finalOutput = `I am asking '${question}', and my question is based on the following views, and you must answer my question by applying the filters on views my report is using. You can only use ${with_filters}. Any a=b in it is a filter you need to apply. Not mentioned Tables or Views are not allowed to be used for generating the answer.`;
        const finalOutput = `I am asking '${question}', you must answer my question by applying the filters on views if filters have been mentioned later, not mentioned views you don't need to considerate any filters. Filters You need to apply when generate answer on filter applied views, here are the filters ${with_filters}. Any a=b or a!=b or a>/<b in it is a filter you need to apply.`;
    
        return finalOutput;
    }

    private parseInput(input: string) {
        // Initialize outputs
        const databases = new Set<string>();
        const used_views = new Set<string>();
        const filter_context = new Set<string>();

        // Split the input by semicolons to process each line individually
        const lines = input.split(';').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            // Match the database and view pattern (e.g., "test_ai.i_iv_all_queries")
            const dbViewMatch = line.match(/^(\w+)\.(\w+)/);
            if (dbViewMatch) {
                const dbName = dbViewMatch[1]; // First part as the database name
                const viewName = dbViewMatch[0]; // Full match as the view name

                // Add to databases (Set ensures uniqueness)
                databases.add(dbName);
                // Add to used_views (Set ensures uniqueness)
                used_views.add(viewName);

                // Check for filters
                const filterMatch = line.match(/with filters (.+)$/);
                if (filterMatch) {
                    filter_context.add(`${viewName} with filters ${filterMatch[1]}`);
                }
            }
        }

        // Convert Sets to comma-separated strings
        const databaseSummary = Array.from(databases).join(', ');
        const usedViewsSummary = Array.from(used_views).join(', ');
        const filterContextSummary = Array.from(filter_context).join(', ');

        return {
            database: databaseSummary,
            used_views: usedViewsSummary,
            filter_context: filterContextSummary
        };
    }
    

    public async callAPI(
        question: string,
        mode: string,
        username: string,
        password: string,
        //outputElement: HTMLElement,  // Use outputElement only for showing the loader
        field_value: string
    ): Promise<string> {
        const restrictToPageCheckbox = document.getElementById('restrictCheckbox') as HTMLInputElement;
        const useFiltersCheckbox = document.getElementById('filtersCheckbox') as HTMLInputElement;

        let restrictToPage: boolean = false;
        let useFilters: boolean = false;

        if (restrictToPageCheckbox && useFiltersCheckbox) {
            restrictToPage = restrictToPageCheckbox.checked;
            useFilters = useFiltersCheckbox.checked;

            // Continue with the rest of the logic
        } else {
            console.error("One or both checkboxes are missing in the DOM.");
            return; // Optionally return early or handle the missing elements appropriately
        }
        
        const authHeader = this.calculateBasicAuthHeader(username, password);
        //const loader = this.createLoader(outputElement);  // Show loader before API call
        let params: any = {};

        try {
            if (!restrictToPage) {
                params = {
                    question: question,
                    mode: mode,
                    vector_search_k: 5
                };
            } else if (restrictToPage && !useFilters) {
                const summarized_views = this.parseInput(field_value);
                params = {
                    question: question,
                    vdp_database_name: summarized_views.database,
                    mode: mode,
                    use_views: summarized_views.used_views,  // Always pass the original jsonData as views
                    expand_set_views: false,
                    vector_search_k: 5
                };
            } else {
                const summarized_views = this.parseInput(field_value);
                const final_instruction = this.generateOutput(question, summarized_views.filter_context);
    
                params = {
                    question: final_instruction,
                    vdp_database_name: summarized_views.database,
                    mode: mode,
                    use_views: summarized_views.used_views, // Always pass the original jsonData as views
                    expand_set_views: false,
                    vector_search_k: 5  
                };
            }
    
            // Convert the payload to query string format
            const queryParams = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');
    
            //const finalApiUrl = `${config.ai_sdk_api}answerQuestion?${queryParams}`;
            const finalApiUrl = `https://${this.server}:${this.port}/answerQuestion?${queryParams}`;

            // Perform the GET request
            const response = await fetch(finalApiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
    
            const data = await response.json();
            const formattedResponse = this.formatApiResponse(data, question);

            // Save question and response in memory
            this.memory.push({ question, response: formattedResponse });

            return formattedResponse;
    
        } catch (error) {
            throw new Error(`Error calling API: ${error.message}`);
        }
    }
    
    // Helper function to format the API response content
    private formatApiResponse(data: any, question: string): string {
        const questionStyle = "font-size: 12px; color: green; margin-top: 5px;"; // Style for user question
        const markdownStyle = "font-size: 12px; color: green;"; // Style for Markdown-rendered content
        const tableStyle = `
            font-size: 12px; color: green; border-collapse: collapse; width: 100%;
            text-align: left; margin-top: 10px;
        `;
        const thTdStyle = `
            font-size: 12px; color: green; border: 1px solid #ddd; padding: 8px;
        `;
        const boldTitleStyle = "font-weight: bold; font-size: 14px; color: #333; margin: 0;";
        const sectionStyle = "background-color: #f0f8ff; padding: 10px; border-radius: 5px; margin-bottom: 10px; user-select: text;";
    
        // Section for displaying the user's question
        const questionSection = `
            <div style="${sectionStyle}">
                <p style="${boldTitleStyle}">Your Question:</p>
                <p style="${questionStyle}">${question}</p>
            </div>`;
    
        // Render the answer using Markdown
        let formattedAnswer = md.render(data.answer);
    
        // Ensure tables and child elements inherit consistent styles
        formattedAnswer = formattedAnswer.replace(
            /<table>/g,
            `<table style="${tableStyle}">`
        ).replace(
            /<th>/g,
            `<th style="${thTdStyle}">`
        ).replace(
            /<td>/g,
            `<td style="${thTdStyle}">`
        ).replace(
            /<p>/g,
            `<p style="${markdownStyle}">`
        );
    
        // Section for displaying the AI SDK's response
        const answerSection = `
            <div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px; user-select: text;">
                <p style="${boldTitleStyle}">Answer by Denodo AI SDK:</p>
                ${formattedAnswer}
                <p style="${boldTitleStyle} margin-top: 15px;">Generated SQL by Denodo AI SDK:</p>
                <p style="${markdownStyle}">${data.sql_query || "No SQL query generated."}</p>
                <p style="${boldTitleStyle} margin-top: 15px;">Related Questions:</p>
                <p style="${markdownStyle}">${data.related_questions.join("<br>") || "No related questions available."}</p>
            </div>`;
    
        return questionSection + answerSection;
    }

    // Display saved questions and responses 
    private displayMemory() {
        // Check if a memory container already exists and remove it (toggle functionality)
        const existingMemory = document.getElementById('memoryContainer');
        if (existingMemory) {
            document.body.removeChild(existingMemory);
            this.removeOverlay(); // Remove overlay if memory container is closed
            return; // Exit to avoid re-creating the container
        }
    
        // Create overlay and add it to the document
        this.createOverlay();
    
        // Create the memory container
        const memoryContainer = document.createElement('div');
        memoryContainer.id = 'memoryContainer';
        memoryContainer.style.position = 'fixed'; // Ensure the container stays fixed to the viewport
        memoryContainer.style.top = '50%';
        memoryContainer.style.left = '50%';
        memoryContainer.style.transform = 'translate(-50%, -50%)';
        memoryContainer.style.padding = '20px';
        memoryContainer.style.backgroundColor = '#f9f9f9';
        memoryContainer.style.border = '1px solid #ccc';
        memoryContainer.style.width = '70%'; // Set width to 70% of the viewport
        memoryContainer.style.height = '70%'; // Set height to 70% of the viewport
        memoryContainer.style.overflow = 'hidden'; // Prevent overflow issues
        memoryContainer.style.zIndex = '1001'; // Ensure it's above the overlay
        memoryContainer.style.boxShadow = '0px 4px 6px rgba(0,0,0,0.1)';
        memoryContainer.style.borderRadius = '10px'; // Adjust the radius as needed
    
        // Add the top-right "X" close button
        const closeIcon = document.createElement('button');
        closeIcon.textContent = '✖';
        closeIcon.style.position = 'fixed'; // Fix it within the modal
        closeIcon.style.top = 'calc(3% - 5px)'; // Align with top
        closeIcon.style.right = 'calc(3% - 5px)'; // Align with right
        closeIcon.style.background = 'none';
        closeIcon.style.border = 'none';
        closeIcon.style.fontSize = '16px'; // Keep consistent size
        closeIcon.style.padding = '0';
        closeIcon.style.cursor = 'pointer';
        closeIcon.style.color = '#333';
        closeIcon.style.zIndex = '1002'; // Ensure it appears above the content
        closeIcon.addEventListener('click', () => {
            document.body.removeChild(memoryContainer);
            this.removeOverlay();
        });
        memoryContainer.appendChild(closeIcon);
    
        // Content container for scrollable content
        const contentContainer = document.createElement('div');
        contentContainer.id = 'memoryContentContainer';
        contentContainer.style.overflowY = 'auto'; // Enable scrolling for the content
        contentContainer.style.height = 'calc(100% - 40px)'; // Leave space for the close button
        memoryContainer.appendChild(contentContainer);
    
        // Colors array to alternate background colors per session
        const colors = ['#f3f3f3', '#e8e8e8', '#f9f9f9', '#ededed']; // Subtle colors for each session
    
        // Populate with responses
        const populateMemory = () => {
            contentContainer.innerHTML = ''; // Clear existing content, if any
    
            if (this.memory.length > 0) {
                this.memory.forEach((item, index) => {
                    const sessionContainer = document.createElement('div');
                    sessionContainer.style.backgroundColor = colors[index % colors.length]; // Cycle colors by session
                    sessionContainer.style.padding = '10px';
                    sessionContainer.style.borderRadius = '5px';
                    sessionContainer.style.marginBottom = '10px';
                    sessionContainer.style.userSelect = 'text'; // Make text selectable
    
                    sessionContainer.innerHTML = `
                        <p style="font-weight: bold; font-size: 14px; color: #333; margin: 0;">Session ${index + 1}:</p>
                        <p style="font-size: 14px; color: #333; margin-top: 5px;">${item.response}</p>
                    `;
                    contentContainer.appendChild(sessionContainer);
                });
    
                // Add Clear Memory button
                contentContainer.appendChild(clearMemoryButton);
            } else {
                const emptyMessage = document.createElement('p');
                emptyMessage.textContent = 'Memory is empty.';
                emptyMessage.style.color = '#999';
                contentContainer.appendChild(emptyMessage);
            }
        };
    
        // Clear Memory button
        const clearMemoryButton = document.createElement('button');
        clearMemoryButton.textContent = 'Clear Memory';
        clearMemoryButton.style.marginTop = '10px';
        clearMemoryButton.style.backgroundColor = '#FF6347';
        clearMemoryButton.style.border = 'none';
        clearMemoryButton.style.color = 'white';
        clearMemoryButton.style.padding = '10px 20px';
        clearMemoryButton.style.borderRadius = '5px';
        clearMemoryButton.style.cursor = 'pointer';
        clearMemoryButton.addEventListener('click', () => {
            this.memory = []; // Clear the memory array
            populateMemory(); // Refresh content
        });
    
        // Populate memory container
        populateMemory();
    
        // Append memory container to the document body
        document.body.appendChild(memoryContainer);
    }
    
}
