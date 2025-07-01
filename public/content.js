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
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    font-family: system-ui, -apple-system, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
      position: relative;
    ">
      <div style="
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #4f46e5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px auto;
      "></div>
      <h3 style="
        margin: 0 0 10px 0;
        color: #333;
        font-size: 18px;
        font-weight: 600;
      ">Filling Form</h3>
      <p style="
        margin: 0 0 15px 0;
        color: #666;
        font-size: 14px;
        line-height: 1.4;
      ">Please wait while we automatically fill the form fields with your profile data and AI suggestions...</p>
      <div id="filling-progress" style="
        background: #f0f0f0;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        margin: 15px 0;
      ">
        <div id="progress-bar" style="
          background: linear-gradient(90deg, #4f46e5, #7c3aed);
          height: 100%;
          width: 0%;
          border-radius: 3px;
          transition: width 0.3s ease;
        "></div>
      </div>
      <p id="filling-status" style="
        margin: 10px 0 0 0;
        color: #888;
        font-size: 12px;
      ">Initializing...</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function updateFillingProgress(message) {
  const statusElement = document.getElementById('filling-status');
  const progressBar = document.getElementById('progress-bar');
  
  if (statusElement) {
    statusElement.textContent = message;
  }
  
  // Update progress bar based on the message
  if (progressBar) {
    if (message.includes('Analyzing')) {
      progressBar.style.width = '20%';
    } else if (message.includes('profile')) {
      progressBar.style.width = '50%';
    } else if (message.includes('AI') || message.includes('Generating')) {
      progressBar.style.width = '80%';
    } else if (message.includes('Applying') || message.includes('Filling:')) {
      progressBar.style.width = '95%';
    } else if (message.includes('Completed') || message.includes('Still waiting')) {
      progressBar.style.width = '100%';
    }
  }
}

function removeFillingOverlay() {
  const overlay = document.getElementById('autofill-filling-overlay');
  if (overlay) {
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
  if (message.action === "showFillingOverlay") {
    createFillingOverlay();
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "updateFillingProgress") {
    updateFillingProgress(message.status);
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