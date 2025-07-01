export function showTab(tabName) {
    document.getElementById('loginTab').classList.add('hidden');
    document.getElementById('registerTab').classList.add('hidden');
    document.getElementById(tabName + 'Tab').classList.remove('hidden');

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const tabButton = document.getElementById(tabName + 'TabBtn');
    if (tabButton) {
        tabButton.classList.add('active');
    }
}

export function toggleSection(sectionName) {
    const section = document.getElementById(sectionName + 'Section');
    section.classList.toggle('hidden');
}

export function hideAllSections() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('userSection').classList.add('hidden');
}

export function showAuthSection() {
    hideAllSections();
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('editProfileBtn').classList.add('hidden');
}

export function showProfileSection() {
    hideAllSections();
    document.getElementById('profileSection').classList.remove('hidden');
    document.getElementById('editProfileBtn').classList.add('hidden');
}

export function showUserSection(currentUser) {
    hideAllSections();
    document.getElementById('userSection').classList.remove('hidden');
    document.getElementById('editProfileBtn').classList.remove('hidden');
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userEmail').textContent = currentUser.email;
    }
}

export function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
}

export function clearMessages() {
    const messageElements = ['loginError', 'loginSuccess', 'registerError', 'registerSuccess', 'profileError', 'profileSuccess'];
    messageElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
            element.textContent = '';
        }
    });
}

export function displayMessage(message) {
    const container = document.getElementById('formsContainer');
    if (container) {
        container.innerHTML = `<p style="color: #666; font-size: 13px;">${message}</p>`;
    }
}
