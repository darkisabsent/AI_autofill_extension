import {
    generateFieldSuggestions,
    separateMatchedFields,
    isOpenEndedQuestion
} from '../utils/formUtils.js';
import { displayMessage } from '../utils/domUtils.js';
import { getAISuggestions } from './aiHandler.js';

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
            displayMessage('Aucun formulaire détecté sur cette page.');
        }
    } catch (error) {
        displayMessage('Erreur lors de la détection des formulaires. Assurez-vous que la page est complètement chargée.');
    }
}

export function displayDetectedForms(instance, forms) {
    const container = document.getElementById('formsContainer');
    container.innerHTML = '';
    
    if (forms.length === 0) {
        container.innerHTML = `
            <div class="no-forms-message">
                <p class="no-forms-text">Aucun formulaire détecté sur cette page.</p>
                <button id="refreshFormsBtn" class="refresh-forms-btn">🔄 Actualiser la détection</button>
            </div>
        `;
        
        document.getElementById('refreshFormsBtn').addEventListener('click', () => {
            detectForms(instance);
        });
        return;
    }
    
    // Ajouter un en-tête indiquant le nombre de formulaires détectés
    const header = document.createElement('div');
    header.className = 'forms-header';
    header.innerHTML = `
        <strong>📋 ${forms.length} formulaire${forms.length > 1 ? 's' : ''} détecté${forms.length > 1 ? 's' : ''}</strong>
        <span class="forms-status">Prêt à remplir</span>
    `;
    container.appendChild(header);
    
    forms.forEach((form, index) => {
        const formElement = document.createElement('div');
        formElement.className = 'form-item';
        formElement.innerHTML = `
            <h4 class="form-item-title">Formulaire ${index + 1}</h4>
            <p class="form-item-info">
                ${form.fieldCount} champs détectés | Action: ${form.action || 'Non définie'}
            </p>
            <details class="form-fields-details">
                <summary class="form-fields-summary">Voir les champs</summary>
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
                🚀 Remplir automatiquement le formulaire
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
            displayMessage('Erreur: Profil utilisateur non trouvé');
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
        
        const { matchedFields } = separateMatchedFields(allSuggestions, formData.fields, (field) => isOpenEndedQuestion(field));
        
        if (!matchedFields.length) {
            displayMessage('Aucun champ correspondant trouvé');
            return;
        }
        
        // Send all data to content script to handle the entire filling process
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
            action: 'fillFormComplete',
            formIndex: formIndex,
            matchedFields: matchedFields,
            userProfile: userProfile,
            totalFields: matchedFields.length
        });
        
        // Show success message in popup
        displayMessage('✅ Remplissage du formulaire démarré!');
        
    } catch (error) {
        console.error('Form filling error:', error);
        displayMessage('❌ Erreur lors du remplissage');
    }
}


