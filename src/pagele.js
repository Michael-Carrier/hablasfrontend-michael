// Daily pages (Pagele) functionality

function requestPageleList() {
    console.log("Requesting pagele list...");
    sendSocketMessage({
        task: "get_pagele_list",
        token: localStorage.getItem('token')
    });
}

function displayPageleList(pageleBooks) {
    console.log("Displaying pagele list:", pageleBooks);
    const pageleList = document.getElementById('pagele-list');
    if (!pageleList) {
        console.error("pagele-list element not found");
        return;
    }
    
    pageleList.innerHTML = '';
    
    if (!pageleBooks || pageleBooks.length === 0) {
        pageleList.innerHTML = '<p>No daily pages available</p>';
        showPageleModal();
        return;
    }
    //review section
    pageleBooks = pageleBooks.filter(b => !b.filename.includes('-review.json'));
    // Group books by language
    const booksByLanguage = {};
    pageleBooks.forEach(book => {
        const language = book.language || 'unknown';
        if (!booksByLanguage[language]) {
            booksByLanguage[language] = [];
        }
        booksByLanguage[language].push(book);
    });
    
    // Create language sections
    Object.keys(booksByLanguage).forEach(language => {
        const languageSection = document.createElement('div');
        languageSection.className = 'pagele-language-section';
        
        const languageHeader = document.createElement('div');
        languageHeader.className = 'pagele-language-header';
        languageHeader.innerHTML = `
            <h3>${language.charAt(0).toUpperCase() + language.slice(1)}</h3>
            <span class="pagele-expand-icon">▶</span>
        `;
        
        const booksContainer = document.createElement('div');
        booksContainer.className = 'pagele-books-container collapsed';
        
        booksByLanguage[language].forEach((book, index) => {
            const bookCard = document.createElement('div');
            bookCard.className = 'pagele-card';
            bookCard.onclick = () => selectPagele(book.filename, book.language, index);
            
            bookCard.innerHTML = `
                <img src="${book.cover || 'images/default-cover.png'}" alt="${book.book_name}" class="pagele-cover">
                <div class="pagele-title">${book.book_name || book.filename}</div>
            `;
            booksContainer.appendChild(bookCard);
        });
        
        // Add click handler for language header
        languageHeader.onclick = () => {
            const isExpanded = booksContainer.classList.contains('expanded');
            const icon = languageHeader.querySelector('.pagele-expand-icon');
            
            if (isExpanded) {
                booksContainer.classList.remove('expanded');
                booksContainer.classList.add('collapsed');
                icon.textContent = '▶';
            } else {
                booksContainer.classList.remove('collapsed');
                booksContainer.classList.add('expanded');
                icon.textContent = '▼';
            }
        };
        
        languageSection.appendChild(languageHeader);
        languageSection.appendChild(booksContainer);
        pageleList.appendChild(languageSection);
    });
    
    showPageleModal();
}

function showPageleModal() {
    console.log("Showing pagele modal");
    const pageleModal = document.getElementById('pagele-modal');
    if (pageleModal) {
        pageleModal.style.display = 'flex';
        addToModalHistory('pagele-modal');
        console.log("Pagele modal display set to flex");
    } else {
        console.error("pagele-modal element not found");
    }
}

function hidePageleModal() {
    const pageleModal = document.getElementById('pagele-modal');
    if (pageleModal) {
        pageleModal.style.display = 'none';
    }
    
    // Check if user is logged in to determine what to show next
    if (!isLoggedIn) {
        // If not logged in, show login screen
        showLoginScreen();
        return;
    }
    
    // Show previous modal from history if available
    const previousModal = getLastModalFromHistory();
    if (previousModal) {
        showModalWithHistory(previousModal);
    }
}

function selectPagele(filename, lang, index) {
    // Check if user can access this book
    if (!canAccessBook(filename)) {
        showBookLimitPrompt();
        return;
    }
    
    // Track book access for free users
    trackBookAccess(filename);
    
    pageleFilename = filename;
    pagele_language = lang;
    
    console.log("Selected pagele:", filename, "Language:", lang);
    
    hidePageleModal();
    
    // Set language and request pagele initialization
    languageSel = setLanguage(lang);
    console.log("languageSel: ", languageSel);
    
    sendSocketMessage({
        task: "init_pagele",
        pagele_filename: filename,
        language: languageSel,
        token: localStorage.getItem('token')
    });
}

function displayChaptersGrid(response) {
    console.log("Displaying chapters grid:", response);

    if (!response.pagele_data) {
        console.error("No pagele_data in response");
        chaptersGrid.innerHTML = '<p>No chapters available</p>';
        showChaptersModal();
        return;
    }

    pagele_data = response.pagele_data;

    console.log("[REVIEW] displayChaptersGrid called");
    console.log("[REVIEW] window.isReviewMode:", window.isReviewMode);
    console.log("[REVIEW] pageleFilename:", pageleFilename);
    console.log("[REVIEW] response:", response);

    if (window.isReviewMode) {
        console.log("[REVIEW] Skipping chapter grid, going straight to sentences");
        window.isReviewMode = false;
        const chapterKey = Object.keys(pagele_data)[0];
        const chapterData = pagele_data[chapterKey];
        openSentenceModal(chapterKey, 0, chapterData, 0);
        return;
    }    
    
    const chaptersGrid = document.getElementById('chapters-grid');
    if (!chaptersGrid) {
        console.error("chapters-grid element not found");
        return;
    }
    
    chaptersGrid.innerHTML = '';
    

    if (pageleFilename && pageleFilename.includes('-review.json')) {
        const chapterKey = Object.keys(pagele_data)[0];
        const chapterData = pagele_data[chapterKey];
        openSentenceModal(chapterKey, 0, chapterData, 0);
        return;
    }
    

    // Get user progress data if available
    const userPagele = response.user_pagele;
    const currentPageleFilename = response.user_pagele?.current_pagele || pageleFilename;
    
    const chapterKeys = Object.keys(pagele_data);
    console.log("Found chapter keys:", chapterKeys);
    
    if (chapterKeys.length === 0) {
        console.error("No chapters found in pagele_data");
        chaptersGrid.innerHTML = '<p>No chapters available</p>';
        showChaptersModal();
        return;
    }
    
    // Sort chapter keys numerically
    chapterKeys.sort((a, b) => {
        const numA = parseInt(a.replace('chapter', ''));
        const numB = parseInt(b.replace('chapter', ''));
        return numA - numB;
    });
    
    chapterKeys.forEach((chapterKey, index) => {
        const chapterData = pagele_data[chapterKey];
        const chapterNumber = chapterKey.replace('chapter', '');
        const chapterCard = document.createElement('div');
        chapterCard.className = 'chapter-card';
        
        // Check if chapter is completed
        const isCompleted = completedIndices[index] === true;
        if (isCompleted) {
            chapterCard.classList.add('completed');
        }
        
        // Get total points for this chapter from user_pagele data
        let totalPoints = 0;
        if (userPagele && userPagele.books && userPagele.books[currentPageleFilename] && 
            userPagele.books[currentPageleFilename].completed_indices && 
            userPagele.books[currentPageleFilename].completed_indices[chapterKey]) {
            const chapterProgress = userPagele.books[currentPageleFilename].completed_indices[chapterKey];
            totalPoints = Object.values(chapterProgress).reduce((sum, points) => sum + points, 0);
        }
        
        chapterCard.innerHTML = `
            <div class="chapter-title">Chapter ${chapterNumber}</div>
            <div class="chapter-points">Points: ${totalPoints}</div>
            ${isCompleted ? '<span class="completed-badge">✓</span>' : ''}
        `;
        
        chapterCard.onclick = () => openSentenceModal(chapterKey, index, chapterData);
        
        chaptersGrid.appendChild(chapterCard);
    });
    
    // Auto-load last sentence if available and matches current book
    if (lastSentenceToLoad && lastSentenceToLoad.book === currentPageleFilename) {
        console.log("Auto-loading last sentence:", lastSentenceToLoad);
        const targetChapterKey = lastSentenceToLoad.chapter; // Already includes 'chapter' prefix
        const chapterIndex = chapterKeys.indexOf(targetChapterKey);
        if (chapterIndex !== -1) {
            const chapterData = pagele_data[targetChapterKey];
            openSentenceModal(targetChapterKey, chapterIndex, chapterData, lastSentenceToLoad.sentence_index);
            lastSentenceToLoad = null; // Clear after loading
            return; // Don't show chapters modal
        } else {
            console.warn("Target chapter not found for auto-load:", targetChapterKey);
        }
    }
    
    console.log("Chapters grid populated, showing modal");
    showChaptersModal();
}

function showChaptersModal() {
    console.log("Showing chapters modal");
    hidePageleModal();
    const chaptersModal = document.getElementById('chapters-modal');
    if (chaptersModal) {
        chaptersModal.style.display = 'flex';
        addToModalHistory('chapters-modal');
        console.log("Chapters modal display set to flex");
    } else {
        console.error("chapters-modal element not found");
    }
}

function hideChaptersModal() {
    const chaptersModal = document.getElementById('chapters-modal');
    if (chaptersModal) {
        chaptersModal.style.display = 'none';
    }
    
    // Always show pagele modal when chapters modal is closed
    showPageleModal();
}

function openSentenceModal(chapterKey, chapterIndex, chapterData, sentenceIndex = 0) {
    console.log('Opening sentence modal for:', chapterKey, 'with data:', chapterData);
    
    if (!chapterData || !Array.isArray(chapterData)) {
        console.error('Chapter data not available or not an array');
        return;
    }
    
    // Set current mode to pagele
    currentMode = 'pagele';
    
    allSentences = chapterData;
    currentSentenceIndex = sentenceIndex;
    currentChapterKey = chapterKey; // Store the current chapter key
    
    // Update chapter title
    const chapterTitle = document.getElementById('chapter-title');
    if (chapterTitle) {
        const chapterNumber = chapterKey.replace('chapter', '');
        chapterTitle.textContent = `Chapter ${chapterNumber}`;
    }
    
    // Update sentence counter
    const sentenceCounter = document.getElementById('sentence-counter');
    if (sentenceCounter) {
        sentenceCounter.textContent = `1/${allSentences.length}`;
    }
    
    hideChaptersModal();
    updateSentenceDisplay();
    
    const sentenceModal = document.getElementById('sentence-modal');
    if (sentenceModal) {
        sentenceModal.style.display = 'flex';
        addToModalHistory('sentence-modal');
        console.log('Sentence modal opened');
    } else {
        console.error('sentence-modal element not found');
    }
}

function updateSentenceDisplay() {
    if (!allSentences || allSentences.length === 0) {
        console.error('No sentences available');
        return;
    }
    
    console.log('updateSentenceDisplay:', {
        currentSentenceIndex,
        totalSentences: allSentences.length,
        currentSentence: allSentences[currentSentenceIndex],
        sentenceType: typeof allSentences[currentSentenceIndex]
    });
    
    const sentenceContainer = document.getElementById('sentence-container');
    const sentenceCounter = document.getElementById('sentence-counter');
    const prevButton = document.getElementById('prev-sentence');
    const nextButton = document.getElementById('next-sentence');
    
    if (sentenceContainer) {
        const currentSentence = allSentences[currentSentenceIndex];
        if (currentSentence) {
            sentenceContainer.textContent = currentSentence.text || currentSentence;
        }
    }
    
    if (sentenceCounter) {
        sentenceCounter.textContent = `${currentSentenceIndex + 1}/${allSentences.length}`;
    }
    
    // Update navigation buttons
    if (prevButton) {
        prevButton.style.opacity = currentSentenceIndex > 0 ? '1' : '0.5';
    }
    
    if (nextButton) {
        nextButton.style.opacity = currentSentenceIndex < allSentences.length - 1 ? '1' : '0.5';
    }
    
    // Clear previous translation
    if (typeof handleTranslationEnd === 'function' && translate_down) {
        handleTranslationEnd();
    }
    translated_text = "";
    const translationDisplay = document.getElementById('translation-display');
    if (translationDisplay) {
        translationDisplay.style.display = 'none';
    }
    
    // Clear previous prediction results
    const predictionContainer = document.getElementById('prediction-container');
    if (predictionContainer) {
        predictionContainer.innerHTML = '';
    }
}

function showPreviousSentence() {
    if (currentSentenceIndex > 0) {
        currentSentenceIndex--;
        updateSentenceDisplay();
    }
}

function showNextSentence() {
    if (currentSentenceIndex < allSentences.length - 1) {
        currentSentenceIndex++;
        updateSentenceDisplay();
    } else {
        // Reached end of chapter
        const chapterIndex = getCurrentChapterIndex();
        if (chapterIndex !== -1) {
            completedIndices[chapterIndex] = true;
            console.log('Chapter completed:', chapterIndex);
        }
        
        // Close sentence modal and go back to chapters
        const sentenceModal = document.getElementById('sentence-modal');
        if (sentenceModal) {
            sentenceModal.style.display = 'none';
        }
        
        // Reset translation state
        if (typeof handleTranslationEnd === 'function') {
            handleTranslationEnd();
        }
        
        // Clear prediction results
        const predictionContainer = document.getElementById('prediction-container');
        if (predictionContainer) {
            predictionContainer.innerHTML = '';
        }
        
        // Show chapters modal directly since we're completing the chapter
        showModalWithHistory('chapters-modal');
    }
}

function getCurrentChapterIndex() {
    if (!pagele_data || !currentChapterKey) {
        return -1;
    }
    
    // Extract chapter keys from pagele_data and find the index of currentChapterKey
    const chapterKeys = Object.keys(pagele_data).filter(key => key.startsWith('chapter'));
    chapterKeys.sort((a, b) => {
        const numA = parseInt(a.replace('chapter', ''));
        const numB = parseInt(b.replace('chapter', ''));
        return numA - numB;
    });
    
    return chapterKeys.indexOf(currentChapterKey);
}

function closeSentenceModal() {
    if (sentenceModal) {
        sentenceModal.style.display = 'none';
    }
    
    // Reset translation state
    translated_text = "";
    translate_down = false;
    
    const translationBtn = document.getElementById('translation-btn');
    if (translationBtn) {
        translationBtn.textContent = 'Translate';
        translationBtn.style.backgroundColor = '';
    }
    
    // Clear prediction results
    const predictionContainer = document.getElementById('prediction-container');
    if (predictionContainer) {
        predictionContainer.innerHTML = '';
    }
    
    // Show previous modal from history
    const previousModal = getLastModalFromHistory();
    if (previousModal) {
        showModalWithHistory(previousModal);
    }
}

function handlePredSentence(response) {
    console.log('Predicted sentence response:', response);
    
    // Handle the response format from the server
    const predSentence = response.pred_sentence || response.predicted_sentence;
    const points = response.points || 0;
    const totalWords = response.total_words || 0;
    const wrongWords = response.wrong_words || 0;
    
    if (predSentence) {
        // Hide processing status
        const statusIndicator = document.getElementById('recording-status-pagele');
        if (statusIndicator) {
            statusIndicator.style.display = 'none';
        }
        
        // Clear any existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Update the prediction container with the results
        const predictionContainer = document.getElementById('prediction-container');
        if (predictionContainer) {
            predictionContainer.innerHTML = `<div class="predicted-text">${predSentence}</div>`;
            
            // Set up click listeners for wrong words after updating the container
            setupWrongWordListeners();
        }
        
        // Update points display
        if (points > 0) {
            userInfo.points += points;
            updatePointsDisplay(userInfo.points);
            
            // Trigger celebration 25% of the time
            const celebrationTriggered = triggerCelebration();
            if (celebrationTriggered) {
                console.log('🎉 Celebration for prediction success!');
            }
        }
        
        logEvent('Speech prediction completed', {
            predicted_text: predSentence,
            points_earned: points,
            total_words: totalWords,
            wrong_words: wrongWords,
            sentence_index: currentSentenceIndex
        });
    }
}

// Recording functionality for pagele
function startPageleRecording() {
    if (!canUseRecording()) {
        showUpgradePrompt('Recording limit reached. Upgrade for unlimited recording.');
        return;
    }
    
    if (!isLoggedIn) {
        alert('Please log in to use recording');
        return;
    }
    
    if (isRecording) {
        console.log('Already recording');
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            isRecording = true;
            
            // Update recording UI
            const recordButton = document.getElementById('record-pagele');
            
            if (recordButton) {
                recordButton.src = 'images/stopRecButton.png';
            }
            
            // Note: We don't show the processing indicator here, only when waiting for server response
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                createPageleBlobAndConnect();
                incrementUsage('recording');
            };
            
            mediaRecorder.start();
            pageleRecordingStartTime = Date.now();
            
            logEvent('Pagele recording started', {
                sentence_index: currentSentenceIndex,
                chapter: currentChapterKey || 'unknown'
            });
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            alert('Unable to access microphone. Please check permissions.');
        });
}

function stopPageleRecording() {
    if (!isRecording || !mediaRecorder) {
        return;
    }
    
    isRecording = false;
    mediaRecorder.stop();
    
    // Update recording UI
    const recordButton = document.getElementById('record-pagele');
    
    if (recordButton) {
        recordButton.src = 'images/recordingButton.png';
    }
    
    // Note: Processing indicator will be shown in createPageleBlobAndConnect when waiting for server
    
    logEvent('Pagele recording stopped', {
        sentence_index: currentSentenceIndex,
        duration_ms: pageleRecordingStartTime ? Date.now() - pageleRecordingStartTime : 0
    });
}

function createPageleBlobAndConnect() {
    // Show processing indicator when waiting for server response
    const statusIndicator = document.getElementById('recording-status-pagele');
    if (statusIndicator) {
        statusIndicator.style.display = 'flex';
        startTimer();
    }

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioChunks = [];

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = function() {
        const base64data = reader.result;
        
        // Get current sentence text
        const currentSentence = allSentences[currentSentenceIndex];
        const sentenceText = typeof currentSentence === 'string' ? currentSentence : (currentSentence?.text || currentSentence);
        
        // Convert language if needed
        let language = pagele_language;
        if (language.length === 2 && lang_conversion[language]) {
            language = lang_conversion[language];
        }
        
        console.log('Sending pagele recording data (old format):', {
            task: 'stt',
            language: language,
            sentence: sentenceText,
            username: localStorage.getItem('username') || '',
            book: pageleFilename,
            chapter: currentChapterKey,
            currentSentenceIndex: currentSentenceIndex,
            page: 'pagele'
        });
        
        // Use the old working format that matches the original function
        sendSocketMessage({ 
            task: 'stt', 
            blob: base64data, 
            language: language, 
            sentence: sentenceText,
            username: localStorage.getItem('username') || '', 
            book: pageleFilename, 
            chapter: currentChapterKey,
            currentSentenceIndex: currentSentenceIndex,
            page: 'pagele'
        });
    };
}

// TTS functionality for wrong words
function speakText(text, language = 'es') {
    if (!text) return;
    
    console.log('Speaking wrong word via server TTS:', text);
    
    // Use the same server TTS function as the robot button
    textToSpeech(text);
}

function setupWrongWordListeners() {
    // Add event listeners to all wrong words in the prediction container
    const predictionContainer = document.getElementById('prediction-container');
    if (predictionContainer) {
        const wrongWords = predictionContainer.querySelectorAll('.wrong');
        wrongWords.forEach(wrongWord => {
            wrongWord.style.cursor = 'pointer';
            wrongWord.addEventListener('click', function() {
                const wordText = this.getAttribute('id') || this.textContent;
                console.log('Clicked wrong word:', wordText);
                speakText(wordText);
                
                // Visual feedback
                this.style.backgroundColor = '#ff8a8a';
                setTimeout(() => {
                    this.style.backgroundColor = '#ff6b6b';
                }, 200);
            });
        });
    }
}

// Debug function to manually test pagele list display
function debugShowPageleList() {
    console.log('DEBUG: Manually showing pagele list');
    
    // Sample data that matches the server response format
    const sampleBooks = [
        {
            filename: 'test1.json',
            book_name: 'Test Book 1',
            language: 'english',
            cover: 'images/default-cover.png'
        },
        {
            filename: 'test2.json', 
            book_name: 'Test Book 2',
            language: 'spanish',
            cover: 'images/default-cover.png'
        }
    ];
    
    displayPageleList(sampleBooks);
}

// Debug function to manually test chapters display
function debugShowChapters() {
    console.log('DEBUG: Manually showing chapters');
    
    // Sample response that matches server format
    const sampleResponse = {
        status: 'success',
        pagele_data: {
            chapters: [
                { chapter: 'Chapter 1', points: 10 },
                { chapter: 'Chapter 2', points: 15 },
                { chapter: 'Chapter 3', points: 20 }
            ]
        },
        index: 0,
        type: 'get_pagele'
    };
    
    displayChaptersGrid(sampleResponse);
}

// Make debug functions available globally
window.debugShowPageleList = debugShowPageleList;
window.debugShowChapters = debugShowChapters;