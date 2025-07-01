document.addEventListener('DOMContentLoaded', function() {
    const optionsManager = new OptionsManager();
    optionsManager.init();
});

class OptionsManager {
    constructor() {
        this.currentUser = null;
        this.countries = [];
        this.originalProfileData = {};
        this.changedFields = {};
    }

    async init() {
        await this.loadUserData();
        await this.loadCountries();
        this.setupEventListeners();
        await this.loadPreferences();

        if (this.currentUser?.profile) {
            this.populateProfileForm(this.currentUser.profile);
            this.originalProfileData = { ...this.currentUser.profile };
        }
    }

    async loadUserData() {
        try {
            const result = await chrome.storage.local.get(['currentUser', 'accessToken']);
            if (result.currentUser) {
                this.currentUser = result.currentUser;
                if (result.accessToken && (!this.currentUser.profile || !Object.keys(this.currentUser.profile).length)) {
                    await this.fetchUserProfile(result.accessToken);
                }
            } else {
                this.showMessage('errorMessage', 'Please log in via the extension popup.');
            }
        } catch (error) {
            this.showMessage('errorMessage', 'Failed to load user data.');
        }
    }

    async fetchUserProfile(accessToken) {
        try {
            const response = await fetch('http://localhost:5000/api/auth/user', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.user?.profile) {
                    this.currentUser.profile = data.user.profile;
                    await chrome.storage.local.set({ currentUser: this.currentUser });
                    this.populateProfileForm(data.user.profile);
                    this.originalProfileData = { ...data.user.profile };
                }
            }
        } catch (error) {}
    }

    async loadCountries() {
        try {
            const response = await fetch('countries.json');
            this.countries = await response.json();
            this.populateCountryDropdowns();
        } catch (error) {}
    }

    populateCountryDropdowns() {
        const phoneCountrySelect = document.getElementById('phoneCountryCode');
        const countrySelect = document.getElementById('country');
        if (!phoneCountrySelect || !countrySelect) return;

        phoneCountrySelect.innerHTML = '<option value="">Select Code</option>';
        countrySelect.innerHTML = '<option value="">Select a country</option>';

        this.countries.forEach(country => {
            const phoneOption = document.createElement('option');
            phoneOption.value = country.phone_code;
            phoneOption.textContent = `${country.phone_code} (${country.code})`;
            phoneCountrySelect.appendChild(phoneOption);

            const countryOption = document.createElement('option');
            countryOption.value = country.name;
            countryOption.textContent = country.name;
            countrySelect.appendChild(countryOption);
        });
    }

    setupEventListeners() {
        document.getElementById('toggleAcademicBtn').addEventListener('click', () => this.toggleSection('academicSection'));
        document.getElementById('toggleProfessionalBtn').addEventListener('click', () => this.toggleSection('professionalSection'));
        document.getElementById('toggleStartupBtn').addEventListener('click', () => this.toggleSection('startupSection'));

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileSubmit();
        });

        document.getElementById('preferencesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePreferencesSubmit();
        });

        const allFormFields = document.querySelectorAll('#profileForm input, #profileForm select, #profileForm textarea');
        allFormFields.forEach(field => {
            field.addEventListener('change', (e) => this.trackFieldChange(e.target));
            if (field.tagName === 'INPUT' && ['text', 'url', 'tel'].includes(field.type)) {
                field.addEventListener('blur', (e) => this.trackFieldChange(e.target));
            }
        });
    }

    trackFieldChange(field) {
        const fieldId = field.id;
        let value = field.value;
        if (field.type === 'number' && value) value = parseInt(value);

        const originalValue = this.originalProfileData[fieldId];
        if (value !== originalValue) {
            this.changedFields[fieldId] = value;
        } else {
            delete this.changedFields[fieldId];
        }
    }

    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        section.classList.toggle('hidden');
    }

    populateProfileForm(profile) {
        if (!profile) return;

        for (const [key, value] of Object.entries(profile)) {
            const element = document.getElementById(key);
            if (element) {
                element.value = element.type === 'date' && typeof value === 'string' && value.includes('T') 
                    ? value.split('T')[0] 
                    : value;
            }
        }

        this.checkAndShowSection('academicSection', ['academicDegree', 'academicInstitution', 'academicGraduationYear', 'academicFieldOfStudy']);
        this.checkAndShowSection('professionalSection', ['professionalJobTitle', 'professionalCompanyName', 'professionalYearsOfExperience', 'professionalSkills']);
        this.checkAndShowSection('startupSection', ['startupProjectName', 'startupSummary', 'startupMission']);
    }

    checkAndShowSection(sectionId, fields) {
        const section = document.getElementById(sectionId);
        const hasData = fields.some(fieldId => document.getElementById(fieldId)?.value);
        if (hasData) section.classList.remove('hidden');
    }

    async handleProfileSubmit() {
        if (!Object.keys(this.changedFields).length) {
            this.showMessage('errorMessage', 'No changes were made.');
            return;
        }

        const dataToSend = { ...this.changedFields };
        if (dataToSend.dateOfBirth) dataToSend.dateOfBirth = new Date(dataToSend.dateOfBirth).toISOString();

        try {
            const { accessToken } = await chrome.storage.local.get('accessToken');
            if (!accessToken) {
                this.showMessage('errorMessage', 'Please log in to update your profile.');
                return;
            }

            const response = await fetch('http://localhost:5000/api/profile', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });

            if (response.ok) {
                const updatedProfile = { ...this.currentUser.profile, ...dataToSend };
                this.currentUser.profile = updatedProfile;
                await chrome.storage.local.set({ currentUser: this.currentUser });
                this.originalProfileData = { ...updatedProfile };
                this.changedFields = {};
                this.showMessage('successMessage', 'Profile updated successfully.');
            } else {
                const data = await response.json();
                this.showMessage('errorMessage', data.message || 'Failed to update profile.');
            }
        } catch (error) {
            this.showMessage('errorMessage', 'An error occurred while updating the profile.');
        }
    }

    async loadPreferences() {
        try {
            const result = await chrome.storage.local.get('preferences');
            const preferences = result.preferences || {
                autoDetect: true,
                showNotifications: true,
                saveHistory: true,
                apiUrl: 'http://localhost:5000/api'
            };

            document.getElementById('autoDetect').checked = preferences.autoDetect !== false;
            document.getElementById('showNotifications').checked = preferences.showNotifications !== false;
            document.getElementById('saveHistory').checked = preferences.saveHistory !== false;
            document.getElementById('apiUrl').value = preferences.apiUrl || 'http://localhost:5000/api';
        } catch (error) {}
    }

    async handlePreferencesSubmit() {
        try {
            const preferences = {
                autoDetect: document.getElementById('autoDetect').checked,
                showNotifications: document.getElementById('showNotifications').checked,
                saveHistory: document.getElementById('saveHistory').checked,
                apiUrl: document.getElementById('apiUrl').value
            };

            await chrome.storage.local.set({ preferences });
            this.showMessage('successMessage', 'Preferences saved successfully.');
        } catch (error) {
            this.showMessage('errorMessage', 'Failed to save preferences.');
        }
    }

    showMessage(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.classList.remove('hidden');
        setTimeout(() => element.classList.add('hidden'), 5000);
    }
}

