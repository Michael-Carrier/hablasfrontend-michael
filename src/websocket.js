// WebSocket management
let socket = null;
let isConnecting = false;
let pendingMessages = [];

let currentReviewQueue = [];
let currentReviewIndex = 0;

function createWebSocketConnection() {
    if (isConnecting) {
        console.log('Connection already in progress, returning existing socket');
        return socket;
    }

    isConnecting = true;
    const newSocket = new WebSocket('wss://carriertech.uk:8675');
    //const newSocket = new WebSocket('ws://localhost:8675');
    
    newSocket.addEventListener('open', (event) => {
        console.log('WebSocket connection established');
        isConnecting = false;
        
        // Send any pending messages
        while (pendingMessages.length > 0) {
            const message = pendingMessages.shift();
            try {
                newSocket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error sending pending message:', error);
            }
        }
    });

    newSocket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        isConnecting = false;
    });

    newSocket.addEventListener('message', async (event) => {
        console.log("message received:", event);
        await handleWebSocketMessage(event);
    });

    newSocket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        isConnecting = false;
    });

    return newSocket;
}

// Handle WebSocket messages
async function handleWebSocketMessage(event) {
    const messageProcessingStartTime = performance.now();

    if (fetchingDataStatusElement) {
        fetchingDataStatusElement.style.display = 'flex';
    }

    
    let jsonString;
    let parsedResponseObject = null; 
    let conversionStartTime, conversionEndTime, parsingStartTime, parsingEndTime, afterConversionTime, afterParsingTime;

    // Handle different data types
    if (event.data instanceof ArrayBuffer) {
        try {
            conversionStartTime = performance.now();
            const decoder = new TextDecoder("utf-8");
            jsonString = decoder.decode(event.data);
            conversionEndTime = performance.now();
        } catch (e) {
            console.error("Error decoding ArrayBuffer:", e);
            hideStatusIndicators();
            return;
        }
    } else if (event.data instanceof Blob) {
        try {
            conversionStartTime = performance.now();
            jsonString = await event.data.text();
            conversionEndTime = performance.now();
            console.log(`Blob.text() took ${(conversionEndTime - conversionStartTime).toFixed(2)} ms`);
        } catch (e) {
            console.error("Error reading Blob as text:", e);
            hideStatusIndicators();
            return;
        }
    } else if (typeof event.data === 'string') {
        jsonString = event.data;
    } else {
        hideStatusIndicators();
        return; 
    }

    afterConversionTime = performance.now();

    // Parse JSON
    if (typeof jsonString === 'string') {
        try {
            parsingStartTime = performance.now();
            parsedResponseObject = JSON.parse(jsonString);
            parsingEndTime = performance.now();
        } catch (e) {
            console.error("Error parsing JSON string:", e);
            console.error("Original string that failed parsing:", jsonString);
            hideStatusIndicators();
            return; 
        }
    } else {
        console.error("Could not convert event.data to a string for parsing.");
        hideStatusIndicators();
        return;
    }
    
    afterParsingTime = performance.now();

    hideStatusIndicators();
    
    if (fetchingDataStatusElement) {
        fetchingDataStatusElement.style.display = 'none';
    }
    
    try {
        // Log response handling
        const endTime = performance.now();
        const processingTime = endTime - messageProcessingStartTime;
        const taskForLogging = currentRequestTask;
        
        logEvent('WebSocket response received', {
            task: taskForLogging,
            response_time_ms: processingTime,
            response_size_bytes: jsonString.length,
            response_type: parsedResponseObject.status || parsedResponseObject.type || 'unknown'
        });
        
        // Store task before clearing for error handling
        parsedResponseObject._originalTask = taskForLogging;
        
        currentRequestTask = '';
        currentRequestStartTime = null;
        
        // Route response to appropriate handler
        await handleResponse(parsedResponseObject);
        
    } catch (error) {
        console.error('Error handling WebSocket response:', error);
        logEvent('WebSocket response error', { error: error.message });
    }
}

// Function to send a message through the socket
function sendSocketMessage(message) {
    // If no socket exists or it's in an unusable state, create a new one
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        console.log('Socket is closed, creating new connection');
        socket = createWebSocketConnection();
        pendingMessages.push(message);
        return;
    }
    
    // If socket is closing, wait and retry with new connection
    if (socket.readyState === WebSocket.CLOSING) {
        console.log('Socket is closing, waiting and creating new connection');
        setTimeout(() => {
            socket = createWebSocketConnection();
            pendingMessages.push(message);
        }, 100);
        return;
    }
    
    // If socket is connecting, add to pending messages
    if (socket.readyState === WebSocket.CONNECTING) {
        console.log('Socket is connecting, queuing message');
        pendingMessages.push(message);
        return;
    }
    
    // Socket is open, try to send
    if (socket.readyState === WebSocket.OPEN) {
        try {
            console.log('Sending message on open socket:', message);
            socket.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message on open socket:', error);
            // Add to pending and create new connection
            pendingMessages.push(message);
            socket = createWebSocketConnection();
            return;
        }
    }
    
    if (fetchingDataStatusElement) {
        fetchingDataStatusElement.style.display = 'flex';
    }
}

function createBlobAndConnect() {
    if (audioChunks.length === 0) {
        console.error("No audio data to send");
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = function() {
        const base64data = reader.result.split(',')[1];
        audioChunks = [];
        
        // Log the recording request
        logEvent('Speech-to-text request', {
            audio_size_bytes: audioBlob.size,
            language: language
        });
        
        // Convert language if needed
        let lang = language;
        if (lang_conversion.hasOwnProperty(language)) {
            lang = lang_conversion[language];
        }
        
        sendSocketMessage({ 
            task: 'stt', 
            blob: base64data, 
            language: lang,
            username: userInfo.username,
            token: localStorage.getItem('token')
        });
    };
}

// Initialize WebSocket connection
function initializeWebSocket() {
    socket = createWebSocketConnection();
}


function requestWordStats() {
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        const statsRequest = {
            task: "get_word_stats",
            username: window.currentUserEmail // or wherever you store the username
        };
        window.socket.send(JSON.stringify(statsRequest));
        console.log("[WS] Requesting word stats...");
    }
}
