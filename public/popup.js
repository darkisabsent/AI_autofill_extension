import {
    prepareAIPayload,
    separateMatchedFields,
    categorizeUnmatchedFields,
    isOpenEndedQuestion,
    generateFieldSuggestions
} from './utils/formUtils.js';
import { FIELD_MAPPINGS } from './utils/constants.js';
import { handleLogin, handleRegister, handleProfileSubmit, handleLogout } from './manager/authHandler.js';
import { detectForms, displayDetectedForms, fillForm } from './manager/formHandler.js';
import { loadCountries } from './manager/dropdownHandler.js';
import { getAISuggestions } from './manager/aiHandler.js';
import { showTab, toggleSection, showAuthSection, showProfileSection, showUserSection, hideAllSections, showMessage, clearMessages, displayMessage } from './utils/domUtils.js';

class PopupManager {
    constructor() {
        this.currentUser = null;
        this.detectedForms = [];
        this.countries = [];
        this.fieldMappings = FIELD_MAPPINGS;
        this.AI_SERVER_URL = 'http://127.0.0.1:5001/api/analyze'; 
        this.init();
    }

    async init() {
        try {
            const storage = await new Promise(resolve =>
                chrome.storage.local.get(['accessToken'], resolve)
            );
            if (storage && storage.accessToken) {
                try {
                    const userResponse = await fetch('http://localhost:5000/api/auth/user', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${storage.accessToken}`
                        }
                    });

                    if (userResponse.status === 403) {
                        await chrome.storage.local.remove(['accessToken']);
                        await chrome.storage.local.remove(['currentUser']);
                        localStorage.removeItem('currentUser');
                        this.currentUser = null;
                        showAuthSection();
                        return;
                    }

                    const userData = await userResponse.json();

                    if (userResponse.ok) {
                        this.currentUser = {
                            id: userData.user.id,
                            username: userData.user.username || '',
                            email: userData.user.email,
                            is_profile_complete: userData.user.isProfileComplete,
                            accessToken: storage.accessToken,
                            profile: userData.user.profile
                        };

                        if (!this.currentUser.is_profile_complete) {
                            showProfileSection();
                            this.updateProfileProgress();
                        } else {
                            showUserSection(this.currentUser);
                            // Automatically load detected forms
                            this.loadDetectedForms();
                        }
                    } else {
                        await chrome.storage.local.remove(['accessToken']);
                        await chrome.storage.local.remove(['currentUser']);
                        localStorage.removeItem('currentUser');
                        showAuthSection();
                    }
                } catch (fetchError) {
                    await chrome.storage.local.remove(['accessToken']);
                    await chrome.storage.local.remove(['currentUser']);
                    localStorage.removeItem('currentUser');
                    showAuthSection();
                }
            } else {
                showAuthSection();
            }
        } catch (error) {
            showAuthSection();
        }
        this.countries = await loadCountries();
        await this.loadFieldMappings();
        this.setupEventListeners();
    }

    async loadCountries() {
        this.countries = await loadCountries();
    }

    populateCountryDropdowns() {
    }

    setupDropdownSearch(selectElement, placeholder) {
    }

    wrapElement(element, className) {
    }

    async checkUserStatus() {
        try {
            const response = await this.sendMessage({ action: 'getCurrentUser' });
            if (response.user) {
                this.currentUser = response.user;
                if (!response.user.is_profile_complete) {
                    showProfileSection();
                    this.updateProfileProgress();
                } else {
                    showUserSection(this.currentUser);
                }
            } else {
                showAuthSection();
            }
        } catch (error) {
            showAuthSection();
        }
    }

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileSubmit();
        });
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
        document.getElementById('editProfileBtn').addEventListener('click', () => {
            this.openOptionsPage();
        });
        this.setupProfileProgressTracking();
        document.getElementById('toggleAcademicSectionBtn').addEventListener('click', () => {
            toggleSection('academic');
        });
        document.getElementById('toggleProfessionalSectionBtn').addEventListener('click', () => {
            toggleSection('professional');
        });
        document.getElementById('toggleStartupSectionBtn').addEventListener('click', () => {
            toggleSection('startup');
        });
        // Remove detect forms button listener since we auto-load
        document.getElementById('loginTabBtn').addEventListener('click', () => {
            showTab('login');
        });
        document.getElementById('registerTabBtn').addEventListener('click', () => {
            showTab('register');
        });
    }

    setupProfileProgressTracking() {
        const profileInputs = document.querySelectorAll('#profileForm input, #profileForm select, #profileForm textarea');
        profileInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateProfileProgress();
            });
        });
    }

    updateProfileProgress() {
        
        const allFields = [
            'firstName', 'lastName', 'hobbies', 'dateOfBirth', 'gender',
            'phoneNumber', 'phoneCountryCode', 'address', 'city', 'country', 'postalCode',
            'linkedinUrl', 'githubUrl', 'portfolioUrl'
        ];
        let filledFields = 0;
        allFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && field.value.trim()) {
                filledFields++;
            }
        });
        const progress = Math.round((filledFields / allFields.length) * 100);
        document.getElementById('profileProgressBar').style.width = `${progress}%`;
    }

    async handleLogin() {
        handleLogin(this);
    }

    async handleRegister() {
        handleRegister(this);
    }

    async handleProfileSubmit() {
        handleProfileSubmit(this);
    }

    collectProfileData() {
    }

    async handleLogout() {
        handleLogout(this);
    }

    openOptionsPage() {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }

    async detectForms() {
        detectForms(this);
    }

    displayDetectedForms(forms) {
        displayDetectedForms(this, forms);
    }

    async fillForm(formIndex) {
        fillForm(this, formIndex);
    }

    async getAISuggestions(userProfile, aiRelevantFields) {
        return getAISuggestions(this, userProfile, aiRelevantFields);
    }

    async loadFieldMappings() {
        try {
            const response = await fetch('field-mappings.json');
            const data = await response.json();
            this.fieldMappings = data;
            console.log('📋 Field mappings loaded from JSON:', {
                dateOfBirth: data.dateOfBirth,
                totalMappings: Object.keys(data).length
            });
        } catch (error) {
            console.warn('❌ Failed to load field-mappings.json, using constants fallback:', error);
            this.fieldMappings = FIELD_MAPPINGS;
            console.log('📋 Using fallback mappings:', {
                dateOfBirth: this.fieldMappings.dateOfBirth
            });
        }
    }

    separateMatchedFields(allSuggestions, originalFields) {
        return separateMatchedFields(allSuggestions, originalFields, (field) => isOpenEndedQuestion(field));
    }

    categorizeUnmatchedFields(unmatchedFields) {
        return categorizeUnmatchedFields(unmatchedFields, (field) => isOpenEndedQuestion(field));
    }

    isOpenEndedQuestion(field) {
        return isOpenEndedQuestion(field);
    }

    generateFieldSuggestions(fields, userProfile) {
        return generateFieldSuggestions(fields, userProfile, this.fieldMappings);
    }

    prepareAIPayload(userProfile, aiRelevantFields) {
        return prepareAIPayload(userProfile, aiRelevantFields);
    }

    showAuthSection() {
        showAuthSection();
    }

    showProfileSection() {
        showProfileSection();
        this.updateProfileProgress();
    }

    showUserSection() {
        showUserSection(this.currentUser);
    }

    hideAllSections() {
        hideAllSections();
    }

    showMessage(elementId, message) {
        showMessage(elementId, message);
    }

    clearMessages() {
        clearMessages();
    }

    displayMessage(message) {
        displayMessage(message);
    }

    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async loadDetectedForms() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getDetectedForms' });
            
            if (response && response.forms && response.forms.length > 0) {
                this.displayDetectedForms(response.forms);
            } else {
                // If no cached forms, show a message or refresh detection
                const container = document.getElementById('formsContainer');
                container.innerHTML = '<p style="color: #666; font-size: 13px; text-align: center; padding: 20px;">No forms detected on this page.</p>';
            }
        } catch (error) {
            const container = document.getElementById('formsContainer');
            container.innerHTML = '<p style="color: #999; font-size: 13px; text-align: center; padding: 20px;">Unable to detect forms. Please refresh the page.</p>';
        }
    }
}

const popupManager = new PopupManager();

