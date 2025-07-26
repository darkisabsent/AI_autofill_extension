export function prepareAIPayload(userProfile, aiRelevantFields) {
    const aiFieldsData = aiRelevantFields.map(field => ({
        field_name: field.field_name,
        label: field.field_info.label || field.field_info.placeholder || field.field_name,
        type: field.field_info.type,
        placeholder: field.field_info.placeholder,
        required: field.field_info.required || false,
        element_info: {
            name: field.field_info.name,
            id: field.field_info.id,
            className: field.field_info.className
        },
        category: 'open_ended_question'
    }));

    return {
        profile: {
            firstName: userProfile.profile.firstName,
            lastName: userProfile.profile.lastName,
            gender: userProfile.profile.gender,
            academicDegree: userProfile.profile.academicDegree,
            academicFieldOfStudy: userProfile.profile.academicFieldOfStudy,
            academicInstitution: userProfile.profile.academicInstitution,
            academicGraduationYear: userProfile.profile.academicGraduationYear,
            professionalJobTitle: userProfile.profile.professionalJobTitle,
            professionalCompanyName: userProfile.profile.professionalCompanyName,
            professionalSkills: userProfile.profile.professionalSkills,
            professionalYearsOfExperience: userProfile.profile.professionalYearsOfExperience,
            hobbies: userProfile.profile.hobbies,
            city: userProfile.profile.city,
            country: userProfile.profile.country,
            dateOfBirth: userProfile.profile.dateOfBirth,
            startupProjectName: userProfile.profile.startupProjectName,
            startupMission: userProfile.profile.startupMission,
            startupProblemStatement: userProfile.profile.startupProblemStatement,
            startupSolution: userProfile.profile.startupSolution,
            startupImpact: userProfile.profile.startupImpact
        },
        ai_fields: aiFieldsData,
        metadata: {
            total_ai_fields: aiRelevantFields.length,
            timestamp: new Date().toISOString(),
            form_context: {
                url: 'browser_extension',
                domain: 'extension'
            },
            field_types: ['open_ended_question'],
            user_id: userProfile.id
        }
    };
}

export function separateMatchedFields(allSuggestions, originalFields, isOpenEndedQuestion) {
    const matchedFields = [];
    const unmatchedFieldNames = [];

    allSuggestions.forEach(suggestion => {
        if (suggestion.suggested_value !== null && suggestion.suggested_value !== undefined && suggestion.suggested_value.toString().trim() !== '') {
            matchedFields.push(suggestion);
        } else {
            unmatchedFieldNames.push(suggestion.field_name);
        }
    });

    const processedFieldNames = allSuggestions.map(s => s.field_name);
    const unprocessedFields = originalFields.filter(field => !processedFieldNames.includes(field.name));

    const unmatchedFields = [
        ...allSuggestions.filter(s => s.suggested_value === null || s.suggested_value === undefined || s.suggested_value.toString().trim() === ''),
        ...unprocessedFields.map(field => ({
            field_name: field.name || field.field_name || field.id || `field_unprocessed_${Math.random()}`,
            suggested_value: null,
            field_info: field,
            matched_profile_field: null
        }))
    ];

    const { aiRelevantFields, missingProfileFields } = categorizeUnmatchedFields(unmatchedFields, isOpenEndedQuestion);

    return {
        matchedFields,
        unmatchedFields,
        aiRelevantFields,
        missingProfileFields
    };
}

export function categorizeUnmatchedFields(unmatchedFields, isOpenEndedQuestion) {
    const aiRelevantFields = [];
    const missingProfileFields = [];

    unmatchedFields.forEach(field => {
        if (isOpenEndedQuestion(field.field_info)) {
            aiRelevantFields.push(field);
        } else {
            missingProfileFields.push(field);
        }
    });

    return { aiRelevantFields, missingProfileFields };
}

export function isOpenEndedQuestion(field) {
    if (!field) return false;

    const identifiers = [
        field.label?.toLowerCase().trim(),
        field.placeholder?.toLowerCase().trim(),
        field.name?.toLowerCase().trim()
    ].filter(Boolean);

    if (field.type === 'textarea' && (field.label?.length > 50 || field.placeholder?.length > 50)) {
        return true;
    }

    for (const identifier of identifiers) {
        if (
            identifier.includes("pourquoi") ||
            identifier.includes("motivation") ||
            identifier.includes("objectifs") ||
            identifier.includes("présentez-vous") ||
            identifier.includes("parlez de vous") ||
            identifier.includes("décrivez-vous") ||
            identifier.includes("présentation") ||
            identifier.includes("candidature") ||
            identifier.includes("intérêt") ||
            identifier.includes("ambitions") ||
            identifier.includes("expliquez") ||
            identifier.includes("commentaire") ||
            identifier.includes("message") ||
            identifier.includes("lettre") ||
            identifier.includes("cover letter") ||
            identifier.includes("personal statement") ||
            identifier.includes("why") ||
            identifier.includes("describe") ||
            identifier.includes("tell us about") ||
            identifier.includes("goals") ||
            identifier.includes("objectives") ||
            identifier.includes("introduce yourself") ||
            identifier.includes("about yourself") ||
            identifier.includes("application") ||
            identifier.includes("interest") ||
            identifier.includes("explain") ||
            identifier.includes("comment") ||
            identifier.includes("essay")
        ) {
            return true;
        }
        if (identifier.endsWith("?")) {
            return true;
        }
        // REMOVED: The simple 'textarea' check was too broad.
        if (
            identifier.includes("bio") ||
            identifier.includes("description") ||
            identifier.includes("summary") ||
            (identifier.includes("experience") && identifier.length > 30) || // Only count 'experience' for longer questions
            identifier.includes("background")
        ) {
            return true;
        }
    }
    return false;
}

export function generateFieldSuggestions(fields, userProfile, fieldMappings) {
    const suggestions = [];
    const profile = userProfile.profile;
    const valueGetters = {
        email: () => userProfile.email,
        firstName: () => profile.firstName,
        lastName: () => profile.lastName,
        fullName: () => (profile.firstName && profile.lastName) ? `${profile.firstName} ${profile.lastName}` : '',
        phone: () => (profile.phoneCountryCode && profile.phoneNumber) ? `${profile.phoneCountryCode}${profile.phoneNumber}` : '',
        address: () => profile.address,
        city: () => profile.city,
        country: () => profile.country,
        postalCode: () => profile.postalCode,
        fullAddress: () => {
            const parts = [
                profile.address,
                profile.postalCode,
                profile.city,
                profile.country
            ].filter(Boolean); // Filter out empty or null parts
            return parts.join(', ');
        },
        dateOfBirth: () => {
            if (!profile.dateOfBirth) return '';
            
            const date = new Date(profile.dateOfBirth);
            if (isNaN(date.getTime())) return '';
            
            // Return ISO format (YYYY-MM-DD) which works with most date inputs
            return date.toISOString().split('T')[0];
        },
        gender: () => profile.gender,
        hobbies: () => profile.hobbies,
        professionalCompanyName: () => profile.professionalCompanyName,
        professionalJobTitle: () => profile.professionalJobTitle,
        professionalSkills: () => profile.professionalSkills,
        professionalYearsOfExperience: () => profile.professionalYearsOfExperience?.toString(),
        academicDegree: () => profile.academicDegree,
        academicInstitution: () => profile.academicInstitution,
        academicFieldOfStudy: () => profile.academicFieldOfStudy,
        academicGraduationYear: () => profile.academicGraduationYear?.toString(),
        linkedinUrl: () => profile.linkedinUrl,
        githubUrl: () => profile.githubUrl,
        portfolioUrl: () => profile.portfolioUrl,
        username: () => userProfile.username
    };

    // Separate AI fields first to prevent incorrect matching
    const aiFields = fields.filter(field => isOpenEndedQuestion(field));
    const standardFields = fields.filter(field => !isOpenEndedQuestion(field));

    console.log(`🤖 Identified ${aiFields.length} AI-relevant fields.`);
    console.log(`👤 Identified ${standardFields.length} standard fields.`);

    // Process standard fields
    standardFields.forEach(field => {
        const fieldIdentifiers = [
            field.label?.toLowerCase().trim(),
            field.name?.toLowerCase().trim(),
            field.placeholder?.toLowerCase().trim()
        ].filter(Boolean);

        let bestMatch = { score: 0, value: null, profileField: null };

        for (const [profileField, keywords] of Object.entries(fieldMappings)) {
            const value = valueGetters[profileField] ? valueGetters[profileField]() : null;
            if (!value || value.toString().trim() === '') {
                continue;
            }

            for (const identifier of fieldIdentifiers) {
                for (const keyword of keywords) {
                    const keywordLower = keyword.toLowerCase();
                    let currentScore = 0;

                    // Prioritize exact matches
                    if (identifier === keywordLower) {
                        currentScore = 100;
                    } 
                    // Then check for whole word matches
                    else {
                        const identifierWords = new Set(identifier.split(/[\s,()]+/));
                        if (identifierWords.has(keywordLower)) {
                            currentScore = 80;
                        }
                    }

                    if (currentScore > bestMatch.score) {
                        bestMatch = {
                            score: currentScore,
                            value: value,
                            profileField: profileField
                        };
                    }
                }
            }
        }

        if (bestMatch.score > 50) { // Only accept matches with a reasonable score
            console.log(`✅ Field matched (score: ${bestMatch.score}):`, {
                fieldName: field.name || field.label,
                matchedField: bestMatch.profileField,
                value: bestMatch.value
            });
            suggestions.push({
                field_name: field.name || field.id || `field_${suggestions.length}`,
                suggested_value: bestMatch.value,
                field_info: field,
                matched_profile_field: bestMatch.profileField,
                source: 'profile'
            });
        } else {
            // Add as unmatched if no good match was found
            suggestions.push({
                field_name: field.name || field.id || `field_${suggestions.length}`,
                suggested_value: null,
                field_info: field,
                matched_profile_field: null,
                source: 'unmatched'
            });
        }
    });

    // Add AI fields to the suggestions list, marked for AI processing
    aiFields.forEach(field => {
        suggestions.push({
            field_name: field.name || field.id || `field_${suggestions.length}`,
            suggested_value: null, // This will be handled by AI
            field_info: field,
            matched_profile_field: 'ai_generated',
            source: 'ai'
        });
    });

    return suggestions;
}
