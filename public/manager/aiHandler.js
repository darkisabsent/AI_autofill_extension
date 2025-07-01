import { prepareAIPayload } from '../utils/formUtils.js';

export async function getAISuggestions(instance, userProfile, aiRelevantFields) {
    try {
        const aiPayload = prepareAIPayload(userProfile, aiRelevantFields);
        const response = await fetch(instance.AI_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(aiPayload),
            signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) {
            throw new Error(`AI server responded with status: ${response.status} ${response.statusText}`);
        }
        const aiResults = await response.json();
        if (!Array.isArray(aiResults)) {
            throw new Error('AI server returned invalid response format (expected array)');
        }
        const aiSuggestions = aiResults.map(result => ({
            field_name: result.field_name,
            suggested_value: result.suggested_value,
            field_info: aiRelevantFields.find(f => f.field_name === result.field_name)?.field_info,
            matched_profile_field: 'ai_generated',
            source: 'ai'
        }));
        return aiSuggestions;
    } catch (error) {
        console.error("AI suggestion error:", error);
        throw error;
    }
}
