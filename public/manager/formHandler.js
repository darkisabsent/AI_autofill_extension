import {
    generateFieldSuggestions,
    separateMatchedFields,
    isOpenEndedQuestion
} from '../utils/formUtils.js';
import { displayMessage } from '../utils/domUtils.js';

export async function detectForms(instance) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        let response = await chrome.tabs.sendMessage(tab.id, { action: 'getDetectedForms' });
        if (!response || !response.forms || response.forms.length === 0) {
            response = await chrome.tabs.sendMessage(tab.id, { action: 'detectForms' });
        }
        if (response && response.forms) {
            displayDetectedForms(instance, response.forms);
        } else {
            displayMessage('No forms detected on this page.');
        }
    } catch (error) {
        displayMessage('Error detecting forms. Please make sure the page is fully loaded.');
    }
}

export function displayDetectedForms(instance, forms) {
    const container = document.getElementById('formsContainer');
    container.innerHTML = '';
    
    if (forms.length === 0) {
        container.innerHTML = `
            <div class="no-forms-message">
                <p class="no-forms-text">No forms detected on this page.</p>
                <p class="reload-message">Please reload the page to detect forms.</p>
                <button id="refreshFormsBtn" class="btn btn-secondary">🔄 Try Again</button>
            </div>
        `;
        
        document.getElementById('refreshFormsBtn').addEventListener('click', () => {
            detectForms(instance);
        });
        return;
    }
    
    // Add header showing number of detected forms
    const header = document.createElement('div');
    header.className = 'forms-header';
    header.innerHTML = `
        <strong>📋 ${forms.length} form${forms.length > 1 ? 's' : ''} detected</strong>
        <span class="forms-status">Ready to fill</span>
    `;
    container.appendChild(header);
    
    forms.forEach((form, index) => {
        const formElement = document.createElement('div');
        formElement.className = 'form-item';
        formElement.innerHTML = `
            <h4 class="form-item-title">Form ${index + 1}</h4>
            <p class="form-item-info">
                ${form.fieldCount} fields detected | URL: ${form.action || 'Not defined'}
            </p>
            <details class="form-fields-details">
                <summary class="form-fields-summary">View fields</summary>
                <div class="form-fields-content">
                    ${form.fields.map(field => `
                        <div class="form-field-item">
                            <strong>${field.label || field.name}</strong> (${field.type})
                            ${field.required ? ' <span class="field-required">*</span>' : ''}
                            ${field.placeholder ? `<br><em class="field-placeholder">Placeholder: ${field.placeholder}</em>` : ''}
                        </div>
                    `).join('')}
                </div>
            </details>
            <button class="btn btn-primary fill-form-btn" id="fillFormBtn-${index}">
                🚀 Auto-fill form
            </button>
        `;
        container.appendChild(formElement);
        document.getElementById(`fillFormBtn-${index}`).addEventListener('click', () => {
            fillForm(instance, index);
        });
    });
    instance.detectedForms = forms;
}

export async function fillForm(instance, formIndex) {
    if (!instance.detectedForms[formIndex]) {
        return;
    }
    
    try {
        // Get user profile
        const storage = await new Promise(resolve =>
            chrome.storage.local.get(['currentUser'], resolve)
        );
        if (!storage.currentUser || !storage.currentUser.profile) {
            displayMessage('Error: User profile not found');
            return;
        }
        
        const userProfile = storage.currentUser;
        const formData = instance.detectedForms[formIndex];
        
        // Analyze fields first
        const allSuggestions = generateFieldSuggestions(formData.fields, userProfile, instance.fieldMappings);
        
        // Debug: Log all suggestions
        console.log('🔍 All field suggestions generated:', allSuggestions.map(s => ({
            field: s.field_name,
            suggested: s.suggested_value,
            matched: s.matched_profile_field
        })));
        
        const { matchedFields, unmatchedFields } = separateMatchedFields(allSuggestions, formData.fields, (field) => isOpenEndedQuestion(field));
        
        // Check for AI-relevant fields (open-ended questions)
        const aiRelevantFields = unmatchedFields.filter(field => isOpenEndedQuestion(field.field_info));
        
        let allFieldsToFill = [...matchedFields];
        
        // If there are AI-relevant fields, prepare them for AI processing
        if (aiRelevantFields.length > 0) {
            console.log('🤖 Found AI-relevant fields:', aiRelevantFields.map(f => f.field_name));
            
            // Add AI fields to the list with placeholder data - they'll be processed in content script
            const aiFieldsForProcessing = aiRelevantFields.map(field => ({
                field_name: field.field_name,
                suggested_value: null, // Will be filled by AI
                field_info: field.field_info,
                matched_profile_field: 'ai_generated',
                source: 'ai'
            }));
            
            allFieldsToFill = [...matchedFields, ...aiFieldsForProcessing];
        }
        
        if (!allFieldsToFill.length) {
            displayMessage('No matching fields found');
            return;
        }
        
        // Send all data to content script to handle the entire filling process including AI
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
            action: 'fillFormComplete',
            formIndex: formIndex,
            matchedFields: allFieldsToFill,
            userProfile: userProfile,
            totalFields: allFieldsToFill.length,
            aiServerUrl: 'http://localhost:5001/api/analyze'
        });
        
        // Show success message in popup
        displayMessage('✅ Form filling started!');
        
    } catch (error) {
        console.error('Form filling error:', error);
        displayMessage('❌ Error filling form');
    }
}


