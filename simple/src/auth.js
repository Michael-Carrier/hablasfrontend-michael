// Authentication functions

function showDailyPages() {
    // Ensure DOM elements are available
    const loginScreen = document.getElementById('login-screen');
    const pageleContent = document.getElementById('pagele-content');
    const pageleModal = document.getElementById('pagele-modal');
    const sentenceModal = document.getElementById('sentence-modal');
    const chaptersModal = document.getElementById('chapters-modal');
    
    if (!loginScreen || !pageleContent) {
        console.error('Required DOM elements not found for showDailyPages');
        return;
    }
    
    // Hide login screen and show daily pages
    loginScreen.classList.add('hidden');
    loginScreen.style.display = 'none';
    pageleContent.style.display = 'block';
    pageleContent.classList.add('active');
    isShowingDailyPages = true;
    
    // Clear modal history when starting a new session
    clearModalHistory();
    
    console.log('Daily pages displayed, pagele content visible');
    
    // Only show pagele modal if user is actually logged in and not already visible
    if (isLoggedIn && pageleModal && sentenceModal && chaptersModal &&
        pageleModal.style.display !== 'block' && 
        sentenceModal.style.display !== 'block' && 
        chaptersModal.style.display !== 'block') {
        // Add small delay to ensure WebSocket connection is ready
        setTimeout(() => {
            requestPageleList();
        }, 500);
    }
}

function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const pageleContent = document.getElementById('pagele-content');
    
    // Hide all modals first
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        modal.style.display = 'none';
    });
    
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
        loginScreen.style.display = 'flex';
    }
    if (pageleContent) {
        pageleContent.style.display = 'none';
        pageleContent.classList.remove('active');
    }
    isShowingDailyPages = false;
    
    // Clear modal history when returning to login
    clearModalHistory();
    
    console.log('Login screen displayed');
}

function handleAuthSuccess(response) {
    console.log("Auth success:", response);
    console.log('handleAuthSuccess called with response:', response);
    logEvent('User authentication successful', { username: response.username });
    
    if (response.token) {
        localStorage.setItem('token', response.token);
        console.log('Token saved to localStorage:', response.token);
    }
    
    if (response.username) {
        localStorage.setItem('username', response.username);
        userInfo.username = response.username;
        console.log('Username saved:', response.username);
        
        // Show admin section if user is admin
        if (response.username === 'admin') {
            const adminSection = document.getElementById('admin-section');
            if (adminSection) {
                adminSection.style.display = 'block';
            }
        }
    }
    
    isLoggedIn = true;
    console.log('isLoggedIn set to true, about to show daily pages');
    
    if (response.points) {
        userInfo.points = response.points;
    }
    
    if (response.preferred_language) {
        userInfo.preferredLanguage = response.preferred_language;
        console.log("Stored preferred language from auth:", response.preferred_language);
        
        const languageSelect = document.getElementById('languageUserOptions');
        if (languageSelect) {
            languageSelect.value = response.preferred_language;
        }
    }
    
    // Handle subscription status
    if (response.subscription_status) {
        userSubscriptionStatus = response.subscription_status;
        console.log("Received subscription status:", userSubscriptionStatus);
        console.log("Setting userSubscriptionStatus to:", userSubscriptionStatus);
    } else {
        userSubscriptionStatus = 'none';
        console.log("No subscription status in response, defaulting to 'none'");
    }
    
    // Handle special access
    if (response.special_access) {
        specialAccess = response.special_access;
        hasSpecialAccess = response.has_special_access || false;
        console.log("Received special access:", specialAccess, "Active:", hasSpecialAccess);
    } else {
        // Reset special access if not provided
        specialAccess = null;
        hasSpecialAccess = false;
        console.log("No special access in response, resetting to false");
    }
    
    console.log("About to call updateAuthUI and updateSubscriptionUI");
    console.log("Current userSubscriptionStatus before UI update:", userSubscriptionStatus);
    
    updateAuthUI(true, response);
    
    // Update subscription UI after setting subscription status
    updateSubscriptionUI();
    
    // Load user's preferred language after successful authentication
    if (typeof loadUserLanguageAfterAuth === 'function') {
        loadUserLanguageAfterAuth();
    }
    
    hideDrawer();
    showDailyPages();
}

function handleTokenVerification(response) {
    if (response.success) {
        console.log('Token verification successful');
        isLoggedIn = true;
        
        if (response.user_data && response.user_data.username) {
            userInfo.username = response.user_data.username;
            if (response.user_data.points) {
                userInfo.points = response.user_data.points;
            }
            
            if (response.user_data.preferred_language) {
                userInfo.preferredLanguage = response.user_data.preferred_language;
            }
        }
        
        // Handle subscription status on token verification
        if (response.subscription_status) {
            userSubscriptionStatus = response.subscription_status;
            console.log("Token verification - subscription status:", userSubscriptionStatus);
        } else {
            userSubscriptionStatus = 'none';
            console.log("Token verification - no subscription status, defaulting to 'none'");
        }
        
        // Handle special access
        if (response.special_access) {
            specialAccess = response.special_access;
            hasSpecialAccess = response.has_special_access || false;
            console.log("Token verification - special access:", specialAccess, "Active:", hasSpecialAccess);
        }
        
        updateAuthUI(true, response);
        
        // Update subscription UI after token verification
        updateSubscriptionUI();
        
        // Load user's preferred language after token verification
        if (typeof loadUserLanguageAfterAuth === 'function') {
            loadUserLanguageAfterAuth();
        }
        
        // Show daily pages directly
        showDailyPages();
    } else {
        handleInvalidToken();
    }
}

function handleInvalidToken() {
    console.log('Token verification failed');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    isLoggedIn = false;
    userInfo = { username: '', points: 0, preferredLanguage: 'en' };
    userSubscriptionStatus = 'none';
    specialAccess = null;
    hasSpecialAccess = false;
    updateAuthUI(false);
    showLoginScreen();
}

function updateAuthUI(isLoggedIn, responseData = null) {
    const userSection = document.getElementById('user-section');
    const loginSection = document.getElementById('login-section');
    const pointsDisplay = document.getElementById('points-display');
    const pointsSpan = document.getElementById('points');
    const pointsDisplayPagele = document.getElementById('points-display-pagele');
    const pointsPageleSpan = document.getElementById('points-pagele');
    
    if (isLoggedIn) {
        if (userSection) {
            userSection.textContent = userInfo.username || 'User';
        }
        
        if (pointsDisplay && pointsSpan) {
            pointsSpan.textContent = userInfo.points || 0;
            pointsDisplay.style.display = 'block';
        }
        
        if (pointsDisplayPagele && pointsPageleSpan) {
            pointsPageleSpan.textContent = userInfo.points || 0;
            pointsDisplayPagele.style.display = 'block';
        }
        
        // Update user fields in settings
        const userNameField = document.getElementById('user-name');
        const userPasswordField = document.getElementById('user-password');
        const loginSingupSection = document.getElementById('login-singup');
        const logoutSection = document.getElementById('logout-section');
        
        if (userNameField) {
            userNameField.value = userInfo.username || '';
        }
        
        // Hide login form and show logout button when logged in
        if (userPasswordField) {
            userPasswordField.style.display = 'none';
        }
        if (loginSingupSection) {
            loginSingupSection.style.display = 'none';
        }
        if (logoutSection) {
            logoutSection.style.display = 'block';
        }
        
    } else {
        if (userSection) {
            userSection.textContent = 'Login';
        }
        
        if (pointsDisplay) {
            pointsDisplay.style.display = 'none';
        }
        
        if (pointsDisplayPagele) {
            pointsDisplayPagele.style.display = 'none';
        }
        
        // Show login form and hide logout button when not logged in
        const userPasswordField = document.getElementById('user-password');
        const loginSingupSection = document.getElementById('login-singup');
        const logoutSection = document.getElementById('logout-section');
        
        if (userPasswordField) {
            userPasswordField.style.display = 'block';
        }
        if (loginSingupSection) {
            loginSingupSection.style.display = 'flex';
        }
        if (logoutSection) {
            logoutSection.style.display = 'none';
        }
    }
}

function handleLogout() {
    const username = localStorage.getItem('username');
    
    console.log('Logout initiated for user:', username);
    logEvent('User logged out', { username });
    
    // Clear all localStorage
    localStorage.clear();
    
    // Reset application state
    isLoggedIn = false;
    userInfo = { username: '', points: 0, preferredLanguage: 'en' };
    userSubscriptionStatus = 'none';
    specialAccess = null;
    hasSpecialAccess = false;
    
    // Clear form fields
    const userEmailDisplay = document.getElementById('user-email-display');
    const userNameMain = document.getElementById('user-name-main');
    const userPasswordMain = document.getElementById('user-password-main');
    
    if (userEmailDisplay) {
        userEmailDisplay.textContent = '';
    }
    if (userNameMain) {
        userNameMain.value = '';
    }
    if (userPasswordMain) {
        userPasswordMain.value = '';
    }
    
    // Update UI and show login screen
    updateAuthUI(false);
    showLoginScreen();
    
    console.log('Logout completed - all local data cleared');
}

function verifyToken(token) {
    sendSocketMessage({
        task: "verify_token",
        token: token
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Auto-login on page load
function initializeAuth() {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                performAuthInitialization();
            }, 100);
        });
    } else {
        setTimeout(() => {
            performAuthInitialization();
        }, 100);
    }
}

function performAuthInitialization() {
    console.log('Performing auth initialization...');
    const token = localStorage.getItem('token');
    const loginScreen = document.getElementById('login-screen');
    const pageleContent = document.getElementById('pagele-content');
    
    console.log('Auth init - DOM elements:', {
        loginScreen: !!loginScreen,
        pageleContent: !!pageleContent,
        hasToken: !!token
    });
    
    if (token) {
        console.log('Found stored token, verifying...');
        verifyToken(token);
    } else {
        console.log('No stored token found, showing login screen');
        showLoginScreen();
    }
}

// Debug function to manually test UI
function debugShowPageleContent() {
    console.log('DEBUG: Manually showing pagele content');
    const loginScreen = document.getElementById('login-screen');
    const pageleContent = document.getElementById('pagele-content');
    
    if (loginScreen) {
        loginScreen.style.display = 'none';
        loginScreen.classList.add('hidden');
        console.log('DEBUG: Login screen hidden');
    }
    
    if (pageleContent) {
        pageleContent.style.display = 'block';
        pageleContent.classList.add('active');
        console.log('DEBUG: Pagele content shown and active class added');
    }
}

// Debug function to show login screen
function debugShowLoginScreen() {
    console.log('DEBUG: Manually showing login screen');
    const loginScreen = document.getElementById('login-screen');
    const pageleContent = document.getElementById('pagele-content');
    
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.classList.remove('hidden');
        console.log('DEBUG: Login screen shown');
    }
    
    if (pageleContent) {
        pageleContent.style.display = 'none';
        pageleContent.classList.remove('active');
        console.log('DEBUG: Pagele content hidden');
    }
}

// Debug function to manually trigger auth success with current response
function debugTriggerAuthSuccess() {
    console.log('DEBUG: Manually triggering auth success');
    const mockResponse = {
        status: 'success',
        token: localStorage.getItem('token') || '95302446-3aa3-4d67-beef-917914a987f9',
        username: localStorage.getItem('username') || 'jason.carrier@gmail.com',
        preferred_language: 'en'
    };
    
    handleAuthSuccess(mockResponse);
}

// Make debug functions available globally
window.debugShowPageleContent = debugShowPageleContent;
window.debugShowLoginScreen = debugShowLoginScreen;
window.debugTriggerAuthSuccess = debugTriggerAuthSuccess;