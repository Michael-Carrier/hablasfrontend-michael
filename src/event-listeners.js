// Event listeners setup

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Settings drawer toggle
    const settingsIcon = document.getElementById('settings');
    if (settingsIcon) {
        addTouchAwareListener(settingsIcon, openSettings);
    }
    
    // Usage indicator click
    const usageIndicator = document.getElementById('usage-indicator');
    if (usageIndicator) {
        addTouchAwareListener(usageIndicator, openSettings);
    }
    
    // Close drawer
    const closeDrawer = document.getElementById('close-drawer');
    if (closeDrawer) {
        addTouchAwareListener(closeDrawer, closeSettings);
    }
    
    // Login buttons (main screen)
    const loginButtonMain = document.getElementById('login-button-main');
    const signupButtonMain = document.getElementById('signup-button-main');
    
    if (loginButtonMain) {
        addTouchAwareListener(loginButtonMain, handleMainLogin);
    }
    
    if (signupButtonMain) {
        addTouchAwareListener(signupButtonMain, handleMainSignup);
    }
    
    // Login buttons (settings drawer)
    const loginButton = document.getElementById('login-button');
    const signupButton = document.getElementById('signup-button');
    const logoutButton = document.getElementById('logout-button');
    
    if (loginButton) {
        addTouchAwareListener(loginButton, handleDrawerLogin);
    }
    
    if (signupButton) {
        addTouchAwareListener(signupButton, handleDrawerSignup);
    }
    
    if (logoutButton) {
        addTouchAwareListener(logoutButton, handleLogout);
    }
    
    // Delete account button (settings drawer)
    const deleteAccountButton = document.getElementById('delete-account');
    if (deleteAccountButton) {
        addTouchAwareListener(deleteAccountButton, deleteAccount);
    }
    
    // GDPR terms link
    const gdprLink = document.getElementById('gdpr-link');
    if (gdprLink) {
        addTouchAwareListener(gdprLink, (e) => {
            e.preventDefault();
            showModalWithHistory('gdpr-modal');
        });
    }
    
    // Enter key handling for login forms
    const loginInputs = [
        document.getElementById('user-name-main'),
        document.getElementById('user-password-main'),
        document.getElementById('user-name'),
        document.getElementById('user-password')
    ];
    
    loginInputs.forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const isMainForm = input.id.includes('-main');
                    if (isMainForm) {
                        handleMainLogin();
                    } else {
                        handleDrawerLogin();
                    }
                }
            });
        }
    });
    
    // Modal close buttons
    const modalCloses = document.querySelectorAll('.close');
    modalCloses.forEach(closeBtn => {
        addTouchAwareListener(closeBtn, (e) => {
            // Skip if this is the drawer close button (handled separately)
            if (closeBtn.id === 'close-drawer') return;
            
            const modal = closeBtn.closest('.modal') || closeBtn.closest('.drawer');
            if (modal) {
                if (modal.id === 'pagele-modal') {
                    // Special handling for pagele modal - check if user is logged in
                    if (!isLoggedIn) {
                        hidePageleModal(); // This will now show login screen
                    } else {
                        hideModalAndShowPrevious('pagele-modal');
                    }
                } else if (modal.id === 'chapters-modal') {
                    hideModalAndShowPrevious('chapters-modal');
                } else if (modal.id === 'sentence-modal') {
                    hideModalAndShowPrevious('sentence-modal');
                } else if (modal.id === 'subscription-modal') {
                    // Reset subscription setup when modal is closed
                    if (typeof resetSubscriptionSetup === 'function') {
                        resetSubscriptionSetup();
                    }
                    hideModalAndShowPrevious('subscription-modal');
                } else {
                    // For other modals, use the new history system too
                    hideModalAndShowPrevious(modal.id);
                }
            }
        });
    });
    
    // Sentence modal navigation
    const prevSentence = document.getElementById('prev-sentence');
    const nextSentence = document.getElementById('next-sentence');
    
    if (prevSentence) {
        addTouchAwareListener(prevSentence, showPreviousSentence);
    }
    
    if (nextSentence) {
        addTouchAwareListener(nextSentence, showNextSentence);
    }
    
    // Recording button
    const recordButton = document.getElementById('record-pagele');
    if (recordButton) {
        addTouchAwareListener(recordButton, (e) => {
            e.preventDefault();
            if (isRecording) {
                stopPageleRecording();
            } else {
                startPageleRecording();
            }
        });
    }
    
    // Robot TTS button
    const robotButton = document.getElementById('robot-pagele');
    if (robotButton) {
        addTouchAwareListener(robotButton, () => {
            console.log('Robot TTS button clicked');
            const isCurrentlySpeaking = robotButton.getAttribute('data-speaking') === 'true';
            
            if (isCurrentlySpeaking) {
                // Stop current audio
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                    currentAudio = null;
                }
                
                robotButton.setAttribute('data-speaking', 'false');
                robotButton.style.filter = 'brightness(1)';
                console.log('TTS stopped');
            } else {
                // Start TTS
                const currentSentence = getCurrentSentenceText();
                console.log('Current sentence for TTS:', currentSentence);
                if (currentSentence) {
                    robotButton.setAttribute('data-speaking', 'true');
                    robotButton.style.filter = 'brightness(0.7)';
                    textToSpeech(currentSentence);
                } else {
                    console.warn('No current sentence found for TTS');
                }
            }
        });
    }
    
    // Translation button (hold to translate)
    const translationBtn = document.getElementById('translation-btn');
    if (translationBtn) {
        let translateTimer;
        let isHolding = false;
        
        const startTranslation = () => {
            isHolding = true;
            translateTimer = setTimeout(() => {
                if (isHolding) {
                    handleTranslationStart();
                }
            }, 200); // Short delay to distinguish from tap
        };
        
        const endTranslation = () => {
            isHolding = false;
            if (translateTimer) {
                clearTimeout(translateTimer);
                translateTimer = null;
            }
            if (translate_down) {
                handleTranslationEnd();
            }
        };
        
        translationBtn.addEventListener('mousedown', startTranslation);
        translationBtn.addEventListener('mouseup', endTranslation);
        translationBtn.addEventListener('mouseleave', endTranslation);
        translationBtn.addEventListener('touchstart', startTranslation);
        translationBtn.addEventListener('touchend', endTranslation);
    }
    
    // Available pagele button
    const availablePagele = document.getElementById('available-pagele');
    if (availablePagele) {
        addTouchAwareListener(availablePagele, () => {
            closeSettings(); // Close the settings drawer first
            requestPageleList(); // Then request the pagele list
        });
    }
    
    // Language selection dropdown
    const languageSelect = document.getElementById('languageUserOptions');
    if (languageSelect) {
        languageSelect.addEventListener('change', updateLanguageSettings);
    }
    
    // Payment buttons
    const tipButtons = document.querySelectorAll('.tip-button');
    tipButtons.forEach(button => {
        addTouchAwareListener(button, () => {
            const amount = parseFloat(button.dataset.amount);
            if (amount) {
                initiateTip(amount);
            }
        });
    });
    
    // Subscription buttons
    const subscribeButton = document.getElementById('subscribe-button');
    const cancelButton = document.getElementById('cancel-subscription-button');
    
    if (subscribeButton) {
        addTouchAwareListener(subscribeButton, submitSubscription);
    }
    
    if (cancelButton) {
        addTouchAwareListener(cancelButton, cancelSubscription);
    }
    
    // Upgrade modal buttons
    const upgradeSubscribeBtn = document.getElementById('upgrade-subscribe-btn');
    const upgradeCancelBtn = document.getElementById('upgrade-cancel-btn');
    
    if (upgradeSubscribeBtn) {
        addTouchAwareListener(upgradeSubscribeBtn, () => {
            hideModal('upgrade-modal');
            startSubscription();
        });
    }
    
    if (upgradeCancelBtn) {
        addTouchAwareListener(upgradeCancelBtn, () => {
            hideModal('upgrade-modal');
        });
    }
    
    
    // Bug report button
    const bugReportBtn = document.getElementById('found-bug');
    if (bugReportBtn) {
        addTouchAwareListener(bugReportBtn, sendBugReport);
    }
    
    // Settings utility buttons
    const resetSettingsBtn = document.getElementById('reset-settings');
    const exportDataBtn = document.getElementById('export-data');
    const deleteAccountBtn = document.getElementById('delete-account');
    
    if (resetSettingsBtn) {
        addTouchAwareListener(resetSettingsBtn, resetSettings);
    }
    
    if (exportDataBtn) {
        addTouchAwareListener(exportDataBtn, exportUserData);
    }
    
    if (deleteAccountBtn) {
        addTouchAwareListener(deleteAccountBtn, deleteAccount);
    }
    
    // Debug buttons (if present)
    const showDebugBtn = document.getElementById('show-debug');
    const exportLogsBtn = document.getElementById('export-logs');
    const clearLogsBtn = document.getElementById('clear-logs');
    
    if (showDebugBtn) {
        addTouchAwareListener(showDebugBtn, showDebugInfo);
    }
    
    if (exportLogsBtn) {
        addTouchAwareListener(exportLogsBtn, exportLogs);
    }
    
    if (clearLogsBtn) {
        addTouchAwareListener(clearLogsBtn, clearLogs);
    }
    
    // Tutorial button
    const tutorialBtn = document.getElementById('tutorial');
    if (tutorialBtn) {
        addTouchAwareListener(tutorialBtn, () => {
            showModalWithHistory('tutorialModal');
        });
    }
    
    // Window event listeners
    window.addEventListener('resize', () => {
        updateUIForDevice();
        logEvent('Window resized', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    });
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        // Only close modals if clicking directly on modal background and not on settings or other UI elements
        if (e.target.classList.contains('modal') && 
            !e.target.closest('#settings') && 
            !e.target.closest('#settings-drawer') &&
            !e.target.closest('.drawer-backdrop')) {
            
            // Special handling for pagele modal when not logged in
            if (e.target.id === 'pagele-modal' && !isLoggedIn) {
                hidePageleModal(); // This will show login screen
            } else if (e.target.id === 'subscription-modal') {
                // Reset subscription setup when modal is closed
                if (typeof resetSubscriptionSetup === 'function') {
                    resetSubscriptionSetup();
                }
                hideModalAndShowPrevious(e.target.id);
            } else {
                hideModalAndShowPrevious(e.target.id);
            }
        }
    });
    
    // ESC key handling for modal closing
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Check for open modals
            const openModals = document.querySelectorAll('.modal[style*="flex"], .modal[style*="block"]');
            if (openModals.length > 0) {
                const topModal = openModals[openModals.length - 1]; // Get the top modal
                
                // Special handling for pagele modal when not logged in
                if (topModal.id === 'pagele-modal' && !isLoggedIn) {
                    hidePageleModal(); // This will show login screen
                } else if (topModal.id === 'subscription-modal') {
                    // Reset subscription setup when modal is closed
                    if (typeof resetSubscriptionSetup === 'function') {
                        resetSubscriptionSetup();
                    }
                    hideModalAndShowPrevious(topModal.id);
                } else {
                    hideModalAndShowPrevious(topModal.id);
                }
            }
        }
    });

    console.log('Event listeners setup complete');
}

// Login handlers
function handleMainLogin() {
    const username = document.getElementById('user-name-main')?.value.trim().toLowerCase();
    const password = document.getElementById('user-password-main')?.value.trim();
    const rememberGdprAgreement = document.getElementById('remember-gdpr-agreement')?.checked;
    
    console.log('Main login attempt:', { username, hasPassword: !!password, rememberGdprAgreement });
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    if (!isValidEmail(username)) {
        alert('Please enter a valid email address');
        return;
    }
    
    if (!rememberGdprAgreement) {
        alert('Please agree to the GDPR terms and remember me option to continue');
        return;
    }
    
    console.log('Sending login request via WebSocket');
    sendSocketMessage({
        task: "login",
        username: username,
        password: password,
        rememberMe: true
    });
    
    logUserInteraction('login_attempt', null, { username, rememberMe: true });
}

function handleMainSignup() {
    const username = document.getElementById('user-name-main')?.value.trim().toLowerCase();
    const password = document.getElementById('user-password-main')?.value.trim();
    const rememberGdprAgreement = document.getElementById('remember-gdpr-agreement')?.checked;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    if (!isValidEmail(username)) {
        alert('Please enter a valid email address');
        return;
    }
    
    if (!rememberGdprAgreement) {
        alert('Please agree to the GDPR terms and remember me option to continue');
        return;
    }

    sendSocketMessage({
        task: "signup",
        username: username,
        password: password,
        rememberMe: true
    });
    
    logUserInteraction('signup_attempt', null, { username, rememberMe: true });
}

function handleDrawerLogin() {
    const username = document.getElementById('user-name')?.value.trim().toLowerCase();
    const password = document.getElementById('user-password')?.value.trim();
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    if (!isValidEmail(username)) {
        alert('Please enter a valid email address');
        return;
    }
    
    sendSocketMessage({
        task: "login",
        username: username,
        password: password
    });
    
    logUserInteraction('login_attempt', null, { username, source: 'drawer' });
}

function handleDrawerSignup() {
    const username = document.getElementById('user-name')?.value.trim().toLowerCase();
    const password = document.getElementById('user-password')?.value.trim();
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    if (!isValidEmail(username)) {
        alert('Please enter a valid email address');
        return;
    }
    
    sendSocketMessage({
        task: "signup",
        username: username,
        password: password
    });
    
    logUserInteraction('signup_attempt', null, { username, source: 'drawer' });
}

// Initialize event listeners when DOM is ready
function initializeEventListeners() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
}