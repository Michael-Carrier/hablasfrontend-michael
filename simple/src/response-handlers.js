// Response handling functions

function handleResponse(response) {
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