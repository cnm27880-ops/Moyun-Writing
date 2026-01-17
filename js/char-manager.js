// ============================================
// MoYun 墨韻 - Character Manager Module
// 角色管理：角色心理混音台、靈感抽屜、動態權重 Prompt
// ============================================

// ============================================
// Character CRUD Operations
// ============================================
function createCharacter() {
    if (!state.currentDoc) return;

    const newCharacter = {
        id: generateId(),
        name: '新角色',
        drives: {},
        autoSync: false
    };

    if (!state.currentDoc.characters) {
        state.currentDoc.characters = [];
    }

    state.currentDoc.characters.push(newCharacter);

    // 如果是第一個角色，自動設為焦點
    if (state.currentDoc.characters.length === 1) {
        state.currentDoc.focusCharacterId = newCharacter.id;
    }

    renderCharacterList();
    updateStatusBar();
    autoSave();
    showToast('已新增角色', 'success', 2000);
}

function deleteCharacter(characterId) {
    if (!state.currentDoc?.characters) return;

    const index = state.currentDoc.characters.findIndex(c => c.id === characterId);
    if (index === -1) return;

    const characterName = state.currentDoc.characters[index].name || '此角色';

    showConfirmModal('刪除角色', `確定要刪除「${characterName}」嗎？`, () => {
        state.currentDoc.characters.splice(index, 1);

        // 如果刪除的是焦點角色，重新設定焦點
        if (state.currentDoc.focusCharacterId === characterId) {
            state.currentDoc.focusCharacterId = state.currentDoc.characters[0]?.id || null;
        }

        renderCharacterList();
        updateStatusBar();
        autoSave();
        hideConfirmModal();
        showToast('角色已刪除', 'success', 2000);
    });
}

function setFocusCharacter(characterId) {
    if (!state.currentDoc) return;

    state.currentDoc.focusCharacterId = characterId;
    renderCharacterList();
    updateStatusBar();
    autoSave();
}

function updateCharacterName(characterId, name) {
    const character = state.currentDoc?.characters?.find(c => c.id === characterId);
    if (!character) return;

    character.name = name.trim() || '未命名角色';
    updateStatusBar();
    autoSave();
}

function updateCharacterDrive(characterId, driveId, value, isActive) {
    const character = state.currentDoc?.characters?.find(c => c.id === characterId);
    if (!character) return;

    if (isActive) {
        character.drives[driveId] = value;
    } else {
        delete character.drives[driveId];
    }

    // 更新 UI
    const driveItem = document.querySelector(`[data-character-id="${characterId}"] [data-drive-id="${driveId}"]`);
    if (driveItem) {
        driveItem.classList.toggle('active', isActive);
    }

    updateStatusBar();
    autoSave();
}

function toggleCharacterAutoSync(characterId, enabled) {
    const character = state.currentDoc?.characters?.find(c => c.id === characterId);
    if (!character) return;

    character.autoSync = enabled;
    autoSave();
}

// ============================================
// Character Analysis (AI)
// ============================================
async function analyzeCharacterState(characterId) {
    const character = state.currentDoc?.characters?.find(c => c.id === characterId);
    if (!character) return;

    if (!state.globalSettings.apiKey) {
        showToast('請先設定 API Key', 'error');
        return;
    }

    if (!state.currentDoc?.paragraphs?.length || state.currentDoc.paragraphs.length < 2) {
        showToast('故事內容太少，無法分析', 'warning');
        return;
    }

    // 設置分析狀態
    state.analyzingCharacterId = characterId;
    const analyzeBtn = document.querySelector(`[data-action="analyze"][data-character-id="${characterId}"]`);
    if (analyzeBtn) {
        analyzeBtn.classList.add('analyzing');
        analyzeBtn.innerHTML = '<span>分析中...</span>';
    }

    try {
        // 獲取最近的內容
        const recentContent = state.currentDoc.paragraphs
            .slice(-3)
            .map(p => p.content)
            .join('\n\n');

        const drivesList = Object.values(CORE_DRIVES)
            .map(d => d.id)
            .join(', ');

        const analysisPrompt = `Role: Psychoanalyst.
Task: Analyze the character "${character.name}" based on the story fragment below.
Output: Strictly valid JSON only. Do not output markdown code blocks. Do not output explanations.

Story Fragment:
${recentContent}

Metrics (0-100 or null if not applicable):
${drivesList}

JSON Format Example:
{"survival": 80, "logic": 20, "curiosity": null, ...}`;

        const response = await callAPIForAnalysis(analysisPrompt);

        // 除錯：輸出 API 回應
        console.log('API Response:', response);

        // 優化 JSON 提取邏輯：移除 Markdown 標記並提取 JSON
        let jsonText = response.trim();

        // 移除可能的 Markdown 標記（包括各種變體）
        jsonText = jsonText.replace(/```json\s*/gi, '');
        jsonText = jsonText.replace(/```javascript\s*/gi, '');
        jsonText = jsonText.replace(/```\s*/g, '');
        jsonText = jsonText.trim();

        // 嘗試多種方法提取 JSON
        let result = null;
        let jsonMatch = null;

        // 方法 1: 直接解析（如果整個回應就是 JSON）
        try {
            result = JSON.parse(jsonText);
            console.log('成功使用方法 1 解析 JSON');
        } catch (e) {
            // 方法 2: 使用貪婪匹配提取最外層的 {}
            jsonMatch = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
            if (!jsonMatch) {
                // 方法 3: 更寬鬆的匹配，處理嵌套結構
                jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            }

            if (jsonMatch) {
                try {
                    result = JSON.parse(jsonMatch[0]);
                    console.log('成功使用方法 2/3 解析 JSON');
                } catch (parseError) {
                    console.error('JSON 解析錯誤:', parseError);
                    console.error('嘗試解析的文字:', jsonMatch[0]);
                }
            }
        }

        if (result) {
            try {

                // 驗證返回的資料格式
                if (typeof result !== 'object' || result === null) {
                    throw new Error('返回的資料格式不正確');
                }

                // 更新角色驅動力並添加動畫效果
                let updatedCount = 0;
                Object.entries(result).forEach(([driveId, value]) => {
                    if (value !== null && CORE_DRIVES[driveId]) {
                        character.drives[driveId] = value;
                        updatedCount++;

                        // 添加視覺反饋
                        const slider = document.querySelector(
                            `[data-character-id="${characterId}"][data-drive-id="${driveId}"].drive-slider`
                        );
                        if (slider) {
                            animateSlider(slider, value);
                        }
                    }
                });

                if (updatedCount === 0) {
                    showToast('未能識別任何心理驅動力', 'warning', 3000);
                    return;
                }

                renderCharacterList();
                updateStatusBar();
                autoSave();
                showToast(`「${character.name}」心理分析完成 (更新 ${updatedCount} 項)`, 'success', 2000);
            } catch (validationError) {
                console.error('資料驗證錯誤:', validationError);
                showToast(`分析結果驗證失敗: ${validationError.message}`, 'error', 3000);
            }
        } else {
            console.error('無法從回應中提取 JSON:', response);
            showToast('沒有提取到有效的 JSON 資料，請檢查 API 回應格式', 'error', 3000);
            alert("分析失敗 (API 回傳內容)：\n" + response.substring(0, 500));
        }
    } catch (error) {
        showToast(`分析失敗: ${error.message}`, 'error');
    } finally {
        state.analyzingCharacterId = null;
        if (analyzeBtn) {
            analyzeBtn.classList.remove('analyzing');
            analyzeBtn.innerHTML = '<span>🧠</span><span>立即分析</span>';
        }
    }
}

// ============================================
// Slider Animation
// ============================================
function animateSlider(slider, targetValue) {
    const startValue = parseInt(slider.value);
    const diff = targetValue - startValue;
    const duration = 500;
    const startTime = performance.now();

    const drive = CORE_DRIVES[slider.dataset.driveId];

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + diff * easeProgress);

        slider.value = currentValue;
        slider.parentElement.querySelector('.drive-value').textContent = currentValue + '%';
        slider.style.background = `linear-gradient(to right, ${drive.color} 0%, ${drive.color} ${currentValue}%, var(--border) ${currentValue}%, var(--border) 100%)`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // 添加同步動畫效果
            slider.classList.add('synced');
            setTimeout(() => slider.classList.remove('synced'), 1000);
        }
    }

    requestAnimationFrame(animate);
}

// ============================================
// Auto Sync Trigger (心靈同步)
// ============================================
function triggerAutoSync() {
    if (state.isSliderDragging) return;

    state.currentDoc?.characters?.forEach(character => {
        if (character.autoSync && state.analyzingCharacterId !== character.id) {
            analyzeCharacterState(character.id);
        }
    });
}

// ============================================
// Inspiration Drawer - 靈感抽屜 (隨機衝突產生器)
// ============================================
async function generateConflict() {
    const focusCharacter = state.currentDoc?.characters?.find(
        c => c.id === state.currentDoc?.focusCharacterId
    );

    // 檢查是否有焦點角色
    if (!focusCharacter) {
        showToast('請先建立並選擇一個焦點角色', 'warning');
        return;
    }

    // 檢查角色是否有驅動力設定
    if (!focusCharacter.drives || Object.keys(focusCharacter.drives).length === 0) {
        showToast('請先為焦點角色設定心理驅動力', 'warning');
        return;
    }

    // 檢查 API Key
    if (!state.globalSettings.apiKey) {
        showToast('請先設定 API Key', 'error');
        return;
    }

    const inspirationContent = document.getElementById('inspirationContent');
    const generateBtn = document.getElementById('generateConflictBtn');

    // 顯示載入狀態
    inspirationContent.innerHTML = '<div class="inspiration-loading">正在生成劇情靈感...</div>';
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';

    try {
        // 獲取驅動力數據並排序
        const drives = Object.entries(focusCharacter.drives)
            .sort((a, b) => b[1] - a[1])
            .map(([driveId, value]) => ({
                id: driveId,
                name: CORE_DRIVES[driveId].name,
                value: value,
                prompt: CORE_DRIVES[driveId].prompt
            }));

        // 取前兩個最高的驅動力作為衝突來源
        const primaryDrive = drives[0];
        const secondaryDrive = drives[1] || drives[0]; // 如果只有一個驅動力，使用相同的

        // 構建提示
        const conflictPrompt = `你是一位專業的劇情顧問。請根據角色的心理驅動力，生成一個兩難的劇情衝突場景。

【角色資訊】
角色名稱：${escapeHtml(focusCharacter.name)}
主導驅動力：${primaryDrive.name} (${primaryDrive.value}%) - ${primaryDrive.prompt}
次要驅動力：${secondaryDrive.name} (${secondaryDrive.value}%) - ${secondaryDrive.prompt}

【要求】
1. 創造一個讓這兩個驅動力產生衝突的場景
2. 場景要具體、戲劇化，能引發角色的內心掙扎
3. 控制在 100-150 字以內
4. 使用第三人稱描述，不要使用項目符號或列表格式
5. 直接輸出場景描述，不要加標題或額外說明

範例格式：
「在廢墟深處，${escapeHtml(focusCharacter.name)}發現了一本記載著禁忌知識的古籍。翻開它,就能掌握改變世界的力量,但書頁上流淌的黑色液體散發著不祥的氣息。一個虛弱的聲音從黑暗中傳來,懇求他救命——但若停下閱讀,這本書可能會永遠消失。」

請生成類似的劇情衝突：`;

        const response = await callAPIForAnalysis(conflictPrompt);

        // 顯示結果
        inspirationContent.innerHTML = `<div class="inspiration-text">${escapeHtml(response.trim())}</div>`;

        // 平滑滾動到靈感抽屜
        const inspirationDrawer = document.querySelector('.inspiration-drawer');
        if (inspirationDrawer) {
            inspirationDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

    } catch (error) {
        inspirationContent.innerHTML = '<div class="inspiration-empty"><div class="inspiration-empty-icon">X</div><p class="inspiration-empty-text">生成失敗，請稍後再試</p></div>';
        showToast(`生成失敗: ${error.message}`, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '隨機衝突';
    }
}

// ============================================
// Dynamic Weight Prompt Generation - 動態權重 Prompt 生成
// ============================================
function getWeightDescription(value) {
    if (value >= 80) return '極度強烈的';
    if (value >= 40) return '顯著的';
    return '微弱但存在的';
}

function buildCharacterMindsetPrompt() {
    const focusCharacter = state.currentDoc?.characters?.find(
        c => c.id === state.currentDoc.focusCharacterId
    );

    if (!focusCharacter || Object.keys(focusCharacter.drives).length === 0) {
        return '';
    }

    const sortedDrives = Object.entries(focusCharacter.drives)
        .sort((a, b) => b[1] - a[1]);

    if (sortedDrives.length === 0) return '';

    const drivesDescription = sortedDrives.map(([driveId, value]) => {
        const drive = CORE_DRIVES[driveId];
        const strength = getWeightDescription(value);
        return `- ${drive.prompt} (${value}%): 這是${strength}驅動力。`;
    }).join('\n');

    // 找出主導動力和抑制動力
    const dominantDrive = sortedDrives[0];
    const conflictDrives = sortedDrives.slice(1).filter(([_, v]) => v >= 30);

    let instruction = '';
    if (conflictDrives.length > 0) {
        const conflictNames = conflictDrives.map(([id, _]) => CORE_DRIVES[id].name).join('、');
        instruction = `請描寫「${CORE_DRIVES[dominantDrive[0]].name}」與「${conflictNames}」之間的心理拉扯，但讓前者最終勝出。`;
    } else {
        instruction = `請讓「${CORE_DRIVES[dominantDrive[0]].name}」成為推動情節發展的主要力量。`;
    }

    return `【內心衝突引擎 - Internal Conflict Engine】
目標角色：${focusCharacter.name}
當前驅動力：
${drivesDescription}

寫作指引：${instruction}`;
}
