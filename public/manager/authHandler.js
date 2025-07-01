import { showMessage, clearMessages, showProfileSection, showUserSection, showAuthSection } from '../utils/domUtils.js';
import { showTab } from '../utils/domUtils.js';

function collectProfileData() {
    return {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        phoneCountryCode: document.getElementById('phoneCountryCode').value,
        gender: document.getElementById('gender').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        country: document.getElementById('country').value,
        postalCode: document.getElementById('postalCode').value,
        hobbies: document.getElementById('hobbies').value,
        linkedinUrl: document.getElementById('linkedinUrl').value,
        githubUrl: document.getElementById('githubUrl').value,
        portfolioUrl: document.getElementById('portfolioUrl').value,
        academicDegree: document.getElementById('academicDegree').value,
        academicInstitution: document.getElementById('academicInstitution').value,
        academicGraduationYear: document.getElementById('academicGraduationYear').value ? parseInt(document.getElementById('academicGraduationYear').value) : null,
        academicFieldOfStudy: document.getElementById('academicFieldOfStudy').value,
        professionalJobTitle: document.getElementById('professionalJobTitle').value,
        professionalCompanyName: document.getElementById('professionalCompanyName').value,
        professionalYearsOfExperience: document.getElementById('professionalYearsOfExperience').value ? parseInt(document.getElementById('professionalYearsOfExperience').value) : null,
        professionalSkills: document.getElementById('professionalSkills').value,
        startupProjectName: document.getElementById('startupProjectName').value,
        startupSummary: document.getElementById('startupSummary').value,
        startupMission: document.getElementById('startupMission').value,
        startupProblemStatement: document.getElementById('startupProblemStatement').value,
        startupSolution: document.getElementById('startupSolution').value,
        startupImpact: document.getElementById('startupImpact').value,
        startupTeamMembers: document.getElementById('startupTeamMembers').value,
        startupVideoUrl: document.getElementById('startupVideoUrl').value
    };
}

export async function handleLogin(instance) {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    clearMessages();
    try {
        const response = await instance.sendMessage({
            action: 'login',
            credentials: { email, password }
        });
        if (response.success) {
            instance.currentUser = response.user;
            localStorage.setItem('currentUser', JSON.stringify(instance.currentUser));
            if (!response.is_profile_complete) {
                showMessage('loginSuccess', 'Connexion réussie ! Veuillez compléter votre profil.');
                setTimeout(() => {
                    showProfileSection();
                    instance.updateProfileProgress();
                }, 1500);
            } else {
                showMessage('loginSuccess', 'Connexion réussie !');
                setTimeout(() => {
                    showUserSection(instance.currentUser);
                }, 1500);
            }
        } else {
            showMessage('loginError', response.error);
        }
    } catch (error) {
        showMessage('loginError', 'Erreur de connexion');
    }
}

export async function handleRegister(instance) {
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    clearMessages();
    try {
        const response = await instance.sendMessage({
            action: 'register',
            userData: { username, email, password }
        });
        if (response.success) {
            showMessage('registerSuccess', 'Inscription réussie ! Veuillez vous connecter.');
            setTimeout(() => {
                showTab('login');
            }, 2000);
        } else {
            showMessage('registerError', response.error);
        }
    } catch (error) {
        showMessage('registerError', 'Erreur lors de l\'inscription');
    }
}

export async function handleProfileSubmit(instance) {
    const profileData = collectProfileData();
    const requiredFields = [
        'firstName', 'lastName', 'dateOfBirth', 'phoneNumber',
        'phoneCountryCode', 'gender', 'address', 'city', 'country', 'postalCode'
    ];
    const missingFields = requiredFields.filter(field => !profileData[field]);
    if (missingFields.length > 0) {
        showMessage('profileError', `Les champs suivants sont requis : ${missingFields.join(', ')}`);
        return;
    }
    clearMessages();
    try {
        const response = await instance.sendMessage({
            action: 'createProfile',
            profileData: profileData
        });
        if (response.success) {
            showMessage('profileSuccess', 'Profil créé avec succès ! Redirection vers le tableau de bord...');
            setTimeout(() => {
                showUserSection(instance.currentUser);
            }, 1500);
        } else {
            showMessage('profileError', response.error || 'Erreur inconnue lors de la création du profil');
        }
    } catch (error) {
        showMessage('profileError', 'Erreur lors de la création du profil');
    }
}

export async function handleLogout(instance) {
    try {
        localStorage.removeItem('currentUser');
        instance.currentUser = null;
        await instance.sendMessage({ action: 'logout' });
        showAuthSection();
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (error) {
        showAuthSection();
    }
}
