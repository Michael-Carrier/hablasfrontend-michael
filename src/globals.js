// Configuration constants
const TESTING_MODE = false;
const EVENT_TYPE = ('ontouchstart' in window) ? 'touchend' : 'click';
const maxLogs = 1000;

// App State Variables
let isShowingDailyPages = false;
let selectedText = null;
let lines = [];
let lineNum = 0;
let language = "";
let isRecording = false;
let translationText = "";
let mediaRecorder;
let audioChunks = [];
let userPoints = 0;
let username = '';
let password = '';
let sourceLang = "";
let languageSel = "en";
let currentAudio = null;
let processingStartTime = 0;
let timerInterval = null;
let currentSentenceIndex = 0;
let currentMode = 'pagele'; // Track current mode: 'pagele' or 'freeread'
let allSentences = [];
let totalDailySentences = 10;
let currentDailySentences = [];
let lastSentencePosition = 0;
let sentenceToTranslate = "";
let dailyTranslationSentence = "translating daily sentence...";
let positionFirstDailySentence = 0;
let popupflag = false;
let isLoggedIn = false;
let userInfo = { username: '', points: 0, preferredLanguage: 'en' };
let currentRequestStartTime = null;
let currentRequestTask = '';
let ttsCache = {};
let translationCache = {}; // Cache for translation results
let lastTtsRequestDetails = null;
let lastTranslationRequestDetails = null; // Store translation request details for caching
let originalSentenceText = ""; // Store original sentence for hold-to-translate

// Subscription and access control
let userSubscriptionStatus = 'none';
let subscriptionUsage = { recording: 0, translation: 0, tts: 0 };
let specialAccess = null;
let hasSpecialAccess = false;
let lastSentenceToLoad = null; // For auto-loading last practiced sentence

// Pagele-specific variables
let completedIndices = {};
let pageleFilename = "";
let selectedBook = ""; // Currently selected book (for compatibility)
let pagele_language = 'en';
let currentChapter = null;
let currentChapterKey = null;
let pagele_data = null;
let translated_text = "";
let translate_down = false;
let pageleRecordingStartTime = null;

// Language mappings
const lang_conversion = {
    'Afrikaans': 'af',
    'Albanian': 'sq',
    'Amharic': 'am',
    'Arabic': 'ar',
    'Armenian': 'hy',
    'Azerbaijani': 'az',
    'Basque': 'eu',
    'Belarusian': 'be',
    'Bengali': 'bn',
    'Bosnian': 'bs',
    'Bulgarian': 'bg',
    'Catalan': 'ca',
    'Cebuano': 'ceb',
    'Chichewa': 'ny',
    'Chinese (Simplified)': 'zh-cn',
    'Chinese (Traditional)': 'zh-tw',
    'Corsican': 'co',
    'Croatian': 'hr',
    'Czech': 'cs',
    'Danish': 'da',
    'Dutch': 'nl',
    'English': 'en',
    'Esperanto': 'eo',
    'Estonian': 'et',
    'Filipino': 'tl',
    'Finnish': 'fi',
    'French': 'fr',
    'Frisian': 'fy',
    'Galician': 'gl',
    'Georgian': 'ka',
    'German': 'de',
    'Greek': 'el',
    'Gujarati': 'gu',
    'Haitian Creole': 'ht',
    'Hausa': 'ha',
    'Hawaiian': 'haw',
    'Hebrew': 'iw',
    'Hindi': 'hi',
    'Hmong': 'hmn',
    'Hungarian': 'hu',
    'Icelandic': 'is',
    'Igbo': 'ig',
    'Indonesian': 'id',
    'Irish': 'ga',
    'Italian': 'it',
    'Japanese': 'ja',
    'Javanese': 'jw',
    'Kannada': 'kn',
    'Kazakh': 'kk',
    'Khmer': 'km',
    'Korean': 'ko',
    'Kurdish (Kurmanji)': 'ku',
    'Kyrgyz': 'ky',
    'Lao': 'lo',
    'Latin': 'la',
    'Latvian': 'lv',
    'Lithuanian': 'lt',
    'Luxembourgish': 'lb',
    'Macedonian': 'mk',
    'Malagasy': 'mg',
    'Malay': 'ms',
    'Malayalam': 'ml',
    'Maltese': 'mt',
    'Maori': 'mi',
    'Marathi': 'mr',
    'Mongolian': 'mn',
    'Myanmar (Burmese)': 'my',
    'Nepali': 'ne',
    'Norwegian': 'no',
    'Odia': 'or',
    'Pashto': 'ps',
    'Persian': 'fa',
    'Polish': 'pl',
    'Portuguese': 'pt',
    'Punjabi': 'pa',
    'Romanian': 'ro',
    'Russian': 'ru',
    'Samoan': 'sm',
    'Scots Gaelic': 'gd',
    'Serbian': 'sr',
    'Sesotho': 'st',
    'Shona': 'sn',
    'Sindhi': 'sd',
    'Sinhala': 'si',
    'Slovak': 'sk',
    'Slovenian': 'sl',
    'Somali': 'so',
    'Spanish': 'es',
    'Sundanese': 'su',
    'Swahili': 'sw',
    'Swedish': 'sv',
    'Tajik': 'tg',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Thai': 'th',
    'Turkish': 'tr',
    'Ukrainian': 'uk',
    'Urdu': 'ur',
    'Uyghur': 'ug',
    'Uzbek': 'uz',
    'Vietnamese': 'vi',
    'Welsh': 'cy',
    'Xhosa': 'xh',
    'Yiddish': 'yi',
    'Yoruba': 'yo',
    'Zulu': 'zu'
};

// Interface language strings
let currentInterfaceLanguage = 'en';
let interfaceStrings = {
    login: 'Login',
    signup: 'Sign up',
    logout: 'Logout',
    settings: 'Settings',
    invalidCredentials: 'Invalid credentials',
    accountExists: 'Account already exists',
    accountCreated: 'Account created successfully',
    processingRecording: 'Processing recording...',
    recordingError: 'Recording error',
    translationError: 'Translation error',
    connectionError: 'Connection error',
    sendingBugReport: 'Sending bug report...',
    bugReportSent: 'Bug report sent successfully!',
    
    // Additional strings for comprehensive UI updates
    availableDailyPages: 'Available daily pages',
    tutorial: 'Tutorial',
    foundABug: 'Found a bug',
    selectPagele: 'Select a book',
    chapters: 'Chapters',
    translate: 'Translate',
    record: 'Record',
    prevSentence: 'Previous',
    nextSentence: 'Next',
    loading: 'Loading...',
    processing: 'Processing...',
    translating: 'Translating...',
    userAccountOptions: 'User account options',
    changeInfo: 'Change info',
    deleteAccount: 'Delete account',
    gdprTerms: 'GDPR terms',
    rememberMe: 'Remember me',
    acceptTerms: 'I accept them',
    email: 'E-mail',
    password: 'Password',
    nativeLanguage: 'Native language',
    supportHablas: 'Support Hablas'
};

// DOM element references
let loginScreen, pageleContent, pageleModal, chaptersModal, sentenceModal, drawer, fetchingDataStatusElement;

// Initialize DOM references when DOM is loaded
function initializeDOMReferences() {
    loginScreen = document.getElementById('login-screen');
    pageleContent = document.getElementById('pagele-content');
    pageleModal = document.getElementById('pagele-modal');
    chaptersModal = document.getElementById('chapters-modal');
    sentenceModal = document.getElementById('sentence-modal');
    drawer = document.getElementById('settings-drawer');
    fetchingDataStatusElement = document.getElementById('fetching-data-status');
    
    console.log('DOM references initialized:', {
        loginScreen: !!loginScreen,
        pageleContent: !!pageleContent,
        pageleModal: !!pageleModal
    });
}

// Initialize DOM references when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDOMReferences();
});