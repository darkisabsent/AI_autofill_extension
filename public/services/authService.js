/**
 * @file Handles user authentication logic.
 * @description This service manages login, registration, logout, and fetching
 * the current user's state, coordinating with ApiService and TokenService.
 */

export class AuthService {
    /**
     * @param {ApiService} apiService - The service for API communication.
     * @param {TokenService} tokenService - The service for token management.
     */
    constructor(apiService, tokenService) {
        /** @private */
        this.apiService = apiService;
        /** @private */
        this.tokenService = tokenService;
        /** @type {object|null} */
        this.currentUser = null;
    }

    /**
     * Initializes the service by loading the current user state from storage.
     * @returns {Promise<void>}
     */
    async init() {
        const { user } = await this.getCurrentUserFromTokens();
        this.currentUser = user;
        if (this.currentUser) {
            console.log('AuthService initialized with user:', this.currentUser.username);
        } else {
            console.log('AuthService initialized with no user.');
        }
    }

    /**
     * Logs a user in with credentials.
     * @param {object} credentials - The user's login credentials.
     * @returns {Promise<{success: boolean, user?: object, error?: string}>}
     */
    async login(credentials) {
        const loginData = await this.apiService.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });

        if (loginData.accessToken && loginData.refreshToken) {
            await this.tokenService.storeTokens({
                accessToken: loginData.accessToken,
                refreshToken: loginData.refreshToken,
                userId: loginData.userId,
            });
        }

        const userData = await this.apiService.request('/auth/user', {}, loginData.accessToken);
        this.currentUser = this.formatUser(userData.user, loginData.accessToken);
        await this.saveUserData(this.currentUser);

        return {
            success: true,
            user: this.currentUser,
            is_profile_complete: this.currentUser.is_profile_complete,
        };
    }

    /**
     * Registers a new user.
     * @param {object} userData - The data for the new user.
     * @returns {Promise<any>} The result from the API.
     */
    async register(userData) {
        const data = await this.apiService.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        return {
            success: true,
            message: data.message,
            redirect_to_login: data.redirect_to_login,
        };
    }

    /**
     * Logs the current user out.
     * @returns {Promise<{success: boolean}>}
     */
    async logout() {
        console.log('Logging out user...');
        const { accessToken } = await this.tokenService.getStoredTokens();
        if (accessToken) {
            try {
                await this.apiService.request('/auth/logout', { method: 'POST' }, accessToken);
                console.log('Successfully logged out on server');
            } catch (e) {
                console.warn('Server logout failed, continuing with local logout:', e.message);
            }
        }
        this.currentUser = null;
        await this.tokenService.clearTokens();
        console.log('Logout complete - all local data cleared');
        return { success: true };
    }

    /**
     * Retrieves the current user by validating stored tokens.
     * Refreshes token if it's expired.
     * @param {number} refreshAttempts - Internal counter to prevent infinite loops.
     * @returns {Promise<{user: object|null}>}
     */
    async getCurrentUserFromTokens(refreshAttempts = 0) {
        if (refreshAttempts > 1) {
            console.warn('Maximum token refresh attempts exceeded. Logging out.');
            await this.logout();
            return { user: null };
        }

        const { accessToken, refreshToken, userId } = await this.tokenService.getStoredTokens();
        if (!accessToken) return { user: null };

        try {
            await this.tokenService.validateToken(accessToken);
            const userData = await this.apiService.request('/auth/user', {}, accessToken);
            this.currentUser = this.formatUser(userData.user, accessToken);
            await this.saveUserData(this.currentUser);
            return { user: this.currentUser };
        } catch (error) {
            console.warn('Access token invalid, attempting refresh...');
            if (refreshToken) {
                try {
                    const newTokens = await this.tokenService.refreshAccessToken(refreshToken);
                    if (!newTokens.accessToken) throw new Error('Refresh returned no access token.');
                    
                    await this.tokenService.storeTokens({
                        accessToken: newTokens.accessToken,
                        refreshToken,
                        userId,
                    });
                    return this.getCurrentUserFromTokens(refreshAttempts + 1);
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError.message);
                    await this.logout();
                    return { user: null };
                }
            }
            console.warn('No refresh token available. Logging out.');
            await this.logout();
            return { user: null };
        }
    }

    /**
     * Marks the user's profile as complete.
     * @returns {Promise<void>}
     */
    async markProfileAsComplete() {
        const { accessToken } = await this.tokenService.getStoredTokens();
        await this.apiService.request('/auth/profile-completion', { method: 'PUT' }, accessToken);
        if (this.currentUser) {
            this.currentUser.is_profile_complete = true;
            await this.saveUserData(this.currentUser);
        }
    }

    /**
     * Saves user data to local storage.
     * @private
     * @param {object} user - The user object to save.
     * @returns {Promise<void>}
     */
    async saveUserData(user) {
        await chrome.storage.local.set({ currentUser: user });
    }

    /**
     * Formats the raw user data from the API into a consistent object.
     * @private
     * @param {object} user - Raw user data.
     * @param {string} accessToken - The user's access token.
     * @returns {object} The formatted user object.
     */
    formatUser(user, accessToken) {
        return {
            id: user.id,
            username: user.username || '',
            email: user.email,
            is_profile_complete: user.isProfileComplete,
            createdAt: user.createdAt || new Date().toISOString(),
            profile: user.profile,
            accessToken: accessToken,
        };
    }
}
