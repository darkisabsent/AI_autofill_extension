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
        // Show overlay immediately
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { action: 'showFillingOverlay' });
        
        // Get user profile
        const storage = await new Promise(resolve =>
            chrome.storage.local.get(['currentUser'], resolve)
        );
        if (!storage.currentUser || !storage.currentUser.profile) {
            await chrome.tabs.sendMessage(tab.id, { action: 'hideFillingOverlay' });
            displayMessage('Erreur: Profil utilisateur non trouvé');
            return;
        }
        
        const userProfile = storage.currentUser;
        const formData = instance.detectedForms[formIndex];
        
        await chrome.tabs.sendMessage(tab.id, { 
            action: 'updateFillingProgress', 
            status: 'Analyzing form fields...' 
        });
        
        // Analyze fields first
        const allSuggestions = generateFieldSuggestions(formData.fields, userProfile, instance.fieldMappings);
        const { matchedFields, aiRelevantFields, missingProfileFields } =
            separateMatchedFields(allSuggestions, formData.fields, (field) => isOpenEndedQuestion(field));
        
        console.log(`Form ${formIndex + 1}: ${matchedFields.length} profile matches, ${aiRelevantFields.length} AI fields`);
        
        // Start AI request immediately if we have AI fields (DON'T WAIT FOR IT)
        let aiPromise = null;
        let aiTimeoutId = null;
        let aiCompleted = false;
        
        if (aiRelevantFields.length > 0) {
            console.log('🚀 Starting AI request in parallel...');
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'updateFillingProgress', 
                status: `Starting AI request for ${aiRelevantFields.length} fields...` 
            });
            
            displayMessage(`🤖 IA démarrée pour ${aiRelevantFields.length} champ(s)...`);
            
            // Start AI request without awaiting
            aiPromise = getAISuggestions(instance, userProfile, aiRelevantFields);
        }
        
        // Fill profile fields while AI is processing
        if (matchedFields.length > 0) {
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'updateFillingProgress', 
                status: `Filling ${matchedFields.length} profile fields...` 
            });
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'fillForm',
                formIndex: formIndex,
                suggestions: matchedFields,
                userId: userProfile.id,
                isAIFilling: false
            });
            
            // Wait for profile filling to complete
            await new Promise(resolve => setTimeout(resolve, (matchedFields.length * 300) + 500));
            
            displayMessage(`✅ ${matchedFields.length} champs profil remplis`);
        }
        
        // Now handle AI results if we have them
        if (aiRelevantFields.length > 0 && aiPromise) {
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'updateFillingProgress', 
                status: 'Waiting for AI response (max 7s)...' 
            });
            
            try {
                console.log('⏳ Waiting for AI response...');
                
                // Create a timeout promise that we can cancel
                const timeoutPromise = new Promise((_, reject) => {
                    aiTimeoutId = setTimeout(() => {
                        if (!aiCompleted) {
                            console.log('❌ AI timeout after 7 seconds');
                            reject(new Error('AI timeout after 7 seconds'));
                        }
                    }, 7000);
                });
                
                // Race between AI response and timeout
                const aiSuggestions = await Promise.race([
                    aiPromise.then(result => {
                        aiCompleted = true; // Mark as completed before timeout fires
                        if (aiTimeoutId) {
                            clearTimeout(aiTimeoutId);
                            aiTimeoutId = null;
                        }
                        return result;
                    }),
                    timeoutPromise
                ]);
                
                console.log('✅ AI response received:', aiSuggestions);
                
                if (aiSuggestions && aiSuggestions.length > 0) {
                    await chrome.tabs.sendMessage(tab.id, { 
                        action: 'updateFillingProgress', 
                        status: `Applying ${aiSuggestions.length} AI suggestions...` 
                    });
                    
                    // Fill AI suggestions
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'fillForm',
                        formIndex: formIndex,
                        suggestions: aiSuggestions,
                        userId: userProfile.id,
                        isAIFilling: true
                    });
                    
                    // Wait for AI filling to complete before hiding overlay
                    await new Promise(resolve => setTimeout(resolve, (aiSuggestions.length * 300) + 1000));
                    
                    const totalFilled = matchedFields.length + aiSuggestions.length;
                    displayMessage(`🎉 Terminé: ${totalFilled} champs (${matchedFields.length} profil + ${aiSuggestions.length} IA)`);
                } else {
                    displayMessage(matchedFields.length > 0 
                        ? `✅ ${matchedFields.length} champs remplis (IA sans réponse)`
                        : '❌ Aucune suggestion IA générée');
                }
                
            } catch (aiError) {
                console.error('AI Error:', aiError);
                
                // Clear timeout if it exists
                if (aiTimeoutId) {
                    clearTimeout(aiTimeoutId);
                    aiTimeoutId = null;
                }
                
                if (aiError.message.includes('timeout')) {
                    displayMessage(matchedFields.length > 0 
                        ? `⏱️ IA timeout (7s) - ${matchedFields.length} champs profil OK`
                        : '⏱️ IA timeout (7s) - Aucun champ rempli');
                } else {
                    displayMessage(matchedFields.length > 0 
                        ? `✅ ${matchedFields.length} champs profil (IA indisponible)`
                        : '❌ IA indisponible');
                }
            }
        } else if (matchedFields.length === 0) {
            displayMessage('Aucun champ correspondant trouvé');
        }
        
        // Always hide overlay at the end
        await chrome.tabs.sendMessage(tab.id, { action: 'hideFillingOverlay' });
        
    } catch (error) {
        console.error('Form filling error:', error);
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'hideFillingOverlay' });
        } catch (e) {
            console.error('Error hiding overlay on error:', e);
        }
        
        displayMessage('❌ Erreur lors du remplissage');
    }
}
