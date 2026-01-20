// ============================================
// Game State - 社交屬性系統 (TRPG System)
// ============================================

// ============================================
// 社交屬性定義 (Social Attributes)
// ============================================
const SOCIAL_ATTRIBUTES = {
    authority: {
        id: 'authority',
        name: '威儀 (Authority)',
        description: '對抗傲慢、守序、膽怯',
        icon: '👑',
        color: '#9C27B0',
        range: [0, 10]
    },
    empathy: {
        id: 'empathy',
        name: '共情 (Empathy)',
        description: '對抗創傷、善良、感性',
        icon: '💗',
        color: '#E91E63',
        range: [0, 10]
    },
    cunning: {
        id: 'cunning',
        name: '機變 (Cunning)',
        description: '對抗貪婪、多疑、狡詐',
        icon: '🦊',
        color: '#FF9800',
        range: [0, 10]
    },
    logic: {
        id: 'logic',
        name: '理性 (Logic)',
        description: '對抗博學、冷靜、務實',
        icon: '🧠',
        color: '#2196F3',
        range: [0, 10]
    }
};

// ============================================
// NPC 標籤系統
// ============================================
const NPC_TAGS = {
    // 威儀相關
    arrogant: { name: '傲慢', attribute: 'authority', description: '高傲自大，輕視他人' },
    lawful: { name: '守序', attribute: 'authority', description: '嚴格遵守規則與秩序' },
    timid: { name: '膽怯', attribute: 'authority', description: '畏懼權威，缺乏勇氣' },

    // 共情相關
    traumatized: { name: '創傷', attribute: 'empathy', description: '過去的創傷影響行為' },
    kind: { name: '善良', attribute: 'empathy', description: '富有同情心，樂於助人' },
    emotional: { name: '感性', attribute: 'empathy', description: '情感豐富，易受感動' },

    // 機變相關
    greedy: { name: '貪婪', attribute: 'cunning', description: '渴求利益，不擇手段' },
    suspicious: { name: '多疑', attribute: 'cunning', description: '不輕易信任他人' },
    cunning: { name: '狡詐', attribute: 'cunning', description: '善於欺騙與操縱' },

    // 理性相關
    learned: { name: '博學', attribute: 'logic', description: '知識淵博，重視理性' },
    calm: { name: '冷靜', attribute: 'logic', description: '不易激動，保持理智' },
    pragmatic: { name: '務實', attribute: 'logic', description: '注重實際利益與結果' },

    // 特殊標籤
    hypocrite: { name: '偽善者', attribute: 'special', description: '表面善良但內心陰暗' }
};

// ============================================
// 遊戲狀態
// ============================================
let gameState = {
    // 角色屬性 (範圍 0-10)
    playerAttributes: {
        authority: 5,
        empathy: 5,
        cunning: 5,
        logic: 5
    },

    // 可分配點數
    availablePoints: 10,

    // 當前場景
    currentScene: null,

    // 當前 NPC
    currentNPC: null,

    // 骰子歷史
    diceHistory: [],

    // 是否已創建角色
    characterCreated: false,

    // 遊戲模式啟用狀態
    gameMode: false
};

// ============================================
// 初始化遊戲狀態
// ============================================
function initGameState() {
    // 嘗試從 localStorage 讀取
    const saved = localStorage.getItem('moyun_game_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState = { ...gameState, ...parsed };
            console.log('✓ 遊戲狀態已載入');
        } catch (e) {
            console.warn('載入遊戲狀態失敗:', e);
        }
    }
}

// ============================================
// 儲存遊戲狀態
// ============================================
function saveGameState() {
    try {
        localStorage.setItem('moyun_game_state', JSON.stringify(gameState));
        console.log('✓ 遊戲狀態已儲存');
    } catch (e) {
        console.error('儲存遊戲狀態失敗:', e);
    }
}

// ============================================
// 角色創建
// ============================================
function createCharacter(attributes) {
    // 驗證點數總和
    const total = Object.values(attributes).reduce((sum, val) => sum + val, 0);
    const baseTotal = Object.keys(SOCIAL_ATTRIBUTES).length * 5; // 基礎值總和 (4 * 5 = 20)
    const expectedTotal = baseTotal + 10; // 基礎值 + 可分配點數

    if (total !== expectedTotal) {
        throw new Error(`屬性點數總和必須為 ${expectedTotal}，目前為 ${total}`);
    }

    // 驗證範圍
    for (const [key, value] of Object.entries(attributes)) {
        if (value < 0 || value > 10) {
            throw new Error(`${key} 必須在 0-10 之間`);
        }
    }

    gameState.playerAttributes = attributes;
    gameState.characterCreated = true;
    gameState.availablePoints = 0;
    saveGameState();

    console.log('✓ 角色創建完成:', gameState.playerAttributes);
    return true;
}

// ============================================
// 重置角色
// ============================================
function resetCharacter() {
    gameState.playerAttributes = {
        authority: 5,
        empathy: 5,
        cunning: 5,
        logic: 5
    };
    gameState.availablePoints = 10;
    gameState.characterCreated = false;
    gameState.diceHistory = [];
    saveGameState();

    console.log('✓ 角色已重置');
}

// ============================================
// 獲取屬性描述
// ============================================
function getAttributeDescription(attributeId, value) {
    const attr = SOCIAL_ATTRIBUTES[attributeId];
    if (!attr) return '';

    let level = '';
    if (value <= 2) level = '極低';
    else if (value <= 4) level = '較低';
    else if (value <= 6) level = '中等';
    else if (value <= 8) level = '較高';
    else level = '極高';

    return `${attr.name}: ${value}/10 (${level})`;
}

// ============================================
// 切換遊戲模式
// ============================================
function toggleGameMode() {
    gameState.gameMode = !gameState.gameMode;
    saveGameState();
    return gameState.gameMode;
}
