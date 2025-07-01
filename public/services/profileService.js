/**
 * @file Manages user profile data.
 * @description This service handles creating, updating, and retrieving user profiles,
 * coordinating with the ApiService for backend communication.
 */

export class ProfileService {
    /**
     * @param {ApiService} apiService - The service for API communication.
     * @param {TokenService} tokenService - The service for token management.
     */
    constructor(apiService, tokenService) {
        /** @private */
        this.apiService = apiService;
        /** @private */
        this.tokenService = tokenService;
    }

    /**
     * Creates a new profile for the currently logged-in user.
     * @param {object} profileData - The data for the new profile.
     * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
     */
    async createProfile(profileData) {
        if (profileData.dateOfBirth) {
            profileData.dateOfBirth = new Date(profileData.dateOfBirth).toISOString();
        }

        const { accessToken } = await this.tokenService.getStoredTokens();
        if (!accessToken) {
            throw new Error('Authentication token not found.');
        }

        const newProfile = await this.apiService.request('/profile', {
            method: 'POST',
            body: JSON.stringify(profileData),
        }, accessToken);

        return { success: true, profile: newProfile };
    }

    /**
     * Updates an existing profile.
     * @param {string} userId - The ID of the user whose profile is being updated.
     * @param {object} profileData - The updated profile data.
     * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
     */
    async updateProfile(userId, profileData) {
        const { accessToken } = await this.tokenService.getStoredTokens();
        if (!accessToken) {
            throw new Error('Authentication token not found.');
        }
        
        // The original implementation used a different endpoint structure.
        // Let's assume the correct endpoint is /profile/{userId} for a PUT request.
        // If the API expects /users/{userId}/profile, change the endpoint below.
        const updatedProfile = await this.apiService.request(`/profile/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(profileData),
        }, accessToken);

        return { success: true, profile: updatedProfile };
    }

    /**
     * Retrieves a user's profile.
     * @param {string} userId - The ID of the user whose profile is being fetched.
     * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
     */
    async getProfile(userId) {
        const { accessToken } = await this.tokenService.getStoredTokens();
        if (!accessToken) {
            throw new Error('Authentication token not found.');
        }

        const profile = await this.apiService.request(`/profile/${userId}`, {
            method: 'GET'
        }, accessToken);
        
        return { success: true, profile };
    }
}
