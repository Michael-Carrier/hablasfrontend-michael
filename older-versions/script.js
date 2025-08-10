const E=('ontouchstart' in window)?'touchend':'click';
let logs=[],maxLogs=1000,logContainer;
function setupLogging(){
  logContainer=document.createElement('div');
  logContainer.id='session-logs';
  logContainer.style.display='none';
  document.body.appendChild(logContainer);
}
function addLog(type,msg,...args){
  const t=new Date().toISOString();
  const entry={timestamp:t,type,message:typeof msg==='string'?msg:JSON.stringify(msg),args:args.map(a=>typeof a==='string'?a:JSON.stringify(a))};
  logs.push(entry);
  if(logs.length>maxLogs)logs=logs.slice(-maxLogs);
  if(logContainer){
    const el=document.createElement('div');
    el.textContent=`[${t}] ${type.toUpperCase()}: ${entry.message} ${entry.args.join(' ')}`;
    logContainer.appendChild(el);
    while(logContainer.children.length>maxLogs)logContainer.removeChild(logContainer.firstChild);
  }
}
const origConsole={log:console.log,error:console.error,warn:console.warn,info:console.info,debug:console.debug};
console.log=(msg,...args)=>{addLog('log',msg,...args);origConsole.log(msg,...args);};
console.error=(msg,...args)=>{addLog('error',msg,...args);origConsole.error(msg,...args);};
console.warn=(msg,...args)=>{addLog('warn',msg,...args);origConsole.warn(msg,...args);};
console.info=(msg,...args)=>{addLog('info',msg,...args);origConsole.info(msg,...args);};
console.debug=(msg,...args)=>{addLog('debug',msg,...args);origConsole.debug(msg,...args);};
window.addEventListener('error',e=>addLog('error',`Uncaught error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`,e.error?.stack||''));
window.addEventListener('unhandledrejection',e=>addLog('error',`Unhandled promise rejection: ${e.reason}`,e.reason?.stack||''));
function logEvent(msg,data=null){addLog('event',data?`${msg} | Data: ${JSON.stringify(data)}`:msg);}
console.log(`Using ${E} events for this device`);

let touchStartTime=0,touchStartY=0,touchStartX=0,touchMoved=false;
function createTouchAwareEventListener(callback){
  if('ontouchstart' in window){
    return function(element){
      let localMoved=false,localY=0,localX=0,localTime=0;
      element.addEventListener('touchstart',e=>{
        localMoved=false;
        const touch=e.touches[0];
        localY=touch.clientY;
        localX=touch.clientX;
        localTime=Date.now();
      },{passive:true});
      element.addEventListener('touchmove',e=>{
        if(e.touches.length>0){
          const touch=e.touches[0];
          const deltaY=Math.abs(touch.clientY-localY);
          const deltaX=Math.abs(touch.clientX-localX);
          if(deltaY>10||deltaX>10)localMoved=true;
        }
      },{passive:true});
      element.addEventListener('touchend',e=>{
        const duration=Date.now()-localTime;
        if(!localMoved&&duration<500){
          setTimeout(()=>{if(!localMoved)callback(e);},50);
        }
      },{passive:true});
    };
  }else{
    return function(element){element.addEventListener('click',callback);};
  }
}

let currentMode='init',currentBook=null,rendition=null,selectedText=null,lines=[],lineNum=0,language="",isRecording=false,translationText="",mediaRecorder,audioChunks=[],userPoints=0,cfi=null,username='',password='',sourceLang="",languageSel="en",selectedBook=null,selectedPage=null,currentAudio=null,processingStartTime=0,timerInterval=null,currentSentenceIndex=0,allSentences=[],totalDailySentences=10,currentDailySentences=[],lastSentencePosition=0,sentenceToTranslate="",dailyTranslationSentence="translating daily sentence...",positionFirstDailySentence=0,popupflag=false;

let completedIndices={},pageleFilename="",pagele_language='en',currentChapter=null,pagele_data=null,translated_text="",translate_down=false,isLoggedIn=false,userInfo={username:'',points:0},currentRequestStartTime=null,currentRequestTask='',ttsCache={},lastTtsRequestDetails=null;

const lang_conversion={
  "francais":"fr","english":"en","español":"es","espagnol":"es","spanish":"es",
  "deutsch":"de","italiano":"it","turkish":"tr",'french':'fr','italian':'it',
  'italiano':'it','portuguese':'pt'
};

let currentInterfaceLanguage='en';
let interfaceStrings={
  en:{
    appTitle:"Hablas",login:"Login",signup:"Sign up",dailyPages:"Daily pages",
    freeRead:"Free read",pleaseLoginToStart:"Please log in to start",email:"Email",
    password:"Password",settings:"Settings",switchToMode:"Switch to",
    nativeLanguage:"Native Language",tutorial:"Tutorial",supportHablas:"Support Hablas",
    foundABug:"Found a bug",sendingBugReport:"Sending bug report...",
    bugReportSent:"Bug report sent! Thank you for helping us improve.",
    bugReportError:"Error sending bug report. Please try again.",
    tapToBegin:"Tap here to begin!",selectPagele:"Select a Pagele",
    chapters:"Chapters",translate:"Translate",loading:"Loading...",
    translating:"Translating...",processing:"Processing...",fetchingData:"Fetching data...",
    parsingData:"Parsing data...",loadMore:"Load More",chapterTitle:"Chapter Title",
    points:"Points",prevSentence:"Previous",nextSentence:"Next",
    loggedInAs:"Logged in as",logout:"Logout",changeInfo:"Change info",
    deleteAccount:"Delete account",userAccountOptions:"User account options",
    completeYourTip:"Complete Your Tip",payNow:"Pay Now",customAmount:"Custom amount",
    tip:"Tip",thankYouForTip:"Thank you for your tip!",
    invalidCredentials:"Invalid credentials, have you signed up?",
    sessionExpired:"Your session has expired. Please log in again.",
    enterValidEmail:"Please enter a valid email address",
    passwordCannotBeEmpty:"Password cannot be empty",
    microphonePermissionRequired:"Microphone permission is required for recording.",
    couldNotAccessMicrophone:"Could not access microphone. Please check your browser permissions.",
    failedToStartRecording:"Failed to start recording. Please try again.",
    enterValidAmount:"Please enter a valid amount",errorLoadingTutorial:"Error loading tutorial content",
    pleaseTryAgain:"Please try again later.",noSentencesAvailable:"No sentences available for this chapter.",
    noChaptersAvailable:"No chapters available.",noPageleBooksAvailable:"No pagele books available.",
    reachedEndOfBook:"Reached end of book",errorRenderingBook:"Error rendering book",
    errorProcessingTip:"Error processing tip. Please try again."
  }
};

const abbreviations=['Mr.','Mrs.','Ms.','Dr.','Prof.','Sr.','Jr.','etc.','e.g.','i.e.','."'];

const fileInput=document.getElementById('fileInput'),
      modalDiv=document.getElementById('myModal'),
      returnSentenceDiv=document.getElementById('return_sentence'),
      fileDiv=document.getElementById("file"),
      pointsDisplay=document.getElementById("points-display"),
      settingsBtn=document.getElementById("settings"),
      userSection=document.getElementById("user-section"),
      drawer=document.getElementById('settings-drawer'),
      closeDrawerBtn=document.getElementById('close-drawer'),
      availableBooksBtn=document.getElementById('available-books'),
      recordBtn=document.getElementById('record'),
      textToSpeechBtn=document.getElementById('robot'),
      translation=document.getElementById('translation'),
      languageDisplay2=document.getElementById('userLanguages'),
      languageUserOptionsSelect=document.getElementById('languageUserOptions'),
      booksModal=document.getElementById('books-modal'),
      tutorialBtn=document.getElementById('tutorial'),
      usernameInput=document.getElementById('user-name'),
      passwordInput=document.getElementById('user-password'),
      loginButton=document.getElementById('login-button'),
      signupButton=document.getElementById('signup-button'),
      usernameInput2=document.getElementById('init-user-name'),
      passwordInput2=document.getElementById('init-user-password'),
      loginButton2=document.getElementById('init-login-button'),
      signupButton2=document.getElementById('init-signup-button'),
      initDailypages=document.getElementById('initDailypages'),
      initFreeRead=document.getElementById("initFreeRead"),
      initChoice=document.getElementById('initChoice'),
      div2viewer=document.getElementById('div2viewer');

const pageleContent=document.getElementById('pagele-content'),
      sentenceModal=document.getElementById('sentence-modal'),
      pageleModal=document.getElementById('pagele-modal'),
      sentenceElem=document.getElementById('sentence-container'),
      counterElem=document.getElementById('sentence-counter'),
      prevButton=document.getElementById('prev-sentence'),
      nextButton=document.getElementById('next-sentence'),
      recordingStatusPagele=document.getElementById('recording-status-pagele'),
      prediction=document.getElementById('prediction-container'),
      pointsSpanPagele=document.getElementById('points-pagele'),
      availablePageleBtn=document.getElementById('available-pagele'),
      closeSentenceModalBtn=document.getElementById('close-sentence-modal'),
      chaptersModal=document.getElementById('chapters-modal'),
      recordBtnPagele=document.getElementById('record-pagele'),
      robotBtnPagele=document.getElementById('robot-pagele'),
      closeChaptersModal=document.getElementById('close-chapters-modal'),
      modeSwitch=document.getElementById('mode-switch'),
      modeText=document.getElementById('mode-text'),
      fetchingDataStatusElement=document.getElementById('fetching-data-status');

const stripe=Stripe('pk_live_51R936ZH6FESgUvUmI0Gu1qfxauHRtqnx9Usx1UkQQgzOVGC2e5MIhKopUsPcSw1n3XfUF8qZyuL7ZGb1wYUOR8DG007A0ipkpw');
let elements,subscriptionElements=null;

let userSubscriptionStatus='none',dailyUsageCount=0,dailyUsageLimit=10,monthlyBookLimit=1;
let currentUsername='',currentToken='',currentSubscriptionStatus='none',specialAccess='none',hasSpecialAccess=false,currentUserInfo={};

console.log("starting script");

function createWebSocketConnection(){
  const socket=new WebSocket('wss://carriertech.uk:8675');
  socket.addEventListener('open',event=>console.log('WebSocket connection established'));
  socket.addEventListener('error',error=>console.error('WebSocket error:',error));
  socket.addEventListener('message',async event=>{
    console.log("message received:",event);
    await handleWebSocketMessage(event);
  });
  socket.addEventListener('close',event=>console.log('WebSocket connection closed',event.code,event.reason));
  return socket;
}

async function handleWebSocketMessage(event){
  const start=performance.now();
  if(fetchingDataStatusElement)fetchingDataStatusElement.style.display='flex';
  
  console.log("Type of event.data:",typeof event.data,"Is Blob?",event.data instanceof Blob,"Is ArrayBuffer?",event.data instanceof ArrayBuffer);
  
  let jsonString,parsedResponseObject=null;
  let conversionStartTime,conversionEndTime,parsingStartTime,parsingEndTime,afterConversionTime,afterParsingTime;

  if(event.data instanceof ArrayBuffer){
    console.log("Received ArrayBuffer, decoding...");
    try{
      conversionStartTime=performance.now();
      const decoder=new TextDecoder("utf-8");
      jsonString=decoder.decode(event.data);
      conversionEndTime=performance.now();
      console.log(`ArrayBuffer decoding took ${(conversionEndTime-conversionStartTime).toFixed(2)} ms`);
    }catch(e){
      console.error("Error decoding ArrayBuffer:",e);
      hideStatusIndicators();
      return;
    }
  }else if(event.data instanceof Blob){
    console.log("Received Blob, reading as text...");
    try{
      conversionStartTime=performance.now();
      jsonString=await event.data.text();
      conversionEndTime=performance.now();
      console.log(`Blob.text() took ${(conversionEndTime-conversionStartTime).toFixed(2)} ms`);
    }catch(e){
      console.error("Error reading Blob as text:",e);
      hideStatusIndicators();
      return;
    }
  }else if(typeof event.data==='string'){
    console.log("Received string directly.");
    jsonString=event.data;
  }else{
    console.error("Received WebSocket message of unknown type:",event.data);
    hideStatusIndicators();
    return;
  }

  afterConversionTime=performance.now();
  console.log(`Time from start to after data conversion: ${(afterConversionTime-start).toFixed(2)} ms`);

  if(typeof jsonString==='string'){
    try{
      parsingStartTime=performance.now();
      parsedResponseObject=JSON.parse(jsonString);
      parsingEndTime=performance.now();
      console.log(`JSON.parse() took ${(parsingEndTime-parsingStartTime).toFixed(2)} ms`);
    }catch(e){
      console.error("Error parsing JSON string:",e);
      console.error("Original string that failed parsing:",jsonString);
      hideStatusIndicators();
      return;
    }
  }else{
    console.error("Could not convert event.data to a string for parsing.");
    hideStatusIndicators();
    return;
  }
  
  afterParsingTime=performance.now();
  console.log(`Time from start to after JSON parsing: ${(afterParsingTime-start).toFixed(2)} ms`);

  if(fetchingDataStatusElement)fetchingDataStatusElement.style.display='none';
  
  const end=performance.now();
  console.log(`Overall message parsing took ${(end-start).toFixed(2)} ms`);
  console.log("Received WebSocket message (parsed successfully):",parsedResponseObject);
  
  await handleResponse(parsedResponseObject);
}

function hideStatusIndicators(){
  const statusIndicator=document.getElementById('recording-status'),
        statusIndicatorPagele=document.getElementById('recording-status-pagele'),
        fetchingData=document.getElementById('fetching-data-status');
  
  if(statusIndicator&&statusIndicator.style.display!=='none'){
    clearInterval(timerInterval);
    statusIndicator.style.display='none';
    if(processingStartTime)processingStartTime=0;
  }
  if(statusIndicatorPagele&&statusIndicatorPagele.style.display!=='none'){
    clearInterval(timerInterval);
    statusIndicatorPagele.style.display='none';
    if(processingStartTime)processingStartTime=0;
  }
  if(fetchingData)fetchingData.style.display='none';
}

async function handleResponse(response){
  hideStatusIndicators();
  if(!response){
    console.error("Response is null, cannot proceed with message handling.");
    return;
  }

  if(Array.isArray(response)){
    console.log('Received pagele list array directly');
    displayPageleList(response);
  }else if(response.status==="success"&&response.hasOwnProperty('username')){
    handleAuthSuccess(response);
  }else if(response.type==='token_verification_result'){
    handleTokenVerification(response);
  }else if(response.hasOwnProperty('books')){
    handleBooksResponse(response);
  }else if(response.hasOwnProperty('pred_sentence')){
    handlePredSentence(response);
  }else if(response.hasOwnProperty('translation')||(response.status==='success'&&response.hasOwnProperty('translated_text'))){
    handleTranslationResponse(response);
  }else if(response.hasOwnProperty('translated_words')){
    handleTranslatedWords(response);
  }else if(response.hasOwnProperty('token')){
    handleTokenResponse(response);
  }else if(response.status==='success'&&response.hasOwnProperty('epub')){
    handleBookDataResponse(response);
  }else if(response.status==='success'&&response.hasOwnProperty('audio')){
    handleTTSResponse(response);
  }else if(response.type==='pagele_list'){
    displayPageleList(response.pagele_books);
  }else if(response.type==='get_pagele'){
    displayChaptersGrid(response);
  }else if(response.status==='success'&&response.client_secret&&!response.subscription_id){
    handlePaymentResponse(response);
  }else if(response.status==='success'&&response.setup_intent_client_secret){
    setupSubscriptionElements(response.setup_intent_client_secret);
  }else if(response.status==='success'&&(response.subscription_id||response.subscription_status)){
    await handleSubscriptionResponse(response);
  }else if(response.status==='success'&&response.hasOwnProperty('old_status')&&response.hasOwnProperty('new_status')){
    userSubscriptionStatus=response.new_status;
    updateSubscriptionUI();
    console.log(`Subscription status synced: ${response.old_status} → ${response.new_status}`);
  }else if(response.message==="Invalid credentials"){
    alert(getInterfaceString('invalidCredentials'));
  }else if(response.hasOwnProperty('access_type')||response.hasOwnProperty('has_special_access')||response.hasOwnProperty('previous_access')){
    handleAdminResponse(response);
  }else if(response.hasOwnProperty('filename')){
    handleBookFilenameResponse(response);
  }else if(response.hasOwnProperty('interface_language')){
    console.log("Received interface language:",response.interface_language);
    applyInterfaceStrings(response.interface_language);
  }else if(response.type==='bug_report_sent'){
    console.log('Bug report sent successfully');
  }else if(response&&response.preferred_language&&typeof response.preferred_language==='string'){
    userInfo.preferredLanguage=response.preferred_language;
    console.log("Found preferred language in response:",response.preferred_language);
    const languageSelect=document.getElementById('languageUserOptions');
    if(languageSelect)languageSelect.value=response.preferred_language;
  }else{
    console.log("Unhandled response from server:",response);
  }
}

let socket=createWebSocketConnection();

function sendSocketMessage(message){
  if(socket.readyState!==WebSocket.OPEN){
    console.log('Socket not open, creating new connection');
    socket=createWebSocketConnection();
    socket.addEventListener('open',()=>socket.send(JSON.stringify(message)),{once:true});
  }else{
    socket.send(JSON.stringify(message));
  }
  if(fetchingDataStatusElement)fetchingDataStatusElement.style.display='flex';
}

function switchToMode(mode){
  document.getElementById('initChoice').style.display='none';
  document.getElementById('div2viewer').style.display='none';
  document.getElementById('pagele-content').style.display='none';
  
  switch(mode){
    case 'init':
      document.getElementById('initChoice').style.display='flex';
      currentMode='init';
      break;
    case 'freeread':
      document.getElementById('div2viewer').style.display='flex';
      currentMode='freeread';
      loadAvailableBooks();
      modeText.textContent='Daily Pages';
      break;
    case 'pagele':
      document.getElementById('pagele-content').style.display='block';
      currentMode='pagele';
      modeText.textContent='Free Read';
      if(pageleModal.style.display!=='block'&&sentenceModal.style.display!=='block'&&chaptersModal.style.display!=='block'){
        requestPageleList();
      }
      break;
  }
}

function handleAuthSuccess(response){
  console.log("Auth success:",response);
  logEvent('User authentication successful',{username:response.username});
  
  if(response.token)localStorage.setItem('token',response.token);
  if(response.username){
    localStorage.setItem('username',response.username);
    userInfo.username=response.username;
    if(response.username==='admin'){
      const adminSection=document.getElementById('admin-section');
      if(adminSection)adminSection.style.display='block';
    }
  }
  
  isLoggedIn=true;
  if(response.points)userInfo.points=response.points;
  if(response.preferred_language){
    userInfo.preferredLanguage=response.preferred_language;
    console.log("Stored preferred language from auth:",response.preferred_language);
    const languageSelect=document.getElementById('languageUserOptions');
    if(languageSelect)languageSelect.value=response.preferred_language;
  }
  
  if(response.subscription_status){
    userSubscriptionStatus=response.subscription_status;
    console.log("Received subscription status:",userSubscriptionStatus);
  }else{
    userSubscriptionStatus='none';
    console.log("No subscription status in response, defaulting to 'none'");
  }
  
  if(response.special_access){
    specialAccess=response.special_access;
    hasSpecialAccess=response.has_special_access||false;
    console.log("Received special access:",specialAccess,"Active:",hasSpecialAccess);
  }
  
  updateAuthUI(true,response);
  drawer.classList.remove('open');
}

function handleTokenVerification(response){
  if(response.success){
    console.log('Token verification successful');
    isLoggedIn=true;
    
    if(response.user_data&&response.user_data.username){
      userInfo.username=response.user_data.username;
      if(response.user_data.points)userInfo.points=response.user_data.points;
      if(response.user_data.preferred_language)userInfo.preferredLanguage=response.user_data.preferred_language;
    }
    
    if(response.subscription_status){
      userSubscriptionStatus=response.subscription_status;
      console.log("Token verification - subscription status:",userSubscriptionStatus);
    }else{
      userSubscriptionStatus='none';
      console.log("Token verification - no subscription status, defaulting to 'none'");
    }
    
    if(response.special_access){
      specialAccess=response.special_access;
      hasSpecialAccess=response.has_special_access||false;
      console.log("Token verification - special access:",specialAccess,"Active:",hasSpecialAccess);
    }
    
    updateAuthUI(true,response);
    updateSubscriptionUI();
    
    if(!response.user_data||!response.user_data.selected_pagele){
      // User can choose mode
    }
  }else{
    console.log('Token verification failed');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    handleInvalidToken();
  }
}

function handleInvalidToken(){
  isLoggedIn=false;
  updateAuthUI(false);
  alert(getInterfaceString('sessionExpired'));
  switchToMode('init');
}

function updateAuthUI(isLoggedIn,responseData=null){
  const loginSignupContainer=document.getElementById('login-singup'),
        usernameInput=document.getElementById('user-name'),
        passwordInput=document.getElementById('user-password'),
        initLoginSection=document.getElementById('init-login-section');
  
  if(isLoggedIn){
    loginSignupContainer.style.display='none';
    usernameInput.style.display='none';
    passwordInput.style.display='none';
    if(initLoginSection)initLoginSection.style.display='none';
    
    if(userInfo.preferredLanguage){
      sendSocketMessage({
        task:'update_interface_language',
        language:userInfo.preferredLanguage,
        token:localStorage.getItem('token')
      });
    }
    
    initDailypages.classList.remove('disabled');
    initFreeRead.classList.remove('disabled');
    
    if(responseData&&responseData.language){
      sourceLang=responseData.language;
      languageSel=setLanguage(sourceLang);
    }
    
    checkSubscriptionStatus();
    
    const today=new Date().toDateString();
    const savedDate=localStorage.getItem('lastUsageDate');
    if(savedDate===today){
      dailyUsageCount=parseInt(localStorage.getItem('dailyUsageCount')||'0');
    }else{
      dailyUsageCount=0;
      localStorage.setItem('lastUsageDate',today);
      localStorage.setItem('dailyUsageCount','0');
    }
    
    updateUIWithSubscriptionLimits();
    
    const userInfoDiv=document.createElement('div');
    userInfoDiv.id='user-info';
    userInfoDiv.className='options';
    userSection.textContent=userInfo.username;
    userInfoDiv.innerHTML=`
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span>${getInterfaceString('loggedInAs')}: ${userInfo.username}</span>
        <button id="logout-button" class="small-button">${getInterfaceString('logout')}</button>
      </div>
    `;
    
    const settingsOptions=document.getElementById('settings-options');
    settingsOptions.insertBefore(userInfoDiv,document.getElementById('available-books'));
    
    document.getElementById('logout-button').addEventListener(E,handleLogout);

    if(responseData&&responseData.current_book&&responseData.epub){
      selectedBook=responseData.current_book;
      console.log("selectedBook:",selectedBook);
      selectedPage=responseData.page||0;
      language=responseData.language;
      languageSel=setLanguage(language);
      console.log("Loading user's current book:",selectedBook);
      
      const base64Data=responseData.epub.split(',')[1];
      const mimeString=responseData.epub.split(',')[0].split(':')[1].split(';')[0];
      const byteString=atob(base64Data);
      const ab=new ArrayBuffer(byteString.length);
      const ia=new Uint8Array(ab);
      
      for(let i=0;i<byteString.length;i++)ia[i]=byteString.charCodeAt(i);
      
      const blob=new Blob([ab],{type:mimeString});
      cfi=responseData.cfi;
      
      renderEpub(blob,responseData.cfi).then(()=>{
        if(selectedPage&&rendition)rendition.display(selectedPage);
      }).catch(error=>{
        console.error('Error rendering book:',error);
      });
    }
  }else{
    loginSignupContainer.style.display='flex';
    usernameInput.style.display='block';
    passwordInput.style.display='block';
    if(initLoginSection)initLoginSection.style.display='block';
    
    initDailypages.classList.add('disabled');
    initFreeRead.classList.add('disabled');
    
    const userInfo=document.getElementById('user-info');
    if(userInfo)userInfo.remove();
    
    updateSubscriptionUI();
  }
}

function handleLogout(){
  logEvent('User logged out');
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  userSection.innerHTML="Login";
  updateAuthUI(false);
  
  username='';
  password='';
  drawer.classList.remove('open');
  
  switchToMode('init');
  
  sendSocketMessage({task:"logout",username:username});
}

async function handleSubscriptionResponse(response){
  console.log('Received subscription response:',response);
  
  if(response.status==='success'){
    if(response.subscription_id){
      document.getElementById('subscription-modal').style.display='none';
      alert('Subscription activated successfully!');
      userSubscriptionStatus=response.subscription_status||'active';
      updateSubscriptionUI();
    }else if(response.subscription_status){
      userSubscriptionStatus=response.subscription_status;
      updateSubscriptionUI();
      
      if(response.subscription_status==='canceled'){
        alert('Subscription has been cancelled. You will have access until the end of your billing period.');
      }
    }else if(response.client_secret){
      const {error}=await stripe.confirmPayment({
        clientSecret:response.client_secret,
        confirmParams:{return_url:window.location.origin},
        redirect:'if_required'
      });
      
      if(error){
        console.error('Payment confirmation error:',error);
        alert('Payment failed: '+error.message);
      }else{
        alert('Payment updated successfully!');
        checkSubscriptionStatus();
      }
    }
  }else{
    const messageDiv=document.getElementById('subscription-message');
    messageDiv.textContent=response.message||'Error processing subscription';
    
    const subscribeBtn=document.getElementById('subscribe-button');
    if(subscribeBtn){
      subscribeBtn.disabled=false;
      subscribeBtn.textContent='Start Subscription';
    }
  }
}

function checkSubscriptionStatus(){
  sendSocketMessage({task:'get_subscription_status',token:localStorage.getItem('token')});
}

function updateSubscriptionUI(){
  const subscriptionSection=document.getElementById('subscription-section'),
        statusDisplay=document.getElementById('subscription-status-display'),
        manageBtn=document.getElementById('manage-subscription-btn');
  
  if(!isLoggedIn){
    subscriptionSection.style.display='none';
    return;
  }
  
  subscriptionSection.style.display='block';
  
  switch(userSubscriptionStatus){
    case 'active':
      statusDisplay.textContent='Active Subscription - £5/month';
      statusDisplay.className='subscription-status active';
      manageBtn.textContent='Cancel Subscription';
      manageBtn.className='subscription-button cancel';
      manageBtn.onclick=cancelSubscription;
      break;
    case 'past_due':
      statusDisplay.textContent='Payment Failed - Please update payment method';
      statusDisplay.className='subscription-status pending';
      manageBtn.textContent='Update Payment';
      manageBtn.className='subscription-button subscribe';
      manageBtn.onclick=startSubscription;
      break;
    case 'canceling':
      statusDisplay.textContent='Subscription will end at period close';
      statusDisplay.className='subscription-status pending';
      manageBtn.textContent='Reactivate Subscription';
      manageBtn.className='subscription-button subscribe';
      manageBtn.onclick=startSubscription;
      break;
    case 'canceled':
    case 'none':
    default:
      statusDisplay.textContent='No active subscription';
      statusDisplay.className='subscription-status inactive';
      manageBtn.textContent='Subscribe for £5/month';
      manageBtn.className='subscription-button subscribe';
      manageBtn.onclick=startSubscription;
      break;
  }
  
  updateUIWithSubscriptionLimits();
}

function startSubscription(){
  document.getElementById('subscription-modal').style.display='block';
  drawer.classList.remove('open');
  setTimeout(()=>drawer.style.display='none',300);
  initializeSubscriptionPayment();
}

function initializeSubscriptionPayment(){
  sendSocketMessage({task:'create_setup_intent',token:localStorage.getItem('token')});
}

function setupSubscriptionElements(clientSecret){
  subscriptionElements=stripe.elements({
    clientSecret:clientSecret,
    appearance:{
      theme:'stripe',
      variables:{
        colorPrimary:'#28a745',
        colorBackground:'#ffffff',
        colorText:'#30313d'
      }
    }
  });

  const paymentElement=subscriptionElements.create('payment');
  paymentElement.mount('#subscription-payment-element');

  const subscribeBtn=document.getElementById('subscribe-button');
  subscribeBtn.onclick=async(e)=>{
    e.preventDefault();
    subscribeBtn.disabled=true;
    subscribeBtn.textContent='Processing...';
    
    const {error,setupIntent}=await stripe.confirmSetup({
      elements:subscriptionElements,
      confirmParams:{return_url:window.location.origin},
      redirect:'if_required'
    });

    if(error){
      const messageDiv=document.getElementById('subscription-message');
      messageDiv.textContent=error.message;
      subscribeBtn.disabled=false;
      subscribeBtn.textContent='Start Subscription';
    }else if(setupIntent&&setupIntent.payment_method){
      sendSocketMessage({
        task:'create_subscription',
        payment_method_id:setupIntent.payment_method,
        token:localStorage.getItem('token')
      });
    }
  };
}

function cancelSubscription(){
  if(confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.')){
    sendSocketMessage({task:'cancel_subscription',token:localStorage.getItem('token')});
  }
}

function hasActiveSubscription(){
  return userSubscriptionStatus==='active'||hasSpecialAccess;
}

function canUseRecording(){
  if(hasActiveSubscription())return true;
  
  const today=new Date().toDateString();
  const savedDate=localStorage.getItem('lastUsageDate');
  const savedCount=parseInt(localStorage.getItem('dailyUsageCount')||'0');
  
  if(savedDate!==today){
    dailyUsageCount=0;
    localStorage.setItem('lastUsageDate',today);
    localStorage.setItem('dailyUsageCount','0');
  }else{
    dailyUsageCount=savedCount;
  }
  
  return dailyUsageCount<dailyUsageLimit;
}

function incrementUsage(){
  if(!hasActiveSubscription()){
    dailyUsageCount++;
    localStorage.setItem('dailyUsageCount',dailyUsageCount.toString());
  }
}

function showUpgradePrompt(message){
  const upgradeMessage=message||`You've reached your daily limit of ${dailyUsageLimit} recordings. Upgrade to Premium for unlimited access!`;
  if(confirm(upgradeMessage+'\n\nWould you like to upgrade now?'))startSubscription();
}

function canAccessBook(bookFilename=null){
  if(hasActiveSubscription())return true;
  
  const accessedBooks=JSON.parse(localStorage.getItem('accessedBooks')||'[]');
  const currentMonth=new Date().getMonth()+'-'+new Date().getFullYear();
  const monthlyBooks=accessedBooks.filter(book=>book.month===currentMonth);
  
  if(bookFilename){
    const hasAccessedThisBook=monthlyBooks.some(book=>book.filename===bookFilename);
    if(hasAccessedThisBook)return true;
  }
  
  return monthlyBooks.length<monthlyBookLimit;
}

function trackBookAccess(bookFilename){
  if(!hasActiveSubscription()){
    const accessedBooks=JSON.parse(localStorage.getItem('accessedBooks')||'[]');
    const currentMonth=new Date().getMonth()+'-'+new Date().getFullYear();
    
    const existingEntry=accessedBooks.find(book=>book.filename===bookFilename&&book.month===currentMonth);
    
    if(!existingEntry){
      accessedBooks.push({
        filename:bookFilename,
        month:currentMonth,
        accessDate:new Date().toISOString()
      });
      localStorage.setItem('accessedBooks',JSON.stringify(accessedBooks));
    }
  }
}

function showBookLimitPrompt(){
  const message=`Free users can access ${monthlyBookLimit} book per month. Upgrade to Premium for unlimited book access!`;
  showUpgradePrompt(message);
}

function updateUIWithSubscriptionLimits(){
  const statusText=document.createElement('div');
  statusText.id='subscription-status-text';
  statusText.style.cssText='position: fixed; top: 60px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; z-index: 1000;';
  
  if(hasActiveSubscription()){
    if(hasSpecialAccess){
      if(specialAccess==='lifetime_free'){
        statusText.textContent='✓ Lifetime Free Access';
      }else if(specialAccess==='free_month'){
        statusText.textContent='✓ Free Month Access';
      }else if(specialAccess==='premium_trial'){
        statusText.textContent='✓ Premium Trial';
      }else{
        statusText.textContent='✓ Special Access';
      }
      statusText.style.background='rgba(138, 43, 226, 0.9)';
    }else{
      statusText.textContent='✓ Premium Active';
      statusText.style.background='rgba(40, 167, 69, 0.9)';
    }
  }else{
    const remainingRecordings=Math.max(0,dailyUsageLimit-dailyUsageCount);
    statusText.textContent=`Free: ${remainingRecordings}/${dailyUsageLimit} recordings left today`;
    statusText.style.background='rgba(220, 53, 69, 0.9)';
  }
  
  const existing=document.getElementById('subscription-status-text');
  if(existing)existing.remove();
  
  document.body.appendChild(statusText);
}

function handleAdminResponse(response){
  console.log("Admin response:",response);
  
  if(response.status==='success'){
    if(response.access_type||response.previous_access){
      showAdminMessage(response.message,'success');
    }else if(response.hasOwnProperty('has_special_access')){
      const info=response.access_info;
      let message=`User access status:\nType: ${info.type}\nActive: ${info.active}`;
      if(info.expiry)message+=`\nExpiry: ${new Date(info.expiry).toLocaleString()}`;
      if(info.granted_by)message+=`\nGranted by: ${info.granted_by}`;
      if(info.notes)message+=`\nNotes: ${info.notes}`;
      showAdminMessage(message,'success');
    }
  }else{
    showAdminMessage(response.message||'Admin operation failed','error');
  }
}

function grantSpecialAccess(){
  const targetUsername=document.getElementById('admin-target-username').value,
        accessType=document.getElementById('admin-access-type').value,
        duration=parseInt(document.getElementById('admin-duration').value),
        notes=document.getElementById('admin-notes').value;
  
  if(!targetUsername){
    showAdminMessage('Please enter a target username','error');
    return;
  }
  
  sendSocketMessage({
    task:'grant_special_access',
    admin_token:localStorage.getItem('token'),
    target_username:targetUsername,
    access_type:accessType,
    duration_days:duration,
    notes:notes
  });
}

function revokeSpecialAccess(){
  const targetUsername=document.getElementById('admin-target-username').value;
  
  if(!targetUsername){
    showAdminMessage('Please enter a target username','error');
    return;
  }
  
  sendSocketMessage({
    task:'revoke_special_access',
    admin_token:localStorage.getItem('token'),
    target_username:targetUsername
  });
}

function checkSpecialAccess(){
  const targetUsername=document.getElementById('admin-target-username').value;
  
  if(!targetUsername){
    showAdminMessage('Please enter a target username','error');
    return;
  }
  
  sendSocketMessage({task:'check_special_access',token:localStorage.getItem('token')});
}

function showAdminMessage(message,type){
  const messageDiv=document.getElementById('admin-message');
  messageDiv.textContent=message;
  messageDiv.style.display='block';
  
  if(type==='success'){
    messageDiv.style.backgroundColor='#d4edda';
    messageDiv.style.color='#155724';
    messageDiv.style.border='1px solid #c3e6cb';
  }else if(type==='error'){
    messageDiv.style.backgroundColor='#f8d7da';
    messageDiv.style.color='#721c24';
    messageDiv.style.border='1px solid #f5c6cb';
  }else{
    messageDiv.style.backgroundColor='#e2e3e5';
    messageDiv.style.color='#383d41';
    messageDiv.style.border='1px solid #d6d8db';
  }
  
  setTimeout(()=>messageDiv.style.display='none',5000);
}

function handleBooksResponse(response){
  const booksByLanguage=response.books.reduce((acc,book)=>{
    if(!acc[book.language])acc[book.language]=[];
    acc[book.language].push(book);
    return acc;
  },{});
  
  const booksGrid=document.getElementById('books-grid');
  booksGrid.innerHTML='';
  
  Object.entries(booksByLanguage).forEach(([language,languageBooks])=>{
    const languageSection=document.createElement('div');
    languageSection.className='language-section';
    
    const languageHeader=document.createElement('h2');
    languageHeader.textContent=language.charAt(0).toUpperCase()+language.slice(1);
    languageSection.appendChild(languageHeader);
    
    const booksContainer=document.createElement('div');
    booksContainer.className='books-container';
    
    languageBooks.forEach(book=>{
      const bookElement=document.createElement('div');
      bookElement.className='book';

      const img=document.createElement('img');
      if(book.cover&&book.cover.startsWith('data:')){
        img.src=book.cover;
      }else{
        img.src='images/default-cover.png';
        console.error('Invalid cover data for book:',book.filename);
      }
      img.alt=book.filename;
    
      const title=document.createElement('div');
      title.className='book-title';
      title.textContent=book.filename.replace('.epub','');
      
      if(!hasActiveSubscription()&&!canAccessBook(book.filename)){
        const premiumBadge=document.createElement('div');
        premiumBadge.style.cssText='position: absolute; top: 5px; right: 5px; background: gold; color: black; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;';
        premiumBadge.textContent='PREMIUM';
        bookElement.style.position='relative';
        bookElement.appendChild(premiumBadge);
        bookElement.style.opacity='0.6';
      }
      
      bookElement.appendChild(img);
      bookElement.appendChild(title);
      
      const addBookEventListener=createTouchAwareEventListener(async(e)=>{
        if(!canAccessBook(book.filename)){
          showBookLimitPrompt();
          return;
        }

        title.textContent="Loading...";
        trackBookAccess(book.filename);
        
        sendSocketMessage({
          task:"get_book_data",
          filename:book.filename,
        });
      });
      addBookEventListener(bookElement);
      
      booksContainer.appendChild(bookElement);
    });
    
    languageSection.appendChild(booksContainer);
    booksGrid.appendChild(languageSection);
  });
}

function handlePredSentence(response){
  console.log("handlePredSentence:",response);
  const predSentence=response.pred_sentence;
  console.log("predSentence:",predSentence);
  
  if(currentMode==='freeread'){
    returnSentenceDiv.innerHTML=predSentence;
    
    document.querySelectorAll('.wrong').forEach(wrongWord=>{
      wrongWord.addEventListener(E,event=>{
        document.querySelectorAll('.wrong').forEach(w=>w.classList.remove('pressed'));
        wrongWord.classList.add('pressed');
        
        const correctWord=wrongWord.id;
        console.log("Correct word:",correctWord);
        
        if(correctWord&&!popupflag)createPopup(correctWord,event);
      });
    });
    
    const pointsDisplay=document.getElementById('points-display');
    pointsDisplay.style.display='block';
    
    const wrongElements=document.getElementsByClassName("wrong");
    const correctWords=response.points;
    
    const pointsEarned=correctWords*10;
    userPoints+=pointsEarned;
    updatePointsDisplay(userPoints);
  }else if(currentMode==='pagele'){
    console.log("Received prediction for pagele:",response);
    
    prediction.innerHTML=predSentence;
    
    document.querySelectorAll('.wrong').forEach(wrongWord=>{
      wrongWord.addEventListener('click',event=>{
        const correctWord=wrongWord.id;
        if(correctWord)textToSpeech(correctWord);
      });
    });
    
    pointsSpanPagele.innerHTML=response.points;
    completedIndices[currentChapter][currentSentenceIndex]=response.points;
  }
}

function handleTranslationResponse(response){
  const translatedText=response.translated_text||response.translation;
  console.log("Current mode:",currentMode);
  console.log("Received translation:",translatedText);
  
  if(currentMode==='pagele'){
    console.log("Updating pagele sentence with translation");
    sentenceElem.innerHTML=translatedText;
    translated_text=translatedText;
    console.log("Updated sentence element with translation");
  }else{
    console.log("Updating free reading translation");
    translation.innerHTML=translatedText;
    console.log("Updated translation with:",translatedText);
    
    if(modalDiv.style.display!=='block'){
      console.log("Modal was not visible, making it visible");
      modalDiv.style.display='block';
    }
    
    translation.style.display='block';
    translation.style.visibility='visible';
  }
}

function handleTranslatedWords(response){
  console.log("translated_text:",response.translated_words);
  if(translate_down)sentenceElem.innerHTML=response.translated_words;
  translated_text=response.translated_words;
  translation.innerHTML=translated_text;
}

function handleTokenResponse(response){
  console.log("Token response:",response);
  localStorage.setItem('token',response.token);
  username=response.username;
  console.log("username:",username);
  
  if(response.language){
    sourceLang=response.language;
    if(languageSel)languageSel=setLanguage(sourceLang);
  }
  
  updateAuthUI(true,response);
  drawer.classList.remove('open');
}

function handleBookDataResponse(response){
  console.log("response:",response);
  
  selectedBook=response.filename;
  console.log("Set selectedBook:",selectedBook);

  sourceLang=response.language;
  languageSel=setLanguage(sourceLang);
  console.log("epub:",response.epub);
  
  const base64Data=response.epub.split(',')[1];
  console.log("Base64 data:",base64Data);
  
  if(!base64Data)throw new Error('Invalid EPUB data format');

  const mimeString=response.epub.split(',')[0].split(':')[1].split(';')[0];
  const byteString=atob(base64Data);
  const ab=new ArrayBuffer(byteString.length);
  const ia=new Uint8Array(ab);
  
  for(let i=0;i<byteString.length;i++)ia[i]=byteString.charCodeAt(i);
  
  const blob=new Blob([ab],{type:mimeString});
  
  renderEpub(blob).then(()=>{
    if(response.page)rendition.display(response.page);
    if(booksModal)booksModal.style.display='none';
  }).catch(error=>{
    console.error('Error rendering book:',error);
    alert('Error rendering book: '+error.message);
  });
}

function handleTTSResponse(response){
  console.log("Received TTS response:",response);
  
  if(currentAudio){
    currentAudio.pause();
    currentAudio.currentTime=0;
  }
  
  const audio=new Audio(response.audio);
  currentAudio=audio;
  
  let robotBtn;
  if(currentMode==='freeread'){
    robotBtn=document.getElementById('robot');
  }else if(currentMode==='pagele'){
    robotBtn=document.getElementById('robot-pagele');
  }
  
  if(robotBtn){
    robotBtn.setAttribute('data-speaking','true');
    robotBtn.style.filter='brightness(0.7)';
  }
  
  audio.onended=()=>{
    console.log('Speech ended');
    if(robotBtn){
      robotBtn.setAttribute('data-speaking','false');
      robotBtn.style.filter='brightness(1)';
    }
    currentAudio=null;
  };
  
  audio.onerror=e=>{
    console.error('Speech error:',e);
    if(robotBtn){
      robotBtn.setAttribute('data-speaking','false');
      robotBtn.style.filter='brightness(1)';
    }
    currentAudio=null;
  };
  
  audio.play();
}

function handlePaymentResponse(response){
  elements=stripe.elements({
    clientSecret:response.client_secret,
    appearance:{
      theme:'stripe',
      variables:{
        colorPrimary:'#0570de',
        colorBackground:'#ffffff',
        colorText:'#30313d'
      }
    }
  });

  const paymentElement=elements.create('payment');
  paymentElement.mount('#payment-element');

  document.getElementById('submit-payment').addEventListener(E,async(e)=>{
    e.preventDefault();
    
    const {error,paymentIntent}=await stripe.confirmPayment({
      elements,
      confirmParams:{return_url:window.location.origin},
      redirect:'if_required'
    });

    if(error){
      const messageDiv=document.getElementById('payment-message');
      messageDiv.textContent=error.message;
      console.error('Payment error:',error);
    }else if(paymentIntent&&paymentIntent.status==='succeeded'){
      document.getElementById('payment-modal').style.display='none';
      alert(getInterfaceString('thankYouForTip'));
    }else if(paymentIntent&&paymentIntent.status==='requires_action'){
       const messageDiv=document.getElementById('payment-message');
        messageDiv.textContent='Further action is required to complete your payment. Please follow the prompts from your bank.';
    }else{
      const messageDiv=document.getElementById('payment-message');
      messageDiv.textContent='Payment processing. You will be redirected if necessary.';
    }
  });
}

function handleBookFilenameResponse(response){
  const epubData=response.epub;
  const base64Data=epubData.split(',')[1];
  if(!base64Data)throw new Error('Invalid EPUB data format');
  
  const byteString=atob(base64Data);
  const mimeString=epubData.split(',')[0].split(':')[1].split(';')[0];
  const ab=new ArrayBuffer(byteString.length);
  const ia=new Uint8Array(ab);
  
  for(let i=0;i<byteString.length;i++)ia[i]=byteString.charCodeAt(i);
  
  const blob=new Blob([ab],{type:mimeString});
  renderEpub(blob);
  booksModal.style.display='none';
  
  languageSel=setLanguage(language);
  selectedBook=response.filename;
  console.log("selected",selectedBook);
}

function applyInterfaceStrings(strings){
  localStorage.setItem('interface_language',JSON.stringify(strings));
  console.log("stored strings:",JSON.stringify(strings));
  const currentStrings=strings;
  console.log("Applying interface strings:",currentStrings);
  
  document.title=`${currentStrings.appTitle} - Language Learning`;
  document.querySelector('#title p').textContent=currentStrings.appTitle;
  
  document.querySelector('#init-login-section h3').textContent=currentStrings.pleaseLoginToStart;
  document.querySelector('#init-user-name').placeholder=currentStrings.email;
  document.querySelector('#init-user-password').placeholder=currentStrings.password;
  document.querySelector('#init-login-button').textContent=currentStrings.login;
  document.querySelector('#init-signup-button').textContent=currentStrings.signup;
  
  document.querySelector('#initDailypages').textContent=currentStrings.dailyPages;
  document.querySelector('#initFreeRead').textContent=currentStrings.freeRead;
  
  document.querySelector('#settings-drawer h2').textContent=currentStrings.settings;
  document.querySelector('#user-name').placeholder=currentStrings.email;
  document.querySelector('#user-password').placeholder=currentStrings.password;
  document.querySelector('#login-button').textContent=currentStrings.login;
  document.querySelector('#signup-button').textContent=currentStrings.signup;
  document.querySelector('#userLanguages').textContent=currentStrings.nativeLanguage;
  document.querySelector('#tutorial').textContent=currentStrings.tutorial;
  document.querySelector('#found-bug').textContent=currentStrings.foundABug;
  document.querySelector('#tip-section h3').textContent=currentStrings.supportHablas;
  document.querySelector('#custom-tip').placeholder=currentStrings.customAmount;
  document.querySelector('#custom-tip-button').textContent=currentStrings.tip;
  
  const browseBtn=document.querySelector('#browse-books-btn');
  if(browseBtn)browseBtn.textContent=currentStrings.tapToBegin;
  
  const pageleModalTitle=document.querySelector('#pagele-modal h2');
  if(pageleModalTitle)pageleModalTitle.textContent=currentStrings.selectPagele;
  
  const chaptersModalTitle=document.querySelector('#chapters-modal h2');
  if(chaptersModalTitle)chaptersModalTitle.textContent=currentStrings.chapters;
  
  const translateBtn=document.querySelector('#translation-btn');
  if(translateBtn)translateBtn.textContent=currentStrings.translate;
  
  const chapterTitle=document.querySelector('#chapter-title');
  if(chapterTitle&&chapterTitle.textContent==='Chapter Title')chapterTitle.textContent=currentStrings.chapterTitle;
  
  const pointsDisplays=document.querySelectorAll('#points-display-pagele');
  pointsDisplays.forEach(el=>{
    const currentText=el.textContent;
    if(currentText.startsWith('Points:'))el.textContent=`${currentStrings.points}: `;
  });
  
  const modeText=document.querySelector('#mode-text');
  if(modeText){
    if(currentMode==='freeread'){
      modeText.textContent=currentStrings.dailyPages;
    }else{
      modeText.textContent=currentStrings.freeRead;
    }
  }
  
  const paymentModalTitle=document.querySelector('#payment-modal h2');
  if(paymentModalTitle)paymentModalTitle.textContent=currentStrings.completeYourTip;
  
  const submitPaymentBtn=document.querySelector('#submit-payment');
  if(submitPaymentBtn)submitPaymentBtn.textContent=currentStrings.payNow;
  
  const userAccountTitle=document.querySelector('.user-account-options-modal-content p');
  if(userAccountTitle)userAccountTitle.textContent=currentStrings.userAccountOptions;
  
  const changeInfoBtn=document.querySelector('#change-info-button');
  if(changeInfoBtn)changeInfoBtn.textContent=currentStrings.changeInfo;
  
  const deleteAccountBtn=document.querySelector('#delete-account-button');
  if(deleteAccountBtn)deleteAccountBtn.textContent=currentStrings.deleteAccount;
  
  updateStatusMessages(currentStrings);
}

function updateStatusMessages(strings){
  const statusMessages=document.querySelectorAll('.status-message');
  statusMessages.forEach(el=>{
    if(el.textContent==='Processing...'){
      el.textContent=strings.processing;
    }else if(el.textContent==='Fetching data...'){
      el.textContent=strings.fetchingData;
    }else if(el.textContent==='Parsing data...'){
      el.textContent=strings.parsingData;
    }
  });
}

function getInterfaceString(key){
  const currentStrings=interfaceStrings[currentInterfaceLanguage]||interfaceStrings.en;
  return currentStrings[key]||interfaceStrings.en[key]||key;
}

function setLanguage(language){
  if(lang_conversion[language])return lang_conversion[language];
  else return language;
}

function loadAvailableBooks(){
  sendSocketMessage({task:'get_books'});
  booksModal.style.display='block';
}

function verifyToken(token){
  sendSocketMessage({task:"verify_token",token:token});
}

async function updateTranslation(text){
  console.log(`Translating text: "${text}" from ${sourceLang}`);
  
  translation.textContent="Translating...";
  
  const targetLang=languageUserOptionsSelect.value;
  console.log("targetLang:",targetLang);
  console.log("sourceLang:",sourceLang);
  console.log("username:",username);
  
  if(rendition){
    const contents=rendition.getContents();
    cfi=rendition.currentLocation().start.cfi;
    console.log("cfi:",cfi);
  }
  
  sendSocketMessage({ 
    task:'translate', 
    text:text, 
    source_lang:sourceLang, 
    target_lang:targetLang, 
    current_book:selectedBook, 
    cfi:cfi,
    username:username,
    token:localStorage.getItem('token')
  });
}

function createBlobAndConnect(){
  const statusIndicator=currentMode==='freeread'?
    document.getElementById('recording-status'):
    document.getElementById('recording-status-pagele');
      
  if(statusIndicator){
    statusIndicator.style.display='flex';
    processingStartTime=Date.now();
    updateTimer();
    timerInterval=setInterval(updateTimer,100);
  }

  const audioBlob=new Blob(audioChunks,{type:'audio/wav'});
  audioChunks=[];

  const reader=new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend=function(){
    const base64data=reader.result;
    
    console.log("Current language value:",languageSel);
    console.log("Current sourceLang:",sourceLang);
    
    if(currentMode==='freeread'){
      sendSocketMessage({ 
        task:'stt', 
        blob:base64data, 
        language:languageSel, 
        sentence:lines[lineNum], 
        username:username, 
        book:selectedBook, 
        page:selectedPage 
      });
    }else if(currentMode==='pagele'){
      const currentSentence=sentenceElem.textContent;
      let language=pagele_language;
      if(language.length==2)language=lang_conversion[language];
      sendSocketMessage({ 
        task:'stt', 
        blob:base64data, 
        language:language, 
        sentence:currentSentence,
        username:localStorage.getItem('username')||'',
        book:pageleFilename, 
        chapter:currentChapter,
        currentSentenceIndex:currentSentenceIndex,
        page:'pagele'
      });
    }
  };
}

async function renderEpub(file,cfi=null){
  currentBook=ePub(file);
  const viewer=document.getElementById("viewer");
  viewer.innerHTML="";
  rendition=currentBook.renderTo("viewer",{
    height:"100%",
    width:"100%",
    allowScriptedContent:false,
    flow:"scrolled-doc",
    manager:"continuous"
  });
  
  console.log("cfi:",cfi);
  if(cfi){
    rendition.display(cfi,{offsetTop:1000});
  }else{
    rendition.display().then(()=>addClickHandlersToPage());
  }
  
  rendition.on("rendered",section=>{
    selectedPage=section.href;
    addClickHandlersToPage();
    const contents=rendition.getContents();
  });
  
  function addClickHandlersToPage(){
    const contents=rendition.getContents();
    
    contents.forEach(content=>{
      const style=content.document.createElement('style');
      style.textContent=`
        @keyframes pulse {
          0% { background-color: transparent; }
          50% { background-color: rgba(169, 209, 215, 0.3); }
          100% { background-color: transparent; }
        }
        .pulse-animation {
          animation: pulse 2s infinite;
        }
        .sentence-icon {
          font-size: 16px;
          margin-right: 4px;
          vertical-align: middle;
          display: inline-block;
        }
        .pulse-animation .sentence-icon {
          opacity: 1 !important;
        }
      `;
      content.document.head.appendChild(style);
      
      content.document.querySelectorAll('.pulse-animation').forEach(el=>{
        el.classList.remove('pulse-animation');
        const icon=el.querySelector('.sentence-icon');
        if(icon)icon.remove();
      });

      let isFirstSentence=true;
      
      content.document.querySelectorAll('p, span').forEach((element,elementIndex)=>{
        if(element.dataset.processed==="true")return;
        
        if(element.textContent.trim()===element.textContent.trim().toUpperCase()){
          element.dataset.processed="true";
          return;
        }
        
        const sentences=element.textContent.split(/(?<=[.!?])\s+/);
        if(sentences.length===0)return;
        
        element.textContent='';
        element.dataset.processed="true";
        
        sentences.forEach((sentence,index)=>{
          if(sentence.trim().length<2)return;
          
          const sentenceSpan=content.document.createElement('span');
          sentenceSpan.textContent=sentence+' ';
          sentenceSpan.style.cursor='pointer';
          sentenceSpan.style.borderRadius='3px';
          sentenceSpan.style.transition='background-color 0.2s ease';
          
          if(isFirstSentence&&sentence.trim()!==sentence.trim().toUpperCase()&&sentence.trim().length>10){
            const selectIcon=content.document.createElement('span');
            selectIcon.className='sentence-icon';
            selectIcon.style.opacity='1';
            sentenceSpan.insertBefore(selectIcon,sentenceSpan.firstChild);
            sentenceSpan.classList.add('pulse-animation');
            isFirstSentence=false;
          }
          
          sentenceSpan.addEventListener('mouseover',()=>{
            sentenceSpan.style.backgroundColor='rgba(169, 209, 215, 0.3)';
          });
          
          sentenceSpan.addEventListener('mouseout',()=>{
            if(!sentenceSpan.classList.contains('selected-line')){
              sentenceSpan.style.backgroundColor='transparent';
            }
          });
          
          sentenceSpan.addEventListener(E,event=>{
            content.document.querySelectorAll('.pulse-animation').forEach(el=>{
              el.classList.remove('pulse-animation');
              const icon=el.querySelector('.sentence-icon');
              if(icon)icon.remove();
            });
            
            content.document.querySelectorAll('.selected-line').forEach(el=>{
              el.classList.remove('selected-line');
              el.style.backgroundColor='transparent';
            });
            
            sentenceSpan.classList.add('selected-line');
            sentenceSpan.style.backgroundColor='rgba(169, 209, 215, 0.5)';
            
            const modalContent=modalDiv.querySelector('.modal-content');
            
            const isMobile=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if(isMobile){
              modalContent.style.width=`calc(100vw - 20px)`;
              modalContent.style.maxWidth='100%';
            }else{
              const modalWidth=Math.min(window.innerWidth-40,800);
              modalContent.style.width=`${modalWidth}px`;
            }
            
            modalDiv.style.display='block';
            
            selectedText=sentence.trim();
            lines=[selectedText];
            lineNum=0;
            updateTranslation(selectedText);
            
            event.stopPropagation();
          });
          
          element.appendChild(sentenceSpan);
        });
      });
    });
  }
  
  fileDiv.style.display="none";
  
  if(!document.getElementById('scroll-down-btn')){
    const scrollBtn=document.createElement('button');
    scrollBtn.id='scroll-down-btn';
    scrollBtn.textContent='Load More';
    scrollBtn.style.position='absolute';
    scrollBtn.style.bottom='10px';
    scrollBtn.style.left='50%';
    scrollBtn.style.transform='translateX(-50%)';
    scrollBtn.style.zIndex='100';
    scrollBtn.style.padding='10px 20px';
    scrollBtn.style.backgroundColor='#007bff';
    scrollBtn.style.color='white';
    scrollBtn.style.border='none';
    scrollBtn.style.borderRadius='5px';
    scrollBtn.style.cursor='pointer';
    scrollBtn.style.marginBottom='10px';
    
    let currentSpinePosition=0;
    
    scrollBtn.onclick=async()=>{
      try{
        const currentLocation=rendition.currentLocation();
        if(!currentLocation){
          console.log("No current location found");
          return;
        }
        
        const spine=currentBook.spine;
        if(!spine){
          console.log("No spine found");
          return;
        }
        
        currentSpinePosition++;
        if(currentSpinePosition>=spine.length){
          console.log("Reached end of book");
          scrollBtn.style.display='none';
          return;
        }
        
        console.log(`Moving to spine position ${currentSpinePosition}`);
        
        await rendition.display(spine.get(currentSpinePosition).href);
        addClickHandlersToPage();
        
        console.log("Moved to next section");
        scrollBtn.style.display='none';
      }catch(error){
        console.error("Error navigating:",error);
      }
    };
    
    const div2viewer=document.getElementById('div2viewer');
    div2viewer.appendChild(scrollBtn);
    div2viewer.style.position='relative';
  }
  
  if(cfi)rendition.display(cfi,{offsetTop:1000});
}

function textToSpeech(textToSpeak){
  console.log('Starting text-to-speech for:',textToSpeak);
  
  const ttsLang=languageSel.substring(0,2);
  console.log('Using language:',ttsLang);
  
  textToSpeechBtn.setAttribute('data-speaking','true');
  textToSpeechBtn.style.filter='brightness(0.7)';
  
  sendSocketMessage({
    task:'tts',
    text:textToSpeak,
    language:ttsLang
  });
}

function createPopup(content,event){
  document.querySelectorAll('.popup').forEach(popup=>popup.remove());
  
  const popup=document.createElement('div');
  const closePopupButton=document.createElement('span');
  const contentElement=document.createElement('p');
  
  closePopupButton.innerHTML='&times;';
  closePopupButton.style.position='absolute';
  closePopupButton.style.top='5px';
  closePopupButton.style.right='10px';
  closePopupButton.style.cursor='pointer';
  closePopupButton.style.fontSize='18px';
  closePopupButton.style.fontWeight='bold';
  closePopupButton.classList.add('popup-close');
  
  contentElement.textContent=content;
  
  popup.appendChild(contentElement);
  popup.appendChild(closePopupButton);
  
  closePopupButton.addEventListener(E,e=>{
    popup.remove();
    popupflag=false;
    e.stopPropagation();
  });
  
  popup.addEventListener(E,e=>{
    popup.remove();
    popupflag=false;
    e.stopPropagation();
  });
  
  const x=event.clientX||(event.touches&&event.touches[0].clientX)||0;
  const y=event.clientY||(event.touches&&event.touches[0].clientY)||0;
  
  popup.style.position='absolute'; 
  popup.style.left=`${x}px`;
  popup.style.top=`${y}px`; 
  popup.classList.add('popup');
  
  document.body.appendChild(popup);
  popup.style.zIndex=1000;
  
  if(content){
    console.log("Speaking correct word:",content);
    textToSpeech(content);
  }else{
    console.error("No content to speak");
  }
  
  popupflag=true;
}

function updatePointsDisplay(points){
  const pointsDisplays=document.querySelectorAll('#points');
  pointsDisplays.forEach(element=>{
    element.textContent=points;
  });

  const pointsDisplayDivs=document.querySelectorAll('#points-display');
  pointsDisplayDivs.forEach(div=>{
    div.style.display='block';
    div.style.textAlign='center';
    div.style.fontSize='1em';
    div.style.fontWeight='bold';
  });
}

function updateTimer(){
  const timerElement=currentMode==='freeread'?
    document.querySelector('#recording-status .timer'):
    document.querySelector('#recording-status-pagele .timer');
      
  if(timerElement&&processingStartTime){
    const elapsedTime=(Date.now()-processingStartTime)/1000;
    timerElement.textContent=`${elapsedTime.toFixed(1)}s`;
  }
}

function isValidEmail(email){
  const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  console.log("email:",emailRegex);
  return emailRegex.test(email);
}

function requestPageleList(){
  sendSocketMessage({task:"get_pagele_list",token:localStorage.getItem('token')});
}

function displayPageleList(pageleBooks){
  const pageleList=document.getElementById('pagele-list');
  pageleList.innerHTML='';
  
  if(pageleBooks.length===0){
    pageleList.innerHTML=`<p>${getInterfaceString('noPageleBooksAvailable')}</p>`;
  }else{
    const booksByLanguage=pageleBooks.reduce((acc,pagele)=>{
      if(!acc[pagele.language])acc[pagele.language]=[];
      acc[pagele.language].push(pagele);
      return acc;
    },{});
    
    Object.entries(booksByLanguage).forEach(([language,languageBooks])=>{
      const languageSection=document.createElement('div');
      languageSection.className='pagele-language-section';
      
      const languageHeader=document.createElement('div');
      languageHeader.className='pagele-language-header';
      languageHeader.innerHTML=`
        <h3>${language.charAt(0).toUpperCase()+language.slice(1)}</h3>
        <span class="pagele-expand-icon">▼</span>
      `;
      
      const booksContainer=document.createElement('div');
      booksContainer.className='pagele-books-container collapsed';
      
      languageBooks.forEach(pagele=>{
        const card=document.createElement('div');
        card.className='pagele-card';
        card.dataset.pageleId=pagele.filename;
        
        card.innerHTML=`
          <img class="pagele-cover" src="${pagele.cover}" alt="${pagele.book_name} cover">
          <div class="pagele-title">${pagele.book_name}</div>
        `;
        
        if(!hasActiveSubscription()&&!canAccessBook(pagele.filename)){
          const premiumBadge=document.createElement('div');
          premiumBadge.style.cssText='position: absolute; top: 5px; right: 5px; background: gold; color: black; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;';
          premiumBadge.textContent='PREMIUM';
          card.style.position='relative';
          card.appendChild(premiumBadge);
          card.style.opacity='0.6';
        }

        const addPageleEventListener=createTouchAwareEventListener(e=>{
          if(!canAccessBook(pagele.filename)){
            showBookLimitPrompt();
            return;
          }

          trackBookAccess(pagele.filename);
          selectPagele(pagele.filename,pagele.language,0);
        });
        addPageleEventListener(card);
        booksContainer.appendChild(card);
      });
      
      const addHeaderEventListener=createTouchAwareEventListener(()=>{
        const isCollapsed=booksContainer.classList.contains('collapsed');
        const icon=languageHeader.querySelector('.pagele-expand-icon');
        
        if(isCollapsed){
          booksContainer.classList.remove('collapsed');
          booksContainer.classList.add('expanded');
          icon.textContent='▲';
          icon.style.transform='rotate(180deg)';
        }else{
          booksContainer.classList.remove('expanded');
          booksContainer.classList.add('collapsed');
          icon.textContent='▼';
          icon.style.transform='rotate(0deg)';
        }
      });
      addHeaderEventListener(languageHeader);
      
      languageSection.appendChild(languageHeader);
      languageSection.appendChild(booksContainer);
      pageleList.appendChild(languageSection);
    });
  }
  
  showPageleModal();
}

function showPageleModal(){
  pageleModal.style.display='block';
  sentenceModal.style.display='none';
}

function hidePageleModal(){
  pageleModal.style.display='none';
}

function selectPagele(pageleFilename,language,index){
  pagele_language=language;
  languageSel=setLanguage(language);
  console.log("languageSel:",languageSel);
  sendSocketMessage({
    task:"init_pagele",
    pagele_filename:pageleFilename,
    language:language,
    index:index,
    token:localStorage.getItem('token')
  });
  console.log("Selected pagele:",pageleFilename);
  hidePageleModal();
}

function displayChaptersGrid(response){
  pageleFilename=response.user_pagele.current_pagele;
  completedIndices=response.user_pagele.books[pageleFilename].completed_indices;
  console.log("completedIndices:",completedIndices);
  
  const chaptersGrid=document.getElementById('chapters-grid');
  chaptersGrid.innerHTML='';
  pagele_data=response.pagele_data;
  
  if(Object.keys(pagele_data).length===0){
    chaptersGrid.innerHTML=`<p>${getInterfaceString('noChaptersAvailable')}</p>`;
  }else{
    Object.keys(pagele_data).forEach((chapter,index)=>{
      const card=document.createElement('div');
      card.className='chapter-card';
      card.dataset.chapterIndex=index;   
      
      card.innerHTML=`
        <div class="chapter-title">${chapter}</div>
      `;
      
      const addChapterEventListener=createTouchAwareEventListener(e=>{
        openSentenceModal(chapter,index,completedIndices[chapter]);
      });
      addChapterEventListener(card);
      chaptersGrid.appendChild(card);
    });
  }
  
  showChaptersModal();
}

function showChaptersModal(){
  chaptersModal.style.display='block';
}

function hideChaptersModal(){
  chaptersModal.style.display='none';
}

function openSentenceModal(chapter,chapterIndex,chapterPoints){
  currentChapter=chapter;
  hideChaptersModal();

  currentSentenceIndex=0;
  console.log("currentChapter:",chapter);
  document.getElementById('chapter-title').textContent=chapter;
  
  updateSentenceDisplay();
  
  sentenceModal.style.display='block';
}

function updateSentenceDisplay(){
  let sentences=pagele_data[currentChapter];
  if(sentences.length===0){
    sentenceElem.textContent=getInterfaceString('noSentencesAvailable');
    counterElem.textContent="0/0";
    prevButton.disabled=true;
    nextButton.disabled=true;
    return;
  }
  
  sentenceElem.textContent=sentences[currentSentenceIndex];
  counterElem.textContent=`${currentSentenceIndex+1}/${sentences.length}`;
  
  let sentencePoints=0;
  console.log("completedIndices:",completedIndices);
  console.log("currentChapter:",completedIndices[currentChapter]);
  console.log("currentSentenceIndex:",completedIndices[currentChapter][currentSentenceIndex]);
  
  if(completedIndices&&
      completedIndices[currentChapter]&&
      completedIndices[currentChapter][currentSentenceIndex]!==undefined){
    sentencePoints=completedIndices[currentChapter][currentSentenceIndex];
    console.log("sentencePoints:",sentencePoints);
  }
  
  if(pointsSpanPagele){
    pointsSpanPagele.textContent=sentencePoints;
    console.log("pointsSpan updated with:",sentencePoints);
  }else{
    console.error("Points span element not found!");
  }
  
  if(sentencePoints>0){
    sentenceElem.classList.add('completed');
    if(sentencePoints>=10){
      sentenceElem.classList.add('max-points');
    }else{
      sentenceElem.classList.remove('max-points');
    }
  }else{
    sentenceElem.classList.remove('completed','max-points');
  }
  
  prevButton.disabled=currentSentenceIndex===0;
  nextButton.disabled=currentSentenceIndex===sentences.length-1;
}

function showPreviousSentence(){
  translated_text="";
  prediction.innerHTML="";
  if(currentSentenceIndex>0){
    currentSentenceIndex--;
    updateSentenceDisplay();
  }
}

function showNextSentence(){
  translated_text="";
  prediction.innerHTML="";
  if(currentSentenceIndex<pagele_data[currentChapter].length-1){
    currentSentenceIndex++;
    console.log("currentSentenceIndex:",currentSentenceIndex);
    updateSentenceDisplay();
  }
}

function closeSentenceModal(){
  sentenceModal.style.display='none';
  showChaptersModal();
}

function playAudioFromData(audioData,textKeyForLog){
  console.log(`Playing audio for: ${textKeyForLog}`);

  if(currentAudio){
    currentAudio.pause();
    currentAudio.currentTime=0;
  }

  const audio=new Audio(audioData);
  currentAudio=audio;

  const robotBtn=currentMode==='pagele'?
    document.getElementById('robot-pagele'):
    document.getElementById('robot');
      
  if(robotBtn){
    robotBtn.setAttribute('data-speaking','true');
    robotBtn.style.filter='brightness(0.7)';
  }

  audio.onended=()=>{
    console.log('Speech ended for:',textKeyForLog);
    if(robotBtn){
      robotBtn.setAttribute('data-speaking','false');
      robotBtn.style.filter='brightness(1)';
    }
    currentAudio=null;
  };

  audio.onerror=e=>{
    console.error('Speech error for:',textKeyForLog,e);
    if(robotBtn){
      robotBtn.setAttribute('data-speaking','false');
      robotBtn.style.filter='brightness(1)';
    }
    currentAudio=null;
  };

  audio.play().catch(e=>{
    console.error('Error playing audio for:',textKeyForLog,e);
    if(robotBtn){
      robotBtn.setAttribute('data-speaking','false');
      robotBtn.style.filter='brightness(1)';
    }
    currentAudio=null; 
  });
}

async function initiateTip(amount){
  try{
    drawer.style.display='none';
    document.getElementById('payment-modal').style.display='block';
    sendSocketMessage({task:'tip',amount:amount});
  }catch(error){
    console.error('Error initiating tip:',error);
    alert('Error processing tip. Please try again.');
  }
}

async function sendBugReport(){
  try{
    const foundBugBtn=document.getElementById('found-bug');
    const originalText=foundBugBtn.textContent;
    foundBugBtn.textContent=getInterfaceString('sendingBugReport');
    foundBugBtn.style.pointerEvents='none';
    
    const systemInfo={
      userAgent:navigator.userAgent,
      platform:navigator.platform,
      language:navigator.language,
      cookieEnabled:navigator.cookieEnabled,
      onLine:navigator.onLine,
      url:window.location.href,
      timestamp:new Date().toISOString(),
      currentMode:currentMode,
      isLoggedIn:isLoggedIn,
      username:userInfo.username||'Not logged in',
      selectedBook:selectedBook||'None',
      pageleFilename:pageleFilename||'None'
    };

    const processedLogs=logs.map(logEntry=>{
      const processedEntry={...logEntry};

      if(typeof processedEntry.message==='string'&&processedEntry.message.length>200){
        processedEntry.message=processedEntry.message.substring(0,197)+"...";
      }

      if(Array.isArray(processedEntry.args)){
        processedEntry.args=processedEntry.args.map(arg=>{
          if(typeof arg==='string'){
            if((arg.startsWith('{')&&arg.endsWith('}'))||(arg.startsWith('[')&&arg.endsWith(']'))){
              try{
                JSON.parse(arg);
                if(arg.startsWith('{'))return"{JSON Object}";
                if(arg.startsWith('['))return"[JSON Array]";
              }catch(e){}
            }
            if(arg.length>100)return arg.substring(0,97)+"...";
          }else if(typeof arg==='object'&&arg!==null){
            return Array.isArray(arg)?"[Array]":"[Object]";
          }
          return arg;
        });
      }
      return processedEntry;
    });
    
    const formattedLogs=processedLogs.map(log=>
      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message} ${log.args.join(' ')}`
    ).join('\\n');
    console.log("processedLogs for email:",processedLogs);
    console.log("processedLogs length:",processedLogs.length);
    
    const emailBody=`
Bug Report from Hablas App
==========================

System Information:
${JSON.stringify(systemInfo,null,2)}

Session Logs:
${formattedLogs}

Additional Notes:
(User can add more details here)
    `.trim();
    
    sendSocketMessage({
      task:'send_bug_report',
      systemInfo:systemInfo,
      logs:processedLogs,
      emailBody:emailBody,
      token:localStorage.getItem('token')
    });
    
    setTimeout(()=>{
      foundBugBtn.textContent=originalText;
      foundBugBtn.style.pointerEvents='auto';
      alert(getInterfaceString('bugReportSent'));
      drawer.classList.remove('open');
      setTimeout(()=>drawer.style.display='none',300);
    },2000);
    
  }catch(error){
    console.error('Error sending bug report:',error);
    const foundBugBtn=document.getElementById('found-bug');
    foundBugBtn.textContent=getInterfaceString('foundABug');
    foundBugBtn.style.pointerEvents='auto';
    alert(getInterfaceString('bugReportError'));
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  const storedToken=localStorage.getItem('token');
  const storedUsername=localStorage.getItem('username');
  console.log("storedToken:",storedToken);
  console.log("storedUsername:",storedUsername);
  
  setupLogging();
  switchToMode('init');
  
  if(storedToken){
    if(socket.readyState===WebSocket.OPEN){
      verifyToken(storedToken);
    }else{
      socket.addEventListener('open',()=>verifyToken(storedToken),{once:true});
    }
  }else{
    console.log("no token");
  }

  setupEventListeners();
  applyInterfaceStrings(interfaceStrings.en);
});

function setupEventListeners(){
  const grantAccessBtn=document.getElementById('grant-access-btn'),
        revokeAccessBtn=document.getElementById('revoke-access-btn'),
        checkAccessBtn=document.getElementById('check-access-btn');
  
  if(grantAccessBtn)grantAccessBtn.addEventListener(E,grantSpecialAccess);
  if(revokeAccessBtn)revokeAccessBtn.addEventListener(E,revokeSpecialAccess);
  if(checkAccessBtn)checkAccessBtn.addEventListener(E,checkSpecialAccess);

  const closeButtons=document.getElementsByClassName('close');
  Array.from(closeButtons).forEach(closeBtn=>{
    closeBtn.addEventListener(E,()=>{
      const container=closeBtn.closest('.modal, .drawer, #books-modal');
      console.log("closing container:",container);
      if(container)container.style.display='none';
    });
  });

  const closeModalBtn=document.querySelector('.close-modal');
  closeModalBtn.addEventListener(E,()=>{
    modalDiv.style.display="none";
    lineNum=0;
    const pointsDisplay=document.getElementById('points-display');
    pointsDisplay.style.display='none';
  });

  loginButton.addEventListener(E,()=>{
    loginButton.style.backgroundColor='#FFB6C1';
    username=usernameInput.value.toLowerCase();
    password=passwordInput.value;

    if(!isValidEmail(username)){
      alert(getInterfaceString('enterValidEmail'));
      return; 
    }

    if(!password||password.trim()===""){
      alert(getInterfaceString('passwordCannotBeEmpty'));
      return; 
    }

    sendSocketMessage({task:"login",username:username,password:password});
  });

  loginButton2.addEventListener(E,()=>{
    loginButton2.style.backgroundColor='#FFB6C1';
    
    username=usernameInput2.value.toLowerCase();
    password=passwordInput2.value;

    if(!isValidEmail(username)){
      alert("Please enter a valid email address");
      return; 
    }

    if(!password||password.trim()===""){
      alert("Password cannot be empty");
      return; 
    }

    sendSocketMessage({task:"login",username:username,password:password});
  });

  signupButton.addEventListener(E,()=>{
    signupButton.style.backgroundColor='#FFB6C1';
    username=usernameInput.value.toLowerCase();
    password=passwordInput.value;

    if(!isValidEmail(username)){
      alert("Please enter a valid email address");
      return;
    }

    if(!password||password.trim()===""){
      alert("Password cannot be empty");
      return;
    }

    sendSocketMessage({task:"signup",username:username,password:password});
  });

  signupButton2.addEventListener(E,()=>{
    signupButton2.style.backgroundColor='#FFB6C1';
    username=usernameInput2.value.toLowerCase();
    password=passwordInput2.value;

    if(!isValidEmail(username)){
      alert("Please enter a valid email address");
      return;
    }

    if(!password||password.trim()===""){
      alert("Password cannot be empty");
      return;
    }

    sendSocketMessage({task:"signup",username:username,password:password});
  });

  initDailypages.addEventListener(E,()=>{
    if(!initDailypages.classList.contains('disabled')){
      logEvent('User switched to Daily Pages mode');
      switchToMode('pagele');
    }
  });

  initFreeRead.addEventListener(E,()=>{
    if(!initFreeRead.classList.contains('disabled')){
      logEvent('User switched to Free Read mode');
      switchToMode('freeread');
    }
  });

  modeSwitch.addEventListener(E,()=>{
    if(currentMode==='freeread'){
      switchToMode('pagele');
    }else if(currentMode==='pagele'){
      switchToMode('freeread');
    }
    drawer.classList.remove('open');
    setTimeout(()=>drawer.style.display='none',300);
  });

  userSection.addEventListener(E,event=>{
    if(userSection.textContent=="Login"){
      console.log("user section clicked");
      drawer.style.display='block';
      setTimeout(()=>drawer.classList.add('open'),10);
      event.stopPropagation();
    }
  });

  settingsBtn.addEventListener(E,event=>{
    console.log("settings button clicked");
    drawer.style.display='block';
    setTimeout(()=>drawer.classList.add('open'),10);
    event.stopPropagation();
  });

  closeDrawerBtn.addEventListener(E,()=>{
    console.log("close button clicked");
    drawer.classList.remove('open');
    setTimeout(()=>drawer.style.display='none',300);
  });

  window.addEventListener(E,event=>{
    if(!drawer.contains(event.target)&&!settingsBtn.contains(event.target)){
      drawer.classList.remove('open');
      setTimeout(()=>drawer.style.display='none',300);
    }
  });

  fileInput.addEventListener('change',async event=>{
    const file=event.target.files[0];
    if(file){
      try{
        await renderEpub(file);
      }catch(error){
        console.error('Error handling file:',error);
      }
    }
  });

  fileDiv.addEventListener(E,()=>fileInput.click());

  recordBtn.addEventListener(E,async()=>{
    console.log("Recording button clicked (free reading)");
    
    if(!canUseRecording()){
      showUpgradePrompt();
      return;
    }

    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
        throw new Error('MediaDevices API not available. This usually means you need to access the site via HTTPS or localhost.');
      }
      
      if(!isRecording){
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder=new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable=event=>audioChunks.push(event.data);

        mediaRecorder.onstop=()=>{
          incrementUsage();
          createBlobAndConnect();
          updateUIWithSubscriptionLimits();
        };

        mediaRecorder.start();
        isRecording=true;
        
        if(mediaRecorder.state==='recording'){
          console.log('Recording started successfully');
          recordBtn.src="images/stopRecButton.png";
        }else{
          alert('Failed to start recording. Please try again.');
          isRecording=false;
          recordBtn.src="images/recordingButton.png";
        }
      }else{
        mediaRecorder.stop(); 
        isRecording=false;
        recordBtn.src="images/recordingButton.png";
      }
    }catch(error){
      console.error('Error accessing microphone:',error);
      console.error('Error name:',error.name);
      console.error('Error message:',error.message);
      console.error('Full error:',error);
      
      if(error.name==='NotAllowedError'){
        alert('Microphone permission denied. Please:\n1. Click the microphone icon in your browser address bar\n2. Allow microphone access\n3. Refresh the page and try again');
      }else if(error.name==='NotFoundError'){
        alert('No microphone found. Please check your microphone connection.');
      }else if(error.name==='NotSupportedError'){
        alert('Microphone access not supported. Please ensure you\'re using a modern browser and accessing via HTTPS.');
      }else if(error.message&&error.message.includes('MediaDevices API not available')){
        alert('❌ HTTPS Required!\n\nMicrophone access requires HTTPS or localhost.\n\nSolutions:\n• If testing locally: Access via http://localhost:PORT\n• If on a server: Use https:// instead of http://\n• Current URL: '+window.location.href);
      }else{
        alert(`Could not access microphone.\nError: ${error.name} - ${error.message}\n\nTroubleshooting:\n1. Check if you're using HTTPS (required for microphone)\n2. Check browser microphone permissions\n3. Try refreshing the page`);
      }
      isRecording=false;
      recordBtn.src="images/recordingButton.png";
    }
  });

  if(recordBtnPagele){
    recordBtnPagele.addEventListener(E,async()=>{
      console.log("Recording button clicked (pagele)");
      
      if(!canUseRecording()){
        showUpgradePrompt();
        return;
      }

      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
          throw new Error('MediaDevices API not available. This usually means you need to access the site via HTTPS or localhost.');
        }
        
        if(!isRecording){
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});
          mediaRecorder=new MediaRecorder(stream);
          
          mediaRecorder.ondataavailable=event=>audioChunks.push(event.data);
          
          mediaRecorder.onstop=()=>{
            incrementUsage();
            createBlobAndConnect();
            updateUIWithSubscriptionLimits();
          };
          
          mediaRecorder.start();
          isRecording=true;
          
          if(mediaRecorder.state==='recording'){
            console.log('Recording started successfully');
            recordBtnPagele.src="images/stopRecButton.png";
          }else{
            alert('Failed to start recording. Please try again.');
            isRecording=false;
            recordBtnPagele.src="images/recordingButton.png";
          }
        }else{
          mediaRecorder.stop();
          isRecording=false;
          recordBtnPagele.src="images/recordingButton.png";
        }
      }catch(error){
        console.error('Error accessing microphone:',error);
        console.error('Error name:',error.name);
        console.error('Error message:',error.message);
        console.error('Full error:',error);
        
        if(error.name==='NotAllowedError'){
          alert('Microphone permission denied. Please:\n1. Click the microphone icon in your browser address bar\n2. Allow microphone access\n3. Refresh the page and try again');
        }else if(error.name==='NotFoundError'){
          alert('No microphone found. Please check your microphone connection.');
        }else if(error.name==='NotSupportedError'){
          alert('Microphone access not supported. Please ensure you\'re using a modern browser and accessing via HTTPS.');
        }else if(error.message&&error.message.includes('MediaDevices API not available')){
          alert('❌ HTTPS Required!\n\nMicrophone access requires HTTPS or localhost.\n\nSolutions:\n• If testing locally: Access via http://localhost:PORT\n• If on a server: Use https:// instead of http://\n• Current URL: '+window.location.href);
        }else{
          alert(`Could not access microphone.\nError: ${error.name} - ${error.message}\n\nTroubleshooting:\n1. Check if you're using HTTPS (required for microphone)\n2. Check browser microphone permissions\n3. Try refreshing the page`);
        }
        isRecording=false;
        recordBtnPagele.src="images/recordingButton.png";
      }
    });
  }

  textToSpeechBtn.addEventListener(E,()=>{
    const isCurrentlySpeaking=textToSpeechBtn.getAttribute('data-speaking')==='true';
    
    if(isCurrentlySpeaking){
      if(currentAudio){
        currentAudio.pause();
        currentAudio.currentTime=0;
        currentAudio=null;
      }
      
      textToSpeechBtn.setAttribute('data-speaking','false');
      textToSpeechBtn.style.filter='brightness(1)';
    }else{
      textToSpeechBtn.setAttribute('data-speaking','true');
      textToSpeechBtn.style.filter='brightness(0.7)';
      textToSpeech(lines[lineNum]);
    }
  });

  if(robotBtnPagele){
    robotBtnPagele.addEventListener(E,()=>{
      const isCurrentlySpeaking=robotBtnPagele.getAttribute('data-speaking')==='true';
      
      if(isCurrentlySpeaking){
        if(currentAudio){
          currentAudio.pause();
          currentAudio.currentTime=0;
          currentAudio=null;
        }
        
        robotBtnPagele.setAttribute('data-speaking','false');
        robotBtnPagele.style.filter='brightness(1)';
      }else{
        const currentSentence=sentenceElem.textContent;
        robotBtnPagele.setAttribute('data-speaking','true');
        robotBtnPagele.style.filter='brightness(0.7)';
        textToSpeech(currentSentence);
      }
    });
  }

  if(prevButton)prevButton.addEventListener('click',showPreviousSentence);
  if(nextButton)nextButton.addEventListener('click',showNextSentence);

  if(closeSentenceModalBtn){
    closeSentenceModalBtn.addEventListener('click',()=>{
      sentenceModal.style.display='none';
      chaptersModal.style.display='block';
    });
  }

  if(closeChaptersModal){
    closeChaptersModal.addEventListener('click',()=>{
      chaptersModal.style.display='none';
      pageleModal.style.display='block';
    });
  }

  const translationBtn=document.getElementById('translation-btn');
  let originalSentence='';
  
  if(translationBtn){
    translationBtn.addEventListener('mousedown',handleTranslationStart);
    translationBtn.addEventListener('touchstart',handleTranslationStart);
    
    translationBtn.addEventListener('mouseup',handleTranslationEnd);
    translationBtn.addEventListener('touchend',handleTranslationEnd);
    translationBtn.addEventListener('mouseleave',handleTranslationEnd);
    
    function handleTranslationStart(e){
      console.log("translation start");
      e.preventDefault();
      translate_down=true;
      originalSentence=sentenceElem.textContent;  
      if(translated_text!=""){
        sentenceElem.innerHTML=translated_text;
      }else{
        getTranslation(originalSentence);
      }
    }
    
    function handleTranslationEnd(){
      translate_down=false;
      if(originalSentence)sentenceElem.textContent=originalSentence;
    }
    
    function getTranslation(text){
      sentenceElem.textContent="Translating...";
      console.log("userInfo:");
      console.log(userInfo);
      
      let userLang=document.getElementById('languageUserOptions').value;
      
      if(userLang.length>2){
        const lowerLang=userLang.toLowerCase();
        if(lang_conversion[lowerLang])userLang=lang_conversion[lowerLang];
      }
      
      let sourceLang=pagele_language;
      if(sourceLang&&sourceLang.length>2){
        const lowerSource=sourceLang.toLowerCase();
        if(lang_conversion[lowerSource])sourceLang=lang_conversion[lowerSource];
      }
      
      console.log("Using language for translation from",sourceLang,"to",userLang);
      console.log({
        task:'translate',
        text:text,
        source_lang:sourceLang,
        target_lang:userLang
      });
      
      sendSocketMessage({
        task:'translate',
        text:text,
        source_lang:sourceLang,
        target_lang:userLang
      });
    }
  }

  tutorialBtn.addEventListener(E,()=>{
    const tutorialModal=document.getElementById('tutorialModal'),
          tutorialContent=document.getElementById('tutorial-content');
    
    tutorialModal.style.display="block";
    
    fetch('tutorial.html')
      .then(response=>{
        if(!response.ok)throw new Error('Network response was not ok');
        return response.text();
      })
      .then(html=>tutorialContent.innerHTML=html)
      .catch(error=>{
        console.error('Error loading tutorial:',error);
        tutorialContent.innerHTML=`
          <div style="text-align: center; padding: 20px;">
            <h3>Error loading tutorial content</h3>
            <p>Please try again later.</p>
          </div>
        `;
      });
  });

  const foundBugBtn=document.getElementById('found-bug');
  foundBugBtn.addEventListener(E,()=>sendBugReport());

  document.querySelectorAll('.tip-button').forEach(button=>{
    button.addEventListener(E,async()=>{
      const amount=button.dataset.amount;
      await initiateTip(amount);
    });
  });

  document.getElementById('custom-tip-button').addEventListener(E,async()=>{
    const amount=document.getElementById('custom-tip').value;
    if(amount&&amount>0){
      await initiateTip(amount);
    }else{
      alert(getInterfaceString('enterValidAmount'));
    }
  });

  const manageSubscriptionBtn=document.getElementById('manage-subscription-btn');
  if(manageSubscriptionBtn){
    manageSubscriptionBtn.addEventListener(E,e=>e.preventDefault());
  }

  window.addEventListener(E,event=>{
    if(event.target==modalDiv)modalDiv.style.display="none";
  });

  document.addEventListener(E,event=>{
    const popups=document.querySelectorAll('.popup');
    if(popups.length>0){
      const clickedInsidePopup=Array.from(popups).some(popup=>popup.contains(event.target));
      const clickedOnWrongElement=event.target.classList.contains('wrong');
      const clickedOnPopupClose=event.target.classList.contains('popup-close');
      
      if(!clickedInsidePopup&&!clickedOnWrongElement&&!clickedOnPopupClose){
        popups.forEach(popup=>popup.remove());
        popupflag=false;
      }
    }
  });

  languageUserOptionsSelect.addEventListener('change',event=>{
    const selectedLang=event.target.value;
    console.log('Interface language changed to:',selectedLang);

    if(localStorage.getItem('token')){
      sendSocketMessage({
        task:'update_interface_language',
        language:selectedLang,
        token:localStorage.getItem('token')
      });
    }
  });

  drawer.style.display='none';
}

availableBooksBtn.addEventListener(E,()=>{
  loadAvailableBooks();
  drawer.classList.remove('open');
  setTimeout(()=>drawer.style.display='none',300);
});

availablePageleBtn.addEventListener(E,()=>{
  switchToMode('pagele');
  drawer.classList.remove('open');
  setTimeout(()=>drawer.style.display='none',300);
});