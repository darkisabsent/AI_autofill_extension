import { prepareAIPayload } from '../utils/formUtils.js';

export async function getAISuggestions(instance, userProfile, aiRelevantFields) {
    try {
        console.log('🤖 Starting AI request for fields:', aiRelevantFields);
        const aiPayload = prepareAIPayload(userProfile, aiRelevantFields);
        console.log('📤 AI payload prepared:', aiPayload);
        
        const startTime = Date.now();
        
        // Make the AI request (no additional timeout here, handled by caller)
        const response = await fetch(instance.AI_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(aiPayload)
        });
        
        const requestTime = Date.now() - startTime;
        console.log(`📨 AI response received in ${requestTime}ms, status: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`AI server responded with status: ${response.status} ${response.statusText}`);
        }
        
        const aiResults = await response.json();
        console.log('📋 Raw AI results:', aiResults);
        
        // Handle different response formats from the AI server
        let processedResults = [];
        
        if (Array.isArray(aiResults)) {
            processedResults = aiResults;
        } else if (aiResults && typeof aiResults === 'object') {
            if (aiResults.suggestions && Array.isArray(aiResults.suggestions)) {
                processedResults = aiResults.suggestions;
            } else if (aiResults.data && Array.isArray(aiResults.data)) {
                processedResults = aiResults.data;
            } else {
                // Single response - map to first AI field
                processedResults = [{
                    field_name: aiRelevantFields[0]?.field_name || 'unknown',
                    suggested_value: aiResults.response || aiResults.answer || aiResults.value || JSON.stringify(aiResults)
                }];
            }
        }
        
        console.log('🔄 Processed AI results:', processedResults);
        
        const aiSuggestions = processedResults.map((result, index) => {
            let fieldName, suggestedValue;
            
            if (typeof result === 'string') {
                fieldName = aiRelevantFields[index]?.field_name || `field_${index}`;
                suggestedValue = result;
            } else if (result && typeof result === 'object') {
                fieldName = result.field_name || result.fieldName || aiRelevantFields[index]?.field_name || `field_${index}`;
                suggestedValue = result.suggested_value || result.suggestedValue || result.value || result.answer || result.response;
            }
            
            return {
                field_name: fieldName,
                suggested_value: suggestedValue,
                field_info: aiRelevantFields.find(f => f.field_name === fieldName)?.field_info,
                matched_profile_field: 'ai_generated',
                source: 'ai'
            };
        }).filter(suggestion => suggestion.suggested_value && suggestion.suggested_value.trim()); // Only valid suggestions
        
        console.log(`✅ Final AI suggestions (${aiSuggestions.length}):`, aiSuggestions);
        return aiSuggestions;
        
    } catch (error) {
        console.error("❌ AI suggestion error:", error);
        throw error;
    }
}
