// ============================================
// Game Systems - 骰子判定與向前失敗機制
// ============================================

/**
 * 擲 D12 骰子
 * @returns {number} 1-12 的隨機數
 */
function rollD12() {
    return Math.floor(Math.random() * 12) + 1;
}

/**
 * 執行骰子檢定
 * @param {string} attribute - 使用的屬性 (authority/empathy/cunning/logic)
 * @param {number} difficulty - 難度值 (預設 10)
 * @param {Object} npc - NPC 對象 (可選)
 * @returns {Object} 檢定結果
 */
function performDiceCheck(attribute, difficulty = 10, npc = null) {
    // 獲取玩家屬性值
    const playerValue = gameState.playerAttributes[attribute] || 0;

    // 擲骰子
    const diceRoll = rollD12();

    // 計算總和
    let total = playerValue + diceRoll;

    // 檢查是否有屬性共鳴
    let resonance = false;
    let resonanceBonus = 0;

    if (npc && npc.tags) {
        // 檢查 NPC 標籤是否與使用的屬性匹配
        const matchingTags = npc.tags.filter(tagId => {
            const tag = NPC_TAGS[tagId];
            return tag && tag.attribute === attribute;
        });

        if (matchingTags.length > 0) {
            resonance = true;
            resonanceBonus = 2; // 共鳴給予 +2 加成
            total += resonanceBonus;
        }
    }

    // 判定成功或失敗
    const success = total >= difficulty;

    // 構建結果對象
    const result = {
        attribute: attribute,
        attributeName: SOCIAL_ATTRIBUTES[attribute]?.name || attribute,
        playerValue: playerValue,
        diceRoll: diceRoll,
        resonance: resonance,
        resonanceBonus: resonanceBonus,
        total: total,
        difficulty: difficulty,
        success: success,
        timestamp: Date.now()
    };

    // 記錄到歷史
    gameState.diceHistory.push(result);
    saveGameState();

    // 顯示骰子動畫
    if (typeof showDiceAnimation === 'function') {
        showDiceAnimation(diceRoll, success);
    }

    return result;
}

/**
 * 檢查是否存在違和感（玩家選錯屬性）
 * @param {string} attribute - 玩家選擇的屬性
 * @param {Object} npc - NPC 對象
 * @returns {boolean} 是否存在違和感
 */
function checkDissonance(attribute, npc) {
    if (!npc || !npc.tags || npc.tags.length === 0) {
        return false;
    }

    // 檢查是否有任何標籤與選擇的屬性匹配
    const hasMatch = npc.tags.some(tagId => {
        const tag = NPC_TAGS[tagId];
        return tag && tag.attribute === attribute;
    });

    // 如果沒有匹配，則存在違和感
    return !hasMatch;
}

/**
 * 生成判定結果描述（用於 UI 顯示）
 * @param {Object} checkResult - performDiceCheck 的返回結果
 * @returns {string} HTML 格式的結果描述
 */
function formatCheckResult(checkResult) {
    const { attributeName, playerValue, diceRoll, resonance, resonanceBonus, total, difficulty, success } = checkResult;

    let html = `<div class="dice-check-result ${success ? 'success' : 'failure'}">`;
    html += `<div class="check-header">`;
    html += `<span class="check-attribute">${attributeName}檢定</span>`;
    html += `<span class="check-status">${success ? '✓ 成功' : '✗ 失敗'}</span>`;
    html += `</div>`;
    html += `<div class="check-details">`;
    html += `<span>屬性值: ${playerValue}</span>`;
    html += `<span>+ 骰子: ${diceRoll}</span>`;
    if (resonance) {
        html += `<span class="resonance">+ 共鳴: ${resonanceBonus}</span>`;
    }
    html += `<span>= ${total}</span>`;
    html += `<span class="difficulty">目標: ${difficulty}</span>`;
    html += `</div>`;
    html += `</div>`;

    return html;
}

/**
 * 處理向前失敗（失敗後生成新的劇情線索）
 * @param {Object} checkResult - 判定結果
 * @param {Object} context - 當前情境
 * @returns {Object} 新的劇情狀態
 */
function handleFailForward(checkResult, context) {
    // 定義失敗後可能的後果類型
    const consequenceTypes = [
        {
            type: 'escalation',
            name: '情況升級',
            description: '失敗引發了更大的麻煩或衝突'
        },
        {
            type: 'exposure',
            name: '身份暴露',
            description: '你的真實意圖被察覺'
        },
        {
            type: 'time_pressure',
            name: '時間緊迫',
            description: '你失去了從容行動的機會'
        },
        {
            type: 'relationship_damage',
            name: '關係惡化',
            description: 'NPC 對你的態度變差'
        },
        {
            type: 'unintended_clue',
            name: '意外線索',
            description: '失敗中意外獲得了新的訊息'
        }
    ];

    // 隨機選擇一種後果（也可以根據情境智能選擇）
    const consequence = consequenceTypes[Math.floor(Math.random() * consequenceTypes.length)];

    return {
        ...context,
        consequence: consequence,
        failedAttribute: checkResult.attribute,
        shouldContinue: true
    };
}

/**
 * 生成選項按鈕（用於遊戲模式下的選擇）
 * @param {Array} options - 選項列表 [{ text, attribute, difficulty }]
 * @returns {string} HTML 格式的選項按鈕
 */
function generateGameOptions(options) {
    if (!options || options.length === 0) return '';

    let html = '<div class="game-options">';

    options.forEach((option, index) => {
        const attr = SOCIAL_ATTRIBUTES[option.attribute];
        html += `<button class="game-option-btn" data-index="${index}" data-attribute="${option.attribute}">`;
        html += `<span class="option-icon">${attr?.icon || '•'}</span>`;
        html += `<span class="option-text">${option.text}</span>`;
        html += `<span class="option-attribute">${attr?.name || option.attribute}</span>`;
        html += `</button>`;
    });

    html += '</div>';

    return html;
}

/**
 * 處理遊戲選項點擊
 * @param {number} optionIndex - 選項索引
 * @param {Array} options - 選項列表
 * @param {Object} npc - 當前 NPC
 * @returns {Promise<Object>} 處理結果
 */
async function handleGameOptionClick(optionIndex, options, npc = null) {
    const option = options[optionIndex];
    if (!option) {
        throw new Error('無效的選項索引');
    }

    // 執行骰子檢定
    const checkResult = performDiceCheck(
        option.attribute,
        option.difficulty || 10,
        npc
    );

    // 檢查違和感
    const hasDissonance = npc ? checkDissonance(option.attribute, npc) : false;

    // 構建 AI 提示
    let prompt = buildCheckPrompt(option.text, option.attribute, npc);

    // 如果存在違和感，添加違和感提示
    if (hasDissonance) {
        prompt += buildDissonancePrompt(option.attribute, npc);
    }

    // 如果失敗，添加向前失敗提示
    if (!checkResult.success) {
        const newContext = handleFailForward(checkResult, { npc });
        prompt += buildFailForwardPrompt();

        // 添加後果類型提示
        prompt += `\n\n[Consequence Type: ${newContext.consequence.name} - ${newContext.consequence.description}]`;
    }

    // 添加判定結果到提示
    prompt += `\n\n判定結果：\n`;
    prompt += `- 屬性值：${checkResult.playerValue}\n`;
    prompt += `- 骰子：D12 = ${checkResult.diceRoll}\n`;
    if (checkResult.resonance) {
        prompt += `- 共鳴加成：+${checkResult.resonanceBonus}\n`;
    }
    prompt += `- 總計：${checkResult.total} vs 難度 ${checkResult.difficulty}\n`;
    prompt += `- 結果：${checkResult.success ? '成功' : '失敗'}`;

    return {
        checkResult,
        prompt,
        hasDissonance
    };
}

/**
 * 初始化遊戲系統
 */
function initGameSystems() {
    console.log('✓ 遊戲系統已初始化');

    // 綁定事件監聽器
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('game-option-btn')) {
            const index = parseInt(e.target.dataset.index);
            const attribute = e.target.dataset.attribute;

            // 這裡需要從當前上下文獲取 options 和 npc
            // 實際實現時需要在全局狀態中存儲當前的選項
            if (gameState.currentOptions) {
                handleGameOptionClick(index, gameState.currentOptions, gameState.currentNPC)
                    .then(result => {
                        // 顯示判定結果
                        const resultHTML = formatCheckResult(result.checkResult);
                        addGameResultParagraph(resultHTML);

                        // 發送 AI 請求
                        if (typeof handleGameModeSubmit === 'function') {
                            handleGameModeSubmit(result.prompt);
                        }
                    })
                    .catch(error => {
                        console.error('處理選項失敗:', error);
                        if (typeof showToast === 'function') {
                            showToast(`錯誤: ${error.message}`, 'error');
                        }
                    });
            }
        }
    });
}

/**
 * 添加遊戲結果段落（用於顯示判定結果）
 * @param {string} resultHTML - 結果 HTML
 */
function addGameResultParagraph(resultHTML) {
    if (!state.currentDoc) return;

    const paragraph = {
        id: generateId(),
        content: resultHTML,
        source: 'system',
        timestamp: Date.now(),
        isGameResult: true
    };

    state.currentDoc.paragraphs.push(paragraph);

    if (typeof renderParagraphs === 'function') {
        renderParagraphs();
    }
}
