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
        container.innerHTML = '<p style="color: #666; font-size: 13px;">Aucun formulaire détecté.</p>';
        return;
    }
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
            <button class="btn btn-primary" id="fillFormBtn-${index}" style="margin-top: 8px;">
                Remplir automatiquement
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
        const storage = await new Promise(resolve =>
            chrome.storage.local.get(['currentUser'], resolve)
        );
        if (!storage.currentUser || !storage.currentUser.profile) {
            displayMessage('Erreur: Profil utilisateur non trouvé');
            return;
        }
        const userProfile = storage.currentUser;
        const formData = instance.detectedForms[formIndex];
        const allSuggestions = generateFieldSuggestions(formData.fields, userProfile, instance.fieldMappings);
        const { matchedFields, aiRelevantFields, missingProfileFields } =
            separateMatchedFields(allSuggestions, formData.fields, (field) => isOpenEndedQuestion(field));
        if (matchedFields.length > 0) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'fillForm',
                formIndex: formIndex,
                suggestions: matchedFields,
                userId: userProfile.id
            });
            displayMessage(`✅ ${matchedFields.length} champs remplis avec les données du profil`);
        }
        if (aiRelevantFields.length > 0) {
            displayMessage(`🤖 Génération de suggestions IA pour ${aiRelevantFields.length} champ(s)...`);
            try {
                const aiSuggestions = await getAISuggestions(instance, userProfile, aiRelevantFields);
                if (aiSuggestions && aiSuggestions.length > 0) {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'fillForm',
                        formIndex: formIndex,
                        suggestions: aiSuggestions,
                        userId: userProfile.id,
                        isAIFilling: true
                    });
                    const totalFilled = matchedFields.length + aiSuggestions.length;
                    displayMessage(`🎉 Remplissage terminé: ${totalFilled} champs (${matchedFields.length} profil + ${aiSuggestions.length} IA)`);
                } else {
                    if (matchedFields.length > 0) {
                        displayMessage(`✅ ${matchedFields.length} champs remplis avec les données du profil (IA non disponible)`);
                    } else {
                        displayMessage('❌ Aucune suggestion IA générée');
                    }
                }
            } catch (aiError) {
                if (matchedFields.length > 0) {
                    displayMessage(`✅ ${matchedFields.length} champs remplis avec les données du profil (IA indisponible)`);
                } else {
                    displayMessage('❌ IA indisponible et aucun champ correspondant dans le profil');
                }
            }
        } else {
            if (matchedFields.length === 0) {
                let message = 'Aucun champ correspondant trouvé pour le remplissage automatique';
                if (missingProfileFields.length > 0) {
                    message += '. Certains champs nécessitent des informations manquantes dans votre profil.';
                }
                displayMessage(message);
            } else {
                displayMessage(`✅ ${matchedFields.length} champs remplis avec les données du profil`);
            }
        }
        if (missingProfileFields.length > 0) {
            const skippedFieldNames = missingProfileFields.map(f => f.field_info.label || f.field_name).join(', ');
        }
    } catch (error) {
        displayMessage('❌ Erreur lors du remplissage automatique');
    }
}
