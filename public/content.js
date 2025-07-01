let detectedFormsCache = [];

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
  return formResults;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", detectForms);
} else {
  detectForms();
}

let detectionTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(detectionTimeout);
  detectionTimeout = setTimeout(() => {
    detectForms();
  }, 500);
});
observer.observe(document.body, {
  childList: true,
  subtree: true
});

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
    fillFormWithSuggestions(message.formIndex, message.suggestions);
    sendResponse({ success: true });
    return true;
  }
});

function fillFormWithSuggestions(formIndex, suggestions) {
  const forms = document.querySelectorAll("form");
  if (formIndex >= forms.length) {
    return;
  }
  const form = forms[formIndex];
  const formInputs = form.querySelectorAll("input, textarea, select");
  suggestions.forEach(suggestion => {
    let targetInput = null;
    targetInput = form.querySelector(`[name="${suggestion.field_name}"]`);
    if (!targetInput) {
      targetInput = form.querySelector(`#${suggestion.field_name}`);
    }
    if (!targetInput) {
      const fieldInfo = suggestion.field_info;
      if (fieldInfo) {
        targetInput = Array.from(formInputs).find(input => {
          const inputLabel = getFieldLabel(input);
          return inputLabel && inputLabel === fieldInfo.label || 
                 input.placeholder && input.placeholder === fieldInfo.placeholder ||
                 input.name && input.name === fieldInfo.name;
        });
      }
    }
    if (targetInput) {
      if (targetInput.tagName.toLowerCase() === 'select') {
        const options = Array.from(targetInput.options);
        let optionFound = false;
        const exactMatch = options.find(option => 
          option.value.toLowerCase() === suggestion.suggested_value.toLowerCase() ||
          option.text.toLowerCase() === suggestion.suggested_value.toLowerCase()
        );
        if (exactMatch) {
          targetInput.value = exactMatch.value;
          optionFound = true;
        } else {
          const partialMatch = options.find(option => 
            option.text.toLowerCase().includes(suggestion.suggested_value.toLowerCase()) ||
            option.value.toLowerCase().includes(suggestion.suggested_value.toLowerCase())
          );
          if (partialMatch) {
            targetInput.value = partialMatch.value;
            optionFound = true;
          }
        }
      } else if (targetInput.tagName.toLowerCase() === 'textarea') {
        targetInput.value = suggestion.suggested_value;
      } else {
        targetInput.value = suggestion.suggested_value;
      }
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      const isAIGenerated = suggestion.source === 'ai';
      targetInput.classList.add('autofill-filling');
      setTimeout(() => {
        targetInput.classList.remove('autofill-filling');
        targetInput.classList.add('autofill-filled');
      }, 300);
      setTimeout(() => {
        targetInput.classList.remove('autofill-filled');
      }, 2000);
    }
  });
}