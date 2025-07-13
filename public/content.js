let detectedFormsCache = [];
let notificationTimeout;
let isNotificationVisible = false;
let lastFormCount = 0;
let lastFieldCount = 0;

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

function detectForms() {
  const forms = document.querySelectorAll("form");
  if (forms.length === 0) {
    detectedFormsCache = [];
    return [];
  }
  const formResults = [];
  forms.forEach((form, index) => {
    const allInputs = form.querySelectorAll("input, textarea, select");
    const validInputs = Array.from(allInputs).filter(input => 
      !["hidden", "submit", "button", "reset", "image"].includes(input.type)
    );
    if (validInputs.length === 0) {
      return;
    }
    const fields = [];
    validInputs.forEach((input, i) => {
      const fieldInfo = {
        index: i + 1,
        name: input.name || input.id || `field_${i + 1}`,
        type: input.type || input.tagName.toLowerCase(),
        label: getFieldLabel(input),
        placeholder: input.placeholder || '',
        required: input.required,
        value: input.value,
        id: input.id,
        className: input.className,
        maxLength: input.maxLength > 0 ? input.maxLength : null
      };
      fields.push(fieldInfo);
    });
    formResults.push({
      formIndex: index,
      fields,
      action: form.action || window.location.href,
      method: form.method || "GET",
      fieldCount: fields.length
    });
  });
  detectedFormsCache = formResults;
  
  // Show notification instantly if forms are detected and counts have changed
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
  // Prevent multiple notifications
  if (isNotificationVisible) {
    return;
  }
  
  // Remove existing notification if any
  const existingNotification = document.getElementById('autofill-form-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  isNotificationVisible = true;
  const totalFields = forms.reduce((sum, form) => sum + form.fieldCount, 0);
  const formText = forms.length === 1 ? 'form' : 'forms';
  const fieldText = totalFields === 1 ? 'field' : 'fields';
  
  // Create lightweight notification
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
  
  // Add click handler for close button
  const closeBtn = notification.querySelector('#autofill-notification-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      hideNotification(notification);
    };
    
    closeBtn.onmouseenter = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseleave = () => closeBtn.style.opacity = '0.8';
  }
  
  // Clear any existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  // Auto-hide after 4 seconds
  notificationTimeout = setTimeout(() => {
    hideNotification(notification);
  }, 4000);
}

function hideNotification(notification) {
  if (!notification || !notification.parentNode) {
    isNotificationVisible = false;
    return;
  }
  
  // Clear timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
  
  // Simple fade out
  notification.style.opacity = '0';
  
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
    isNotificationVisible = false;
  }, 200);
}

// Instant detection when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", detectForms);
} else {
  detectForms();
}

// Optimized mutation observer
let detectionTimeout;
const observer = new MutationObserver((mutations) => {
  // Quick check for form-related changes
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
  const existingOverlay = document.getElementById('autofill-filling-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'autofill-filling-overlay';
  overlay.className = 'autofill-content-overlay';

  overlay.innerHTML = `
    <div class="autofill-content-modal">
      <div class="autofill-content-spinner"></div>
      <h3 class="autofill-content-title">🤖 AutoFill AI en cours</h3>
      <p class="autofill-content-description">Veuillez patienter pendant que nous remplissons automatiquement le formulaire...</p>
      
      <div id="filling-progress" class="autofill-content-progress">
        <div id="progress-bar" class="autofill-content-progress-bar"></div>
      </div>
      
      <p id="filling-status" class="autofill-content-status">Initialisation...</p>
      
      <p id="filling-progress-text" class="autofill-content-progress-text">0 / 0 champs remplis</p>
      
      <div class="autofill-content-tip">
        <p>💡 <strong>Astuce:</strong> Ne modifiez pas le formulaire pendant le remplissage automatique.</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  
  // Prevent all interaction with the page content
  overlay.addEventListener('click', (e) => e.stopPropagation());
  overlay.addEventListener('mousedown', (e) => e.stopPropagation());
  overlay.addEventListener('keydown', (e) => e.stopPropagation());
  overlay.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
  overlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  
  // Prevent scrolling on the body when overlay is active
  document.body.style.overflow = 'hidden';
  
  return overlay;
}

function updateFillingProgress(message, current = null, total = null) {
  const statusElement = document.getElementById('filling-status');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('filling-progress-text');
  
  if (statusElement) {
    statusElement.textContent = message;
  }
  
  // Update progress text if provided
  if (current !== null && total !== null) {
    if (progressText) {
      progressText.textContent = `${current} / ${total} champs remplis`;
    }
    // Update progress bar based on actual progress
    if (progressBar && total > 0) {
      const percentage = Math.round((current / total) * 90) + 10; // 10-100%
      progressBar.style.width = `${percentage}%`;
    }
  } else {
    // Update progress bar based on the message
    if (progressBar) {
      if (message.includes('Initialisation') || message.includes('Préparation')) {
        progressBar.style.width = '10%';
      } else if (message.includes('Analyzing')) {
        progressBar.style.width = '20%';
      } else if (message.includes('profile')) {
        progressBar.style.width = '50%';
      } else if (message.includes('Remplissage:') || message.includes('Filling:')) {
        // Extract progress if available in message like "Rempli 3/5 champs"
        const match = message.match(/(\d+)\/(\d+)/);
        if (match) {
          const [, current, total] = match;
          const percentage = Math.round((parseInt(current) / parseInt(total)) * 70) + 20; // 20-90%
          progressBar.style.width = `${percentage}%`;
        } else {
          progressBar.style.width = '60%';
        }
      } else if (message.includes('AI') || message.includes('Generating')) {
        progressBar.style.width = '80%';
      } else if (message.includes('Applying') || message.includes('Filling:')) {
        progressBar.style.width = '95%';
      } else if (message.includes('Completed') || message.includes('terminé') || message.includes('succès')) {
        progressBar.style.width = '100%';
      } else if (message.includes('Still waiting')) {
        progressBar.style.width = '100%';
      }
    }
  }
}

function removeFillingOverlay() {
  const overlay = document.getElementById('autofill-filling-overlay');
  if (overlay) {
    // Restore body scrolling
    document.body.style.overflow = '';
    
    // Fade out animation
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 300);
  }
}

// Add autofill styles to the page
function addAutofillStyles() {
  if (document.getElementById('autofill-styles')) {
    return; // Already added
  }
  
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
    
    /* Overlay animations */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    #autofill-filling-overlay {
      animation: fadeIn 0.3s ease-out;
    }
  `;
  
  document.head.appendChild(styles);
}

// Initialize styles when content script loads
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
    // Handle complete form filling process with overlay
    handleCompleteFormFilling(message.formIndex, message.matchedFields, message.userProfile, message.totalFields);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "showFillingOverlay") {
    createFillingOverlay();
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "updateFillingProgress") {
    updateFillingProgress(message.message || message.status);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "hideFillingOverlay") {
    removeFillingOverlay();
    sendResponse({ success: true });
    return true;
  }
});

function fillFormWithSuggestions(formIndex, suggestions, isAIFilling = false) {
  const forms = document.querySelectorAll("form");
  if (formIndex >= forms.length) {
    console.warn(`Form index ${formIndex} not found`);
    return;
  }
  
  const form = forms[formIndex];
  const formInputs = form.querySelectorAll("input, textarea, select");
  
  console.log(`Filling ${suggestions.length} suggestions (AI: ${isAIFilling})`);
  
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
      
      // Try multiple ways to find the target input
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
        
        // Fill the field based on its type
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
        
        console.log(`✅ Filled: ${fieldLabel} = "${suggestion.suggested_value}" (${suggestion.source})`);
        filledCount++;
      } else {
        console.warn(`❌ Could not find field: ${suggestion.field_name}`);
      }
      
      // Update progress for the last suggestion
      if (index === suggestions.length - 1) {
        setTimeout(() => {
          const sourceText = isAIFilling ? '🤖 AI' : '👤 Profile';
          updateFillingProgress(`${sourceText}: Completed ${filledCount}/${suggestions.length} fields!`);
        }, 200);
      }
      
    }, index * 250);
  });
}

// Complete form filling function that handles the entire process
async function handleCompleteFormFilling(formIndex, matchedFields, userProfile, totalFields) {
  try {
    console.log('🎯 Starting complete form filling process in content script');
    
    // Debug: Log the fields that were passed
    console.log('📝 Received matched fields:', matchedFields.map(f => ({
      name: f.field_name,
      value: f.suggested_value,
      matched: f.matched_profile_field
    })));
    
    // Create and show overlay
    createFillingOverlay();
    updateFillingProgress('Préparation du remplissage...', 0, totalFields);
    
    // Small delay to show the overlay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const forms = document.querySelectorAll("form");
    if (formIndex >= forms.length) {
      throw new Error(`Form index ${formIndex} not found`);
    }
    
    const form = forms[formIndex];
    
    // Fill fields one by one with progress updates
    let successCount = 0;
    let failedCount = 0;
    const failedFields = [];
    
    for (let i = 0; i < matchedFields.length; i++) {
      const field = matchedFields[i];
      
      try {
        // Get a meaningful field name for progress display
        const progressFieldName = field.field_info?.label || field.field_info?.placeholder || field.field_name || `Champ ${i + 1}`;
        updateFillingProgress(`Remplissage: ${progressFieldName}...`, i, totalFields);
        
        // Find the target input with multiple fallback strategies
        let targetInput = null;
        let foundVia = '';
        
        try {
          // Strategy 1: By name attribute
          targetInput = form.querySelector(`[name="${field.field_name}"]`);
          if (targetInput) foundVia = 'name';
          
          // Strategy 2: By ID
          if (!targetInput) {
            targetInput = form.querySelector(`#${field.field_name}`);
            if (targetInput) foundVia = 'id';
          }
          
          // Strategy 3: By field info properties
          if (!targetInput && field.field_info) {
            const fieldInfo = field.field_info;
            const formInputs = form.querySelectorAll("input, textarea, select");
            targetInput = Array.from(formInputs).find(input => {
              return (
                input.name === fieldInfo.name ||
                input.id === fieldInfo.id ||
                (fieldInfo.label && (getFieldLabel(input) === fieldInfo.label)) ||
                (fieldInfo.placeholder && input.placeholder === fieldInfo.placeholder)
              );
            });
            if (targetInput) foundVia = 'fieldInfo';
          }
        } catch (findError) {
          console.warn(`❌ Error finding field ${field.field_name}:`, findError);
          failedFields.push({ field: field.field_name, reason: 'field_not_found', error: findError.message });
          failedCount++;
          continue; // Skip to next field
        }
        
        if (targetInput && field.suggested_value !== null && field.suggested_value !== undefined) {
          try {
            const fieldLabel = getFieldLabel(targetInput) || targetInput.name || targetInput.placeholder || 'field';
            
            // Fill the field based on its type and content with error handling
            if (targetInput.tagName.toLowerCase() === 'select') {
              // Handle select elements
              try {
                const options = Array.from(targetInput.options);
                const matchingOption = options.find(option => 
                  option.value.toLowerCase() === field.suggested_value.toLowerCase() ||
                  option.text.toLowerCase() === field.suggested_value.toLowerCase()
                );
                if (matchingOption) {
                  targetInput.value = matchingOption.value;
                } else {
                  throw new Error(`No matching option found for "${field.suggested_value}"`);
                }
              } catch (selectError) {
                console.warn(`❌ Select field error for ${field.field_name}:`, selectError);
                failedFields.push({ field: field.field_name, reason: 'select_option_not_found', error: selectError.message });
                failedCount++;
                continue;
              }
            } else if (targetInput.type === 'date' || field.matched_profile_field === 'dateOfBirth') {
              // Handle date inputs specifically
              try {
                let dateValue = field.suggested_value;
                
                // If it's a date field but not in YYYY-MM-DD format, try to convert
                if (dateValue && !dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const date = new Date(dateValue);
                  if (!isNaN(date.getTime())) {
                    dateValue = date.toISOString().split('T')[0];
                  } else {
                    throw new Error(`Invalid date format: ${dateValue}`);
                  }
                }
                
                targetInput.value = dateValue;
                console.log(`📅 Date field filled: ${fieldLabel} = "${dateValue}" (via: ${foundVia})`);
              } catch (dateError) {
                console.warn(`❌ Date field error for ${field.field_name}:`, dateError);
                failedFields.push({ field: field.field_name, reason: 'date_format_error', error: dateError.message });
                failedCount++;
                continue;
              }
            } else {
              // Handle input and textarea elements
              try {
                targetInput.value = field.suggested_value.toString();
              } catch (inputError) {
                console.warn(`❌ Input field error for ${field.field_name}:`, inputError);
                failedFields.push({ field: field.field_name, reason: 'input_value_error', error: inputError.message });
                failedCount++;
                continue;
              }
            }
            
            // Trigger events to notify the page (with error handling)
            try {
              targetInput.dispatchEvent(new Event('input', { bubbles: true }));
              targetInput.dispatchEvent(new Event('change', { bubbles: true }));
              targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
            } catch (eventError) {
              console.warn(`⚠️ Event dispatch warning for ${field.field_name}:`, eventError);
              // Don't fail the field for event errors, just warn
            }
            
            // Visual feedback (with error handling)
            try {
              targetInput.classList.add('autofill-filling');
              setTimeout(() => {
                try {
                  targetInput.style.backgroundColor = '#e8f5e8';
                  targetInput.style.transition = 'background-color 0.3s';
                } catch (styleError) {
                  console.warn(`⚠️ Style warning for ${field.field_name}:`, styleError);
                }
              }, 100);
              setTimeout(() => {
                try {
                  targetInput.style.backgroundColor = '';
                  targetInput.classList.remove('autofill-filling');
                } catch (styleError) {
                  console.warn(`⚠️ Style cleanup warning for ${field.field_name}:`, styleError);
                }
              }, 2000);
            } catch (visualError) {
              console.warn(`⚠️ Visual feedback warning for ${field.field_name}:`, visualError);
              // Don't fail for visual feedback errors
            }
            
            console.log(`✅ Filled: ${fieldLabel} = "${field.suggested_value}" (via: ${foundVia})`);
            successCount++;
            
          } catch (fillError) {
            console.warn(`❌ Failed to fill ${field.field_name}:`, fillError);
            failedFields.push({ field: field.field_name, reason: 'fill_operation_failed', error: fillError.message });
            failedCount++;
          }
        } else {
          console.warn(`❌ Could not find field or value: ${field.field_name}`);
          failedFields.push({ field: field.field_name, reason: 'field_or_value_missing' });
          failedCount++;
        }
        
        // Update progress with meaningful field name
        const completedFieldName = field.field_info?.label || field.field_info?.placeholder || field.field_name || `Champ ${i + 1}`;
        updateFillingProgress(`Rempli: ${completedFieldName}`, i + 1, totalFields);
        
        // Small delay for visual feedback (continue even if this fails)
        try {
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (delayError) {
          console.warn('⚠️ Delay warning:', delayError);
        }
        
      } catch (outerError) {
        console.error(`❌ Unexpected error processing field ${field.field_name}:`, outerError);
        failedFields.push({ field: field.field_name, reason: 'unexpected_error', error: outerError.message });
        failedCount++;
      }
    }
    
    // Show completion
    updateFillingProgress(`Formulaire rempli avec succès! ${successCount}/${totalFields} champs`, totalFields, totalFields);
    
    // Auto-remove overlay after showing completion
    setTimeout(() => {
      removeFillingOverlay();
    }, 2500);
    
    console.log(`🎉 Form filling completed! Filled ${successCount}/${totalFields} fields`);
    
    // Log summary of failed fields if any
    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} fields failed to fill:`, failedFields);
    }
    
  } catch (error) {
    console.error('❌ Form filling error:', error);
    updateFillingProgress('Erreur lors du remplissage du formulaire');
    
    // Remove overlay after error
    setTimeout(() => {
      removeFillingOverlay();
    }, 3000);
  }
}

// Debug function to log field details
function logFieldDebugInfo(fields, userProfile) {
  console.log('🔍 Debug: All detected fields:', fields.map(f => ({
    name: f.name,
    label: f.label,
    type: f.type,
    placeholder: f.placeholder
  })));
  
  // Check specifically for potential birth date fields
  const potentialBirthFields = fields.filter(f => {
    const identifiers = [f.label, f.name, f.placeholder].filter(Boolean).map(s => s.toLowerCase());
    return identifiers.some(id => 
      id.includes('birth') || id.includes('naissance') || id.includes('age') || 
      id.includes('âge') || id.includes('né') || id.includes('born')
    );
  });
  
  if (potentialBirthFields.length > 0) {
    console.log('🎂 Potential birth date fields found:', potentialBirthFields);
  }
  
  console.log('👤 User profile birth date:', userProfile.profile?.dateOfBirth);
}