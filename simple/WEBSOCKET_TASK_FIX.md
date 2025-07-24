# WebSocket Task Fix - Using Existing update_interface_language

## Problem Identified
The app was sending `get_interface_language` task to the server, but the server only supports `update_interface_language`. This caused "Invalid task" errors.

## Solution Implemented

### Changes Made:

1. **Updated settings.js**:
   - Changed `get_interface_language` to `update_interface_language`
   - Removed duplicate server calls
   - Added logic to skip server requests for English (default language)
   - Modified `initializeSettings()` to only make server requests for non-English preferences

2. **Updated translation.js**:
   - Changed `get_interface_language` to `update_interface_language` in auto-load functions
   - Added check to skip server requests for English language
   - Enhanced initialization to avoid unnecessary server calls

3. **Updated response-handlers.js**:
   - Changed handler from `get_interface_language` to `update_interface_language`
   - Maintained backwards compatibility with existing response formats
   - Added proper language data handling

### Technical Flow:

**Before (causing errors):**
```javascript
// App sent this (unsupported):
{ task: 'get_interface_language', language: 'en', token: '...' }

// Server responded:
{ error: 'Invalid task' }
```

**After (fixed):**
```javascript
// For English (default):
// No server request - uses local default strings

// For other languages:
{ task: 'update_interface_language', language: 'es', token: '...' }

// Server responds with:
{ task: 'update_interface_language', language: 'es', language_data: {...} }
```

### Key Improvements:

1. **No more "Invalid task" errors**: Using existing `update_interface_language` task
2. **Reduced server load**: No requests for English (default language)
3. **Backwards compatible**: Still handles existing response formats
4. **Better initialization**: Only makes server requests when necessary

### Files Modified:
- `src/settings.js` - Fixed task name and added English skip logic
- `src/translation.js` - Updated initialization and auto-load functions  
- `src/response-handlers.js` - Updated response handler for correct task

The app should now work properly without WebSocket errors when changing languages or during initialization.
