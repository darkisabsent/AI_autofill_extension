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
            field_name: field.name,
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
        if (
            field.type === 'textarea' ||
            identifier.includes("bio") ||
            identifier.includes("description") ||
            identifier.includes("summary") ||
            identifier.includes("experience") ||
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
        fullName: () => `${profile.firstName} ${profile.lastName}`,
        phone: () => `${profile.phoneCountryCode}${profile.phoneNumber}`,
        address: () => profile.address,
        city: () => profile.city,
        country: () => profile.country,
        postalCode: () => profile.postalCode,
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

    fields.forEach(field => {
        const fieldIdentifiers = [
            field.label?.toLowerCase().trim(),
            field.name?.toLowerCase().trim(),
            field.placeholder?.toLowerCase().trim()
        ].filter(Boolean);

        let suggestedValue = null;
        let matchedField = null;

        // Debug logging for birth date fields
        if (fieldIdentifiers.some(id => id.includes('birth') || id.includes('naissance') || id.includes('age') || id.includes('âge'))) {
            console.log('🔍 Birth date field detected:', {
                fieldName: field.field_name,
                identifiers: fieldIdentifiers,
                fieldType: field.type,
                userDateOfBirth: profile.dateOfBirth
            });
        }

        for (const [profileField, keywords] of Object.entries(fieldMappings)) {
            if (valueGetters[profileField]) {
                for (const identifier of fieldIdentifiers) {
                    for (const keyword of keywords) {
                        if (identifier === keyword.toLowerCase()) {
                            const value = valueGetters[profileField]();
                            if (value && value.toString().trim() !== '') {
                                suggestedValue = value;
                                matchedField = profileField;
                                
                                // Debug logging for matches
                                if (profileField === 'dateOfBirth') {
                                    console.log('✅ Birth date matched:', {
                                        fieldName: field.field_name,
                                        identifier,
                                        keyword,
                                        value,
                                        originalDate: profile.dateOfBirth
                                    });
                                }
                                break;
                            }
                        }
                    }
                    if (matchedField) break;
                }
            }
        }

        suggestions.push({
            field_name: field.field_name,
            suggested_value: suggestedValue,
            field_info: field,
            matched_profile_field: matchedField
        });
    });

    return suggestions;
}
