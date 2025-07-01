class BackgroundService {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.currentUser = null;
        console.log('BackgroundService initialized');
        this.init();
    }

    init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Received message:', request);
            this.handleMessage(request, sender, sendResponse);
            return true; 
        });

        this.loadUserData();
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            console.log('Handling message action:', request.action);
            switch (request.action) {
                case 'login':
                    console.log('Processing login...');
                    const loginResult = await this.login(request.credentials);
                    sendResponse(loginResult);
                    break;

                case 'register':
                    console.log('Processing register...');
                    const registerResult = await this.register(request.userData);
                    sendResponse(registerResult);
                    break;

                case 'logout':
                    console.log('Processing logout...');
                    await this.logout();
                    sendResponse({ success: true });
                    break;

                case 'getCurrentUser':
                    console.log('Fetching current user...');
                    const userInfo = await this.getCurrentUserFromTokens();
                    sendResponse(userInfo);
                    break;

                case 'createProfile':
                    console.log('Creating profile...');
                    const profileResult = await this.createProfile(request.profileData);
                    sendResponse(profileResult);
                    break;

                case 'updateProfile':
                    console.log('Updating profile...');
                    const updateResult = await this.updateProfile(request.profileData);
                    sendResponse(updateResult);
                    break;

                case 'getProfile':
                    console.log('Fetching profile for userId:', request.userId);
                    const profile = await this.getProfile(request.userId);
                    sendResponse(profile);
                    break;

                default:
                    console.warn('Unknown action:', request.action);
                    sendResponse({ error: 'Action non reconnue' });
            }
        } catch (error) {
            console.error('Error in handleMessage:', error);
            sendResponse({ error: error.message });
        }
    }

    async login(credentials) {
        console.log('Attempting login with credentials:', credentials);
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Login successful:', data);
                if (data.accessToken && data.refreshToken) {
                    await this.storeTokens({
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        userId: data.userId
                    });
                }

                const userResponse = await fetch(`${this.apiBaseUrl}/auth/user`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${data.accessToken}`
                    }
                });

                const userData = await userResponse.json();

                if (userResponse.ok) {
                    console.log('User details fetched successfully:', userData);

                    this.currentUser = {
                        id: userData.user.id,
                        username: userData.user.username || '',
                        email: userData.user.email,
                        is_profile_complete: userData.user.isProfileComplete,
                        createdAt: userData.user.createdAt || new Date().toISOString(),
                        profile: userData.user.profile
                    };

                    await this.saveUserData(this.currentUser);
                    return { 
                        success: true, 
                        user: this.currentUser,
                        is_profile_complete: userData.user.isProfileComplete,
                    };
                } else {
                    console.warn('Failed to fetch user details:', userData.message || 'Unknown error');
                    return { success: false, error: userData.message || 'Failed to fetch user details' };
                }
            } else {
                console.warn('Login failed:', data.message || 'Unknown error');
                return { success: false, error: data.message || 'Login failed' };
            }
        } catch (error) {
            console.error('Error during login:', error);
            return { success: false, error: 'Erreur de connexion au serveur' };
        }
    }

    async register(userData) {
        console.log('Attempting registration with userData:', userData);
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Registration successful:', data);
                return { 
                    success: true, 
                    message: data.message,
                    redirect_to_login: data.redirect_to_login
                };
            } else {
                console.warn('Registration failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Error during registration:', error);
            return { success: false, error: 'Erreur de connexion au serveur' };
        }
    }

    async createProfile(profileData) {
        console.log('Attempting to create profile with data:', profileData);

        try {
            if (profileData.dateOfBirth) {
                const date = new Date(profileData.dateOfBirth);
                profileData.dateOfBirth = date.toISOString();
            }
            
            const { accessToken } = await new Promise((resolve) => {
                chrome.storage.local.get(['accessToken'], resolve);
            });

            if (!accessToken) {
                console.warn('No access token found');
                return { success: false, error: 'Invalid or expired token' };
            }

            console.log('Using access token:', accessToken);
            console.log('Sending formatted profile data:', profileData);

            const response = await fetch(`${this.apiBaseUrl}/profile`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });

            console.log('Raw response status:', response.status);
            const responseText = await response.text();
            console.log('Raw response body:', responseText);

            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse response as JSON:', e);
                return { success: false, error: 'Invalid server response' };
            }

            console.log('Parsed response from createProfile API:', responseData);

            if (!response.ok) {
                console.warn('Profile creation failed:', responseData.message || 'Unknown error');
                return { success: false, error: responseData.message || 'Profile creation failed' };
            }

            console.log('Profile creation successful:', responseData);

            const completionResponse = await fetch(`${this.apiBaseUrl}/auth/profile-completion`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            const completionData = await completionResponse.json();
            console.log('Response from profile-completion API:', completionData);

            if (!completionResponse.ok) {
                console.warn('Profile completion update failed:', completionData.message || 'Unknown error');
                return { success: false, error: completionData.message || 'Profile completion update failed' };
            }

            console.log('Profile marked as complete:', completionData);
            this.currentUser.is_profile_complete = true;
            await this.saveUserData(this.currentUser);

            return { success: true };
        } catch (error) {
            console.error('Error during profile creation:', error);
            return { success: false, error: 'Erreur de connexion au serveur' };
        }
    }

    async updateProfile(profileData) {
        console.log('Attempting to update profile with data:', profileData);
        if (!this.currentUser) {
            console.warn('Cannot update profile: User not logged in');
            return { error: 'Utilisateur non connecté' };
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUser.id}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Profile update successful:', data);
                return { success: true, profile: data.profile };
            } else {
                console.warn('Profile update failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Error during profile update:', error);
            return { success: false, error: 'Erreur de connexion au serveur' };
        }
    }

    async getProfile(userId) {
        console.log('Attempting to fetch profile for userId:', userId);
        try {
            const response = await fetch(`${this.apiBaseUrl}/users/${userId}/profile`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Profile fetch successful:', data);
                return { success: true, profile: data };
            } else {
                console.warn('Profile fetch failed:', data.error || data.message);
                return { success: false, error: data.error || data.message };
            }
        } catch (error) {
            console.error('Error during profile fetch:', error);
            return { success: false, error: 'Erreur de connexion au serveur' };
        }
    }

    async logout() {
        console.log('Logging out user...');
        
        try { 
            const { accessToken } = await this.getStoredTokens();
            if (accessToken) {
                try {
                    await fetch(`${this.apiBaseUrl}/auth/logout`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log('Successfully logged out on server');
                } catch (e) {
                    console.warn('Server logout failed, continuing with local logout');
                }
            }
        } catch (e) {
            console.warn('Error during server logout, continuing with local logout');
        }
        
        this.currentUser = null;
        await this.clearTokens();
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'userId', 'currentUser']);
        
        console.log('Logout complete - all local data cleared');
        return { success: true };
    }

    async getCurrentUserFromTokens(refreshAttempts = 0) {
        console.log('Fetching current user from tokens...');
        try {
            const MAX_REFRESH_ATTEMPTS = 1;
            if (refreshAttempts > MAX_REFRESH_ATTEMPTS) {
                console.warn(`Maximum token refresh attempts (${MAX_REFRESH_ATTEMPTS}) exceeded. Logging out.`);
                await this.logout();
                return { user: null };
            }

            const { accessToken, refreshToken, userId } = await this.getStoredTokens();

            if (!accessToken) {
                console.warn('No access token found');
                return { user: null };
            }

            try {
                console.log('Validating access token...');
                const userResponse = await this.validateToken(accessToken);
                console.log('Access token valid:', userResponse);

                const userDetailsResponse = await fetch(`${this.apiBaseUrl}/auth/user`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                const userData = await userDetailsResponse.json();

                if (userDetailsResponse.ok) {
                    console.log('User details fetched successfully:', userData);

                    this.currentUser = {
                        id: userData.user.id,
                        username: userData.user.username || '',
                        email: userData.user.email,
                        is_profile_complete: userData.user.isProfileComplete,
                        createdAt: userData.user.createdAt || new Date().toISOString(),
                        profile: userData.user.profile,
                        accessToken: accessToken
                    };

                    await this.saveUserData(this.currentUser);
                    return { user: this.currentUser };
                } else {
                    console.warn('Failed to fetch user details:', userData.message || 'Unknown error');
                    return { user: null };
                }
            } catch (error) {
                console.warn('Access token invalid, attempting refresh...');
                if (refreshToken) {
                    try {
                        const newTokens = await this.refreshAccessToken(refreshToken);
                        console.log('Token refresh successful:', newTokens);
                        
                        if (!newTokens.accessToken) {
                            console.error('Refresh returned invalid tokens');
                            await this.clearTokens();
                            return { user: null };
                        }
                        
                        await this.storeTokens({
                            accessToken: newTokens.accessToken,
                            refreshToken: refreshToken,
                            userId: userId
                        });

                        return await this.getCurrentUserFromTokens(refreshAttempts + 1);
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                        await this.clearTokens();
                        return { user: null };
                    }
                } else {
                    console.warn('No refresh token available');
                    await this.clearTokens();
                    return { user: null };
                }
            }
        } catch (error) {
            console.error('Error fetching current user from tokens:', error);
            return { user: null };
        }
    }

    async validateToken(token) {
        const response = await fetch(`${this.apiBaseUrl}/auth/validate`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        return response.json();
    }

    async refreshAccessToken(refreshToken) {
        const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        return response.json();
    }

    async getStoredTokens() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['accessToken', 'refreshToken', 'userId'], (result) => {
                resolve(result);
            });
        });
    }

    async storeTokens({ accessToken, refreshToken, userId }) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ accessToken, refreshToken, userId }, resolve);
        });
    }

    async clearTokens() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['accessToken', 'refreshToken', 'userId'], resolve);
        });
    }
    
    async saveUserData(user) {
        await chrome.storage.local.set({ currentUser: user });
    }

    async loadUserData() {
        const result = await chrome.storage.local.get(['accessToken', 'refreshToken', 'userId', 'currentUser']);
        const { accessToken, refreshToken, userId } = result;

        if (accessToken) {
            try {
                console.log('Validating access token...');
                const userResponse = await this.validateToken(accessToken);
                console.log('Access token valid:', userResponse);

                const userDetailsResponse = await fetch(`${this.apiBaseUrl}/auth/user`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                const userData = await userDetailsResponse.json();

                if (userDetailsResponse.ok) {
                    console.log('User details fetched successfully:', userData);

                    this.currentUser = {
                        id: userData.user.id,
                        username: userData.user.username || '',
                        email: userData.user.email,
                        is_profile_complete: userData.user.isProfileComplete,
                        createdAt: userData.user.createdAt || new Date().toISOString(),
                        profile: userData.user.profile
                    };

                    await this.saveUserData(this.currentUser);
                } else {
                    console.warn('Failed to fetch user details:', userData.message || 'Unknown error');
                    this.currentUser = null;
                }
            } catch (error) {
                console.warn('Access token invalid, attempting refresh...');
                if (refreshToken) {
                    try {
                        const newTokens = await this.refreshAccessToken(refreshToken);
                        console.log('Token refresh successful:', newTokens);
                        await this.storeTokens(newTokens);

                        const userDetailsResponse = await fetch(`${this.apiBaseUrl}/auth/user`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${newTokens.accessToken}`
                            }
                        });

                        const userData = await userDetailsResponse.json();

                        if (userDetailsResponse.ok) {
                            console.log('User details fetched successfully after token refresh:', userData);

                            this.currentUser = {
                                id: userData.user.id,
                                username: userData.user.username || '',
                                email: userData.user.email,
                                is_profile_complete: userData.user.isProfileComplete,
                                createdAt: userData.user.createdAt || new Date().toISOString(),
                                profile: userData.user.profile
                            };

                            await this.saveUserData(this.currentUser);
                        } else {
                            console.warn('Failed to fetch user details after token refresh:', userData.message || 'Unknown error');
                            this.currentUser = null;
                        }
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                        await this.clearTokens();
                        this.currentUser = null;
                    }
                } else {
                    console.warn('No refresh token available');
                    await this.clearTokens();
                    this.currentUser = null;
                }
            }
        } else {
            console.warn('No access token found');
            this.currentUser = null;
        }
    }
}

const backgroundService = new BackgroundService();

