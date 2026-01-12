// Translation and language functions

function applyInterfaceStrings(strings) {
    if (!strings || typeof strings !== 'object') {
        console.error('Invalid interface strings provided');
        return;
    }
    
    console.log("Applying interface strings:", strings);
    interfaceStrings = { ...interfaceStrings, ...strings };
    updateStatusMessages(strings);
    
    // Comprehensive UI element mapping for dynamic language updates
    const elementsToUpdate = [
        // Authentication buttons
        { id: 'login-button-main', key: 'login' },
        { id: 'signup-button-main', key: 'signup' },
        { id: 'login-button', key: 'login' },
        { id: 'signup-button', key: 'signup' },
        { id: 'logout-button', key: 'logout' },
        
        // Settings drawer elements
        { id: 'available-pagele', key: 'availableDailyPages' },
        { id: 'tutorial', key: 'tutorial' },
        { id: 'found-bug', key: 'foundABug' },
        
        // Modal and UI text
        { id: 'pagele-title', key: 'selectPagele' },
        { id: 'chapters-title', key: 'chapters' },
        { id: 'translation-btn', key: 'translate' },
        { id: 'record-pagele', key: 'record' },
        { id: 'prev-sentence', key: 'prevSentence' },
        { id: 'next-sentence', key: 'nextSentence' },
        
        // Status and loading messages
        { id: 'loading-text', key: 'loading' },
        { id: 'processing-text', key: 'processing' },
        { id: 'translating-text', key: 'translating' },
        
        // Account and subscription
        { id: 'user-account-options', key: 'userAccountOptions' },
        { id: 'change-info', key: 'changeInfo' },
        { id: 'delete-account', key: 'deleteAccount' },
        
        // GDPR and terms
        { id: 'gdpr-terms', key: 'gdprTerms' },
        { id: 'remember-me-label', key: 'rememberMe' },
        { id: 'accept-terms-label', key: 'acceptTerms' }
    ];
    
    // Update all mapped elements
    elementsToUpdate.forEach(({ id, key }) => {
        const element = document.getElementById(id);
        if (element && strings[key]) {
            element.textContent = strings[key];
        }
    });
    
    // Update placeholder texts for input fields
    const placeholderUpdates = [
        { id: 'user-name-main', key: 'email' },
        { id: 'user-password-main', key: 'password' },
        { id: 'user-name', key: 'email' },
        { id: 'user-password', key: 'password' }
    ];
    
    placeholderUpdates.forEach(({ id, key }) => {
        const element = document.getElementById(id);
        if (element && strings[key]) {
            element.placeholder = strings[key];
        }
    });
    
    // Update section headers and labels
    const sectionHeaders = document.querySelectorAll('h3, .section-header');
    sectionHeaders.forEach(header => {
        const text = header.textContent.trim();
        if (text === 'Native Language' && strings.nativeLanguage) {
            header.textContent = strings.nativeLanguage;
        } else if (text === 'Parameters' && strings.settings) {
            header.textContent = strings.settings;
        }
    });
    
    // Update button titles and tooltips
    const buttonUpdates = [
        { selector: '[title="Settings"]', key: 'settings' },
        { selector: '[title="Tutorial"]', key: 'tutorial' },
        { selector: '[title="Support Hablas"]', key: 'supportHablas' }
    ];
    
    buttonUpdates.forEach(({ selector, key }) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (strings[key]) {
                element.title = strings[key];
            }
        });
    });
    
    console.log("Interface strings applied successfully");
}

function updateStatusMessages(strings) {
    if (strings.processingRecording) {
        dailyTranslationSentence = strings.processingRecording;
    }
}

function getInterfaceString(key) {
    return interfaceStrings[key] || key;
}

function setLanguage(language) {
    if (lang_conversion.hasOwnProperty(language)) {
        return lang_conversion[language];
    }
    return language;
}

function updateTranslation(text) {
    translationText = text;
    
    // Update translation display elements
    const translationElements = document.querySelectorAll('.translation-text');
    translationElements.forEach(element => {
        element.textContent = text;
    });
}

function handleTranslationResponse(response) {
    const translatedText = response.translated_text || response.translation;
    console.log("Current mode:", currentMode);
    console.log("Received translation:", translatedText);
    console.log("Translation down state:", translate_down);
    
    if (!translatedText) {
        console.error('No translation in response:', response);
        alert(getInterfaceString('translationError'));
        return;
    }
    
    // Increment usage for translations (only if not from cache)
    if (!lastTranslationRequestDetails?.fromCache) {
        incrementUsage('translation');
    }
    
    // Cache the translation response
    if (lastTranslationRequestDetails) {
        const cacheKey = `${lastTranslationRequestDetails.text}_${lastTranslationRequestDetails.sourceLang}_${lastTranslationRequestDetails.targetLang}`;
        translationCache[cacheKey] = translatedText;
        console.log('Translation response cached');
        lastTranslationRequestDetails = null;
    }
    
    if (currentMode === 'pagele') {
        // For pagele mode, only show translation if user is still holding the button
        if (translate_down) {
            console.log("Updating pagele sentence with translation (button still held)");
            const sentenceContainer = document.getElementById('sentence-container');
            if (sentenceContainer) {
                sentenceContainer.innerHTML = translatedText;
                translated_text = translatedText;
                console.log("Updated sentence element with translation");
            }
        } else {
            console.log("Translation received but button was released, not showing translation");
        }
    } else {
        // For free reading mode, update the translation element in the translation modal
        console.log("Updating free reading translation");
        const translation = document.getElementById('translation');
        const modalDiv = document.getElementById('myModal');
        
        if (translation) {
            translation.innerHTML = translatedText;
            console.log("Updated translation with:", translatedText);
            
            // Force the modal to be visible if it's not
            if (modalDiv && modalDiv.style.display !== 'block') {
                console.log("Modal was not visible, making it visible");
                showModalWithHistory('myModal');
            }
            
            // Make sure translation element is visible
            translation.style.display = 'block';
            translation.style.visibility = 'visible';
        }
        
        // Update legacy translation displays for backward compatibility
        updateTranslation(translatedText);
        const translationDisplay = document.getElementById('translation-display');
        if (translationDisplay) {
            translationDisplay.textContent = translatedText;
            translationDisplay.style.display = 'block';
        }
    }
    
    logEvent('Translation completed', {
        source_text_length: response.original_text?.length || 0,
        translated_text_length: translatedText.length,
        language_pair: `${response.source_language || 'unknown'}->${response.target_language || 'unknown'}`,
        mode: currentMode
    });
}

function handleTranslatedWords(response) {
    if (response.translated_text) {
        translated_text = response.translated_text;
        console.log("Translated text:", translated_text);
        
        // Update sentence display with translation
        updateSentenceDisplay();
    }
}

function handleTTSResponse(response) {
    console.log('TTS response received:', response);
    
    const audioData = response.audio_data || response.audio;
    
    if (audioData) {
        console.log('Processing TTS audio data...');
        
        // Increment usage for TTS (only if not from cache)
        if (!lastTtsRequestDetails?.fromCache) {
            incrementUsage('tts');
        }
        
        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        
        // Cache the TTS response
        if (lastTtsRequestDetails) {
            const cacheKey = `${lastTtsRequestDetails.text}_${lastTtsRequestDetails.language}`;
            ttsCache[cacheKey] = audioData;
            console.log('TTS response cached');
        }
        
        // Handle the audio based on format - match old behavior
        let audio;
        if (audioData.startsWith('http') || audioData.startsWith('data:audio/')) {
            // Direct URL or complete data URL - old format
            audio = new Audio(audioData);
        } else {
            // Base64 data - convert to blob URL
            try {
                const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(blob);
                audio = new Audio(audioUrl);
            } catch (error) {
                console.error('Error creating audio from base64:', error);
                alert('Text-to-speech failed');
                return;
            }
        }
        
        currentAudio = audio;
        
        // Update robot button visual state - handle both robot buttons
        const robotBtnPagele = document.getElementById('robot-pagele');
        const robotBtn = document.getElementById('robot');
        
        if (robotBtnPagele) {
            robotBtnPagele.setAttribute('data-speaking', 'true');
            robotBtnPagele.style.filter = 'brightness(0.7)';
        }
        if (robotBtn) {
            robotBtn.setAttribute('data-speaking', 'true');
            robotBtn.style.filter = 'brightness(0.7)';
        }
        
        audio.onended = () => {
            console.log('TTS playback ended');
            if (robotBtnPagele) {
                robotBtnPagele.setAttribute('data-speaking', 'false');
                robotBtnPagele.style.filter = 'brightness(1)';
            }
            if (robotBtn) {
                robotBtn.setAttribute('data-speaking', 'false');
                robotBtn.style.filter = 'brightness(1)';
            }
            
            // Only clean up if this audio is still the current one
            if (currentAudio === audio) {
                currentAudio = null;
            }
            
            // Clean up blob URL if we created one
            if (audioData && !audioData.startsWith('http') && !audioData.startsWith('data:audio/')) {
                URL.revokeObjectURL(audio.src);
            }
        };
        
        audio.onerror = (error) => {
            console.error('TTS playback error:', error);
            if (robotBtnPagele) {
                robotBtnPagele.setAttribute('data-speaking', 'false');
                robotBtnPagele.style.filter = 'brightness(1)';
            }
            if (robotBtn) {
                robotBtn.setAttribute('data-speaking', 'false');
                robotBtn.style.filter = 'brightness(1)';
            }
            
            // Only clean up if this audio is still the current one
            if (currentAudio === audio) {
                currentAudio = null;
            }
            
            // Clean up blob URL if we created one
            if (audioData && !audioData.startsWith('http') && !audioData.startsWith('data:audio/')) {
                URL.revokeObjectURL(audio.src);
            }
        };
        
        // Add a small delay before playing to ensure the audio element is properly set up
        setTimeout(() => {
            if (currentAudio === audio) {
                audio.play().catch(error => {
                    console.error('Error playing TTS audio:', error);
                    if (robotBtnPagele) {
                        robotBtnPagele.setAttribute('data-speaking', 'false');
                        robotBtnPagele.style.filter = 'brightness(1)';
                    }
                    if (robotBtn) {
                        robotBtn.setAttribute('data-speaking', 'false');
                        robotBtn.style.filter = 'brightness(1)';
                    }
                    
                    // Clean up on error
                    if (currentAudio === audio) {
                        currentAudio = null;
                    }
                    if (audioData && !audioData.startsWith('http') && !audioData.startsWith('data:audio/')) {
                        URL.revokeObjectURL(audio.src);
                    }
                });
            }
        }, 10);
        
        logEvent('TTS completed', {
            text_length: lastTtsRequestDetails?.text?.length || 0,
            language: lastTtsRequestDetails?.language || 'unknown',
            audio_size_bytes: audioData.length
        });
        
        lastTtsRequestDetails = null;
    } else {
        console.error('No audio data in TTS response:', response);
        alert('Text-to-speech failed');
    }
}

function textToSpeech(textToSpeak) {
    if (!textToSpeak || textToSpeak.trim() === '') {
        console.log('No text provided for TTS');
        return;
    }
    
    // Check if TTS is already playing - prevent multiple simultaneous requests
    if (currentAudio && !currentAudio.paused) {
        console.log('TTS already playing, ignoring new request');
        return;
    }
    
    // Check usage limits for free users
    if (!canUseTTS()) {
        showTTSLimitPrompt();
        return;
    }
    
    // Determine TTS language - use 2-letter language code like the old version
    let ttsLang = 'en'; // default
    
    // If we're in pagele context, use pagele language
    if (typeof pagele_language !== 'undefined' && pagele_language) {
        ttsLang = pagele_language;
    } else if (languageSel) {
        ttsLang = languageSel;
    }
    
    // Ensure we have a 2-letter language code
    if (ttsLang.length > 2) {
        ttsLang = ttsLang.substring(0, 2);
    }
    
    console.log('TTS request:', {
        text: textToSpeak,
        language: ttsLang,
        pagele_language: typeof pagele_language !== 'undefined' ? pagele_language : 'not set'
    });
    
    // Check cache first
    const cacheKey = `${textToSpeak}_${ttsLang}`;
    if (ttsCache[cacheKey]) {
        console.log('Playing TTS from cache');
        let cachedAudio = ttsCache[cacheKey];
        
        // Mark as cached so usage isn't incremented
        lastTtsRequestDetails = { fromCache: true };
        
        // Handle cached audio the same way as new responses
        if (cachedAudio.startsWith('http') || cachedAudio.startsWith('data:audio/')) {
            const audio = new Audio(cachedAudio);
            currentAudio = audio;
            
            // Set robot button state
            const robotBtnPagele = document.getElementById('robot-pagele');
            const robotBtn = document.getElementById('robot');
            if (robotBtnPagele) {
                robotBtnPagele.setAttribute('data-speaking', 'true');
                robotBtnPagele.style.filter = 'brightness(0.7)';
            }
            if (robotBtn) {
                robotBtn.setAttribute('data-speaking', 'true');
                robotBtn.style.filter = 'brightness(0.7)';
            }
            
            audio.onended = () => {
                if (robotBtnPagele) {
                    robotBtnPagele.setAttribute('data-speaking', 'false');
                    robotBtnPagele.style.filter = 'brightness(1)';
                }
                if (robotBtn) {
                    robotBtn.setAttribute('data-speaking', 'false');
                    robotBtn.style.filter = 'brightness(1)';
                }
                if (currentAudio === audio) {
                    currentAudio = null;
                }
            };
            
            audio.onerror = (error) => {
                console.error('Cached TTS playback error:', error);
                if (robotBtnPagele) {
                    robotBtnPagele.setAttribute('data-speaking', 'false');
                    robotBtnPagele.style.filter = 'brightness(1)';
                }
                if (robotBtn) {
                    robotBtn.setAttribute('data-speaking', 'false');
                    robotBtn.style.filter = 'brightness(1)';
                }
                if (currentAudio === audio) {
                    currentAudio = null;
                }
            };
            
            setTimeout(() => {
                if (currentAudio === audio) {
                    audio.play().catch(error => {
                        console.error('Error playing cached TTS audio:', error);
                        if (robotBtnPagele) {
                            robotBtnPagele.setAttribute('data-speaking', 'false');
                            robotBtnPagele.style.filter = 'brightness(1)';
                        }
                        if (robotBtn) {
                            robotBtn.setAttribute('data-speaking', 'false');
                            robotBtn.style.filter = 'brightness(1)';
                        }
                        if (currentAudio === audio) {
                            currentAudio = null;
                        }
                    });
                }
            }, 10);
        } else {
            // Base64 data
            try {
                const binaryString = atob(cachedAudio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                currentAudio = audio;
                
                // Set robot button state
                const robotBtnPagele = document.getElementById('robot-pagele');
                const robotBtn = document.getElementById('robot');
                if (robotBtnPagele) {
                    robotBtnPagele.setAttribute('data-speaking', 'true');
                    robotBtnPagele.style.filter = 'brightness(0.7)';
                }
                if (robotBtn) {
                    robotBtn.setAttribute('data-speaking', 'true');
                    robotBtn.style.filter = 'brightness(0.7)';
                }
                
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    if (robotBtnPagele) {
                        robotBtnPagele.setAttribute('data-speaking', 'false');
                        robotBtnPagele.style.filter = 'brightness(1)';
                    }
                    if (robotBtn) {
                        robotBtn.setAttribute('data-speaking', 'false');
                        robotBtn.style.filter = 'brightness(1)';
                    }
                    if (currentAudio === audio) {
                        currentAudio = null;
                    }
                };
                
                audio.onerror = (error) => {
                    console.error('Cached blob TTS playback error:', error);
                    URL.revokeObjectURL(audioUrl);
                    if (robotBtnPagele) {
                        robotBtnPagele.setAttribute('data-speaking', 'false');
                        robotBtnPagele.style.filter = 'brightness(1)';
                    }
                    if (robotBtn) {
                        robotBtn.setAttribute('data-speaking', 'false');
                        robotBtn.style.filter = 'brightness(1)';
                    }
                    if (currentAudio === audio) {
                        currentAudio = null;
                    }
                };
                
                setTimeout(() => {
                    if (currentAudio === audio) {
                        audio.play().catch(error => {
                            console.error('Error playing cached blob TTS audio:', error);
                            URL.revokeObjectURL(audioUrl);
                            if (robotBtnPagele) {
                                robotBtnPagele.setAttribute('data-speaking', 'false');
                                robotBtnPagele.style.filter = 'brightness(1)';
                            }
                            if (robotBtn) {
                                robotBtn.setAttribute('data-speaking', 'false');
                                robotBtn.style.filter = 'brightness(1)';
                            }
                            if (currentAudio === audio) {
                                currentAudio = null;
                            }
                        });
                    }
                }, 10);
            } catch (error) {
                console.error('Error playing cached audio:', error);
            }
        }
        return;
    }
    
    console.log('Sending TTS request with language:', ttsLang);
    
    // Store request details for caching
    lastTtsRequestDetails = {
        text: textToSpeak,
        language: ttsLang
    };
    
    sendSocketMessage({
        task: 'tts',
        text: textToSpeak,
        language: ttsLang,
        username: userInfo.username,
        token: localStorage.getItem('token')
    });
}

function getTranslation(text) {
    if (!text || text.trim() === '') {
        console.log('No text provided for translation');
        return;
    }
    
    console.log("Getting translation for:", text);
    console.log("username: ", userInfo.username);
    
    // Get target language from user preferences
    const targetLang = userInfo.preferredLanguage || 'en';
    
    // Determine source language based on current context
    let sourceLang = 'en'; // default
    if (typeof pagele_language !== 'undefined' && pagele_language) {
        sourceLang = pagele_language;
    }
    
    // Check cache first
    const cacheKey = `${text}_${sourceLang}_${targetLang}`;
    if (translationCache[cacheKey]) {
        console.log('Using cached translation');
        
        // Simulate the response format for cached translation
        const cachedResponse = {
            translated_text: translationCache[cacheKey],
            source_language: sourceLang,
            target_language: targetLang,
            original_text: text
        };
        
        // Mark as cached so usage isn't incremented
        lastTranslationRequestDetails = { fromCache: true };
        
        // Handle the cached response immediately
        handleTranslationResponse(cachedResponse);
        return;
    }
    
    console.log('Sending translation request (not cached)');
    
    // Store request details for caching
    lastTranslationRequestDetails = {
        text: text,
        sourceLang: sourceLang,
        targetLang: targetLang
    };
    
    const translationData = { 
        task: 'translate', 
        text: text, 
        source_lang: sourceLang,
        target_lang: targetLang,
        username: userInfo.username,
        token: localStorage.getItem('token')
    };
    
    // Add pagele-specific data if in pagele mode
    if (currentMode === 'pagele') {
        translationData.current_book = pageleFilename;
        translationData.chapter = currentChapterKey;
        translationData.currentSentenceIndex = currentSentenceIndex;
    }
    
    console.log('Sending translation request:', translationData);
    sendSocketMessage(translationData);
}

// Translation event handlers
function handleTranslationStart(e) {
    if (!isLoggedIn) {
        alert('Please log in to use translation');
        return;
    }
    
    // Check usage limits for free users
    if (!canUseTranslation()) {
        showTranslationLimitPrompt();
        return;
    }
    
    translate_down = true;
    const translationBtn = document.getElementById('translation-btn');
    
    if (translationBtn) {
        translationBtn.textContent = 'Translating...';
    }
    
    // Get current sentence text for translation and store original
    const currentSentence = getCurrentSentenceText();
    if (currentSentence) {
        originalSentenceText = currentSentence; // Store original sentence
        
        // Show "Translating..." in pagele mode
        if (currentMode === 'pagele') {
            const sentenceContainer = document.getElementById('sentence-container');
            if (sentenceContainer) {
                sentenceContainer.textContent = 'Translating...';
            }
        }
        
        getTranslation(currentSentence);
    }
}

function handleTranslationEnd() {
    translate_down = false;
    const translationBtn = document.getElementById('translation-btn');
    const translationToggle = document.getElementById('translation-toggle');
    
    if (translationToggle) {
        translationToggle.checked = false;
    }
    
    if (translationBtn) {
        translationBtn.textContent = 'Translate';
    }
    
    // Restore original sentence in pagele mode
    if (currentMode === 'pagele' && originalSentenceText) {
        const sentenceContainer = document.getElementById('sentence-container');
        if (sentenceContainer) {
            sentenceContainer.textContent = originalSentenceText;
            console.log("Restored original sentence:", originalSentenceText);
        }
        originalSentenceText = ""; // Clear the stored text
    }
}

function getCurrentSentenceText() {
    // Get the current sentence text from the sentence container
    const sentenceContainer = document.getElementById('sentence-container');
    if (sentenceContainer) {
        return sentenceContainer.textContent || sentenceContainer.innerText;
    }
    return '';
}

// Initialize interface language on page load
function initializeLanguage() {
    // Set default interface language
    currentInterfaceLanguage = userInfo.preferredLanguage || 'en';
    
    // Apply default interface strings
    applyInterfaceStrings(interfaceStrings);
    
    // Load user's preferred language if it's not English
    if (currentInterfaceLanguage !== 'en') {
        console.log("Initializing with preferred language:", currentInterfaceLanguage);
        
        // Try to load from server first if user is logged in
        if (localStorage.getItem('token')) {
            sendSocketMessage({
                task: 'update_interface_language',
                language: currentInterfaceLanguage,
                token: localStorage.getItem('token')
            });
        } else {
            // Load from local file as fallback
            if (typeof loadLanguageFromLocalFile === 'function') {
                loadLanguageFromLocalFile(currentInterfaceLanguage);
            }
        }
    } else {
        console.log("Default language (English) selected, no server request needed");
    }
}

// Auto-load user language when authentication is successful
function loadUserLanguageAfterAuth() {
    if (userInfo.preferredLanguage && userInfo.preferredLanguage !== 'en') {
        console.log("Loading user's preferred language after authentication:", userInfo.preferredLanguage);
        
        // Update current language
        currentInterfaceLanguage = userInfo.preferredLanguage;
        
        // Update language select dropdown
        const languageSelect = document.getElementById('languageUserOptions');
        if (languageSelect) {
            languageSelect.value = userInfo.preferredLanguage;
        }
        
        // Request language data from server
        sendSocketMessage({
            task: 'update_interface_language',
            language: userInfo.preferredLanguage,
            token: localStorage.getItem('token')
        });
    }
}