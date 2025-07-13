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
            <div style="text-align: center; padding: 20px; color: #666;">
                <p style="margin: 0 0 10px 0; font-size: 13px;">Aucun formulaire détecté sur cette page.</p>
                <button id="refreshFormsBtn" style="
                    background: #f0f0f0; 
                    border: 1px solid #ddd; 
                    padding: 6px 12px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 12px;
                ">🔄 Actualiser la détection</button>
            </div>
        `;
        
        document.getElementById('refreshFormsBtn').addEventListener('click', () => {
            detectForms(instance);
        });
        return;
    }
    
    // Ajouter un en-tête indiquant le nombre de formulaires détectés
    const header = document.createElement('div');
    header.style.cssText = `
        background: #f8f9fa;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #495057;
        border: 1px solid #e9ecef;
    `;
    header.innerHTML = `
        <strong>📋 ${forms.length} formulaire${forms.length > 1 ? 's' : ''} détecté${forms.length > 1 ? 's' : ''}</strong>
        <span style="float: right; color: #6c757d; font-size: 11px;">Prêt à remplir</span>
    `;
    container.appendChild(header);
    
    forms.forEach((form, index) => {
        const formElement = document.createElement('div');
        formElement.className = 'form-item';
        formElement.style.cssText = `
            border: 1px solid #ddd;
            padding: 12px;
            margin: 8px 0;
            border-radius: 6px;
            background: #f9f9f9;
        `;
        formElement.innerHTML = `
            <h4 style="margin: 0 0 8px 0; color: #333;">Formulaire ${index + 1}</h4>
            <p style="margin: 4px 0; color: #666; font-size: 13px;">
                ${form.fieldCount} champs détectés | Action: ${form.action || 'Non définie'}
            </p>
            <details style="margin: 8px 0;">
                <summary style="cursor: pointer; color: #666; font-size: 12px;">Voir les champs</summary>
                <div style="margin-top: 8px; font-size: 11px;">
                    ${form.fields.map(field => `
                        <div style="margin: 4px 0; padding: 4px; background: white; border-radius: 3px;">
                            <strong>${field.label || field.name}</strong> (${field.type})
                            ${field.required ? ' <span style="color: red;">*</span>' : ''}
                            ${field.placeholder ? `<br><em style="color: #999;">Placeholder: ${field.placeholder}</em>` : ''}
                        </div>
                    `).join('')}
                </div>
            </details>
            <button class="btn btn-primary" id="fillFormBtn-${index}" style="
                margin-top: 8px;
                background: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            ">
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


