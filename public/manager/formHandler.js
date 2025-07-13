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
    let overlay = null;
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
        const { matchedFields } = separateMatchedFields(allSuggestions, formData.fields, (field) => isOpenEndedQuestion(field));
        if (!matchedFields.length) {
            displayMessage('Aucun champ correspondant trouvé');
            return;
        }
        // Show overlay
        showOverlay(matchedFields.length);
        console.log('Overlay shown');
        // Fill profile fields one by one
        for (let i = 0; i < matchedFields.length; i++) {
            const field = matchedFields[i];
            console.log(`✍️ Filling profile field ${i+1}/${matchedFields.length}:`, field.field_name);
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'fillForm',
                    formIndex: formIndex,
                    suggestions: [field],
                    userId: userProfile.id,
                    isAIFilling: false
                });
                console.log(`✅ Filled ${field.field_name} with:`, field.suggested_value);
            } catch (err) {
                console.warn(`❌ Failed to fill ${field.field_name}:`, err);
            }
            updateOverlayProgress(i + 1, matchedFields.length);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Form filling error:', error);
        displayMessage('❌ Erreur lors du remplissage');
    } finally {
        hideOverlay();
        console.log('Overlay hidden');
    }
}

function showOverlay(totalFields) {
    hideOverlay(); // Remove any existing overlay first
    const overlay = document.createElement('div');
    overlay.id = 'autofillOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.5);
        z-index: 999999;
        display: flex; align-items: center; justify-content: center;
    `;
    overlay.innerHTML = `
        <div style="background: #fff; padding: 32px 40px; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); text-align: center; min-width: 320px;">
            <h3 style="margin-bottom: 16px; color: #333;">Remplissage du profil...</h3>
            <div id="autofillProgressBar" style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                <div id="autofillProgress" style="background: linear-gradient(90deg,#4f46e5,#7c3aed); height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="autofillProgressText" style="font-size: 14px; color: #666;">0 / ${totalFields} champs</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function updateOverlayProgress(current, total) {
    const bar = document.getElementById('autofillProgress');
    const text = document.getElementById('autofillProgressText');
    if (bar) bar.style.width = `${Math.round((current/total)*100)}%`;
    if (text) text.textContent = `${current} / ${total} champs`;
}

function hideOverlay() {
    const overlay = document.getElementById('autofillOverlay');
    if (overlay) {
        overlay.remove();
    }
}
