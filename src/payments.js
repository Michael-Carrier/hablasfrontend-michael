// Stripe payment and subscription management

// Stripe configuration - LIVE KEYS ONLY
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51R936ZH6FESgUvUmI0Gu1qfxauHRtqnx9Usx1UkQQgzOVGC2e5MIhKopUsPcSw1n3XfUF8qZyuL7ZGb1wYUOR8DG007A0ipkpw';

let stripe = null;
let subscriptionElements = null;

// Load Stripe
function initializeStripe() {
    if (!TESTING_MODE && window.Stripe) {
        stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
        console.log('Stripe initialized with live publishable key');
    } else if (!window.Stripe) {
        console.error('Stripe.js not loaded - make sure the script tag is in your HTML');
    } else {
        console.log('Testing mode: Stripe not initialized');
        const testingIndicator = document.getElementById('testing-mode-indicator');
        if (testingIndicator) {
            testingIndicator.style.display = 'block';
        }
    }
}

function handlePaymentResponse(response) {
    if (TESTING_MODE) {
        console.log('Testing mode: Payment response would be handled');
        alert('Testing mode: Payment functionality disabled');
        return;
    }
    
    console.log('Payment response:', response);
    
    // Handle setup intent for subscriptions
    if (response.setup_intent && response.setup_intent.client_secret) {
        console.log('Setting up subscription payment elements with client secret');
        setupSubscriptionElements(response.setup_intent.client_secret);
        return;
    }
    
    // Handle setup intent client secret directly (new format)
    if (response.setup_intent_client_secret) {
        console.log('Setting up subscription payment elements with setup intent client secret');
        setupSubscriptionElements(response.setup_intent_client_secret);
        return;
    }
    
    // Handle direct client secret for setup intent
    if (response.client_secret && response.task === 'create_setup_intent') {
        console.log('Setting up subscription payment elements with client secret');
        setupSubscriptionElements(response.client_secret);
        return;
    }
    
    // Handle regular payment responses (tips, etc.)
    if (response.success) {
        alert('Payment successful! Thank you for your support.');
        const paymentModal = document.getElementById('payment-modal');
        if (paymentModal) {
            paymentModal.style.display = 'none';
        }
    } else {
        alert('Payment failed: ' + (response.error || 'Unknown error'));
    }
}

function initiateTip(amount) {
    if (TESTING_MODE) {
        console.log(`Testing mode: Would initiate $${amount} tip`);
        alert(`Testing mode: Would process $${amount} tip`);
        return;
    }
    
    if (!isLoggedIn) {
        alert('Please log in to make a tip');
        return;
    }
    
    drawer.style.display = 'none';
    showModalWithHistory('payment-modal');
    sendSocketMessage({
        task: 'tip',
        amount: amount
    });
}

async function handleSubscriptionResponse(response) {
    if (TESTING_MODE) {
        console.log('Testing mode: Subscription response would be handled');
        alert('Testing mode: Subscription functionality disabled');
        return;
    }
    
    console.log('Received subscription response:', response);
    
    if (response.status === 'success') {
        if (response.subscription_id) {
            // Subscription was created successfully
            const subscriptionModal = document.getElementById('subscription-modal');
            if (subscriptionModal) {
                subscriptionModal.style.display = 'none';
            }
            alert('Subscription activated successfully!');
            userSubscriptionStatus = response.subscription_status || 'active';
            updateSubscriptionUI();
        } else if (response.subscription_status) {
            // Handle subscription status update
            userSubscriptionStatus = response.subscription_status;
            updateSubscriptionUI();
            
            if (response.subscription_status === 'canceled') {
                alert('Subscription has been cancelled. You will have access until the end of your billing period.');
            }
        } else if (response.client_secret) {
            // Handle payment intent that needs confirmation (for failed payments, etc.)
            if (!stripe) {
                console.error('Stripe not initialized for payment confirmation');
                alert('Payment system not ready. Please refresh the page and try again.');
                return;
            }
            
            const { error } = await stripe.confirmPayment({
                clientSecret: response.client_secret,
                confirmParams: {
                    return_url: window.location.origin
                },
                redirect: 'if_required'
            });
            
            if (error) {
                console.error('Payment confirmation error:', error);
                alert('Payment failed: ' + error.message);
            } else {
                alert('Payment updated successfully!');
                checkSubscriptionStatus();
            }
        }
    } else {
        const messageDiv = document.getElementById('subscription-message');
        if (messageDiv) {
            messageDiv.textContent = response.message || 'Error processing subscription';
        }
        
        // Re-enable subscribe button if it was disabled
        const subscribeBtn = document.getElementById('subscribe-button');
        if (subscribeBtn) {
            subscribeBtn.disabled = false;
            subscribeBtn.textContent = 'Start Subscription';
        }
        
        // Show error to user
        alert(response.message || 'Error processing subscription');
    }
}

function checkSubscriptionStatus() {
    sendSocketMessage({
        task: 'get_subscription_status',
        token: localStorage.getItem('token')
    });
}

function updateSubscriptionUI() {
    console.log('updateSubscriptionUI called with userSubscriptionStatus:', userSubscriptionStatus);
    console.log('hasSpecialAccess:', hasSpecialAccess);
    console.log('hasActiveSubscription():', hasActiveSubscription());
    
    const subscriptionSection = document.getElementById('subscription-section');
    const statusDisplay = document.getElementById('subscription-status');
    const manageBtn = document.getElementById('subscription-manage-btn');
    
    console.log('DOM elements found:', {
        subscriptionSection: !!subscriptionSection,
        statusDisplay: !!statusDisplay,
        manageBtn: !!manageBtn
    });
    
    if (!subscriptionSection || !statusDisplay || !manageBtn) {
        console.error('Missing subscription UI elements');
        return;
    }
    
    if (TESTING_MODE) {
        subscriptionSection.style.display = 'block';
        statusDisplay.textContent = 'Testing Mode - Subscription UI';
        statusDisplay.style.color = '#ff4444';
        manageBtn.textContent = 'Testing Mode';
        manageBtn.onclick = () => alert('Testing mode: Subscription functionality disabled');
        return;
    }
    
    subscriptionSection.style.display = 'block';
    
    // Handle different subscription statuses
    console.log('Switching on userSubscriptionStatus:', userSubscriptionStatus);
    switch (userSubscriptionStatus) {
        case 'active':
            console.log('Setting active subscription UI');
            statusDisplay.textContent = 'Active Subscription - £5/month';
            statusDisplay.className = 'subscription-status active';
            manageBtn.textContent = 'Cancel Subscription';
            manageBtn.className = 'subscription-button cancel';
            manageBtn.onclick = cancelSubscription;
            break;
            
        case 'past_due':
            statusDisplay.textContent = 'Payment Failed - Please update payment method';
            statusDisplay.className = 'subscription-status pending';
            manageBtn.textContent = 'Update Payment';
            manageBtn.className = 'subscription-button subscribe';
            manageBtn.onclick = startSubscription;
            break;
            
        case 'canceling':
            statusDisplay.textContent = 'Subscription will end at period close';
            statusDisplay.className = 'subscription-status pending';
            manageBtn.textContent = 'Reactivate Subscription';
            manageBtn.className = 'subscription-button subscribe';
            manageBtn.onclick = startSubscription;
            break;
            
        case 'canceled':
        case 'none':
        default:
            statusDisplay.textContent = 'No active subscription';
            statusDisplay.className = 'subscription-status inactive';
            manageBtn.textContent = 'Subscribe for £5/month';
            manageBtn.className = 'subscription-button subscribe';
            manageBtn.onclick = startSubscription;
            break;
    }
    
    // Update usage limits display
    updateUIWithSubscriptionLimits();
}

function startSubscription() {
    if (TESTING_MODE) {
        console.log('Testing mode: Would start subscription');
        alert('Testing mode: Subscription functionality disabled');
        return;
    }
    
    if (!isLoggedIn) {
        alert('Please log in to subscribe');
        return;
    }
    
    if (!stripe) {
        console.error('Stripe not initialized');
        alert('Payment system not ready. Please refresh the page and try again.');
        return;
    }
    
    // Hide drawer first
    const drawer = document.getElementById('settings-drawer');
    if (drawer) {
        drawer.classList.remove('open');
        setTimeout(() => {
            const backdrop = document.getElementById('drawer-backdrop');
            if (backdrop) {
                backdrop.style.display = 'none';
            }
        }, 300);
    }
    
    // Show loading state immediately
    const subscribeBtn = document.getElementById('subscribe-button');
    if (subscribeBtn) {
        subscribeBtn.disabled = true;
        subscribeBtn.textContent = 'Loading payment form...';
    }
    
    // Show modal hidden so DOM element exists for Stripe mounting
    const subscriptionModal = document.getElementById('subscription-modal');
    if (subscriptionModal) {
        subscriptionModal.style.display = 'flex';
        subscriptionModal.style.visibility = 'hidden'; // Hide until ready
    }
    
    // Initialize payment elements first, then show modal when ready
    initializeSubscriptionPayment();
}

function initializeSubscriptionPayment() {
    if (TESTING_MODE) {
        console.log('Testing mode: Would initialize subscription payment');
        return;
    }
    
    // First, request a SetupIntent from the server
    sendSocketMessage({
        task: 'create_setup_intent',
        token: localStorage.getItem('token')
    });
}

function setupSubscriptionElements(clientSecret) {
    if (TESTING_MODE) {
        console.log('Testing mode: Would setup subscription elements');
        return;
    }
    
    if (!stripe) {
        console.error('Stripe not loaded');
        alert('Payment system not ready. Please refresh the page and try again.');
        return;
    }
    
    console.log('Setting up subscription elements with client secret:', clientSecret);
    
    // Create elements with the clientSecret from SetupIntent
    subscriptionElements = stripe.elements({
        clientSecret: clientSecret,
        appearance: {
            theme: 'stripe',
            variables: {
                colorPrimary: '#28a745',
                colorBackground: '#ffffff',
                colorText: '#30313d',
            }
        }
    });

    const paymentElement = subscriptionElements.create('payment');
    
    // Wait for Stripe element to be ready before showing modal
    paymentElement.on('ready', () => {
        console.log('Stripe payment element is ready, showing modal');
        
        // Now make the subscription modal visible
        const subscriptionModal = document.getElementById('subscription-modal');
        if (subscriptionModal) {
            subscriptionModal.style.visibility = 'visible'; // Make visible
            showModalWithHistory('subscription-modal');
        }
        
        // Enable the subscribe button
        const subscribeBtn = document.getElementById('subscribe-button');
        if (subscribeBtn) {
            subscribeBtn.disabled = false;
            subscribeBtn.textContent = 'Start Subscription';
        }
    });
    
    // Handle loading state
    paymentElement.on('loaderror', (event) => {
        console.error('Stripe payment element failed to load:', event.error);
        alert('Payment system failed to load. Please refresh and try again.');
        
        const subscribeBtn = document.getElementById('subscribe-button');
        if (subscribeBtn) {
            subscribeBtn.disabled = false;
            subscribeBtn.textContent = 'Start Subscription';
        }
    });
    
    paymentElement.mount('#subscription-payment-element');

    // Update the subscribe button handler
    const subscribeBtn = document.getElementById('subscribe-button');
    if (subscribeBtn) {
        subscribeBtn.onclick = async (e) => {
            e.preventDefault();
            subscribeBtn.disabled = true;
            subscribeBtn.textContent = 'Processing...';
            
            const { error, setupIntent } = await stripe.confirmSetup({
                elements: subscriptionElements,
                confirmParams: {
                    return_url: window.location.origin
                },
                redirect: 'if_required'
            });

            if (error) {
                console.error('Setup confirmation error:', error);
                const messageDiv = document.getElementById('subscription-message');
                if (messageDiv) {
                    messageDiv.textContent = error.message;
                }
                subscribeBtn.disabled = false;
                subscribeBtn.textContent = 'Start Subscription';
            } else if (setupIntent && setupIntent.payment_method) {
                console.log('Setup confirmed, sending payment method to backend');
                // Send payment method to backend to create subscription
                sendSocketMessage({
                    task: 'create_subscription',
                    payment_method_id: setupIntent.payment_method,
                    token: localStorage.getItem('token')
                });
            }
        };
    }
}


function cancelSubscription() {
    if (TESTING_MODE) {
        console.log('Testing mode: Would cancel subscription');
        alert('Testing mode: Would cancel subscription');
        return;
    }
    
    if (!isLoggedIn) {
        alert('Please log in to manage subscription');
        return;
    }
    
    if (confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.')) {
        sendSocketMessage({
            task: 'cancel_subscription',
            token: localStorage.getItem('token')
        });
    }
}

function hasActiveSubscription() {
    // Only 'active' status counts as having an active subscription
    // 'canceled', 'past_due', 'incomplete', 'incomplete_expired' etc. do not
    return userSubscriptionStatus === 'active' || hasSpecialAccess;
}

function canUseRecording() {
    if (hasActiveSubscription()) {
        return true;
    }
    
    // Free tier limits - 10 recordings per day as shown in subscription modal
    const freeRecordingLimit = 10;
    return subscriptionUsage.recording < freeRecordingLimit;
}

function canUseTranslation() {
    if (hasActiveSubscription()) {
        return true;
    }
    
    // Free tier limits - 20 translations per day
    const freeTranslationLimit = 20;
    return subscriptionUsage.translation < freeTranslationLimit;
}

function canUseTTS() {
    if (hasActiveSubscription()) {
        return true;
    }
    
    // Free tier limits - 15 TTS uses per day
    const freeTTSLimit = 15;
    return subscriptionUsage.tts < freeTTSLimit;
}

function incrementUsage(type) {
    if (!hasActiveSubscription()) {
        subscriptionUsage[type] = (subscriptionUsage[type] || 0) + 1;
        
        // Check for usage warnings
        checkUsageWarnings(type);
        
        // Update the usage display
        updateUsageDisplay();
        
        // Also update UI limits in case we just hit a limit
        updateUIWithSubscriptionLimits();
    }
}

function showUpgradePrompt(message) {
    if (TESTING_MODE) {
        console.log('Testing mode: Would show upgrade prompt:', message);
        alert(`Testing mode: ${message}`);
        return;
    }
    
    const upgradeModal = document.getElementById('upgrade-modal');
    const upgradeMessage = document.getElementById('upgrade-message');
    
    if (upgradeModal && upgradeMessage) {
        upgradeMessage.textContent = message;
        showModalWithHistory('upgrade-modal');
    } else {
        alert(message);
    }
}

function canAccessBook(bookFilename) {
    if (hasActiveSubscription()) {
        return true;
    }
    
    // Free tier book access logic - 1 book per month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthKey = `${currentYear}-${currentMonth}`;
    
    // Initialize monthly book usage if not exists
    if (!subscriptionUsage.monthlyBooks) {
        subscriptionUsage.monthlyBooks = {};
    }
    
    // Reset if it's a new month
    if (!subscriptionUsage.monthlyBooks[monthKey]) {
        subscriptionUsage.monthlyBooks = { [monthKey]: new Set() };
    }
    
    const booksThisMonth = subscriptionUsage.monthlyBooks[monthKey];
    
    // If they've already accessed this book this month, allow it
    if (booksThisMonth.has(bookFilename)) {
        return true;
    }
    
    // If they haven't reached the free book limit (1 per month), allow it
    return booksThisMonth.size < 1;
}

function trackBookAccess(bookFilename) {
    if (!hasActiveSubscription()) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;
        
        // Initialize monthly book usage if not exists
        if (!subscriptionUsage.monthlyBooks) {
            subscriptionUsage.monthlyBooks = {};
        }
        
        // Reset if it's a new month
        if (!subscriptionUsage.monthlyBooks[monthKey]) {
            subscriptionUsage.monthlyBooks = { [monthKey]: new Set() };
        }
        
        // Add this book to the accessed books for this month
        subscriptionUsage.monthlyBooks[monthKey].add(bookFilename);
        
        console.log('Book access tracked for free user:', bookFilename, 'Total books this month:', subscriptionUsage.monthlyBooks[monthKey].size);
        
        // Update the usage display
        updateUsageDisplay();
    }
}

function showBookLimitPrompt() {
    showUpgradePrompt('You have reached the free book limit (1 book per month). Upgrade to access unlimited books.');
}

function showTranslationLimitPrompt() {
    showUpgradePrompt('You have reached the daily translation limit (20/day). Upgrade for unlimited translations.');
}

function showTTSLimitPrompt() {
    showUpgradePrompt('You have reached the daily text-to-speech limit (15/day). Upgrade for unlimited TTS.');
}

function showRecordingLimitPrompt() {
    showUpgradePrompt('You have reached the daily recording limit (10/day). Upgrade for unlimited recording.');
}

function updateUIWithSubscriptionLimits() {
    const recordingButton = document.getElementById('record-pagele');
    const translationButton = document.getElementById('translation-btn');
    const robotButtons = document.querySelectorAll('#robot-pagele, #robot');
    
    // Update recording button
    if (!canUseRecording() && recordingButton) {
        recordingButton.style.opacity = '0.5';
        recordingButton.title = 'Daily recording limit reached (10/day). Upgrade for unlimited recording.';
    } else if (recordingButton) {
        recordingButton.style.opacity = '1';
        recordingButton.title = '';
    }
    
    // Update translation button
    if (!canUseTranslation() && translationButton) {
        translationButton.style.opacity = '0.5';
        translationButton.title = 'Daily translation limit reached (20/day). Upgrade for unlimited translations.';
    } else if (translationButton) {
        translationButton.style.opacity = '1';
        translationButton.title = 'Hold to translate';
    }
    
    // Update TTS robot buttons
    robotButtons.forEach(robotButton => {
        if (!canUseTTS() && robotButton) {
            robotButton.style.opacity = '0.5';
            robotButton.title = 'Daily text-to-speech limit reached (15/day). Upgrade for unlimited TTS.';
        } else if (robotButton) {
            robotButton.style.opacity = '1';
            robotButton.title = 'Click to hear pronunciation';
        }
    });
}

// Daily usage reset functionality
function checkAndResetDailyUsage() {
    const today = new Date().toDateString();
    const lastResetDate = localStorage.getItem('lastUsageResetDate');
    
    // If it's a new day, reset daily counters
    if (lastResetDate !== today) {
        console.log('Resetting daily usage counters for new day:', today);
        
        // Reset daily usage counters
        subscriptionUsage.recording = 0;
        subscriptionUsage.translation = 0;
        subscriptionUsage.tts = 0;
        
        // Store the new reset date
        localStorage.setItem('lastUsageResetDate', today);
        
        // Update UI to reflect reset limits
        updateUIWithSubscriptionLimits();
        
        // Update usage display
        updateUsageDisplay();
        
        console.log('Daily usage counters reset successfully');
    }
}

// Initialize daily reset checking on page load
function initializeDailyResetSystem() {
    // Check for reset on page load
    checkAndResetDailyUsage();
    
    // Initialize usage display
    updateUsageDisplay();
    
    // Set up interval to check for reset every minute
    setInterval(checkAndResetDailyUsage, 60000); // Check every minute
    
    console.log('Daily usage reset system initialized');
}

// Call this when the page loads to initialize the reset system
document.addEventListener('DOMContentLoaded', () => {
    initializeDailyResetSystem();
});

// Usage display functions
function updateUsageDisplay() {
    // Don't show usage for subscribed users
    if (hasActiveSubscription()) {
        hideUsageSection();
        return;
    }
    
    showUsageSection();
    updateRecordingUsageDisplay();
    updateTranslationUsageDisplay();
    updateTTSUsageDisplay();
    updateBookUsageDisplay();
    updateCompactUsageIndicator();
}

function hideUsageSection() {
    const usageSection = document.getElementById('usage-section');
    if (usageSection) {
        usageSection.style.display = 'none';
    }
}

function showUsageSection() {
    const usageSection = document.getElementById('usage-section');
    if (usageSection) {
        usageSection.style.display = 'block';
    }
}

function updateRecordingUsageDisplay() {
    const recordingUsageElement = document.getElementById('recording-usage');
    const recordingUsageItem = recordingUsageElement?.parentElement;
    
    if (recordingUsageElement) {
        const current = subscriptionUsage.recording || 0;
        const limit = 10;
        recordingUsageElement.textContent = `${current}/${limit}`;
        
        // Update styling based on usage
        if (recordingUsageItem) {
            recordingUsageItem.classList.remove('limit-reached', 'limit-warning');
            if (current >= limit) {
                recordingUsageItem.classList.add('limit-reached');
            } else if (current >= limit * 0.8) { // 80% of limit
                recordingUsageItem.classList.add('limit-warning');
            }
        }
    }
}

function updateTranslationUsageDisplay() {
    const translationUsageElement = document.getElementById('translation-usage');
    const translationUsageItem = translationUsageElement?.parentElement;
    
    if (translationUsageElement) {
        const current = subscriptionUsage.translation || 0;
        const limit = 20;
        translationUsageElement.textContent = `${current}/${limit}`;
        
        // Update styling based on usage
        if (translationUsageItem) {
            translationUsageItem.classList.remove('limit-reached', 'limit-warning');
            if (current >= limit) {
                translationUsageItem.classList.add('limit-reached');
            } else if (current >= limit * 0.8) { // 80% of limit
                translationUsageItem.classList.add('limit-warning');
            }
        }
    }
}

function updateTTSUsageDisplay() {
    const ttsUsageElement = document.getElementById('tts-usage');
    const ttsUsageItem = ttsUsageElement?.parentElement;
    
    if (ttsUsageElement) {
        const current = subscriptionUsage.tts || 0;
        const limit = 15;
        ttsUsageElement.textContent = `${current}/${limit}`;
        
        // Update styling based on usage
        if (ttsUsageItem) {
            ttsUsageItem.classList.remove('limit-reached', 'limit-warning');
            if (current >= limit) {
                ttsUsageItem.classList.add('limit-reached');
            } else if (current >= limit * 0.8) { // 80% of limit
                ttsUsageItem.classList.add('limit-warning');
            }
        }
    }
}

function updateBookUsageDisplay() {
    const bookUsageElement = document.getElementById('book-usage');
    const bookUsageItem = bookUsageElement?.parentElement;
    
    if (bookUsageElement) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;
        
        const current = (subscriptionUsage.monthlyBooks && subscriptionUsage.monthlyBooks[monthKey]) 
            ? subscriptionUsage.monthlyBooks[monthKey].size 
            : 0;
        const limit = 1;
        
        bookUsageElement.textContent = `${current}/${limit}`;
        
        // Update styling based on usage
        if (bookUsageItem) {
            bookUsageItem.classList.remove('limit-reached', 'limit-warning');
            if (current >= limit) {
                bookUsageItem.classList.add('limit-reached');
            }
        }
    }
}

// Compact usage indicator in title bar
function updateCompactUsageIndicator() {
    const usageIndicator = document.getElementById('usage-indicator');
    const usageSummary = document.getElementById('usage-summary');
    
    if (!usageIndicator || !usageSummary) return;
    
    // Hide for subscribed users
    if (hasActiveSubscription()) {
        usageIndicator.style.display = 'none';
        return;
    }
    
    // Also hide during testing mode
    if (TESTING_MODE) {
        usageIndicator.style.display = 'none';
        return;
    }
    
    // Show for free users
    usageIndicator.style.display = 'block';
    
    // Find the highest usage percentage to show
    const usages = [
        { type: 'recordings', current: subscriptionUsage.recording || 0, limit: 10 },
        { type: 'translations', current: subscriptionUsage.translation || 0, limit: 20 },
        { type: 'TTS', current: subscriptionUsage.tts || 0, limit: 15 }
    ];
    
    // Find the usage closest to limit
    let highestUsage = usages[0];
    let highestPercentage = 0;
    
    usages.forEach(usage => {
        const percentage = usage.current / usage.limit;
        if (percentage > highestPercentage) {
            highestPercentage = percentage;
            highestUsage = usage;
        }
    });
    
    // Update display
    usageSummary.textContent = `${highestUsage.current}/${highestUsage.limit} ${highestUsage.type}`;
    
    // Update color based on usage
    if (highestPercentage >= 1) {
        usageIndicator.style.background = '#ff4444';
        usageIndicator.style.color = 'white';
    } else if (highestPercentage >= 0.8) {
        usageIndicator.style.background = '#ff8800';
        usageIndicator.style.color = 'white';
    } else {
        usageIndicator.style.background = 'var(--bg-secondary)';
        usageIndicator.style.color = 'var(--text-primary)';
    }
}

// Usage warning notifications
function checkUsageWarnings(type) {
    if (hasActiveSubscription()) return;
    
    const limits = {
        recording: 10,
        translation: 20,
        tts: 15
    };
    
    const current = subscriptionUsage[type] || 0;
    const limit = limits[type];
    
    if (!limit) return;
    
    // Show warning at 80% of limit
    if (current === Math.floor(limit * 0.8)) {
        showUsageWarning(type, current, limit);
    }
    
    // Show final warning at 90% of limit
    if (current === Math.floor(limit * 0.9)) {
        showFinalUsageWarning(type, current, limit);
    }
}

function showUsageWarning(type, current, limit) {
    const remaining = limit - current;
    const typeNames = {
        recording: 'recordings',
        translation: 'translations', 
        tts: 'text-to-speech uses'
    };
    
    const message = `You have ${remaining} ${typeNames[type]} remaining today. Consider upgrading for unlimited access!`;
    showTemporaryNotification(message, 'warning');
}

function showFinalUsageWarning(type, current, limit) {
    const remaining = limit - current;
    const typeNames = {
        recording: 'recordings',
        translation: 'translations',
        tts: 'text-to-speech uses'
    };
    
    const message = `Almost at your limit! Only ${remaining} ${typeNames[type]} left today.`;
    showTemporaryNotification(message, 'error');
}

function showTemporaryNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('usage-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'usage-notification';
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: var(--bg-card);
            color: var(--text-primary);
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-left: 4px solid var(--accent-primary);
            font-family: 'Quicksand', sans-serif;
            font-size: 14px;
            max-width: 300px;
            z-index: 99999;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        document.body.appendChild(notification);
    }
    
    // Update styling based on type
    const colors = {
        info: 'var(--accent-primary)',
        warning: '#ff8800',
        error: '#ff4444'
    };
    
    notification.style.borderLeftColor = colors[type] || colors.info;
    notification.textContent = message;
    
    // Show notification
    notification.style.transform = 'translateX(0)';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
    }, 5000);
}