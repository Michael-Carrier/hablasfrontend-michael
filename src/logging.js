// Logging system

let sessionLogs = [];
const logContainer = document.createElement('div');

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

function addLogEntry(type, message, ...args) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        message: String(message),
        data: args.length > 0 ? args : null
    };
    
    sessionLogs.push(logEntry);
    
    // Limit log size to prevent memory issues
    if (sessionLogs.length > maxLogs) {
        sessionLogs = sessionLogs.slice(-maxLogs);
    }
    
    // Call original console method
    originalConsole[type] && originalConsole[type](message, ...args);
}

function logEvent(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type: 'event',
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : null // Deep clone to avoid reference issues
    };
    
    sessionLogs.push(logEntry);
    
    // Limit log size
    if (sessionLogs.length > maxLogs) {
        sessionLogs = sessionLogs.slice(-maxLogs);
    }
    
    console.log(`[EVENT] ${message}`, data || '');
}

// Override console methods to capture logs
console.log = function(message, ...args) {
    addLogEntry('log', message, ...args);
};

console.warn = function(message, ...args) {
    addLogEntry('warn', message, ...args);
};

console.error = function(message, ...args) {
    addLogEntry('error', message, ...args);
};

console.info = function(message, ...args) {
    addLogEntry('info', message, ...args);
};

// Performance logging utilities
function logPerformance(operation, startTime, endTime = null) {
    const end = endTime || performance.now();
    const duration = end - startTime;
    
    logEvent('Performance measurement', {
        operation,
        duration_ms: duration,
        start_time: startTime,
        end_time: end
    });
}

function createPerformanceTimer(operation) {
    const startTime = performance.now();
    
    return {
        end: () => logPerformance(operation, startTime),
        mark: (label) => logEvent('Performance mark', {
            operation,
            label,
            time_ms: performance.now() - startTime
        })
    };
}

// Memory usage logging
function logMemoryUsage(context) {
    if (performance.memory) {
        logEvent('Memory usage', {
            context,
            used_js_heap_size: performance.memory.usedJSHeapSize,
            total_js_heap_size: performance.memory.totalJSHeapSize,
            js_heap_size_limit: performance.memory.jsHeapSizeLimit
        });
    }
}

// Network request logging
function logNetworkRequest(url, method, status, duration, size) {
    logEvent('Network request', {
        url,
        method,
        status,
        duration_ms: duration,
        response_size_bytes: size
    });
}

// User interaction logging
function logUserInteraction(action, element, data = null) {
    logEvent('User interaction', {
        action,
        element_id: element?.id || 'unknown',
        element_type: element?.tagName?.toLowerCase() || 'unknown',
        timestamp: Date.now(),
        ...data
    });
}

// Error logging utilities
function logError(error, context = '') {
    const errorInfo = {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace',
        context,
        timestamp: Date.now(),
        url: window.location.href,
        user_agent: navigator.userAgent
    };
    
    logEvent('Error occurred', errorInfo);
    console.error('Error logged:', errorInfo);
}

// Session logging utilities
function logSessionStart() {
    logEvent('Session started', {
        url: window.location.href,
        referrer: document.referrer,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        window_size: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
}

function logSessionEnd() {
    logEvent('Session ended', {
        duration_ms: Date.now() - (sessionLogs[0]?.timestamp ? new Date(sessionLogs[0].timestamp).getTime() : Date.now()),
        total_logs: sessionLogs.length,
        page_views: sessionLogs.filter(log => log.message === 'Page view').length,
        user_interactions: sessionLogs.filter(log => log.type === 'event' && log.message === 'User interaction').length
    });
}

// Export logs functionality
function exportLogs() {
    const logsData = {
        session_info: {
            start_time: sessionLogs[0]?.timestamp || new Date().toISOString(),
            end_time: new Date().toISOString(),
            total_entries: sessionLogs.length,
            user: userInfo.username || 'anonymous'
        },
        logs: sessionLogs
    };
    
    const dataStr = JSON.stringify(logsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `hablas-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    logEvent('Logs exported', { entries_count: sessionLogs.length });
}

// Clear logs
function clearLogs() {
    const oldCount = sessionLogs.length;
    sessionLogs = [];
    logEvent('Logs cleared', { previous_count: oldCount });
    console.log(`Cleared ${oldCount} log entries`);
}

// Get filtered logs
function getFilteredLogs(type = null, startTime = null, endTime = null) {
    let filtered = sessionLogs;
    
    if (type) {
        filtered = filtered.filter(log => log.type === type);
    }
    
    if (startTime) {
        filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(startTime));
    }
    
    if (endTime) {
        filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(endTime));
    }
    
    return filtered;
}

// Debug utilities
function showDebugInfo() {
    console.group('Debug Information');
    console.log('Session logs count:', sessionLogs.length);
    console.log('User info:', userInfo);
    console.log('App state:', {
        isLoggedIn,
        isShowingDailyPages,
        userSubscriptionStatus,
        hasSpecialAccess
    });
    console.log('WebSocket state:', socket?.readyState);
    console.groupEnd();
}

// Initialize logging
function initializeLogging() {
    logSessionStart();
    
    // Log page unload
    window.addEventListener('beforeunload', () => {
        logSessionEnd();
    });
    
    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
        logEvent('Page visibility changed', {
            visible: !document.hidden
        });
    });
    
    // Log page focus/blur
    window.addEventListener('focus', () => {
        logEvent('Page focused', {});
    });
    
    window.addEventListener('blur', () => {
        logEvent('Page blurred', {});
    });
    
    console.log('Logging system initialized');
}