// Response handling functions
//michael addition begin
let lastMasteredWords = []; // Global variable to store words for the mini-page
let currentRatios = null; // Add this at the top of your script
let A1_DICT_FRONTEND = {};
let A2_DICT_FRONTEND = {};
let responseStats = {}; // Make it global!
let lastCorrectList = [];
window.responseStats = window.responseStats || {};


// 1. Move this to the top of your script so it's globally available
window.openMiniPage = function(level) {
    const overlay = document.getElementById('mini-page-overlay');
    const title = document.getElementById('mini-page-title');
    const content = document.getElementById('mini-page-content');

    if (!overlay || !title || !content) return;

    title.innerText = `${level} Detailed Progress`;
    
    // The Hub Menu
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <p style="color: #7f8c8d; font-size: 0.9em; text-align: center; margin-bottom: 10px;">
                Select a focus area to view your masteries.
            </p>
            
            <div onclick="renderSelectionList('${level}', 'vocabulary')" 
                 style="cursor: pointer; padding: 20px; background: #3498db; color: white; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s;">
                 <div style="font-size: 1.5em; margin-bottom: 5px;">📚</div>
                 <strong style="font-size: 1.1em;">Vocabulary</strong>
                 <div style="font-size: 0.8em; opacity: 0.9;">Words and Definitions</div>
            </div>

            <div onclick="renderSelectionList('${level}', 'structure')" 
                 style="cursor: pointer; padding: 20px; background: #9b59b6; color: white; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s;">
                 <div style="font-size: 1.5em; margin-bottom: 5px;">🏗️</div>
                 <strong style="font-size: 1.1em;">Sentence Structure</strong>
                 <div style="font-size: 0.8em; opacity: 0.9;">Patterns and Grammar</div>
            </div>
            
            <button onclick="closeMiniPage()" style="margin-top: 10px; background: transparent; border: none; color: #95a5a6; cursor: pointer;">
                Back to Dashboard
            </button>
        </div>
    `;

    overlay.style.display = 'block';
};

function highlightVocabWord(sentence, targetWord) {
    const fakeHighlights = {
        special: [targetWord]  // 'special' = blue bold, fits well for a target word
    };
    return window.renderHighlightedSentence(sentence, fakeHighlights);
}


window.renderHighlightedSentence = function(sentence, highlightsJson) {
    if (!highlightsJson) return sentence;
    
    let hl = {};
    try {
        // Handle cases where it's already an object or still a string
        hl = typeof highlightsJson === 'string' ? JSON.parse(highlightsJson) : highlightsJson;
    } catch(e) { return sentence; }

    let words = sentence.split(' ');

    return words.map(word => {
        // Clean word for comparison (remove punctuation)
        let clean = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

        // Apply colors based on your preferences:
        // Numbers = Yellow background
        if (hl.numbers && hl.numbers.some(n => n.toLowerCase() === clean)) {
            return `<span style="background: #f1c40f; border-radius: 3px; padding: 0 2px;">${word}</span>`;
        }
        // Verbs = Orange text
        if (hl.verbs && hl.verbs.some(v => v.toLowerCase() === clean)) {
            return `<span style="color: #e67e22; font-weight: bold;">${word}</span>`;
        }
        // Special/Keywords (can, could, would, etc.) = Blue text
        if (hl.special && hl.special.some(s => s.toLowerCase() === clean)) {
            return `<span style="color: #3498db; font-weight: bold;">${word}</span>`;
        }
        // Nouns = Green text
        if (hl.nouns && hl.nouns.some(n => n.toLowerCase() === clean)) {
            return `<span style="color: #27ae60; font-weight: bold;">${word}</span>`;
        }

        return word;
    }).join(' ');
};

function renderSelectionList(level, type) {
    const content = document.getElementById('mini-page-content');
    const title = document.getElementById('mini-page-title');
    
    // SAFETY CHECK: If the server hasn't sent data yet, stop the crash
    if (!currentRatios) {
        content.innerHTML = `<p style="text-align:center; padding:20px;">Loading your stats... Please wait a moment.</p>`;
        return;
    }

    const key = level.toLowerCase();
    
    // Double check the level exists in the data
    if (!currentRatios[key]) {
        content.innerHTML = `<p>No data found for level ${level}.</p>`;
        return;
    }

    const dataSource = (type === 'vocabulary') 
        ? currentRatios[key].categories 
        : currentRatios[key].structures;

    // ... rest of your code ...

    title.innerText = `${level} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

    if (dataSource) {
        let html = `
            <button onclick="openMiniPage('${level}')" style="margin-bottom: 15px; color: #3498db; background: none; border: none; cursor: pointer; font-weight: bold;">
                ⬅ Back to Options
            </button>
            <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        const sortedEntries = Object.entries(dataSource).sort();

        for (const [name, counts] of sortedEntries) {
            const perc = ((counts.current / counts.total) * 100).toFixed(0);
            
            // Note: If type is 'structure', we call openStructureDetail instead
            const clickAction = (type === 'vocabulary') 
                ? `openCategoryDetail('${level}', '${name}')`
                : `openStructureDetail('${level}', '${name}')`;

            html += `
                <div onclick="${clickAction}" style="cursor: pointer; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.9em;">
                        <span>${name}</span>
                        <span>${counts.current} / ${counts.total}</span>
                    </div>
                    <div style="width: 100%; background: #edf2f7; height: 8px; border-radius: 4px; margin-top: 8px; overflow: hidden;">
                        <div style="width: ${perc}%; background: #2ecc71; height: 100%;"></div>
                    </div>
                </div>`;
        }
        content.innerHTML = html + '</div>';
    } else {
        content.innerHTML = `<p>No ${type} data found.</p><button onclick="openMiniPage('${level}')">Back</button>`;
    }
}

function openReviewModal() {
    // Hide the drawer first
    document.getElementById("settings-drawer").classList.remove("open");
    
    // Show the modal
    const modal = document.getElementById("review-modal");
    modal.style.display = "block";
}

function closeReviewModal() {
    document.getElementById("review-modal").style.display = "none";
}

// Add this to the top of your review functions
async function startA1Review() {
    const lang = window.userInfo?.preferred_language || localStorage.getItem('preferred_language') || 'en';
    pageleFilename = `a1-${lang}-review.json`;
    window.isReviewMode = true;
    console.log("[REVIEW] startA1Review called");
    console.log("[REVIEW] pageleFilename set to:", pageleFilename);
    console.log("[REVIEW] isReviewMode set to:", window.isReviewMode);
    closeReviewModal();
    sendSocketMessage({
        task: "init_pagele",
        token: localStorage.getItem('token'),
        pagele_filename: pageleFilename,
        language: "review"
    });
}

async function startGeneralReview() {
    const lang = window.userInfo?.preferred_language || localStorage.getItem('preferred_language') || 'en';
    pageleFilename = `general-${lang}-review.json`;
    window.isReviewMode = true;  // add this
    closeReviewModal();
    sendSocketMessage({
        task: "init_pagele",
        token: localStorage.getItem('token'),
        pagele_filename: pageleFilename,
        language: "review"
    });
}

// Optional: Close modal if user clicks outside of the box
window.onclick = function(event) {
    const reviewModal = document.getElementById("review-modal");
    const progressModal = document.getElementById("michael-progress-modal"); // or whatever your name is
    
    if (event.target == reviewModal) {
        reviewModal.style.display = "none";
    }
}

window.openStructureDetail = function(level, structureName) {
    const title = document.getElementById('mini-page-title');
    const content = document.getElementById('mini-page-content');
    const key = level.toLowerCase();

    title.innerHTML = `🏗️ Patterns: ${structureName}`;

    const levelData = currentRatios[key];
    const structureData = (levelData && levelData.structures) ? levelData.structures[structureName] : null;
    
    // structureData.sentences is now a list of OBJECTS: {text: "...", highlights: "{...}"}
    const sentences = (structureData && structureData.sentences) ? structureData.sentences : [];

    let html = `
        <button onclick="renderSelectionList('${level}', 'structure')" style="margin-bottom:15px; color:#3498db; background:none; border:none; cursor:pointer;">
            ⬅ Back to Structures
        </button>
        <div style="background:#f8f9fa; padding:15px; border-radius:10px; border-left:4px solid #9b59b6;">
            <p style="font-size:0.85em; color:#7f8c8d; margin-bottom:10px;">Sentences you used correctly:</p>
    `;

    if (sentences.length > 0) {
        sentences.forEach(s => {
            // Check if s is an object (new version) or just a string (old version)
            const text = typeof s === 'object' ? s.text : s;
            const highlights = typeof s === 'object' ? s.highlights : null;

            html += `
                <div style="background:white; padding:12px; border-radius:8px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.05); font-size:1em; line-height:1.4;">
                    ${window.renderHighlightedSentence(text, highlights)}
                </div>`;
        });
    } else {
        html += `<p style="text-align:center; color:#bdc3c7; padding:20px;">No sentences recorded yet!</p>`;
    }

    content.innerHTML = html + `</div>`;
};

window.closeMiniPage = function() {
    document.getElementById('mini-page-overlay').style.display = 'none';
};

function handlePredSentence(response) {
    const predHtml = response.pred_sentence || response.predicted_sentence;

    const wrongWords = extractWrongWords(predHtml);   // MUST return array of {expected, pronounced}
    const correctWords = extractCorrectWords(predHtml); // array of strings

    console.log("✅ Correct:", correctWords);
    console.log("❌ Incorrect:", wrongWords);

    window.pronunciationBank = window.pronunciationBank || [];
    window.pronunciationBank.push({
        timestamp: Date.now(),
        correct: correctWords,
        incorrect: wrongWords
    });
}


function normalizeWord(word) {
    return word.toLowerCase().replace(/[.,!?;:]/g, "").trim();
}

function extractCorrectWords(predSentenceHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = predSentenceHtml;
    temp.querySelectorAll(".wrong").forEach(el => el.remove());
    return temp.textContent
        .trim()
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean);
}


function exportPronunciationCSV() {
    if (!window.pronunciationBank || !window.pronunciationBank.length) {
        console.warn("No data to export");
        return;
    }

    const rows = ["timestamp,type,expected,pronounced"];
    
    window.pronunciationBank.forEach(entry => {
        // Correct words: expected = pronounced
        entry.correct.forEach(w => rows.push(`${entry.timestamp},correct,${w},${w}`));
        // Incorrect words: store both
        entry.incorrect.forEach(obj => rows.push(`${entry.timestamp},incorrect,${obj.expected},${obj.pronounced}`));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "pronunciation_test.csv";
    a.click();

    URL.revokeObjectURL(url);
}


// normalize words: lowercase + remove punctuation
function normalizeWord(word) {
    return word.toLowerCase().replace(/[.,!?;:]/g, "").trim();
}

// extract correct words from pred_sentence HTML
function extractCorrectWords(predSentenceHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = predSentenceHtml;
    temp.querySelectorAll(".wrong").forEach(el => el.remove());
    return temp.textContent
        .trim()
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean);
}

// extract incorrect words from pred_sentence HTML
function extractWrongWords(predSentenceHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = predSentenceHtml;

    return Array.from(temp.querySelectorAll(".wrong")).map(el => ({
        expected: el.getAttribute('id') || '[UNKNOWN]',
        pronounced: el.textContent
    }));
}

// export the banked data to CSV
function exportPronunciationCSV() {
    if (!window.pronunciationBank || !window.pronunciationBank.length) {
        console.warn("No data to export");
        return;
    }

    const rows = ["timestamp,type,expected,pronounced"];

    window.pronunciationBank.forEach(entry => {
        // correct words
        entry.correct.forEach(w => rows.push(`${entry.timestamp},correct,${w},${w}`));
        // incorrect words
        entry.incorrect.forEach(obj => {
            rows.push(`${entry.timestamp},incorrect,${obj.expected},${obj.pronounced}`);
        });
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "pronunciation_test.csv";
    a.click();

    URL.revokeObjectURL(url);
}


//michael addition end

function handleResponse(response) {
    //alert("RAW RESPONSE: " + JSON.stringify(response)); // temporary alert to freeze the screen
    console.log("Handling response:", response);    
    // Handle authentication responses - check for either success format
    if ((response.success && (response.username || response.token)) ||
        (response.status === 'success' && (response.username || response.token)) ||
        (response.type === 'login' && response.status === 'success')) {
        console.log("Login success detected, calling handleAuthSuccess");
        handleAuthSuccess(response);
        
        // Check if this login response also contains pagele data
        if (response.pagele_data) {
            console.log("Login response also contains pagele_data, displaying chapters");
            displayChaptersGrid(response);
        }
        return;
    }
    
    // Handle login/signup success responses
    if (response.status === 'success' && response.message && 
        (response.message.includes('logged in') || response.message.includes('Login successful'))) {
        console.log("Login success message detected");
        handleAuthSuccess(response);
        
        // Check if this login response also contains pagele data
        if (response.pagele_data) {
            console.log("Login success message also contains pagele_data, displaying chapters");
            displayChaptersGrid(response);
        }
        return;
    }
    
    // Add this inside the handleResponse function
    if (response.type === "review_content") {
        const displayArea = document.getElementById("review-display-area");
        if (displayArea) {
            if (response.status === "success") {
                // Success! Display the sentence Michael mastered
                displayArea.innerHTML = `
                    <div class="review-text-container">
                        <p style="font-size: 1.3rem; line-height: 1.5; color: var(--text-primary); margin-bottom: 15px;">
                            ${response.sentence}
                        </p>
                        <div class="review-footer" style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: bold;">
                                Pattern Mastered
                            </span>
                            <button onclick="playReviewTTS('${response.sentence.replace(/'/g, "\\'")}')" 
                                    class="options" 
                                    style="padding: 5px 15px; margin: 0; font-size: 0.9rem;">
                                🔊 Hear Sentence
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Handle the case where no sentences are found
                displayArea.innerHTML = `<p style="color: #e74c3c;">${response.message}</p>`;
            }
        }
        return; 
    }

    if (response.type === "recommend_content") {
        if (response.status === "success") {
            closeRecommendModal();
            
            // Load directly into pagele sentence modal
            allSentences = [{"text": response.sentence, "highlights": response.highlights}];
            currentSentenceIndex = 0;
            pageleFilename = "recommend";
            
            const chapterTitle = document.getElementById('chapter-title');
            if (chapterTitle) chapterTitle.textContent = response.label || "We Recommend";
            
            updateSentenceDisplay();
            
            const sentenceModal = document.getElementById('sentence-modal');
            if (sentenceModal) sentenceModal.style.display = 'flex';
        } else {
            const displayArea = document.getElementById("recommend-display-area");
            if (displayArea) displayArea.innerHTML = `<p style="color: #e74c3c;">${response.message}</p>`;
        }
        return;
    }

    // Handle token verification
    if (response.hasOwnProperty('success') && response.hasOwnProperty('user_data')) {
        handleTokenVerification(response);
        return;
    }
    
    // Handle pagele list response - check if it's an array of books
    if (Array.isArray(response) && response.length > 0 && response[0].filename && response[0].book_name) {
        console.log("Pagele books array detected, displaying list");
        displayPageleList(response);
        return;
    }
    
    // Handle pagele list response
    if (response.pagele_books) {
        displayPageleList(response.pagele_books);
        return;
    }
    
    // Handle pagele initialization response
    if (response.pagele_data) {
        displayChaptersGrid(response);
        return;
    }
    
    // Handle speech-to-text prediction
    if (response.predicted_sentence || response.pred_sentence) {
        handlePredSentence(response);
        return;
    }
    
    // Handle translation response
    if (response.translated_text) {
        handleTranslationResponse(response);
        return;
    }
    
    // Handle TTS response
    if (response.audio_data || response.audio) {
        handleTTSResponse(response);
        return;
    }
    
    // Handle payment responses
    if (response.hasOwnProperty('payment_intent') || 
        response.hasOwnProperty('setup_intent') ||
        response.hasOwnProperty('setup_intent_client_secret') ||
        response.task === 'create_setup_intent' ||
        (response.hasOwnProperty('client_secret') && response.task !== 'create_subscription')) {
        handlePaymentResponse(response);
        return;
    }
    
    // Handle subscription responses
    if (response.hasOwnProperty('subscription') || 
        response.task === 'create_subscription' ||
        response.task === 'cancel_subscription' ||
        response.hasOwnProperty('subscription_id') ||
        response.hasOwnProperty('subscription_status') ||
        (response.status === 'success' && response.hasOwnProperty('client_secret'))) {
        handleSubscriptionResponse(response);
        return;
    }
    
    // Handle subscription status sync
    if (response.status === 'success' && response.hasOwnProperty('old_status') && response.hasOwnProperty('new_status')) {
        userSubscriptionStatus = response.new_status;
        updateSubscriptionUI();
        console.log(`Subscription status synced: ${response.old_status} → ${response.new_status}`);
        return;
    }
    
    // Handle invalid credentials
    if (response.message === "Invalid credentials") {
        alert(getInterfaceString('invalidCredentials'));
        return;
    }
    
    
    // Handle interface strings response
    if (response.hasOwnProperty('interface_language')) {
        console.log("Received interface language:", response.interface_language);
        applyInterfaceStrings(response.interface_language);
        return;
    }
    
    // Handle update_interface_language response with language data
    if (response.task === 'update_interface_language' && response.language_data) {
        console.log("Received language data from update_interface_language:", response.language, response.language_data);
        applyInterfaceStrings(response.language_data);
        currentInterfaceLanguage = response.language;
        return;
    }
    
    // Handle language data response (alternative format) 
    if (response.hasOwnProperty('language_data') && response.hasOwnProperty('language')) {
        console.log("Received language data response:", response.language, response.language_data);
        applyInterfaceStrings(response.language_data);
        currentInterfaceLanguage = response.language;
        return;
    }
    
    // Handle bug report response
    if (response.type === 'bug_report_sent') {
        console.log('Bug report sent successfully');
        alert('Bug report sent successfully. Thank you for your feedback!');
        return;
    }
    
    // Handle preferred language
    if (response && response.preferred_language && typeof response.preferred_language === 'string') {
        userInfo.preferredLanguage = response.preferred_language;
        console.log("Found preferred language in response:", response.preferred_language);
        
        const languageSelect = document.getElementById('languageUserOptions');
        if (languageSelect) {
            languageSelect.value = response.preferred_language;
        }
        return;
    }
    
    // Handle account creation success
    if (response.message === "Account created successfully") {
        alert(getInterfaceString('accountCreated'));
        return;
    }
    
    // Handle account already exists
    if (response.message === "Account already exists") {
        alert(getInterfaceString('accountExists'));
        return;
    }
    
    // Handle logout confirmation
    if (response.message === "Logged out successfully") {
        console.log('Logout confirmed by server');
        return;
    }
    
    // Handle points update
    if (response.hasOwnProperty('points') && typeof response.points === 'number') {
        updatePointsDisplay(response.points);
        return;
    }

    // --- MICHAEL'S PROGRESS REPORT HANDLER ---
    // Look for the task OR the specific stats key
if (response.task === "michael_stats_response") {
        // --- DATA SAVING ---
        currentRatios = response.ratios;
        lastCorrectList = response.correct_list || [];
        window.responseStats = response.stats || {}; 

        window.A1_DICT_FRONTEND = response.a1_full_dict || {};
        window.A2_DICT_FRONTEND = response.a2_full_dict || {};

        // --- THE FIX: DEFINE THE ELEMENTS AT THE START ---
        const accuracyEl = document.getElementById('overall-accuracy');
        const cefrEl = document.getElementById('cefr-level'); 
        const trickyListEl = document.getElementById('tricky-words-list');

        // 1. Update Ratios (Targeting separate boxes so they both show)
        if (response.ratios) {
            const a1 = response.ratios.a1;
            const a1Perc = ((a1.current / a1.total) * 100).toFixed(1);
            if (accuracyEl) {
                accuracyEl.innerHTML = `📘 <strong>A1 Progress:</strong> ${a1.current}/${a1.total} <span style="color:#27ae60">(${a1Perc}%)</span>`;
            }

            const a2 = response.ratios.a2;
            const a2Perc = ((a2.current / a2.total) * 100).toFixed(1);
            if (cefrEl) {
                cefrEl.innerHTML = `📙 <strong>A2 Progress:</strong> ${a2.current}/${a2.total} <span style="color:#27ae60">(${a2Perc}%)</span>`;
            }
        }

        // 2. The Tricky & Mastered Lists
        if (trickyListEl) {
            trickyListEl.innerHTML = ""; 
            const statsEntries = Object.entries(response.stats || {});
            
            // Section: Needs Practice - NOW USES needs_review FLAG
            const needsReview = statsEntries
                .filter(([word, data]) => data.needs_review === true)
                .sort((a, b) => (b[1].last_seen || "").localeCompare(a[1].last_seen || ""))
                .slice(0, 10);

            if (needsReview.length > 0) {
                trickyListEl.innerHTML += "<h4 style='margin:10px 0 5px 0; color:#e74c3c;'>Focus on these:</h4>";
                needsReview.forEach(([word, counts]) => {
                    const li = document.createElement('li');
                    li.style.padding = "3px 0";
                    li.innerHTML = `<strong>${word}</strong>: ${counts.incorrect} ❌ | ${counts.correct} ✅`;
                    trickyListEl.appendChild(li);
                });
            } else if (statsEntries.length > 0) {
                trickyListEl.innerHTML += "<h4 style='margin:10px 0 5px 0; color:#2ecc71;'>No words need review!</h4>";
            }

            // Section: Words Covered (Your naming convention)
            const covered = response.correct_list || [];
            if (covered.length > 0) {
                trickyListEl.innerHTML += "<hr><h4 style='margin:10px 0 5px 0; color:#2ecc71;'>Words Mastered:</h4>";
                const p = document.createElement('p');
                p.style.fontSize = "0.85em";
                p.style.lineHeight = "1.6";
                p.style.color = "#34495e";
                p.innerText = covered.join(" • "); 
                trickyListEl.appendChild(p);
            } else if (statsEntries.length === 0) {
                trickyListEl.innerHTML = "<li>Start speaking to see your progress!</li>";
            }
        }
        return;        
    }
        
function closeMiniPage() {
    document.getElementById('mini-page-overlay').style.display = 'none';
}

function closeMichaelProgress() {
    document.getElementById('progress-modal').style.display = 'none';
    document.getElementById('drawer-backdrop').style.display = 'none'; // Closes backdrop too
}
    
    // Handle error responses
    if (response.error) {
        console.error('Server error:', response.error);
        
    // Don't show alerts for logout-related errors (backend might not support logout task)
    if (response.error === 'Invalid task' && response._originalTask === 'logout') {
        console.log('Logout task not supported by backend - this is OK, logout completed on frontend');
        return;
    }
        
    if (response.error.includes('subscription') || response.error.includes('limit')) {
        showUpgradePrompt(response.error);
    } else {
        alert('Error: ' + response.error);
    }
    return;
}
    
    // Handle subscription status responses
    if (response.subscription_status) {
        userSubscriptionStatus = response.subscription_status;
        updateSubscriptionUI();
        console.log('Subscription status updated:', userSubscriptionStatus);
        return;
    }
    
    // Default case for unhandled responses
    console.log("Unhandled response from server:", response);

}

function openRecommendModal() {
    document.getElementById("settings-drawer").classList.remove("open");
    document.getElementById("recommend-modal").style.display = "block";
}

function closeRecommendModal() {
    document.getElementById("recommend-modal").style.display = "none";
}

function requestNewWord() {
    const user = (window.userInfo && window.userInfo.username) || localStorage.getItem('username');
    document.getElementById("recommend-display-area").innerHTML = `<p style="color: #666;">Finding a new word...</p>`;
    sendSocketMessage({
        task: "get_new_word",
        username: user,
        token: localStorage.getItem('token')
    });
}

function requestWeakStructure() {
    const user = (window.userInfo && window.userInfo.username) || localStorage.getItem('username');
    document.getElementById("recommend-display-area").innerHTML = `<p style="color: #666;">Finding your weakest structure...</p>`;
    sendSocketMessage({
        task: "get_weak_structure",
        username: user,
        token: localStorage.getItem('token')
    });
}

function handleTokenResponse(response) {
    if (response.valid) {
        console.log('Token is valid');
        isLoggedIn = true;
        
        if (response.user_data) {
            userInfo = { ...userInfo, ...response.user_data };
        }
        
        updateAuthUI(true, response);
        showDailyPages();
    } else {
        console.log('Token is invalid');
        handleInvalidToken();
    }
}

// Error handling utilities
function handleConnectionError() {
    console.error('Connection error occurred');
    alert(getInterfaceString('connectionError'));
    
    // Try to reconnect WebSocket
    if (socket && socket.readyState !== WebSocket.OPEN) {
        console.log('Attempting to reconnect WebSocket...');
        socket = createWebSocketConnection();
    }
}

function handleServerError(error) {
    console.error('Server error:', error);
    
    let errorMessage = 'An error occurred. Please try again.';
    
    if (error.includes('authentication') || error.includes('login')) {
        errorMessage = 'Authentication failed. Please log in again.';
        handleInvalidToken();
    } else if (error.includes('network') || error.includes('connection')) {
        errorMessage = 'Network error. Please check your connection.';
        handleConnectionError();
    } else if (error.includes('subscription') || error.includes('limit')) {
        showUpgradePrompt(error);
        return; // Don't show generic error for subscription issues
    }
    
    alert(errorMessage);
}

function handleRateLimitError() {
    console.warn('Rate limit exceeded');
    alert('Too many requests. Please wait a moment before trying again.');
}

function handleValidationError(validationErrors) {
    console.error('Validation errors:', validationErrors);
    
    if (Array.isArray(validationErrors)) {
        const errorMessage = validationErrors.join('\n');
        alert('Please correct the following errors:\n' + errorMessage);
    } else {
        alert('Please check your input and try again.');
    }
}

// Response timing and logging
function logResponseTiming(responseType, processingTime) {
    logEvent('Response processed', {
        response_type: responseType,
        processing_time_ms: processingTime,
        timestamp: Date.now()
    });
}

// Initialize response handlers
function initializeResponseHandlers() {
    console.log('Response handlers initialized');
    
    // Set up global error handlers
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        logEvent('Unhandled promise rejection', { error: event.reason?.message || 'Unknown error' });
    });
    
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        logEvent('Global error', { 
            error: event.error?.message || 'Unknown error',
            filename: event.filename,
            line: event.lineno
        });
    });
}

function displayWordStats(stats) {
    // 1. Sort words to find the ones with the most 'incorrect' counts
    const sortedWords = Object.entries(stats)
        .filter(([word, data]) => data.incorrect > 0)
        .sort((a, b) => b[1].incorrect - a[1].incorrect)
        .slice(0, 5); // Just take the top 5

    if (sortedWords.length === 0) return;

    // 2. Create a small notification or update a <div> on your page
    console.log("📊 Michael's Top 5 Difficult Words:", sortedWords);
    
    // Example: If you have a div with id="stats-container"
    const container = document.getElementById('stats-container');
    if (container) {
        container.innerHTML = '<h3>Needs Practice:</h3>' + 
            sortedWords.map(([word, data]) => `
                <div class="stat-item">
                    <strong>${word}</strong>: missed ${data.incorrect} times
                </div>
            `).join('');
    }
}


function closeMiniPage() {
    document.getElementById('mini-page-overlay').style.display = 'none';
}

function showMistakeSummary(response) {
    // This looks at the response we got back from the STT task
    if (response.wrong_words && response.wrong_words.length > 0) {
        let summaryHtml = "<div class='mistake-report'><h3>Words to Practice:</h3><ul>";
        
        response.wrong_words.forEach(w => {
            summaryHtml += `<li><strong>${w.expected}</strong> (You said: "${w.pronounced}")</li>`;
        });
        
        summaryHtml += "</ul></div>";
        
        // Push this to your UI (replace 'status-box' with your actual div ID)
        const statusBox = document.getElementById('status-box');
        if (statusBox) statusBox.innerHTML += summaryHtml;
    }
}


window.openCategoryDetail = function(level, category) {
    const title = document.getElementById('mini-page-title');
    const content = document.getElementById('mini-page-content');
    
    const masterDict = (level === 'A1') ? window.A1_DICT_FRONTEND : window.A2_DICT_FRONTEND;
    
    console.log(`[DEBUG] Level: ${level}, Category: ${category}`);
    // responseStats is what you saved in the michael_stats_response handler
    console.log("[DEBUG] Stats for this category:", window.responseStats);

    title.innerHTML = `
        <span onclick="openMiniPage('${level}')" style="cursor:pointer; color:#3498db; font-size: 0.85em;">⬅ ${level}</span> 
        <span style="font-size: 0.9em; margin-left:5px;">/ ${category}</span>`;
    
    if (!masterDict || Object.keys(masterDict).length === 0) {
        content.innerHTML = `<p style="text-align:center; padding:20px;">Waiting for word data from server...</p>`;
        return;
    }

    const categoryWords = Object.entries(masterDict)
        .filter(([word, cat]) => cat === category)
        .sort((a, b) => a[0].localeCompare(b[0]));

    if (categoryWords.length === 0) {
        content.innerHTML = `<p style="text-align:center; color:#95a5a6; padding:20px;">No words found for "${category}".</p>`;
        return;
    }

    // We keep the 1fr 1fr grid
    let wordHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 400px; overflow-y: auto; padding: 10px; background: #fdfdfd; border-radius: 8px; border: 1px solid #eee;">`;

categoryWords.forEach(([word, cat], index) => {
        const isMastered = lastCorrectList.includes(word);
        const wordData = window.responseStats[word] || {};
        const sentences = wordData.sentences || [];
        const hasSentences = sentences.length > 0;

        // Use 'display: contents' so the children are direct members of the grid
        wordHtml += `
            <div style="display: contents;">
                <div onclick="${hasSentences ? `toggleSentences('sent-${index}')` : ''}" 
                    style="
                        padding: 10px; 
                        border-radius: 8px; 
                        background: ${isMastered ? '#e8f5e9' : '#ffffff'}; 
                        color: ${isMastered ? '#2e7d32' : '#7f8c8d'};
                        border: 1px solid ${isMastered ? '#c8e6c9' : '#ececec'};
                        font-size: 0.85em;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        /* THIS IS THE FIX: */
                        cursor: ${hasSentences ? 'pointer' : 'default'}; 
                        user-select: none;
                        transition: background 0.2s;
                    "
                    ${hasSentences ? `onmouseover="this.style.background='#f0f0f0'"` : ''}
                    ${hasSentences ? `onmouseout="this.style.background='${isMastered ? '#e8f5e9' : '#ffffff'}'"` : ''}
                >
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${isMastered ? '✅' : '⚪'}</span>
                        <span style="${isMastered ? 'font-weight: 600;' : ''}">${word}</span>
                    </div>
                    ${hasSentences ? `<span style="font-size: 0.7em; color: #3498db; filter: grayscale(${isMastered ? 0 : 1});">💬</span>` : ''}
                </div>
                
                <div id="sent-${index}" style="
                    display: none; 
                    grid-column: span 2; 
                    padding: 12px; 
                    background: #fdfdfd; 
                    border: 1px dashed #dcdcdc; 
                    border-radius: 8px; 
                    font-size: 0.8em; 
                    color: #444; 
                    margin: 2px 5px 10px 5px;
                ">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #7f8c8d; font-size: 0.7em; letter-spacing: 0.5px;">RECORDED EXAMPLES:</div>
                    ${sentences.map(s => `
                        <div style="margin-bottom:8px; line-height:1.4; padding-left: 10px; border-left: 2px solid #3498db;">
                            "${highlightVocabWord(s, word)}"
                        </div>
                    `).join('')}
                </div>
            </div>`;
    });    

    wordHtml += `</div>`;
    
    wordHtml += `
        <button onclick="openMiniPage('${level}')" style="margin-top:15px; width:100%; padding:8px; border:none; background:#f0f2f5; border-radius:6px; cursor:pointer; color:#65676b; font-size:0.9em;">
            Back to Categories
        </button>`;

    content.innerHTML = wordHtml;
};

window.toggleSentences = function(id) {
    console.log("Toggling visibility for:", id);
    const el = document.getElementById(id);
    if (el) {
        if (el.style.display === 'none' || el.style.display === '') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    } else {
        console.error("Could not find element with ID:", id);
    }
};

window.toggleSentences = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
    }
};

function playReviewTTS(text) {
    console.log("Playing TTS for review sentence...");
    if (typeof sendSocketMessage === "function") {
        sendSocketMessage({
            task: "tts",
            text: text,
            language: window.language || 'en'
        });
    } else {
        console.error("sendSocketMessage not found for TTS");
    }
}

window.playReviewTTS = function(text) {
    console.log("TTS Request for:", text);
    if (typeof sendSocketMessage === "function") {
        sendSocketMessage({
            task: "tts",
            text: text,
            language: window.language || 'en'
        });
    }
};



