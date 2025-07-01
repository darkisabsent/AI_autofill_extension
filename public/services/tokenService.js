/**
 * @file Manages authentication tokens using chrome.storage.local.
 * @description Provides an interface for storing, retrieving, clearing,
 * and refreshing access and refresh tokens securely.
 */

export class TokenService {
    /**
     * @param {ApiService} apiService - An instance of the ApiService for making refresh requests.
     */
    constructor(apiService) {
        /** @private */
        this.apiService = apiService;
    }

    /**
     * Retrieves stored tokens and userId from chrome.storage.
     * @returns {Promise<{accessToken: string|null, refreshToken: string|null, userId: string|null}>}
     */
    async getStoredTokens() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['accessToken', 'refreshToken', 'userId'], (result) => {
                resolve(result);
            });
        });
    }

    /**
     * Stores tokens and userId in chrome.storage.
     * @param {{accessToken: string, refreshToken: string, userId: string}} tokens
     * @returns {Promise<void>}
     */
    async storeTokens({ accessToken, refreshToken, userId }) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ accessToken, refreshToken, userId }, resolve);
        });
    }

    /**
     * Removes all tokens and userId from chrome.storage.
     * @returns {Promise<void>}
     */
    async clearTokens() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['accessToken', 'refreshToken', 'userId', 'currentUser'], resolve);
        });
    }

    /**
     * Validates an access token by making a request to the API.
     * @param {string} token - The access token to validate.
     * @returns {Promise<any>} The validation response from the API.
     * @throws {Error} If the token is invalid.
     */
    async validateToken(token) {
        return this.apiService.request('/auth/validate', {}, token);
    }

    /**
     * Refreshes an access token using a refresh token.
     * @param {string} refreshToken - The refresh token.
     * @returns {Promise<{accessToken: string}>} The new access token.
     * @throws {Error} If the refresh fails.
     */
    async refreshAccessToken(refreshToken) {
        return this.apiService.request('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        });
    }
}
