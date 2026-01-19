// ============================================
// Firebase Configuration
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyAwACDkdakqOAT9I2bwbN0btMnGI9v_njU",
  authDomain: "limbus-map.firebaseapp.com",
  databaseURL: "https://limbus-map-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "limbus-map",
  storageBucket: "limbus-map.firebasestorage.app",
  messagingSenderId: "476759549750",
  appId: "1:476759549750:web:483948327756763ea17597",
  measurementId: "G-LB2J0DC2SB"
};

// Initialize Firebase (only if config is set)
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;

function isFirebaseConfigured() {
    return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
}

if (isFirebaseConfigured()) {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDB = firebase.database();
        console.log('✓ Firebase 初始化成功');
    } catch (error) {
        console.error('✗ Firebase 初始化失敗:', error);
    }
} else {
    console.log('ℹ Firebase 尚未設定，使用本地儲存模式');
}

// ============================================
// Constants & Storage Keys
// ============================================
const STORAGE = {
    GLOBAL_SETTINGS: 'moyun_global_settings',
    DOC_INDEX: 'moyun_doc_index',
    DOC_PREFIX: 'moyun_doc_',
    WORLD_LIBRARY: 'moyun_world_library'  // 世界觀圖書館
};

const DEFAULT_GLOBAL_SETTINGS = {
    apiFormat: 'openrouter',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: '',
    modelName: 'anthropic/claude-sonnet-4',
    temperature: 0.8,
    savedEndpoints: [
        'https://openrouter.ai/api/v1/chat/completions',
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    ],  // 常用 Endpoint 列表（雲端同步）
    savedModels: [
        'anthropic/claude-sonnet-4',
        'gemini-3-pro-preview'
    ],     // 常用 Model 列表（雲端同步）
    defaultWorldSetting: '',  // 預設世界觀
    defaultCustomPrompt: '',  // 預設系統指令
    authorStyleProfile: ''    // 文風基因 (Style DNA)
};

// ============================================
// Core Drives Database - 角色心理混音台
// ============================================
const CORE_DRIVES = {
    survival: {
        id: 'survival',
        name: '生存本能',
        icon: '🛡️',
        color: '#E57373',
        prompt: '生存本能 (優先保命，恐懼死亡，對威脅極度敏感)'
    },
    logic: {
        id: 'logic',
        name: '絕對理智',
        icon: '🧊',
        color: '#64B5F6',
        prompt: '絕對理智 (計算得失，壓抑情感，追求效率與邏輯)'
    },
    curiosity: {
        id: 'curiosity',
        name: '狂熱求知',
        icon: '🔥',
        color: '#FFB74D',
        prompt: '狂熱求知 (探索未知，不計代價，對知識癡迷)'
    },
    love: {
        id: 'love',
        name: '情感羈絆',
        icon: '💗',
        color: '#F06292',
        prompt: '情感羈絆 (重視特定對象，溫柔守護，為愛犧牲)'
    },
    destruction: {
        id: 'destruction',
        name: '毀滅衝動',
        icon: '💀',
        color: '#8D6E63',
        prompt: '毀滅衝動 (暴力傾向，破壞慾望，混亂中找尋快感)'
    },
    duty: {
        id: 'duty',
        name: '道德責任',
        icon: '⚖️',
        color: '#81C784',
        prompt: '道德責任 (堅持原則，正義感強烈，無法容忍不公)'
    },
    pride: {
        id: 'pride',
        name: '傲慢自尊',
        icon: '👑',
        color: '#BA68C8',
        prompt: '傲慢自尊 (維護顏面，不願示弱，追求優越感)'
    },
    greed: {
        id: 'greed',
        name: '貪婪慾望',
        icon: '💎',
        color: '#4DB6AC',
        prompt: '貪婪慾望 (渴求力量、財富或資源，永不滿足)'
    }
};

const DEFAULT_CHARACTER = {
    id: '',
    name: '',
    drives: {},  // { driveId: weight (0-100) }
    autoSync: false
};

// ============================================
// Logic Presets - AI 底層邏輯模式
// ============================================
const LOGIC_PRESETS = {
    'gemini': {
        name: 'Gemini: 深度邏輯 (Protocol)',
        instruction: `**【執行協議】**\n你必須嚴格遵守「三段式思考」：\n1. 感知：描寫環境與微表情。\n2. 判斷：分析局勢與風險。\n3. 行動：最後才輸出對白。\n\n**【絕對禁令】**\n禁止平鋪直敘、禁止總結劇情、禁止解釋象徵。`
    },
    'claude': {
        name: 'Claude: 文學沉浸 (Immersion)',
        instruction: `<style_guide>\n核心原則：Show, Don't Tell。\n優先順序：觸覺 > 溫覺 > 嗅覺 > 聽覺 > 視覺。\n請模仿人類作家的非線性敘事，允許對話破碎與留白。\n</style_guide>`
    },
    'custom': {
        name: '自訂模式 (進階)',
        instruction: '' // 使用者自訂
    }
};

// ============================================
// Style Tags Configuration
// ============================================
const STYLE_TAGS = {
    immersive: {
        name: '沉浸',
        icon: '🍃',
        tooltip: '沉浸描寫',
        prompt: '[System: 本段落請側重「環境氛圍與五感描寫」。放慢敘事節奏，細緻刻畫光影、氣味、聲音等細節。]'
    },
    dialogue: {
        name: '對話',
        icon: '🗨️',
        tooltip: '對話互動',
        prompt: '[System: 本段落請側重「角色互動與語言交流」。透過對話內容與肢體語言來展現角色關係與張力。]'
    },
    action: {
        name: '動作',
        icon: '⚡',
        tooltip: '動作場面',
        prompt: '[System: 本段落請側重「動態與物理描寫」。使用緊湊有力的句式，強調動作的連貫性、速度感與結果。]'
    },
    psychology: {
        name: '心理',
        icon: '💭',
        tooltip: '心理獨白',
        prompt: '[System: 本段落請側重「內心獨白與情感轉折」。深入挖掘角色當下的思緒、矛盾與潛意識活動。]'
    },
    spicy: {
        name: '張力',
        icon: '🌹',
        tooltip: '張力/尺度',
        prompt: '[System: 本段落請側重「感官刺激與慾望展現」。解除描寫限制，大膽描寫肢體接觸與生理反應。]'
    }
};

const DEFAULT_DOC_DATA = {
    title: '未命名文檔',
    paragraphs: [],
    characters: [],  // 角色心理混音台：[{ id, name, drives: { driveId: weight }, autoSync }]
    focusCharacterId: null,  // 當前焦點角色
    logicMode: 'claude',  // 底層邏輯模式：gemini / claude / custom
    worldSetting: '',
    customPrompt: '',  // 只在 custom 模式下使用
    // 角色印象筆記
    aiCharacterNote: '',
    userCharacterNote: ''
};

// ============================================
// Application State
// ============================================
let state = {
    currentDocId: null,
    docIndex: [],
    globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
    currentDoc: null,
    isLoading: false,
    lastScrollY: 0,
    navbarHidden: false,
    // Character Mindset Mixer
    isSliderDragging: false,  // 防止自動同步與手動拖拉衝突
    analyzingCharacterId: null,  // 正在分析的角色 ID
    // Style Tags & Director Mode
    activeStyleTags: new Set(),  // 選中的風格標籤 (支援複選)
    directorMode: false  // 導演模式開關
};
