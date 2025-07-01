/**
 * @file Manages all API communications for the extension.
 * @description This service centralizes fetch requests to the backend,
 * handling request setup, response parsing, and error management.
 */

export class ApiService {
    /**
     * @param {string} apiBaseUrl - The base URL for the API.
     */
    constructor(apiBaseUrl) {
        /** @private */
        this.apiBaseUrl = apiBaseUrl;
    }

    /**
     * Performs a fetch request to the API.
     * @param {string} endpoint - The API endpoint to call (e.g., '/auth/login').
     * @param {RequestInit} options - The options for the fetch request (method, headers, body, etc.).
     * @param {string} [token] - Optional JWT token for authenticated requests.
     * @returns {Promise<any>} The JSON response from the API.
     * @throws {Error} If the network response is not ok.
     */
    async request(endpoint, options = {}, token = null) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                ...options,
                headers,
            });

            const responseData = await response.json();

            if (!response.ok) {
                const errorMessage = responseData.message || responseData.error || `API request failed with status ${response.status}`;
                console.warn(`API Error on ${endpoint}:`, errorMessage);
                throw new Error(errorMessage);
            }

            return responseData;
        } catch (error) {
            console.error(`Error during API request to ${endpoint}:`, error);
            // Re-throw to be handled by the calling service
            throw new Error(error.message || 'Erreur de connexion au serveur');
        }
    }
}
