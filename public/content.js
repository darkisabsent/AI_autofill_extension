let detectedFormsCache = [];
let notificationTimeout;
let isNotificationVisible = false;
let lastFormCount = 0;
let lastFieldCount = 0;
let isFillingCancelled = false;
let aiAbortController = null;

function getFieldLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText.trim();
  }
  const parentLabel = input.closest("label");
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    const nestedInputs = clone.querySelectorAll("input, textarea, select");
    nestedInputs.forEach(nested => nested.remove());
    return clone.innerText.trim();
  }
  const prev = input.previousElementSibling;
  if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN")) {
    return prev.innerText.trim();
  }
  if (input.getAttribute('aria-label')) {
    return input.getAttribute('aria-label').trim();
  }
  return '';
}

function detectStandardInputs() {
    const matchedFields = [];
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select');
    
    inputs.forEach(input => {
        const label = getFieldLabel(input);
        if (label || input.placeholder || input.name) {
            matchedFields.push({ 
                label: label || input.placeholder || input.name, 
                input 
            });
        }
    });
    
    return matchedFields;
}

function detectGoogleFormBlocks() {
    const matchedFields = [];
    const blocks = document.querySelectorAll('div[role="listitem"]');
    
    if (blocks.length === 0) return [];

    blocks.forEach(block => {
        const labelElement = block.querySelector('.M7eMe, .freebirdFormviewerViewItemsTextItemWrapper span');
        const label = labelElement?.innerText?.trim();
        const input = block.querySelector('input[type="text"], input[type="email"], textarea, select');
        
        if (label && input) {
            matchedFields.push({ label, input });
        }
    });
    
    return matchedFields;
}

function detectTypeformBlocks() {
    const matchedFields = [];
    const blocks = document.querySelectorAll('div[data-qa="question-wrapper"], .typeform-field');

    if (blocks.length === 0) return [];

    blocks.forEach(block => {
        const labelElement = block.querySelector('label span, [data-qa="title"] span, h1, h2, h3');
        const label = labelElement?.innerText?.trim();
        const input = block.querySelector('input, textarea, select');
        
        if (label && input) {
            matchedFields.push({ label, input });
        }
    });
    
    return matchedFields;
}

function removeDuplicateFields(fields) {
    const uniqueInputs = new Map();
    fields.forEach(field => {
        if (!uniqueInputs.has(field.input)) {
            uniqueInputs.set(field.input, field);
        }
    });
    return Array.from(uniqueInputs.values());
}

function detectAllFields() {
    let allFields = [];

    allFields.push(...detectStandardInputs());
    allFields.push(...detectGoogleFormBlocks());
    allFields.push(...detectTypeformBlocks());

    const uniqueFields = removeDuplicateFields(allFields);
    return uniqueFields;
}

function detectForms() {
  const allDetectedFields = detectAllFields();
  if (allDetectedFields.length === 0) {
    detectedFormsCache = [];
    return [];
  }

  const formsMap = new Map();
  allDetectedFields.forEach(({ label, input }) => {
    const form = input.closest('form') || document.body; 
    if (!formsMap.has(form)) {
      formsMap.set(form, []);
    }
    formsMap.get(form).push({ label, input });
  });

  const formResults = [];
  let formIndex = 0;
  formsMap.forEach((fields, formElement) => {
    const formFields = fields.map(({ label, input }, i) => ({
      index: i + 1,
      name: input.name || input.id || `field_${i + 1}`,
      type: input.type || input.tagName.toLowerCase(),
      label: label,
      placeholder: input.placeholder || '',
      required: input.required,
      value: input.value,
      id: input.id,
      className: input.className,
      maxLength: input.maxLength > 0 ? input.maxLength : null,
    }));

    formResults.push({
      formIndex: formIndex,
      fields: formFields,
      action: formElement.action || window.location.href,
      method: formElement.method || "GET",
      fieldCount: formFields.length,
    });
    formIndex++;
  });

  detectedFormsCache = formResults;
  
  if (formResults.length > 0) {
    const totalFields = formResults.reduce((sum, form) => sum + form.fieldCount, 0);
    if (!isNotificationVisible && (formResults.length !== lastFormCount || totalFields !== lastFieldCount)) {
      lastFormCount = formResults.length;
      lastFieldCount = totalFields;
      showFormDetectionNotification(formResults);
    }
  }
  
  return formResults;
}

function showFormDetectionNotification(forms) {
  if (isNotificationVisible) return;
  
  const existingNotification = document.getElementById('autofill-form-notification');
  if (existingNotification) existingNotification.remove();

  isNotificationVisible = true;
  const totalFields = forms.reduce((sum, form) => sum + form.fieldCount, 0);
  const formText = forms.length === 1 ? 'form' : 'forms';
  const fieldText = totalFields === 1 ? 'field' : 'fields';
  
  const notification = document.createElement('div');
  notification.id = 'autofill-form-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4f46e5;
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    max-width: 260px;
    transform: translateX(0);
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  notification.innerHTML = `
    <span style="font-size: 16px;">📋</span>
    <div>
      <div style="font-weight: 500;">${forms.length} ${formText}, ${totalFields} ${fieldText}</div>
    </div>
    <button id="autofill-notification-close" style="
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
      opacity: 0.8;
      font-size: 14px;
    ">✕</button>
  `;
  
  document.body.appendChild(notification);
  
  const closeBtn = notification.querySelector('#autofill-notification-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      hideNotification(notification);
    };
    
    closeBtn.onmouseenter = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseleave = () => closeBtn.style.opacity = '0.8';
  }
  
  if (notificationTimeout) clearTimeout(notificationTimeout);
  
  notificationTimeout = setTimeout(() => {
    hideNotification(notification);
  }, 4000);
}

function hideNotification(notification) {
  if (!notification || !notification.parentNode) {
    isNotificationVisible = false;
    return;
  }
  
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
  
  notification.style.opacity = '0';
  
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
    isNotificationVisible = false;
  }, 200);
}

// Initialize form detection
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", detectForms);
} else {
  detectForms();
}

// Watch for new forms being added to the page
let detectionTimeout;
const observer = new MutationObserver((mutations) => {
  let shouldDetect = false;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && (node.tagName === 'FORM' || node.querySelector?.('form'))) {
          shouldDetect = true;
          break;
        }
      }
    }
    if (shouldDetect) break;
  }
  
  if (shouldDetect) {
    clearTimeout(detectionTimeout);
    detectionTimeout = setTimeout(detectForms, 500);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function createFillingOverlay() {
  isFillingCancelled = false;
  aiAbortController = new AbortController();
  
  const existingOverlay = document.getElementById('autofill-filling-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'autofill-filling-overlay';
  overlay.className = 'autofill-content-overlay';

  overlay.innerHTML = `
    <div class="autofill-content-modal">
      <button id="autofill-cancel-btn" style="
        position: absolute; 
        top: 15px; 
        right: 15px; 
        background: none; 
        border: none; 
        font-size: 20px; 
        cursor: pointer; 
        color: #888;
        z-index: 10;
      ">✕</button>
      
      <div class="autofill-content-spinner"></div>
      <h3 class="autofill-content-title">🤖 AutoFill AI en cours</h3>
      <p class="autofill-content-description">Remplissage automatique du formulaire...</p>
      
      <div class="autofill-progress-section">
        <p class="autofill-progress-label">👤 Remplissage du profil</p>
        <div id="filling-progress" class="autofill-content-progress">
          <div id="progress-bar" class="autofill-content-progress-bar" style="width: 0%;"></div>
        </div>
        <p id="filling-progress-text" class="autofill-content-progress-text">0 / 0 champs remplis</p>
      </div>

      <div id="ai-progress-section" class="autofill-progress-section" style="display: none;">
        <p class="autofill-progress-label">🤖 Génération IA</p>
        <div id="ai-filling-progress" class="autofill-content-progress">
          <div id="ai-progress-bar" class="autofill-content-progress-bar" style="width: 0%; background: linear-gradient(90deg, #3b82f6, #6366f1) !important;"></div>
        </div>
        <p id="ai-filling-status" class="autofill-content-status">En attente...</p>
      </div>

      <p id="filling-status" class="autofill-content-status">Initialisation...</p>
      
      <div class="autofill-content-tip">
        <p>💡 <strong>Astuce:</strong> Ne modifiez pas le formulaire pendant le remplissage automatique.</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('autofill-cancel-btn').addEventListener('click', () => {
    isFillingCancelled = true;
    if (aiAbortController) aiAbortController.abort();
    updateFillingProgress('Remplissage annulé par l\'utilisateur.');
    removeFillingOverlay();
  });
  
  // Prevent interaction with page content
  overlay.addEventListener('click', (e) => e.stopPropagation());
  overlay.addEventListener('mousedown', (e) => e.stopPropagation());
  overlay.addEventListener('keydown', (e) => e.stopPropagation());
  overlay.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
  overlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  
  document.body.style.overflow = 'hidden';
  void overlay.offsetWidth;

  return overlay;
}

function updateFillingProgress(message, current = null, total = null) {
  if (isFillingCancelled) return;
  
  const statusElement = document.getElementById('filling-status');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('filling-progress-text');
  
  if (statusElement) statusElement.textContent = message;
  
  if (current !== null && total !== null) {
    if (progressText) {
      progressText.textContent = `${current} / ${total} champs remplis`;
    }
    if (progressBar && total > 0) {
      const percentage = Math.min(100, Math.round((current / total) * 100));
      
      progressBar.offsetHeight;
      progressBar.style.cssText = `
        width: ${percentage}% !important;
        height: 100% !important;
        background: linear-gradient(90deg, #22c55e, #16a34a) !important;
        border-radius: 4px !important;
        transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1) !important;
        display: block !important;
      `;
    }
  }
}

function updateAIProgress(message, percentage) {
  if (isFillingCancelled) return;
  
  const aiSection = document.getElementById('ai-progress-section');
  const aiStatus = document.getElementById('ai-filling-status');
  const aiProgressBar = document.getElementById('ai-progress-bar');

  if (aiSection) aiSection.style.display = 'block';
  if (aiStatus) aiStatus.textContent = message;
  if (aiProgressBar) {
    aiProgressBar.offsetHeight;
    aiProgressBar.style.cssText = `
      width: ${percentage}% !important;
      height: 100% !important;
      background: linear-gradient(90deg, #3b82f6, #6366f1) !important;
      border-radius: 4px !important;
      transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1) !important;
      display: block !important;
    `;
  }
}

function addAutofillStyles() {
  if (document.getElementById('autofill-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'autofill-styles';
  styles.textContent = `
    .autofill-filling {
      outline: 2px solid #4f46e5 !important;
      outline-offset: 2px !important;
      transition: all 0.3s ease !important;
    }
    .autofill-filled {
      background-color: #e8f5e8 !important;
      border-color: #22c55e !important;
    }
    .autofill-filled-ai {
      background-color: #eef2ff !important;
      border-color: #3b82f6 !important;
    }
    .autofill-progress-section {
      margin: 15px 0 !important;
      text-align: left !important;
    }
    .autofill-progress-label {
      font-weight: 600 !important;
      margin-bottom: 8px !important;
      font-size: 14px !important;
      color: #374151 !important;
    }
    .autofill-content-progress {
      background: #e5e7eb !important;
      height: 12px !important;
      border-radius: 6px !important;
      overflow: hidden !important;
      margin: 8px 0 !important;
      border: 1px solid #d1d5db !important;
      position: relative !important;
    }
    .autofill-content-progress-bar {
      height: 100% !important;
      width: 0% !important;
      border-radius: 6px !important;
      transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1) !important;
      display: block !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
    }
    .autofill-content-progress-text {
      font-size: 12px !important;
      color: #6b7280 !important;
      margin: 4px 0 !important;
    }
    #autofill-filling-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.85) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      backdrop-filter: blur(4px) !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      pointer-events: all !important;
      user-select: none !important;
      animation: fadeIn 0.3s ease-out;
    }
    .autofill-content-modal {
      background: white !important;
      padding: 40px !important;
      border-radius: 16px !important;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important;
      text-align: center !important;
      max-width: 520px !important;
      position: relative !important;
      min-width: 420px !important;
    }
    .autofill-content-spinner {
      width: 50px !important;
      height: 50px !important;
      border: 4px solid #f3f3f3 !important;
      border-top: 4px solid #4f46e5 !important;
      border-radius: 50% !important;
      animation: spin 1s linear infinite !important;
      margin: 0 auto 24px auto !important;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  
  document.head.appendChild(styles);
}

addAutofillStyles();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getDetectedForms") {
    sendResponse({ forms: detectedFormsCache });
    return true;
  }
  if (message.action === "detectForms") {
    const forms = detectForms();
    sendResponse({ forms });
    return true;
  }
  if (message.action === "fillForm") {
    fillFormWithSuggestions(message.formIndex, message.suggestions, message.isAIFilling);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "fillFormComplete") {
    handleCompleteFormFilling(message.formIndex, message.matchedFields, message.userProfile, message.totalFields, message.aiServerUrl);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "getAISuggestions") {
    handleAILogic(message.userProfile, message.aiRelevantFields, message.aiServerUrl)
      .then(suggestions => sendResponse({ success: true, suggestions }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

function fillFormWithSuggestions(formIndex, suggestions, isAIFilling = false) {
  const forms = document.querySelectorAll("form");
  if (formIndex >= forms.length) {
    return;
  }
  
  const form = forms[formIndex];
  const formInputs = form.querySelectorAll("input, textarea, select");
  
  if (isAIFilling) {
    updateFillingProgress('🤖 Applying AI suggestions...');
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = '100%';
    }
  }
  
  let filledCount = 0;
  
  suggestions.forEach((suggestion, index) => {
    setTimeout(() => {
      let targetInput = null;
      
      targetInput = form.querySelector(`[name="${suggestion.field_name}"]`);
      if (!targetInput) {
        targetInput = form.querySelector(`#${suggestion.field_name}`);
      }
      if (!targetInput && suggestion.field_info) {
        const fieldInfo = suggestion.field_info;
        targetInput = Array.from(formInputs).find(input => {
          const inputLabel = getFieldLabel(input);
          return (inputLabel && inputLabel === fieldInfo.label) || 
                 (input.placeholder && input.placeholder === fieldInfo.placeholder) ||
                 (input.name && input.name === fieldInfo.name);
        });
      }
      
      if (targetInput) {
        const fieldLabel = getFieldLabel(targetInput) || targetInput.name || targetInput.placeholder || 'field';
        const source = suggestion.source === 'ai' ? '🤖 AI' : '👤 Profile';
        updateFillingProgress(`${source}: ${fieldLabel}...`);
        
        // Fill field based on type
        if (targetInput.tagName.toLowerCase() === 'select') {
          const options = Array.from(targetInput.options);
          const exactMatch = options.find(option => 
            option.value.toLowerCase() === suggestion.suggested_value.toLowerCase() ||
            option.text.toLowerCase() === suggestion.suggested_value.toLowerCase()
          );
          if (exactMatch) {
            targetInput.value = exactMatch.value;
          } else {
            const partialMatch = options.find(option => 
              option.text.toLowerCase().includes(suggestion.suggested_value.toLowerCase()) ||
              option.value.toLowerCase().includes(suggestion.suggested_value.toLowerCase())
            );
            if (partialMatch) {
              targetInput.value = partialMatch.value;
            }
          }
        } else {
          targetInput.value = suggestion.suggested_value;
        }
        
        // Trigger events to notify the page
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Visual feedback
        targetInput.classList.add('autofill-filling');
        setTimeout(() => {
          targetInput.classList.remove('autofill-filling');
          targetInput.classList.add('autofill-filled');
        }, 200);
        setTimeout(() => {
          targetInput.classList.remove('autofill-filled');
        }, 2000);
        
        filledCount++;
      }
      
      if (index === suggestions.length - 1) {
        setTimeout(() => {
          const sourceText = isAIFilling ? '🤖 AI' : '👤 Profile';
          updateFillingProgress(`${sourceText}: Completed ${filledCount}/${suggestions.length} fields!`);
        }, 200);
      }
      
    }, index * 250);
  });
}

// AI logic handler
async function handleAILogic(userProfile, aiRelevantFields, aiServerUrl) {
  if (isFillingCancelled) return { suggestions: [], timedOut: false };
  
  try {
    updateAIProgress('Envoi à l\'IA...', 50);
    
    const aiPayload = {
      user_profile: {
        firstName: userProfile.profile?.firstName || '',
        lastName: userProfile.profile?.lastName || '',
        email: userProfile.email || '',
        dateOfBirth: userProfile.profile?.dateOfBirth || '',
        gender: userProfile.profile?.gender || '',
        phoneNumber: userProfile.profile?.phoneNumber || '',
        address: userProfile.profile?.address || '',
        city: userProfile.profile?.city || '',
        country: userProfile.profile?.country || '',
        postalCode: userProfile.profile?.postalCode || '',
        hobbies: userProfile.profile?.hobbies || '',
        linkedinUrl: userProfile.profile?.linkedinUrl || '',
        githubUrl: userProfile.profile?.githubUrl || '',
        portfolioUrl: userProfile.profile?.portfolioUrl || ''
      },
      fields: aiRelevantFields.map(field => ({
        field_name: field.field_name,
        field_type: field.field_info?.type || 'text',
        field_label: field.field_info?.label || '',
        field_placeholder: field.field_info?.placeholder || '',
        field_required: field.field_info?.required || false
      }))
    };
    
    const response = await fetch(aiServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload),
      signal: aiAbortController?.signal
    });
    
    if (!response.ok) {
      throw new Error(`AI server returned error: ${response.status}`);
    }
    
    const aiResults = await response.json();
    updateAIProgress('Réponse IA reçue', 75);
    
    // Handle response format: [{'field_name': 'skills', 'suggested_value': '...'}]
    let processedResults = [];
    
    if (Array.isArray(aiResults)) {
      processedResults = aiResults;
    } else if (aiResults && typeof aiResults === 'object') {
      if (aiResults.suggestions && Array.isArray(aiResults.suggestions)) {
        processedResults = aiResults.suggestions;
      } else if (aiResults.data && Array.isArray(aiResults.data)) {
        processedResults = aiResults.data;
      } else if (aiResults.generated_suggestions && Array.isArray(aiResults.generated_suggestions)) {
        processedResults = aiResults.generated_suggestions;
      }
    }
    
    const aiSuggestions = processedResults.map((result) => {
      return {
        field_name: result.field_name,
        suggested_value: result.suggested_value,
        field_info: aiRelevantFields.find(f => f.field_name === result.field_name)?.field_info,
        matched_profile_field: 'ai_generated',
        source: 'ai'
      };
    }).filter(suggestion => suggestion.suggested_value && suggestion.suggested_value.trim());
    
    updateAIProgress('Suggestions IA traitées', 100);
    return { suggestions: aiSuggestions, timedOut: false };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      return { suggestions: [], timedOut: false };
    }
    
    console.error("AI suggestion error:", error.message);
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      updateAIProgress('Serveur IA indisponible', 0);
    } else {
      updateAIProgress('Erreur IA, ignorer...', 0);
    }
    return { suggestions: [], timedOut: false, error: error };
  }
}

// Field filling utilities
function findFieldInForm(form, field) {
  let targetInput = form.querySelector(`[name="${field.field_name}"]`);
  if (!targetInput) targetInput = form.querySelector(`#${field.field_name}`);
  
  if (!targetInput && field.field_info) {
    const { name, id, label, placeholder } = field.field_info;
    const formInputs = form.querySelectorAll("input, textarea, select");
    targetInput = Array.from(formInputs).find(input =>
      (input.name && input.name === name) ||
      (input.id && input.id === id) ||
      (label && getFieldLabel(input) === label) ||
      (placeholder && input.placeholder === placeholder)
    );
  }
  
  return targetInput;
}

function fillSingleField(targetInput, field, source) {
  if (targetInput.tagName.toLowerCase() === 'select') {
    const options = Array.from(targetInput.options);
    const match = options.find(opt => 
      opt.value.toLowerCase() === field.suggested_value.toLowerCase() ||
      opt.text.toLowerCase() === field.suggested_value.toLowerCase()
    );
    if (match) targetInput.value = match.value;
  } else if (targetInput.type === 'date' || field.matched_profile_field === 'dateOfBirth') {
    // Handle date inputs specifically
    let dateValue = field.suggested_value;
    if (dateValue && !dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        dateValue = date.toISOString().split('T')[0];
      }
    }
    targetInput.value = dateValue;
  } else {
    targetInput.value = field.suggested_value;
  }

  // Trigger events
  ['input', 'change', 'blur'].forEach(eventType => {
    targetInput.dispatchEvent(new Event(eventType, { bubbles: true }));
  });

  // Visual feedback
  const filledClass = source === 'ai' ? 'autofill-filled-ai' : 'autofill-filled';
  targetInput.classList.add(filledClass);
  setTimeout(() => targetInput.classList.remove(filledClass), 2000);
}

function removeFillingOverlay() {
  const overlay = document.getElementById('autofill-filling-overlay');
  if (overlay) {
    document.body.style.overflow = '';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 300);
  }
  
  if (aiAbortController) {
    aiAbortController = null;
  }
}

async function fillProfileFields(form, profileFields) {
  let successCount = 0;
  
  for (let i = 0; i < profileFields.length; i++) {
    if (isFillingCancelled) break;
    
    const field = profileFields[i];
    const progressFieldName = field.field_info?.label || field.field_info?.placeholder || field.field_name || `Champ ${i + 1}`;
    
    updateFillingProgress(`👤 Remplissage: ${progressFieldName}...`, i + 1, profileFields.length);
    
    const targetInput = findFieldInForm(form, field);
    if (targetInput) {
      fillSingleField(targetInput, field, 'profile');
      successCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  updateFillingProgress(`👤 Profil terminé: ${successCount} champs`, profileFields.length, profileFields.length);
  return successCount;
}

async function processAndFillAIFields(form, aiFields, userProfile, aiServerUrl) {
  let successCount = 0;
  
  try {
    if (aiFields.length === 0) return 0;
    
    updateAIProgress('🤖 Démarrage requête IA...', 15);
    
    const timeoutPromise = new Promise(resolve => 
      setTimeout(() => resolve({ suggestions: [], timedOut: true }), 15000) 
    );
    
    const aiPromise = handleAILogic(userProfile, aiFields, aiServerUrl);
    
    const aiResult = await Promise.race([aiPromise, timeoutPromise]).catch(err => {
      updateAIProgress("IA indisponible", 0);
      return { suggestions: [], timedOut: true, error: err };
    });
    
    if (isFillingCancelled) return 0;
    
    if (aiResult.timedOut) {
      updateAIProgress('⌛️ Délai IA dépassé', 0);
      return 0;
    } else if (aiResult.suggestions && aiResult.suggestions.length > 0) {
      updateAIProgress('🤖 Application suggestions...', 90);
      
      // Fill AI fields
      for (let i = 0; i < aiResult.suggestions.length; i++) {
        if (isFillingCancelled) break;
        
        const field = aiResult.suggestions[i];
        const targetInput = findFieldInForm(form, field);
        if (targetInput) {
          fillSingleField(targetInput, field, 'ai');
          successCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      updateAIProgress(`🤖 IA terminée: ${successCount} champs`, 100);
    } else if (aiResult.error) {
      updateAIProgress('❌ Erreur IA', 0);
    }
  } catch (error) {
    console.error('AI processing error:', error);
    updateAIProgress('❌ Erreur IA', 0);
  }
  
  return successCount;
}

// Main form filling orchestrator - parallel workflow
async function handleCompleteFormFilling(formIndex, matchedFields, userProfile, totalFields, aiServerUrl) {
  try {
    createFillingOverlay();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const forms = document.querySelectorAll("form");
    if (formIndex >= forms.length) {
      throw new Error(`Form index ${formIndex} not found`);
    }
    
    const form = forms[formIndex];
    
    // Separate profile and AI fields
    const profileFields = matchedFields.filter(f => f.source !== 'ai');
    const aiFields = matchedFields.filter(f => f.source === 'ai');
    
    updateFillingProgress('🚀 Démarrage remplissage parallèle...', 0, profileFields.length);
    
    // Start both processes simultaneously
    const profilePromise = fillProfileFields(form, profileFields);
    const aiPromise = processAndFillAIFields(form, aiFields, userProfile, aiServerUrl);
    
    // Wait for both to complete
    const [profileSuccessCount, aiSuccessCount] = await Promise.all([profilePromise, aiPromise]);
    
    if (isFillingCancelled) return;
    
    const totalSuccess = profileSuccessCount + aiSuccessCount;
    updateFillingProgress(`✅ Formulaire rempli! ${totalSuccess}/${totalFields} champs (👤${profileSuccessCount} + 🤖${aiSuccessCount})`, totalFields, totalFields);
    
    setTimeout(removeFillingOverlay, 2500);
    
  } catch (error) {
    console.error('Form filling error:', error);
    updateFillingProgress('❌ Erreur lors du remplissage', 0, totalFields);
    setTimeout(removeFillingOverlay, 3000);
  }
}