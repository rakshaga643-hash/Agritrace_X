/**
 * AgriTraceX — i18n Multilingual Engine v2
 * Fixed: dropdown z-index, overflow, positioning, accessibility
 * Supports: en, hi, ta, te, ml, kn, mr
 */
const LANGS = {
  en: { name:'English',   native:'English',  locale:'en-IN' },
  hi: { name:'Hindi',     native:'हिंदी',    locale:'hi-IN' },
  ta: { name:'Tamil',     native:'தமிழ்',   locale:'ta-IN' },
  te: { name:'Telugu',    native:'తెలుగు',  locale:'te-IN' },
  ml: { name:'Malayalam', native:'മലയാളം',  locale:'ml-IN' },
  kn: { name:'Kannada',   native:'ಕನ್ನಡ',   locale:'kn-IN' },
  mr: { name:'Marathi',   native:'मराठी',    locale:'mr-IN' },
};

const T = {
  login:             { en:'Login',           hi:'लॉगिन',         ta:'உள்நுழை',       te:'లాగిన్',        ml:'ലോഗിൻ',         kn:'ಲಾಗಿನ್',        mr:'लॉगिन' },
  logout:            { en:'Sign Out',         hi:'साइन आउट',      ta:'வெளியேறு',      te:'సైన్ అవుట్',    ml:'സൈൻ ഔട്ട്',    kn:'ಸೈನ್ ಔಟ್',      mr:'बाहेर पडा' },
  welcome:           { en:'Welcome',          hi:'स्वागत है',     ta:'வரவேற்கிறோம்',  te:'స్వాగతం',       ml:'സ്വാഗതം',       kn:'ಸ್ವಾಗತ',         mr:'स्वागत' },
  dashboard:         { en:'Dashboard',        hi:'डैशबोर्ड',      ta:'டாஷ்போர்டு',    te:'డాష్‌బోర్డ్',   ml:'ഡാഷ്‌ബോർഡ്',   kn:'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', mr:'डॅशबोर्ड' },
  platform:          { en:'AI Powered Geospatial Agricultural Intelligence Platform', hi:'एआई संचालित भू-स्थानिक कृषि बुद्धिमत्ता मंच', ta:'AI இயக்கும் புவியியல் வேளாண்மை நுண்ணறிவு தளம்', te:'AI ఆధారిత జియోస్పేషియల్ వ్యవసాయ మేధా వేదిక', ml:'AI ഭൂസ്ഥാനിക കൃഷി ബുദ്ധി പ്ലാറ്റ്ഫോം', kn:'AI ಭೌಗೋಳಿಕ ಕೃಷಿ ಬುದ್ಧಿಮತ್ತೆ ವೇದಿಕೆ', mr:'AI भू-स्थानिक कृषी बुद्धिमत्ता व्यासपीठ' },
  startMonitor:      { en:'Start Monitoring', hi:'निगरानी शुरू करें', ta:'கண்காணிப்பு தொடங்கு', te:'పర్యవేక్షణ ప్రారంభించు', ml:'നിരീക്ഷണം ആരംഭിക്കുക', kn:'ಮಾನಿಟರಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ', mr:'निरीक्षण सुरू करा' },
  sensorData:        { en:'Sensor Data',      hi:'सेंसर डेटा',    ta:'சென்சார் தரவு',  te:'సెన్సార్ డేటా',  ml:'സെൻസർ ഡേറ്റ',  kn:'ಸೆನ್ಸಾರ್ ಡೇಟಾ',  mr:'सेन्सर डेटा' },
  weatherUpdates:    { en:'Weather Updates',  hi:'मौसम अपडेट',    ta:'வானிலை புதுப்பிப்புகள்', te:'వాతావరణ నవీకరణలు', ml:'കാലാവസ്ഥ അപ്ഡേറ്റ്', kn:'ಹವಾಮಾನ ನವೀಕರಣ', mr:'हवामान अद्यतने' },
  aiAnalysis:        { en:'AI Analysis',      hi:'एआई विश्लेषण',  ta:'AI பகுப்பாய்வு', te:'AI విశ్లేషణ',    ml:'AI വിശകലനം',    kn:'AI ವಿಶ್ಲೇಷಣೆ',   mr:'AI विश्लेषण' },
  save:              { en:'Save',             hi:'सहेजें',        ta:'சேமி',           te:'సేవ్ చేయి',     ml:'സേവ് ചെയ്യുക',  kn:'ಉಳಿಸಿ',          mr:'जतन करा' },
  cancel:            { en:'Cancel',           hi:'रद्द करें',     ta:'ரத்து செய்',     te:'రద్దు చేయి',    ml:'റദ്ദാക്കുക',    kn:'ರದ್ದು ಮಾಡಿ',     mr:'रद्द करा' },
  home:              { en:'Home',             hi:'होम',           ta:'முகப்பு',        te:'హోమ్',           ml:'ഹോം',           kn:'ಹೋಮ್',           mr:'मुखपृष्ठ' },
  farmer:            { en:'Farmer',           hi:'किसान',         ta:'விவசாயி',        te:'రైతు',           ml:'കർഷകൻ',         kn:'ರೈತ',            mr:'शेतकरी' },
  drone:             { en:'Drone',            hi:'ड्रोन',         ta:'ட்ரோன்',         te:'డ్రోన్',         ml:'ഡ്രോൺ',         kn:'ಡ್ರೋನ್',         mr:'ड्रोन' },
  gisMap:            { en:'GIS Map',          hi:'जीआईएस मैप',   ta:'GIS வரைபடம்',    te:'GIS మ్యాప్',    ml:'GIS മാപ്പ്',    kn:'GIS ನಕ್ಷೆ',      mr:'GIS नकाशा' },
  images:            { en:'Images',           hi:'छवियाँ',        ta:'படங்கள்',        te:'చిత్రాలు',       ml:'ചിത്രങ്ങൾ',    kn:'ಚಿತ್ರಗಳು',      mr:'प्रतिमा' },
  aiIntel:           { en:'AI Intel',         hi:'एआई इंटेल',    ta:'AI நுண்ணறிவு',   te:'AI ఇంటెల్',     ml:'AI ഇന്റൽ',     kn:'AI ಇಂಟೆಲ್',     mr:'AI माहिती' },
  irrigationAnalysis:{ en:'Irrigation Analysis', hi:'सिंचाई विश्लेषण', ta:'நீர்ப்பாசன பகுப்பாய்வு', te:'నీటిపారుదల విశ్లేషణ', ml:'ജലസേചന വിശകലനം', kn:'ನೀರಾವರಿ ವಿಶ್ಲೇಷಣೆ', mr:'सिंचन विश्लेषण' },
  fertilizerAnalysis:{ en:'Fertilizer Analysis', hi:'उर्वरक विश्लेषण', ta:'உர பகுப்பாய்வு', te:'ఎరువుల విశ్లేషణ', ml:'വളം വിശകലനം', kn:'ಗೊಬ್ಬರ ವಿಶ್ಲೇಷಣೆ', mr:'खत विश्लेषण' },
  yieldPrediction:   { en:'Yield Prediction', hi:'उपज पूर्वानुमान', ta:'மகசூல் கணிப்பு', te:'దిగుబడి అంచనా', ml:'വിളവ് പ്രവചനം', kn:'ಇಳುವರಿ ಮುನ್ಸೂಚನೆ', mr:'उत्पादन अंदाज' },
  disasterRisk:      { en:'Disaster Risk',    hi:'आपदा जोखिम',   ta:'பேரழிவு அபாயம்', te:'విపత్తు ప్రమాదం', ml:'ദുരന്ത അപകടം', kn:'ವಿಪತ್ತು ಅಪಾಯ',  mr:'आपत्ती धोका' },
  runAnalysis:       { en:'Run Full Analysis', hi:'पूर्ण विश्लेषण चलाएं', ta:'முழு பகுப்பாய்வு இயக்கு', te:'పూర్తి విశ్లేషణ అమలు', ml:'പൂർണ്ണ വിശകലനം', kn:'ಸಂಪೂರ್ಣ ವಿಶ್ಲೇಷಣೆ', mr:'संपूर्ण विश्लेषण' },
  uploadImage:       { en:'Upload & Pin on Map', hi:'मानचित्र पर अपलोड करें', ta:'வரைபடத்தில் பதிவேற்றவும்', te:'మ్యాప్‌లో అప్‌లోడ్', ml:'മാപ്പിൽ അപ്‌ലോഡ്', kn:'ನಕ್ಷೆಯಲ್ಲಿ ಅಪ್‌ಲೋಡ್', mr:'नकाशावर अपलोड' },
  liveTelemetry:     { en:'Live Telemetry',   hi:'लाइव टेलीमेट्री', ta:'நேரடி தொலைமிதி', te:'లైవ్ టెలిమెట్రీ', ml:'തത്സമയ ടെലിമെട്രി', kn:'ನೇರ ಟೆಲಿಮೆಟ್ರಿ', mr:'थेट टेलीमेट्री' },
  registeredFarms:   { en:'Registered Farms', hi:'पंजीकृत खेत',   ta:'பதிவு செய்யப்பட்ட பண்ணைகள்', te:'నమోదైన వ్యవసాయాలు', ml:'രജിസ്റ്റർ ഫാമുകൾ', kn:'ನೋಂದಾಯಿತ ಜಮೀನುಗಳು', mr:'नोंदणीकृत शेते' },
  hectaresMapped:    { en:'Hectares Mapped',  hi:'मैप किए हेक्टेयर', ta:'வரைபடத்தில் ஹெக்டேர்', te:'మ్యాప్ హెక్టార్లు', ml:'മ്യാപ്പ് ഹെക്ടർ', kn:'ನಕ್ಷೆ ಹೆಕ್ಟೇರ್', mr:'मॅप हेक्टर' },
  droneMissions:     { en:'Drone Missions',   hi:'ड्रोन मिशन',   ta:'ட்ரோன் பணிகள்',  te:'డ్రోన్ మిషన్లు', ml:'ഡ്രോൺ ദൗത്യങ്ങൾ', kn:'ಡ್ರೋನ್ ಮಿಷನ್‌ಗಳು', mr:'ड्रोन मोहिमा' },
  selectRole:        { en:'Select your role to continue', hi:'जारी रखने के लिए भूमिका चुनें', ta:'தொடர பாத்திரத்தை தேர்வு செய்யவும்', te:'కొనసాగడానికి పాత్రను ఎంచుకోండి', ml:'തുടരാൻ റോൾ തിരഞ്ഞെടുക്കുക', kn:'ಮುಂದುವರೆಯಲು ಪಾತ್ರ ಆಯ್ಕೆ ಮಾಡಿ', mr:'सुरू ठेवण्यासाठी भूमिका निवडा' },
  signIn:            { en:'Sign In',          hi:'साइन इन',       ta:'உள்நுழை',        te:'సైన్ ఇన్',      ml:'സൈൻ ఇన్',      kn:'ಸೈನ್ ಇನ್',      mr:'साइन इन' },
  productionSystem:  { en:'PRODUCTION SYSTEM', hi:'उत्पादन प्रणाली', ta:'உற்பத்தி அமைப்பு', te:'ఉత్పత్తి వ్యవస్థ', ml:'ഉൽപ്പാദന സംവിധാനം', kn:'ಉತ್ಪಾದನ ವ್ಯವಸ್ಥೆ', mr:'उत्पादन प्रणाली' },
  systemOnline:      { en:'SYSTEM ONLINE',    hi:'सिस्टम ऑनलाइन', ta:'கணினி ஆன்லைன்', te:'సిస్టమ్ ఆన్‌లైన్', ml:'സിസ്റ്റം ഓൺലൈൻ', kn:'ಸಿಸ್ಟಮ್ ಆನ್‌ಲೈನ್', mr:'सिस्टम ऑनलाइन' },
  commandCentre:     { en:'Agricultural Intelligence Command Centre', hi:'कृषि बुद्धिमत्ता कमान केंद्र', ta:'வேளாண்மை நுண்ணறிவு கட்டளை மையம்', te:'వ్యవసాయ మేధా కమాండ్ సెంటర్', ml:'കൃഷി ബുദ్ధి കമാൻഡ് സെന്റർ', kn:'ಕೃಷಿ ಬುದ್ಧಿಮತ್ತೆ ಕೇಂದ್ರ', mr:'कृषी बुद्धिमत्ता कमांड केंद्र' },
  saveFarmland:      { en:'Save Farmland to Database', hi:'खेत डेटाबेस में सहेजें', ta:'பண்ணையை தரவுத்தளத்தில் சேமி', te:'వ్యవసాయాన్ని డేటాబేస్‌లో సేవ్ చేయి', ml:'ഫാം ഡാറ്റാബേസിൽ സേവ്', kn:'ಫಾರ್ಮ್ ಡೇಟಾಬೇಸ್‌ಗೆ ಉಳಿಸಿ', mr:'शेत डेटाबेसमध्ये जतन' },
  locateMe:          { en:'Locate My Position', hi:'मेरी स्थिति खोजें', ta:'என் இருப்பிடம் கண்டுபிடி', te:'నా స్థానాన్ని గుర్తించు', ml:'എന്റെ സ్ഥానം കണ്ടെത്തുക', kn:'ನನ್ನ ಸ್ಥಾನ ಹುಡುಕಿ', mr:'माझे स्थान शोधा' },
  sendTelemetry:     { en:'Send Telemetry Packet', hi:'टेलीमेट्री पैकेट भेजें', ta:'தொலைமிதி தொகுப்பை அனுப்பு', te:'టెలిమెట్రీ ప్యాకెట్ పంపండి', ml:'ടെലിమെട్రి పాക్కెట്ట് അയക്കുക', kn:'ಟೆಲಿಮೆಟ್ರಿ ಪ್ಯಾಕೆಟ್ ಕಳುಹಿಸಿ', mr:'टेलिमेट्री पॅकेट पाठवा' },
  overallScore:      { en:'Overall Farm Health Score', hi:'समग्र फार्म स्वास्थ्य स्कोर', ta:'ஒட்டுமொத்த பண்ணை ஆரோக்கிய மதிப்பெண்', te:'మొత్తం వ్యవసాయ ఆరోగ్య స్కోర్', ml:'ഫാം ആരോഗ്യ സ്കോർ', kn:'ಕೃಷಿ ಆರೋಗ్య ಅಂಕ', mr:'शेत आरोग्य गुण' },
  selectLang:        { en:'Select Language',  hi:'भाषा चुनें',   ta:'மொழி தேர்வு',    te:'భాష ఎంచుకోండి', ml:'ഭാഷ തിരഞ്ഞെടുക്കുക', kn:'ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ', mr:'भाषा निवडा' },
};

// ── Core engine ───────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('agri_lang') || 'en';

function t(key) {
  const entry = T[key];
  if (!entry) return key;
  return entry[currentLang] || entry['en'] || key;
}

function applyLang(lang) {
  if (!LANGS[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('agri_lang', lang);
  document.documentElement.lang = LANGS[lang].locale;

  // Translate all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });

  // Placeholder-specific
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // Sync voice language
  if (typeof setVoiceLang === 'function') setVoiceLang(LANGS[lang].locale);

  // Fade transition
  document.body.classList.add('lang-switching');
  setTimeout(() => document.body.classList.remove('lang-switching'), 220);

  // Update all selector widgets on page
  document.querySelectorAll('.lang-option').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === lang);
  });
  document.querySelectorAll('#lang-current').forEach(el => {
    el.textContent = LANGS[lang].native;
  });
}

// ── Build one selector widget ─────────────────────────────────────────────────
function buildOneLangSelector(target) {
  const wrap = document.createElement('div');
  wrap.className = 'lang-selector';
  wrap.setAttribute('role', 'navigation');
  wrap.setAttribute('aria-label', 'Language selector');

  // Globe SVG
  const globeSVG = `<svg class="lang-trigger-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>`;
  const caretSVG = `<svg class="lang-trigger-caret" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
  const checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

  const optionsHTML = Object.entries(LANGS).map(([code, l]) => `
    <div class="lang-option${code === currentLang ? ' active' : ''}"
         data-lang="${code}"
         role="option"
         tabindex="0"
         aria-selected="${code === currentLang}"
         aria-label="${l.name} — ${l.native}">
      <div class="lang-opt-left">
        <span class="lang-opt-name">${l.native}</span>
        <span class="lang-opt-en">${l.name !== l.native ? l.name : ''}</span>
      </div>
      <div class="lang-opt-check">${checkSVG}</div>
    </div>`).join('');

  wrap.innerHTML = `
    <button class="lang-trigger"
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-label="Select language — currently ${LANGS[currentLang].name}"
            onclick="toggleLangDropdown(this)">
      ${globeSVG}
      <span id="lang-current" class="lang-trigger-label">${LANGS[currentLang].native}</span>
      ${caretSVG}
    </button>
    <div class="lang-dropdown" role="listbox" aria-label="Available languages">
      <div class="lang-dropdown-header">${t('selectLang')}</div>
      ${optionsHTML}
    </div>`;

  // Keyboard nav within dropdown
  wrap.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectLang(opt.dataset.lang, wrap);
      }
    });
    opt.addEventListener('click', () => selectLang(opt.dataset.lang, wrap));
  });

  target.prepend(wrap);
}

function toggleLangDropdown(btn) {
  const selector = btn.closest('.lang-selector');
  const isOpen   = selector.classList.contains('open');

  // Close all open selectors first
  document.querySelectorAll('.lang-selector.open').forEach(s => {
    s.classList.remove('open');
    s.querySelector('.lang-trigger')?.setAttribute('aria-expanded','false');
  });

  if (!isOpen) {
    selector.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function selectLang(lang, wrap) {
  applyLang(lang);
  // Close dropdown
  document.querySelectorAll('.lang-selector.open').forEach(s => {
    s.classList.remove('open');
    s.querySelector('.lang-trigger')?.setAttribute('aria-expanded','false');
  });
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.lang-selector')) {
    document.querySelectorAll('.lang-selector.open').forEach(s => {
      s.classList.remove('open');
      s.querySelector('.lang-trigger')?.setAttribute('aria-expanded','false');
    });
  }
}, true);

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.lang-selector.open').forEach(s => {
      s.classList.remove('open');
      s.querySelector('.lang-trigger')?.setAttribute('aria-expanded','false');
    });
  }
});

// ── Build selectors on all target containers ──────────────────────────────────
function buildLangSelectors() {
  // Remove any previously injected selectors (prevent duplicates)
  document.querySelectorAll('.lang-selector').forEach(el => el.remove());

  const targets = [
    document.querySelector('.dash-nav-right'),
    document.querySelector('.gov-topbar-right'),
  ].filter(Boolean);

  if (targets.length === 0) {
    // Fallback: inject into body top-right
    const fallback = document.createElement('div');
    fallback.style.cssText = 'position:fixed;top:10px;right:16px;z-index:99999;';
    document.body.appendChild(fallback);
    buildOneLangSelector(fallback);
  } else {
    targets.forEach(t => buildOneLangSelector(t));
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildLangSelectors();
  applyLang(currentLang);
});

// Expose globally
window.t           = t;
window.applyLang   = applyLang;
window.LANGS       = LANGS;
window.toggleLangDropdown = toggleLangDropdown;
window.selectLang  = selectLang;
