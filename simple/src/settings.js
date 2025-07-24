// Settings functionality

// Function to send bug report with logs
async function sendBugReport() {
    try {
        console.log('sendBugReport called');
        
        const foundBugBtn = document.getElementById('found-bug');
        if (!foundBugBtn) {
            console.error('found-bug button not found');
            alert('Bug report button not found');
            return;
        }
        
        const originalText = foundBugBtn.textContent;
        foundBugBtn.textContent = getInterfaceString('sendingBugReport');
        foundBugBtn.style.pointerEvents = 'none';
        
        console.log('Button state updated, gathering system info...');
        
        // Gather system information
        const systemInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            currentMode: typeof currentMode !== 'undefined' ? currentMode : 'unknown',
            isLoggedIn: typeof isLoggedIn !== 'undefined' ? isLoggedIn : false,
            username: (typeof userInfo !== 'undefined' && userInfo.username) ? userInfo.username : 'Not logged in',
            selectedBook: typeof selectedBook !== 'undefined' ? selectedBook : 'None',
            pageleFilename: typeof pageleFilename !== 'undefined' ? pageleFilename : 'None'
        };
        
        console.log('System info gathered:', systemInfo);

        // Check if sessionLogs exists
        if (typeof sessionLogs === 'undefined' || !Array.isArray(sessionLogs)) {
            console.error('sessionLogs not available or not an array:', sessionLogs);
            alert('Session logs not available. Please try again.');
            foundBugBtn.textContent = originalText;
            foundBugBtn.style.pointerEvents = 'auto';
            return;
        }

        console.log('Processing logs, sessionLogs length:', sessionLogs.length);

        // Process logs to shorten them
        const processedLogs = sessionLogs.map(logEntry => {
            const processedEntry = { ...logEntry }; // Shallow copy

            // Truncate message
            if (typeof processedEntry.message === 'string' && processedEntry.message.length > 200) {
                processedEntry.message = processedEntry.message.substring(0, 197) + "...";
            }

            // Process args
            if (Array.isArray(processedEntry.args)) {
                processedEntry.args = processedEntry.args.map(arg => {
                    if (typeof arg === 'string') {
                        if ((arg.startsWith('{') && arg.endsWith('}')) || (arg.startsWith('[') && arg.endsWith(']'))) {
                            try {
                                JSON.parse(arg); // Check if it's valid JSON
                                if (arg.startsWith('{')) return "{JSON Object}";
                                if (arg.startsWith('[')) return "[JSON Array]";
                            } catch (e) {
                                // Not valid JSON, treat as regular string
                            }
                        }
                        if (arg.length > 100) {
                            return arg.substring(0, 97) + "...";
                        }
                    } else if (typeof arg === 'object' && arg !== null) {
                        return Array.isArray(arg) ? "[Array]" : "[Object]";
                    }
                    return arg; // Keep numbers, booleans, etc. as is
                });
            }
            return processedEntry;
        });
        
        console.log('Logs processed, generating email body...');
        
        // Format logs for email using processed logs
        const formattedLogs = processedLogs.map(log => 
            `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message} ${log.args ? log.args.join(' ') : ''}`
        ).join('\\n');
        
        console.log("processedLogs for email: ", processedLogs);
        console.log("processedLogs length: ", processedLogs.length);
        
        const emailBody = `
Bug Report from Hablas App
==========================

System Information:
${JSON.stringify(systemInfo, null, 2)}

Session Logs:
${formattedLogs}

Additional Notes:
(User can add more details here)
        `.trim();
        
        console.log('Sending via WebSocket...');
        
        // Check if sendSocketMessage function exists
        if (typeof sendSocketMessage !== 'function') {
            console.error('sendSocketMessage function not available');
            alert('WebSocket not available. Please try again.');
            foundBugBtn.textContent = originalText;
            foundBugBtn.style.pointerEvents = 'auto';
            return;
        }
        
        // Send via WebSocket to your server using processed logs
        sendSocketMessage({
            task: 'send_bug_report',
            systemInfo: systemInfo,
            logs: processedLogs, // Use processed logs
            emailBody: emailBody, // emailBody is now generated from processed logs
            token: localStorage.getItem('token')
        });
        
        console.log('Bug report sent successfully');
        
        // Reset button after a delay
        setTimeout(() => {
            foundBugBtn.textContent = originalText;
            foundBugBtn.style.pointerEvents = 'auto';
            alert(getInterfaceString('bugReportSent'));
            
            // Check if drawer exists before trying to close it
            if (typeof drawer !== 'undefined' && drawer) {
                drawer.classList.remove('open');
                setTimeout(() => {
                    drawer.style.display = 'none';
                }, 300);
            } else {
                // Use alternative method to close settings
                closeSettings();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error sending bug report:', error);
        console.error('Error stack:', error.stack);
        const foundBugBtn = document.getElementById('found-bug');
        if (foundBugBtn) {
            foundBugBtn.textContent = 'Found a bug';
            foundBugBtn.style.pointerEvents = 'auto';
        }
        alert('Error sending bug report: ' + error.message + '. Please try again.');
    }
}

function updateLanguageSettings() {
    const languageSelect = document.getElementById('languageUserOptions');
    if (!languageSelect) return;
    
    const selectedLang = languageSelect.value;
    console.log("User selected interface language:", selectedLang);
    
    // Update user preference
    userInfo.preferredLanguage = selectedLang;
    currentInterfaceLanguage = selectedLang;
    
    // Skip server request for English since we have default strings
    if (selectedLang === 'en') {
        console.log("English selected, using default interface strings");
        applyInterfaceStrings(interfaceStrings);
        
        // Still save the preference to server if logged in (but don't expect language data back)
        if (localStorage.getItem('token')) {
            sendSocketMessage({
                task: 'update_interface_language', 
                language: selectedLang,
                token: localStorage.getItem('token')
            });
        }
    } else {
        // Request language data from server for non-English languages
        if (localStorage.getItem('token')) {
            console.log("Requesting language data from server for:", selectedLang);
            // Use existing update_interface_language task
            sendSocketMessage({
                task: 'update_interface_language',
                language: selectedLang,
                token: localStorage.getItem('token')
            });
        } else {
            console.log("No token available, loading from local JSON file as fallback");
            loadLanguageFromLocalFile(selectedLang);
        }
    }
    
    logEvent('Interface language changed', { language: selectedLang });
}

// Fallback function to load language from local JSON file
async function loadLanguageFromLocalFile(languageCode) {
    try {
        console.log("Loading language from local file:", languageCode);
        
        // Fetch the language data from local JSON file
        const response = await fetch('interface_languages_translated.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const languageData = await response.json();
        
        if (languageData[languageCode]) {
            console.log("Found language data in local file for:", languageCode);
            applyInterfaceStrings(languageData[languageCode]);
        } else {
            console.warn("Language not found in local file:", languageCode);
            // Fall back to English
            if (languageData['en']) {
                console.log("Falling back to English");
                applyInterfaceStrings(languageData['en']);
            }
        }
    } catch (error) {
        console.error('Error loading language from local file:', error);
        // Use default English strings as ultimate fallback
        console.log("Using default interface strings");
    }
}

function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to default?')) {
        return;
    }
    
    // Reset UI elements
    const userNameField = document.getElementById('user-name');
    const userPasswordField = document.getElementById('user-password');
    const languageSelect = document.getElementById('languageUserOptions');
    
    if (userNameField) userNameField.value = '';
    if (userPasswordField) userPasswordField.value = '';
    if (languageSelect) languageSelect.value = 'en';
    
    // Reset user preferences
    userInfo.preferredLanguage = 'en';
    currentInterfaceLanguage = 'en';
    
    // Apply default interface strings
    applyInterfaceStrings(interfaceStrings);
    
    alert('Settings reset to default');
    
    logEvent('Settings reset', {});
}

function exportUserData() {
    if (!isLoggedIn) {
        alert('Please log in to export your data');
        return;
    }
    
    const userData = {
        username: userInfo.username,
        points: userInfo.points,
        preferredLanguage: userInfo.preferredLanguage,
        subscriptionStatus: userSubscriptionStatus,
        completedChapters: Object.keys(completedIndices).length,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `hablas-data-${userInfo.username}-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    logEvent('User data exported', {
        username: userInfo.username,
        data_size_bytes: dataStr.length
    });
}

function deleteAccount() {
    if (!isLoggedIn) {
        alert('Please log in to delete your account');
        return;
    }
    
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmation !== 'DELETE') {
        alert('Account deletion cancelled');
        return;
    }
    
    if (confirm('This action cannot be undone. Are you absolutely sure you want to delete your account?')) {
        sendSocketMessage({
            task: 'delete_account',
            token: localStorage.getItem('token'),
            confirmation: 'DELETE'
        });
        
        // Log out immediately
        handleLogout();
        
        alert('Account deletion request sent. Your account will be deleted within 24 hours.');
        
        logEvent('Account deletion requested', {
            username: userInfo.username
        });
    }
}

// Settings drawer functionality
function openSettings(event) {
    console.log('openSettings called');
    if (!drawer) {
        console.log('No drawer found');
        return;
    }
    
    // Prevent event propagation to avoid closing other modals
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('Opening settings drawer...');
    
    // Store currently open modals before opening drawer
    const openModals = [];
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        if (modal.style.display === 'block' || modal.style.display === 'flex') {
            openModals.push(modal.id);
        }
    });
    
    // Update settings form with current values
    const userNameField = document.getElementById('user-name');
    const languageSelect = document.getElementById('languageUserOptions');
    
    if (userNameField && isLoggedIn) {
        userNameField.value = userInfo.username || '';
    }
    
    if (languageSelect) {
        languageSelect.value = userInfo.preferredLanguage || 'en';
    }
    
    showDrawerWithBackdrop();
    
    // Update usage display for free users
    if (typeof updateUsageDisplay === 'function') {
        updateUsageDisplay();
    }
    
    // Restore any modals that were open
    openModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '99998'; // Below drawer but above other content
        }
    });
    
    logEvent('Settings opened', {});
}

function closeSettings() {
    // Restore z-index for any open modals before closing drawer
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        if (modal.style.display === 'block' || modal.style.display === 'flex') {
            modal.style.zIndex = ''; // Reset to default
        }
    });
    
    hideDrawerWithBackdrop();
    logEvent('Settings closed', {});
}

// Initialize settings
function initializeSettings() {
    console.log('Settings initialized');
    
    // Only initialize language settings if user has a non-English preference
    if (userInfo.preferredLanguage && userInfo.preferredLanguage !== 'en') {
        console.log('User has non-English preference, loading language:', userInfo.preferredLanguage);
        updateLanguageSettings();
    } else {
        console.log('User preference is English or not set, using default strings');
        applyInterfaceStrings(interfaceStrings);
    }
}