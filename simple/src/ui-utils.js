// UI utility functions

// Modal history system
let modalHistory = [];

function addToModalHistory(modalId) {
    // Only add if it's not already the last item (avoid duplicates)
    if (modalHistory.length === 0 || modalHistory[modalHistory.length - 1] !== modalId) {
        modalHistory.push(modalId);
        console.log('Modal history:', modalHistory);
    }
}

function getLastModalFromHistory() {
    // Remove current modal and return previous one
    if (modalHistory.length > 1) {
        modalHistory.pop(); // Remove current modal
        const previousModal = modalHistory[modalHistory.length - 1];
        console.log('Returning to previous modal:', previousModal);
        return previousModal;
    }
    return null;
}

function clearModalHistory() {
    modalHistory = [];
    console.log('Modal history cleared');
}

function createTouchAwareEventListener(callback) {
    return function(e) {
        // For click events, just call the callback
        if (e.type === 'click') {
            callback(e);
            return;
        }
        
        // For touch events, we need to be more careful
        if (e.type === 'touchend') {
            // Check if this was a scroll gesture
            const touch = e.changedTouches[0];
            const element = e.currentTarget;
            
            // Get the stored touch start position
            const startData = element._touchStartData;
            if (!startData) {
                // No start data, treat as a tap
                e.preventDefault();
                callback(e);
                return;
            }
            
            const deltaX = Math.abs(touch.clientX - startData.startX);
            const deltaY = Math.abs(touch.clientY - startData.startY);
            const timeDelta = Date.now() - startData.startTime;
            
            // If movement is small and time is short, it's a tap
            const isScroll = deltaX > 10 || deltaY > 10 || timeDelta > 500;
            
            if (!isScroll) {
                e.preventDefault();
                callback(e);
            }
            
            // Clean up
            delete element._touchStartData;
        }
    };
}

function hideStatusIndicators() {
    // Hide various status indicators across the app
    const indicators = [
        'fetching-data-status',
        'processing-status',
        'loading-indicator'
    ];
    
    indicators.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function updatePointsDisplay(points) {
    userInfo.points = points;
    
    // Only update points in the currently visible modal
    const sentenceModal = document.getElementById('sentence-modal');
    const translationModal = document.getElementById('myModal');
    
    if (sentenceModal && sentenceModal.style.display === 'flex') {
        // Update only sentence modal points
        const pagelePoints = document.getElementById('points-pagele');
        if (pagelePoints) {
            pagelePoints.textContent = points;
        }
    } else if (translationModal && translationModal.style.display === 'block') {
        // Update only translation modal points
        const translationPoints = document.getElementById('points');
        if (translationPoints) {
            translationPoints.textContent = points;
        }
    } else {
        // Fallback: update both but with extra safety
        const pointsElements = [
            document.getElementById('points'),
            document.getElementById('points-pagele')
        ];
        
        pointsElements.forEach(element => {
            if (element) {
                element.textContent = points;
            }
        });
    }
}

function updateTimer() {
    if (!processingStartTime) return;
    
    const elapsed = (Date.now() - processingStartTime) / 1000;
    const timerElements = document.querySelectorAll('.timer');
    
    timerElements.forEach(element => {
        element.textContent = elapsed.toFixed(1) + 's';
    });
}

function startTimer() {
    processingStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    processingStartTime = 0;
    
    const timerElements = document.querySelectorAll('.timer');
    timerElements.forEach(element => {
        element.textContent = '0.0s';
    });
}

function playAudioFromData(audioData, textKeyForLog) {
    try {
        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        
        // Convert base64 to blob and play
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use audio/mp3 since that's what the server is sending
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        
        currentAudio = new Audio(audioUrl);
        
        currentAudio.onloadeddata = () => {
            console.log('Audio loaded, duration:', currentAudio.duration);
            logEvent('Audio playback started', {
                source: textKeyForLog,
                duration_seconds: currentAudio.duration,
                audio_size_bytes: audioData.length
            });
        };
        
        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            
            // Update robot icon state for both possible robot buttons
            const robotIconPagele = document.getElementById('robot-pagele');
            const robotIcon = document.getElementById('robot');
            
            if (robotIconPagele) {
                robotIconPagele.setAttribute('data-speaking', 'false');
                robotIconPagele.style.filter = 'brightness(1)';
            }
            if (robotIcon) {
                robotIcon.setAttribute('data-speaking', 'false');
                robotIcon.style.filter = 'brightness(1)';
            }
        };
        
        currentAudio.onerror = (error) => {
            console.error('Audio playback error:', error);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            
            // Reset robot button states on error
            const robotIconPagele = document.getElementById('robot-pagele');
            const robotIcon = document.getElementById('robot');
            
            if (robotIconPagele) {
                robotIconPagele.setAttribute('data-speaking', 'false');
                robotIconPagele.style.filter = 'brightness(1)';
            }
            if (robotIcon) {
                robotIcon.setAttribute('data-speaking', 'false');
                robotIcon.style.filter = 'brightness(1)';
            }
        };
        
        currentAudio.play().catch(error => {
            console.error('Error playing audio:', error);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
        });
        
        // Update robot icon state to indicate speaking for both possible robot buttons
        const robotIconPagele = document.getElementById('robot-pagele');
        const robotIcon = document.getElementById('robot');
        
        if (robotIconPagele) {
            robotIconPagele.setAttribute('data-speaking', 'true');
            robotIconPagele.style.filter = 'brightness(0.7)';
        }
        if (robotIcon) {
            robotIcon.setAttribute('data-speaking', 'true');
            robotIcon.style.filter = 'brightness(0.7)';
        }
        
    } catch (error) {
        console.error('Error processing audio data:', error);
        logEvent('Audio playback error', { error: error.message });
    }
}

function showModal(modalId) {
    showModalRespectingDrawer(modalId);
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function showModalWithHistory(modalId) {
    showModalWithHistoryRespectingDrawer(modalId);
}

function hideModalAndShowPrevious(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.style.zIndex = ''; // Reset z-index
        const previousModal = getLastModalFromHistory();
        if (previousModal) {
            showModalWithHistoryRespectingDrawer(previousModal);
        }
    }
}

function showDrawer() {
    if (drawer) {
        drawer.classList.add('open');
    }
}

function hideDrawer() {
    if (drawer) {
        drawer.classList.remove('open');
    }
}

function toggleDrawer() {
    if (drawer) {
        drawer.classList.toggle('open');
    }
}

// Loading state management
function showLoading(message = 'Loading...') {
    let loadingElement = document.getElementById('loading-overlay');
    
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loading-overlay';
        loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            </div>
        `;
        document.body.appendChild(loadingElement);
    } else {
        const messageElement = loadingElement.querySelector('.loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
    
    loadingElement.style.display = 'flex';
}

function hideLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Touch and click event handling
function addTouchAwareListener(element, callback) {
    if (!element) return;
    
    const touchAwareCallback = createTouchAwareEventListener(callback);
    
    // Add both touch and click listeners
    if ('ontouchstart' in window) {
        // On touch devices, track touch start position
        element.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            element._touchStartData = {
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now()
            };
        }, { passive: true });
        
        element.addEventListener('touchend', touchAwareCallback);
    } else {
        // On non-touch devices, use click
        element.addEventListener('click', touchAwareCallback);
    }
    
    return () => {
        if ('ontouchstart' in window) {
            element.removeEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                element._touchStartData = {
                    startX: touch.clientX,
                    startY: touch.clientY,
                    startTime: Date.now()
                };
            });
            element.removeEventListener('touchend', touchAwareCallback);
        } else {
            element.removeEventListener('click', touchAwareCallback);
        }
    };
}

// Utility for handling responsive design
function isMobileDevice() {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
}

function updateUIForDevice() {
    const body = document.body;
    if (isMobileDevice()) {
        body.classList.add('mobile');
    } else {
        body.classList.remove('mobile');
    }
}

// Initialize UI utilities
function initializeUIUtils() {
    updateUIForDevice();
    
    // Update UI on resize
    window.addEventListener('resize', updateUIForDevice);
    
    // Initialize loading styles if not present
    if (!document.getElementById('loading-styles')) {
        const styles = document.createElement('style');
        styles.id = 'loading-styles';
        styles.textContent = `
            #loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .loading-content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                max-width: 300px;
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .loading-message {
                color: #333;
                font-size: 14px;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Settings drawer functions with backdrop support
function showDrawerWithBackdrop() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    
    if (drawer) {
        drawer.classList.add('open');
    }
    
    if (drawerBackdrop) {
        drawerBackdrop.style.display = 'block';
        // Force reflow to ensure display is set before adding active class
        drawerBackdrop.offsetHeight;
        drawerBackdrop.classList.add('active');
        
        // Add click-outside functionality
        drawerBackdrop.addEventListener('click', handleDrawerBackdropClick, { once: true });
    }
}

function hideDrawerWithBackdrop() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    
    if (drawer) {
        drawer.classList.remove('open');
    }
    
    if (drawerBackdrop) {
        drawerBackdrop.classList.remove('active');
        
        // Hide after transition completes
        setTimeout(() => {
            drawerBackdrop.style.display = 'none';
        }, 300);
        
        // Remove event listener if it exists
        drawerBackdrop.removeEventListener('click', handleDrawerBackdropClick);
    }
}

function handleDrawerBackdropClick(e) {
    // Only close if clicking on the backdrop itself, not the drawer content
    if (e.target.id === 'drawer-backdrop') {
        closeSettings();
    }
}

// Enhanced modal functions that respect drawer state
function showModalRespectingDrawer(modalId) {
    const modal = document.getElementById(modalId);
    const drawer = document.getElementById('settings-drawer');
    
    if (modal) {
        modal.style.display = 'block';
        addToModalHistory(modalId);
        
        // If drawer is open, ensure modal appears below it
        if (drawer && drawer.classList.contains('open')) {
            modal.style.zIndex = '99998'; // Below drawer but above other content
        } else {
            modal.style.zIndex = ''; // Reset to default
        }
    }
}

function showModalWithHistoryRespectingDrawer(modalId) {
    const modal = document.getElementById(modalId);
    const drawer = document.getElementById('settings-drawer');
    
    if (modal) {
        modal.style.display = 'flex';
        addToModalHistory(modalId);
        
        // If drawer is open, ensure modal appears below it
        if (drawer && drawer.classList.contains('open')) {
            modal.style.zIndex = '99998'; // Below drawer but above other content
        } else {
            modal.style.zIndex = ''; // Reset to default
        }
        
        console.log('Showing modal with history (respecting drawer):', modalId);
    }
}

// Celebration functions
function playBoingSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const createBoingNote = (frequency, startTime, volume) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, audioContext.currentTime + startTime + 0.3);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + startTime + 0.4);
            
            oscillator.start(audioContext.currentTime + startTime);
            oscillator.stop(audioContext.currentTime + startTime + 0.4);
        };
        
        createBoingNote(440, 0, 0.3);
        
    } catch (error) {
        console.log('🎵 Boing! 🎵');
    }
}

function playSuccessChime() {
    // Create a pleasant success chime using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create multiple oscillators for a rich chord
        const createNote = (frequency, startTime, duration) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + startTime + duration);
            
            oscillator.start(audioContext.currentTime + startTime);
            oscillator.stop(audioContext.currentTime + startTime + duration);
        };
        
        // Create a pleasant C major chord progression: C - E - G - C (higher octave)
        const baseTime = audioContext.currentTime;
        createNote(523.25, 0, 0.6);      // C5
        createNote(659.25, 0.1, 0.7);    // E5
        createNote(783.99, 0.2, 0.8);    // G5
        createNote(1046.50, 0.3, 0.9);   // C6
        
    } catch (error) {
        // Fallback: just log the success
        console.log('🎵 Success! 🎵');
    }
}

function createConfetti() {
    const confettiCount = 50;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fd79a8', '#fdcb6e'];
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        document.body.appendChild(confetti);
        
        // Remove confetti after animation
        setTimeout(() => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 4000);
    }
}

function createFireworks() {
    const fireworkCount = 3;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
    
    for (let i = 0; i < fireworkCount; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = (20 + Math.random() * 60) + '%';
            firework.style.top = (20 + Math.random() * 40) + '%';
            
            document.body.appendChild(firework);
            
            // Create sparks
            const sparkCount = 12;
            for (let j = 0; j < sparkCount; j++) {
                const spark = document.createElement('div');
                spark.className = 'firework-spark';
                spark.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                
                const angle = (j / sparkCount) * 2 * Math.PI;
                const distance = 50 + Math.random() * 50;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                spark.style.transform = `translate(${x}px, ${y}px)`;
                firework.appendChild(spark);
            }
            
            // Remove firework after animation
            setTimeout(() => {
                if (firework.parentNode) {
                    firework.parentNode.removeChild(firework);
                }
            }, 2000);
        }, i * 300);
    }
}

function showCelebrationMessage() {
    const messages = ['Great job!', 'Excellent!', 'Well done!', 'Amazing!', 'Perfect!', '¡Fantástico!', 'Bravo!'];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    const messageElement = document.createElement('div');
    messageElement.className = 'celebration-message';
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    // Remove message after animation
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 2000);
}

function triggerCelebration() {
    // 25% chance of celebration
    if (Math.random() < 0.25) {
        console.log('🎉 Celebration triggered!');
        
        // Play boing sound
        playBoingSound();
        
        // Show celebration message
        showCelebrationMessage();
        
        // Randomly choose between confetti or fireworks
        if (Math.random() < 0.5) {
            console.log('🎊 Creating confetti');
            createConfetti();
        } else {
            console.log('🎆 Creating fireworks');
            createFireworks();
        }
        
        return true; // Celebration was triggered
    }
    console.log('No celebration this time (25% chance)');
    return false; // No celebration
}