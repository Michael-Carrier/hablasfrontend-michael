// Theme management functionality

let currentTheme = 'classic';

// Initialize theme system
function initializeThemes() {
    console.log('Initializing theme system...');
    
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('hablas-theme') || 'classic';
    setTheme(savedTheme);
    
    // Add event listeners to theme buttons
    const themeButtons = document.querySelectorAll('.theme-button');
    themeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const theme = e.target.getAttribute('data-theme');
            setTheme(theme);
        });
    });
    
    console.log('Theme system initialized with theme:', savedTheme);
}

// Set the current theme
function setTheme(theme) {
    if (!['classic', 'light', 'dark'].includes(theme)) {
        console.warn('Invalid theme:', theme);
        return;
    }
    
    currentTheme = theme;
    
    // Apply theme to document with smooth transition
    document.body.style.transition = 'background-color 0.3s ease';
    
    // Apply theme to document
    if (theme === 'classic') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // Update active button
    updateThemeButtons(theme);
    
    // Save to localStorage
    localStorage.setItem('hablas-theme', theme);
    
    // Log theme change
    console.log('Theme changed to:', theme);
    
    // Add visual feedback
    showThemeChangeNotification(theme);
    
    // Trigger custom event for other modules to listen to
    document.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { theme: theme } 
    }));
}

// Show theme change notification
function showThemeChangeNotification(theme) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.theme-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'theme-notification';
    notification.textContent = `Switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'var(--accent-primary)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        zIndex: '10000',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 12px var(--shadow)',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        fontFamily: '"Quicksand", sans-serif'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

// Update theme button states
function updateThemeButtons(activeTheme) {
    const themeButtons = document.querySelectorAll('.theme-button');
    themeButtons.forEach(button => {
        const buttonTheme = button.getAttribute('data-theme');
        if (buttonTheme === activeTheme) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Get current theme
function getCurrentTheme() {
    return currentTheme;
}

// Toggle between themes (for potential keyboard shortcuts)
function toggleTheme() {
    const themes = ['classic', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
}

// Export functions for global access
window.initializeThemes = initializeThemes;
window.setTheme = setTheme;
window.getCurrentTheme = getCurrentTheme;
window.toggleTheme = toggleTheme;
