// ============================================
// MoYun 墨韻 - Main Application Logic
// ============================================

        function createDocument() {
            // Save current document first
            if (state.currentDocId) {
                saveCurrentDocument();
            }

            // Generate new document
            const newId = generateId();
            const newDoc = {
                ...JSON.parse(JSON.stringify(DEFAULT_DOC_DATA)),
                createdAt: Date.now(),
                lastModified: Date.now()
            };

            // 使用全域預設值（如果有設定的話）
            if (state.globalSettings.defaultWorldSetting) {
                newDoc.worldSetting = state.globalSettings.defaultWorldSetting;
            }
            if (state.globalSettings.defaultCustomPrompt) {
                newDoc.customPrompt = state.globalSettings.defaultCustomPrompt;
            }

            // Save to storage
            saveToStorage(STORAGE.DOC_PREFIX + newId, newDoc);
            
            // Update index
            state.docIndex.unshift({
                id: newId,
                title: newDoc.title,
                lastModified: newDoc.lastModified,
                previewText: ''
            });
            saveToStorage(STORAGE.DOC_INDEX, state.docIndex);
            
            // Load new document
            loadDocument(newId);
            renderDocList();
            
            showToast('已建立新文檔', 'success');
            closeDrawerLeft();
        }

        function loadDocument(docId) {
            // Save current document first
            if (state.currentDocId && state.currentDocId !== docId) {
                saveCurrentDocument();
            }
            
            // Load document data
            const docData = loadFromStorage(STORAGE.DOC_PREFIX + docId);
            if (!docData) {
                showToast('文檔不存在', 'error');
                return;
            }
            
            state.currentDocId = docId;
            state.currentDoc = docData;

            // Update UI
            el.navTitle.textContent = docData.title || '未命名文檔';
            el.storyAnchors.value = docData.storyAnchors || DEFAULT_DOC_DATA.storyAnchors;
            el.styleFingerprint.value = docData.styleFingerprint || DEFAULT_DOC_DATA.styleFingerprint;
            el.worldSetting.value = docData.worldSetting || '';
            el.customPrompt.value = docData.customPrompt || DEFAULT_DOC_DATA.customPrompt;

            // Ensure characters array exists
            if (!state.currentDoc.characters) {
                state.currentDoc.characters = [];
            }

            // Render paragraphs
            renderParagraphs();
            renderDocList();

            // Render character list and status bar
            renderCharacterList();
            updateStatusBar();

            closeDrawerLeft();
        }

        function saveCurrentDocument() {
            if (!state.currentDocId || !state.currentDoc) return;

            // Update document data
            state.currentDoc.storyAnchors = el.storyAnchors.value;
            state.currentDoc.styleFingerprint = el.styleFingerprint.value;
            state.currentDoc.worldSetting = el.worldSetting.value;
            state.currentDoc.customPrompt = el.customPrompt.value;
            state.currentDoc.lastModified = Date.now();

            // Characters are already directly modified in state.currentDoc.characters

            // Generate preview text
            const previewText = state.currentDoc.paragraphs
                .slice(0, 2)
                .map(p => p.content)
                .join(' ')
                .substring(0, 100);

            // Save to storage
            saveToStorage(STORAGE.DOC_PREFIX + state.currentDocId, state.currentDoc);

            // Update index
            const indexItem = state.docIndex.find(d => d.id === state.currentDocId);
            if (indexItem) {
                indexItem.title = state.currentDoc.title;
                indexItem.lastModified = state.currentDoc.lastModified;
                indexItem.previewText = previewText;
                saveToStorage(STORAGE.DOC_INDEX, state.docIndex);
            }

            // Update navbar title
            el.navTitle.textContent = state.currentDoc.title || '未命名文檔';
        }

        function deleteDocument(docId) {
            showConfirmModal('刪除文檔', '確定要刪除此文檔嗎？此操作無法復原。', () => {
                // Remove from storage
                removeFromStorage(STORAGE.DOC_PREFIX + docId);
                
                // Update index
                state.docIndex = state.docIndex.filter(d => d.id !== docId);
                saveToStorage(STORAGE.DOC_INDEX, state.docIndex);
                
                // If deleted current document, load another or create new
                if (docId === state.currentDocId) {
                    if (state.docIndex.length > 0) {
                        loadDocument(state.docIndex[0].id);
                    } else {
                        createDocument();
                    }
                }
                
                renderDocList();
                hideConfirmModal();
                showToast('文檔已刪除', 'success');
            });
        }

        let autoSave = debounce(() => {
            // 1. 執行原本的儲存邏輯 (LocalStorage + Firebase)
            saveCurrentDocument();

            // 2. 執行離線儲存邏輯 (IndexedDB) - 現在這也會被 Debounce 保護了
            if (state.currentDocId && state.currentDoc) {
                // 儲存到本地資料庫
                OfflineStorage.saveDocument(state.currentDocId, state.currentDoc)
                    .catch(err => console.error('IndexedDB save failed:', err));

                // 如果離線，記錄變更以便未來同步
                if (!OfflineStorage.isOnline) {
                    OfflineStorage.addPendingChange(
                        state.currentDocId,
                        'update',
                        state.currentDoc
                    ).catch(err => console.error('Failed to record pending change:', err));
                }
            }

            console.log('Auto-saved:', new Date().toLocaleTimeString());
        }, 1000);

        // ============================================
        // Render Functions
        function updateStats() {
            if (!state.currentDoc?.paragraphs) {
                $('statTotalChars').textContent = '0';
                $('statUserChars').textContent = '0';
                $('statAiChars').textContent = '0';
                $('statParagraphs').textContent = '0';
                return;
            }

            let totalChars = 0;
            let userChars = 0;
            let aiChars = 0;
            const paragraphs = state.currentDoc.paragraphs;

            paragraphs.forEach(p => {
                const chars = countChars(p.content);
                totalChars += chars;
                if (p.source === 'user') {
                    userChars += chars;
                } else {
                    aiChars += chars;
                }
            });

            $('statTotalChars').textContent = totalChars.toLocaleString();
            $('statUserChars').textContent = userChars.toLocaleString();
            $('statAiChars').textContent = aiChars.toLocaleString();
            $('statParagraphs').textContent = paragraphs.length.toLocaleString();
        }

        // ============================================
        // Character Mindset Mixer - 角色心理混音台
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

                const analysisPrompt = `你是一位心理分析師。請閱讀以下劇情，並分析角色「${character.name}」當前的心理驅動力。

【劇情片段】
${recentContent}

請針對以下指標評分 (0-100)，若文中未體現則填 null：
${drivesList}

每個指標的含義：
- survival: 生存本能（優先保命，恐懼死亡）
- logic: 絕對理智（計算得失，壓抑情感）
- curiosity: 狂熱求知（探索未知，不計代價）
- love: 情感羈絆（重視特定對象，溫柔守護）
- destruction: 毀滅衝動（暴力，破壞慾）
- duty: 道德責任（堅持原則，正義感）
- pride: 傲慢自尊（維護顏面，不願示弱）
- greed: 貪婪慾望（渴求力量或資源）

請只回傳 JSON 格式，例如：{"survival": 80, "logic": 20, "curiosity": null, ...}`;

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

                // 嘗試提取 JSON 物件 (更寬容的 regex)
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    try {
                        const result = JSON.parse(jsonMatch[0]);

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
                    } catch (parseError) {
                        console.error('JSON 解析錯誤:', parseError);
                        console.error('嘗試解析的文字:', jsonMatch[0]);
                        showToast(`分析格式錯誤: ${parseError.message}`, 'error', 3000);
                    }
                } else {
                    console.error('無法從回應中提取 JSON:', response);
                    showToast('無法從 AI 回應中提取有效的 JSON 資料', 'error', 3000);
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

        async function callAPIForAnalysis(prompt) {
            const { apiEndpoint, apiKey, modelName } = state.globalSettings;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (state.globalSettings.apiFormat === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'MoYun';
            }

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,  // 較低的 temperature 以獲得更穩定的分析結果
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `API 請求失敗 (${response.status})`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        }

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

        // 自動同步觸發（在 AI 完成續寫後調用）
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
            inspirationContent.innerHTML = '<div class="inspiration-loading">✨ 正在生成劇情靈感...</div>';
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
                inspirationContent.innerHTML = '<div class="inspiration-empty"><div class="inspiration-empty-icon">❌</div><p class="inspiration-empty-text">生成失敗，請稍後再試</p></div>';
                showToast(`生成失敗: ${error.message}`, 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '🎲 隨機衝突';
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

        // ============================================
        // API Communication
        // ============================================
        function buildSystemPrompt() {
            const parts = [];

            if (el.customPrompt.value.trim()) {
                parts.push(el.customPrompt.value.trim());
            }

            if (el.worldSetting.value.trim()) {
                parts.push(`【世界觀設定】\n${el.worldSetting.value.trim()}`);
            }

            if (el.storyAnchors.value.trim()) {
                parts.push(`【故事錨點 - 當前狀態】\n${el.storyAnchors.value.trim()}`);
            }

            if (el.styleFingerprint.value.trim()) {
                parts.push(`【文風指紋 - 寫作風格】\n${el.styleFingerprint.value.trim()}`);
            }

            // 角色心理混音台 Prompt
            const mindsetPrompt = buildCharacterMindsetPrompt();
            if (mindsetPrompt) {
                parts.push(mindsetPrompt);
            }

            return parts.join('\n\n');
        }

        function buildConversationHistory() {
            if (!state.currentDoc?.paragraphs) return [];

            const recent = state.currentDoc.paragraphs.slice(-20);
            const messages = [];
            let currentRole = null;
            let currentContent = '';

            recent.forEach(p => {
                // 跳過空內容或只有空白字元的段落
                if (!p.content || !p.content.trim()) {
                    return;
                }

                const role = p.source === 'user' ? 'user' : 'assistant';

                if (role === currentRole) {
                    currentContent += '\n\n' + p.content;
                } else {
                    if (currentRole && currentContent.trim()) {
                        messages.push({ role: currentRole, content: currentContent });
                    }
                    currentRole = role;
                    currentContent = p.content;
                }
            });

            if (currentRole && currentContent.trim()) {
                messages.push({ role: currentRole, content: currentContent });
            }

            return messages;
        }

        async function callAPI(userContent, options = {}) {
            const { apiEndpoint, apiKey, modelName, temperature } = state.globalSettings;

            if (!apiKey) {
                throw new Error('請先在設定中填入 API Key');
            }

            const systemPrompt = buildSystemPrompt();
            const history = buildConversationHistory();
            // 不再手動 push userContent，因為它已經透過 addParagraph 存入 state.currentDoc
            // buildConversationHistory 會自動抓取它

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (state.globalSettings.apiFormat === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'MoYun';
            }

            const requestBody = {
                model: modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history
                ],
                temperature: parseFloat(temperature),
                max_tokens: 4096
            };

            // 如果開啟 streaming 模式
            if (options.stream) {
                requestBody.stream = true;

                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error?.message || `API 請求失敗 (${response.status})`);
                }

                return response; // 返回 response 供 stream 處理
            }

            // 原本的非 streaming 模式（用於分析等功能）
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `API 請求失敗 (${response.status})`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        }
        function toggleStyleTag(tagId) {
            const wasActive = state.activeStyleTags.has(tagId);
            if (wasActive) {
                state.activeStyleTags.delete(tagId);
            } else {
                state.activeStyleTags.add(tagId);
                // 顯示 Toast 提示
                const tag = STYLE_TAGS[tagId];
                if (tag) {
                    showToast(`${tag.icon} 已開啟：${tag.tooltip}`, 'info', 2000);
                }
            }
            updateStyleTagsUI();
        }

        // updateStyleTagsUI, toggleDirectorMode, updateDirectorModeUI 已統一移至 ui.js

        function getActiveStylePrompts() {
            const prompts = [];
            state.activeStyleTags.forEach(tagId => {
                if (STYLE_TAGS[tagId]) {
                    prompts.push(STYLE_TAGS[tagId].prompt);
                }
            });
            return prompts;
        }

        async function handleSubmit() {
            const content = el.inputField.value.trim();
            if (!content || state.isLoading) return;

            // 根據導演模式包裝用戶輸入
            let userPrompt = content;
            if (state.directorMode) {
                userPrompt = `[System Instruction: 用戶要求劇情發展如下：${content}。請演出此情節，不要在文中複述指令。]`;
            } else {
                userPrompt = content + '\n\n請繼續這個故事。';
            }

            // 新增風格標籤的 prompts
            const stylePrompts = getActiveStylePrompts();
            if (stylePrompts.length > 0) {
                userPrompt += '\n\n' + stylePrompts.join('\n');
            }

            addParagraph(content, 'user');
            el.inputField.value = '';
            el.inputField.style.height = 'auto';

            state.isLoading = true;
            el.sendBtn.classList.add('loading');
            el.sendBtn.disabled = true;

            // Add breathing effect to editor
            const editorPaper = document.querySelector('.editor-paper');
            if (editorPaper) {
                editorPaper.classList.add('ai-writing');
            }

            // 即時建立空的 AI 段落
            const aiParagraph = {
                id: generateId(),
                content: '',
                source: 'ai',
                timestamp: Date.now()
            };
            state.currentDoc.paragraphs.push(aiParagraph);
            renderParagraphs();

            // 智慧滾動：將視窗捲動到新段落的頂部
            const newPara = el.editorBody.querySelector(`[data-id="${aiParagraph.id}"]`);
            let initialScrollDone = false;

            if (newPara) {
                // 添加 streaming 類別以顯示閃爍游標
                newPara.classList.add('streaming');
                // 初始滾動到段落頂部
                newPara.scrollIntoView({ behavior: 'smooth', block: 'start' });
                initialScrollDone = true;
            }

            try {
                const response = await callAPI(userPrompt, { stream: true });

                // 處理 SSE Stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';
                let fullContent = '';

                // 記錄初始滾動位置，streaming 期間保持固定
                const mainContent = document.querySelector('.main-content');
                const initialScrollTop = mainContent ? mainContent.scrollTop : window.scrollY;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 保留未完成的行

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        if (!line.startsWith('data: ')) continue;

                        const data = line.slice(6); // 移除 "data: " 前綴
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content || '';
                            if (delta) {
                                fullContent += delta;
                                // 即時更新段落內容
                                aiParagraph.content = fullContent;
                                const paraContent = newPara.querySelector('.paragraph-content');
                                if (paraContent) {
                                    paraContent.innerHTML = parseMarkdown(fullContent);
                                }
                                // 流式傳輸期間不自動滾動，保持在段落開頭
                                // 用戶可以手動滾動閱讀
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', e);
                        }
                    }
                }

                // 完成後移除 streaming 類別
                if (newPara) {
                    newPara.classList.remove('streaming');
                }

                autoSave();
                showToast('AI 續寫完成', 'success', 2000);

                // 觸發自動同步（心靈同步功能）
                setTimeout(() => triggerAutoSync(), 500);
            } catch (error) {
                // 移除空段落
                const paraIndex = state.currentDoc.paragraphs.findIndex(p => p.id === aiParagraph.id);
                if (paraIndex !== -1) {
                    state.currentDoc.paragraphs.splice(paraIndex, 1);
                    renderParagraphs();
                }
                showToast(`續寫失敗: ${error.message}`, 'error');
            } finally {
                state.isLoading = false;
                el.sendBtn.classList.remove('loading');
                el.sendBtn.disabled = false;

                // Remove breathing effect from editor
                if (editorPaper) {
                    editorPaper.classList.remove('ai-writing');
                }
            }
        }

        async function performCheckpoint() {
            if (!state.currentDoc?.paragraphs?.length || state.currentDoc.paragraphs.length < 3) {
                showToast('內容太少，請先寫一些故事', 'warning');
                return;
            }
            
            if (!state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'error');
                return;
            }
            
            el.checkpointBtn.disabled = true;
            el.checkpointBtn.innerHTML = '<span>⏳</span><span>分析中...</span>';
            
            try {
                const recentContent = state.currentDoc.paragraphs
                    .slice(-10)
                    .map(p => p.content)
                    .join('\n\n');
                
                const analysisPrompt = `你是一位文學編輯，請分析以下故事片段，並提取兩種結構化資訊：

【故事片段】
${recentContent}

請以 JSON 格式回傳，包含兩個物件：

1. "storyAnchors" (故事錨點)：
{
  "時間地點": "具體的時間與地點",
  "環境氛圍": {
    "光影": "光線描述",
    "氣味": "氣味描述",
    "聲音": "聲音描述"
  },
  "角色狀態": {
    "心理": "當前心理狀態",
    "姿勢": "身體姿態",
    "外觀": "外觀描述"
  },
  "當前衝突": "主要衝突或張力",
  "禁止發生的劇情": ["不應該發生的情節"]
}

2. "styleFingerprint" (文風指紋)：
{
  "敘事節奏": "描述節奏特點",
  "感官偏好": ["主要感官描寫類型"],
  "禁忌與張力處理": "如何處理敏感或緊張情節",
  "關鍵語氣樣本": ["摘錄代表性句子"]
}

請直接回傳 JSON，不要加任何其他說明。`;

                const response = await callAPI(analysisPrompt);
                
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    
                    if (result.storyAnchors) {
                        el.storyAnchors.value = JSON.stringify(result.storyAnchors, null, 2);
                    }
                    if (result.styleFingerprint) {
                        el.styleFingerprint.value = JSON.stringify(result.styleFingerprint, null, 2);
                    }
                    
                    autoSave();
                    showToast('✨ 本章結算完成！', 'success');
                }
            } catch (error) {
                showToast(`結算失敗: ${error.message}`, 'error');
            } finally {
                el.checkpointBtn.disabled = false;
                el.checkpointBtn.innerHTML = '<span>✨</span><span>本章結算 (Checkpoint)</span>';
            }
        }
        function loadWorldLibrary() {
            const data = loadFromStorage(STORAGE.WORLD_LIBRARY, []);
            // 強制轉換：若為物件則透過 Object.values() 轉回陣列
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                console.warn('loadWorldLibrary: 偵測到物件格式，正在轉換為陣列');
                return Object.values(data);
            }
            return Array.isArray(data) ? data : [];
        }

        function saveWorldLibrary(library) {
            saveToStorage(STORAGE.WORLD_LIBRARY, library);
        }

        // renderWorldLibrarySelect 已統一移至 ui.js

        function loadWorldFromLibrary(worldId) {
            if (!worldId) {
                // 清空选择时不改变 textarea
                el.worldNameInput.value = '';
                el.worldDeleteBtn.disabled = true;
                return;
            }

            const library = loadWorldLibrary();
            const world = library.find(w => w.id === worldId);

            if (world) {
                el.worldSetting.value = world.content;
                el.worldNameInput.value = world.name;
                el.worldDeleteBtn.disabled = false;
                autoSave();
                showToast(`已載入「${world.name}」`, 'success', 2000);
            }
        }

        async function saveWorldToLibrary() {
            console.log('💾 嘗試儲存世界觀到圖書館...');

            const name = el.worldNameInput.value.trim();
            const content = el.worldSetting.value.trim();

            console.log('世界觀名稱:', name);
            console.log('世界觀內容長度:', content.length);

            if (!name) {
                console.warn('❌ 世界觀名稱為空');
                showToast('請輸入世界觀名稱', 'warning');
                el.worldNameInput.focus();
                return;
            }

            if (!content) {
                console.warn('❌ 世界觀內容為空');
                showToast('世界觀內容不能為空', 'warning');
                el.worldSetting.focus();
                return;
            }

            // 設置按鈕 Loading 狀態
            const originalBtnText = el.worldSaveBtn.textContent;
            const wasDisabled = el.worldSaveBtn.disabled;
            el.worldSaveBtn.disabled = true;
            el.worldSaveBtn.textContent = '儲存中...';

            try {
                const library = loadWorldLibrary();
                console.log('當前圖書館內容:', library);

                // 優先根據名稱查找是否已存在
                const existingIndex = library.findIndex(w => w.name === name);
                console.log('現有項目索引 (by name):', existingIndex);

                let savedWorldId;
                let isUpdate = false;

                if (existingIndex !== -1) {
                    // 更新現有的
                    console.log('✏️ 更新現有世界觀:', name);
                    library[existingIndex].content = content;
                    library[existingIndex].lastModified = Date.now();
                    savedWorldId = library[existingIndex].id;
                    saveWorldLibrary(library);
                    isUpdate = true;
                } else {
                    // 新增
                    console.log('➕ 新增世界觀:', name);
                    const newWorld = {
                        id: generateId(),
                        name: name,
                        content: content,
                        lastModified: Date.now()
                    };
                    library.push(newWorld);
                    savedWorldId = newWorld.id;
                    saveWorldLibrary(library);
                    isUpdate = false;
                }

                // 無論是新增還是更新，都刷新下拉選單並選中該項目
                renderWorldLibrarySelect();
                el.worldLibrarySelect.value = savedWorldId;
                el.worldDeleteBtn.disabled = false;

                console.log('✅ 世界觀儲存完成，已選中 ID:', savedWorldId);

                // 同步到雲端（如果已登入）
                if (storageManager.isLoggedIn()) {
                    console.log('🔄 同步世界觀到雲端...');
                    await storageManager.syncWorldLibrary();
                    showToast(isUpdate ? `已更新並同步「${name}」` : `已儲存並同步「${name}」到圖書館`, 'success');
                } else {
                    showToast(isUpdate ? `已更新「${name}」` : `已儲存「${name}」到圖書館`, 'success');
                }
            } catch (error) {
                console.error('儲存世界觀時發生錯誤:', error);
                showToast('儲存失敗，請稍後再試', 'error');
            } finally {
                // 恢復按鈕狀態
                el.worldSaveBtn.disabled = wasDisabled;
                el.worldSaveBtn.textContent = originalBtnText;
            }
        }

        function deleteWorldFromLibrary() {
            const selectedId = el.worldLibrarySelect.value;

            if (!selectedId) {
                showToast('請先選擇要刪除的世界觀', 'warning');
                return;
            }

            const library = loadWorldLibrary();
            const world = library.find(w => w.id === selectedId);

            if (!world) return;

            showConfirmModal('刪除世界觀', `確定要從圖書館刪除「${world.name}」嗎？`, () => {
                const updatedLibrary = library.filter(w => w.id !== selectedId);
                saveWorldLibrary(updatedLibrary);

                // 重置 UI
                renderWorldLibrarySelect();
                el.worldLibrarySelect.value = '';
                el.worldNameInput.value = '';
                el.worldDeleteBtn.disabled = true;

                hideConfirmModal();
                showToast(`已刪除「${world.name}」`, 'success');

                // 同步到雲端（如果已登入）
                if (storageManager.isLoggedIn()) {
                    storageManager.syncWorldLibrary();
                }
            });
        }

        // 設定預設世界觀
        function setDefaultWorld() {
            const currentWorld = el.worldSetting.value.trim();
            state.globalSettings.defaultWorldSetting = currentWorld;
            state.globalSettings._lastModified = Date.now();
            saveToStorage(STORAGE.GLOBAL_SETTINGS, state.globalSettings);

            // 同步到雲端
            if (storageManager.isLoggedIn()) {
                storageManager.syncSettings();
            }

            showToast('已設為預設世界觀', 'success');
        }

        // 回復預設世界觀
        function restoreDefaultWorld() {
            const defaultWorld = state.globalSettings.defaultWorldSetting || '';
            el.worldSetting.value = defaultWorld;

            // 同步到當前文檔
            if (state.currentDoc) {
                state.currentDoc.worldSetting = defaultWorld;
                saveDocument();
            }

            showToast('已回復預設世界觀', 'success');
        }

        // 設定預設系統指令
        function setDefaultPrompt() {
            const currentPrompt = el.customPrompt.value.trim();
            state.globalSettings.defaultCustomPrompt = currentPrompt;
            state.globalSettings._lastModified = Date.now();
            saveToStorage(STORAGE.GLOBAL_SETTINGS, state.globalSettings);

            // 同步到雲端
            if (storageManager.isLoggedIn()) {
                storageManager.syncSettings();
            }

            showToast('已設為預設系統指令', 'success');
        }

        // 回復預設系統指令
        function restoreDefaultPrompt() {
            const defaultPrompt = state.globalSettings.defaultCustomPrompt || '你是一位資深小說家，擅長細膩的心理描寫與環境塑造。請以第三人稱視角續寫故事，保持文風一致，注重角色內心活動的刻畫。每次續寫至少 1200 字，描寫要具體且富有畫面感。';
            el.customPrompt.value = defaultPrompt;

            // 同步到當前文檔
            if (state.currentDoc) {
                state.currentDoc.customPrompt = defaultPrompt;
                saveDocument();
            }

            showToast('已回復預設系統指令', 'success');
        }

        // ============================================
        // Settings Management
        // ============================================
        function loadGlobalSettings() {
            const saved = loadFromStorage(STORAGE.GLOBAL_SETTINGS);
            if (saved) {
                state.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...saved };
            }

            // Update UI
            el.apiFormat.value = state.globalSettings.apiFormat;
            el.apiEndpoint.value = state.globalSettings.apiEndpoint;
            el.apiKey.value = state.globalSettings.apiKey;
            el.modelName.value = state.globalSettings.modelName;
            el.temperature.value = state.globalSettings.temperature;
            el.tempValue.textContent = state.globalSettings.temperature;

            // 填入歷史紀錄下拉選單
            updateHistoryDatalist();
        }

        function updateHistoryDatalist() {
            // 更新 Endpoint 歷史
            const endpointDatalist = document.getElementById('endpointHistory');
            endpointDatalist.innerHTML = '';
            (state.globalSettings.savedEndpoints || []).forEach(endpoint => {
                const option = document.createElement('option');
                option.value = endpoint;
                endpointDatalist.appendChild(option);
            });

            // 更新 Model 歷史
            const modelDatalist = document.getElementById('modelHistory');
            modelDatalist.innerHTML = '';
            (state.globalSettings.savedModels || []).forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                modelDatalist.appendChild(option);
            });
        }

        function saveGlobalSettings() {
            const currentEndpoint = el.apiEndpoint.value.trim();
            const currentModel = el.modelName.value.trim();

            // 保留原有的 savedEndpoints、savedModels、defaultWorldSetting、defaultCustomPrompt
            const savedEndpoints = state.globalSettings.savedEndpoints || [];
            const savedModels = state.globalSettings.savedModels || [];

            // 將當前值加入歷史（去重）
            if (currentEndpoint && !savedEndpoints.includes(currentEndpoint)) {
                savedEndpoints.push(currentEndpoint);
            }
            if (currentModel && !savedModels.includes(currentModel)) {
                savedModels.push(currentModel);
            }

            state.globalSettings = {
                apiFormat: el.apiFormat.value,
                apiEndpoint: currentEndpoint,
                apiKey: el.apiKey.value,
                modelName: currentModel,
                temperature: el.temperature.value,
                savedEndpoints: savedEndpoints,
                savedModels: savedModels,
                defaultWorldSetting: state.globalSettings.defaultWorldSetting || '',
                defaultCustomPrompt: state.globalSettings.defaultCustomPrompt || '',
                _lastModified: Date.now()
            };

            saveToStorage(STORAGE.GLOBAL_SETTINGS, state.globalSettings);

            // 同步到雲端（如果已登入）
            if (storageManager.isLoggedIn()) {
                storageManager.syncSettings();
            }

            // 更新歷史下拉選單
            updateHistoryDatalist();

            showToast('設定已儲存', 'success');
        }

        function clearAllData() {
            showConfirmModal('清除所有資料', '確定要清除所有資料嗎？此操作無法復原。', () => {
                // Clear all moyun_ keys
                Object.keys(localStorage)
                    .filter(k => k.startsWith('moyun_'))
                    .forEach(k => localStorage.removeItem(k));
                
                hideConfirmModal();
                location.reload();
            });
        }
        function handleTextSelection() {
            // 延遲執行，避免與其他事件衝突
            setTimeout(() => {
                const selection = window.getSelection();
                const text = selection.toString().trim();

                // 確保選取的文字長度足夠且在編輯器內
                if (text.length > 0 && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const container = range.commonAncestorContainer;

                    // 檢查選取是否在編輯器主體內
                    const isInEditor = el.editorBody.contains(container.nodeType === 3 ? container.parentNode : container);

                    if (isInEditor) {
                        selectedText = text;
                        selectedRange = range.cloneRange();

                        // 獲取選取範圍的座標
                        const rect = range.getBoundingClientRect();

                        // 計算選單顯示位置（選取範圍的中心點，使用視窗座標）
                        const x = rect.left + rect.width / 2;
                        const y = rect.top; // 不需加 scrollY，因為選單使用 position: fixed

                        console.log('📝 文字選取:', text.substring(0, 30) + '...', '座標:', x, y);
                        showSelectionMenu(x, y);
                        return;
                    }
                }

                // 沒有有效選取，隱藏選單
                hideSelectionMenu();
                selectedText = '';
                selectedRange = null;
            }, 50); // 延遲 50ms 執行
        }

        function enableEditing() {
            if (!selectedRange) return;

            // 找到選取範圍所在的段落
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;

            // 找到包含的 paragraph-content 元素
            let paragraphContent = container.nodeType === 3 ? container.parentNode : container;
            while (paragraphContent && !paragraphContent.classList?.contains('paragraph-content')) {
                paragraphContent = paragraphContent.parentNode;
            }

            if (paragraphContent) {
                // 設為可編輯並聚焦
                paragraphContent.setAttribute('contenteditable', 'true');
                paragraphContent.focus();

                // 恢復選取範圍
                try {
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (e) {
                    console.warn('無法恢復選取範圍:', e);
                }

                hideSelectionMenu();
                showToast('進入編輯模式', 'info', 1000);
            }
        }

        function deleteSelectedText() {
            if (selectedRange && state.currentDoc) {
                // Find and update the paragraph containing the selection
                const paragraphs = state.currentDoc.paragraphs;
                const selectionText = selectedText;

                for (let i = 0; i < paragraphs.length; i++) {
                    if (paragraphs[i].content.includes(selectionText)) {
                        paragraphs[i].content = paragraphs[i].content.replace(selectionText, '');
                        break;
                    }
                }

                renderParagraphs();
                autoSave();
                hideSelectionMenu();
                showToast('已刪除選取文字', 'success', 1500);
            }
        }

        async function refineSelectedText() {
            if (!selectedText || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            hideSelectionMenu();
            showToast('正在潤飾文字...', 'info', 2000);

            const prompt = `請潤飾以下文字，使其更加優美、有文采，保持原意不變，但讓描寫更加生動細膩。只輸出潤飾後的結果，不要加任何解釋：

原文：
${selectedText}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    // 找到包含選取文字的段落
                    const paragraphs = state.currentDoc.paragraphs;
                    for (let i = 0; i < paragraphs.length; i++) {
                        if (paragraphs[i].content.includes(selectedText)) {
                            // 在獨立編輯畫布中顯示結果
                            currentEditingParagraphId = paragraphs[i].id;
                            el.editCanvasTextarea.value = paragraphs[i].content.replace(selectedText, response);
                            el.editCanvas.classList.add('active');
                            el.editCanvasTextarea.focus();
                            showToast('潤飾完成，請確認修改', 'success', 2000);
                            break;
                        }
                    }
                }
            } catch (error) {
                showToast('潤飾失敗：' + error.message, 'error');
            }
        }

        async function expandSelectedText() {
            if (!selectedText || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            hideSelectionMenu();
            showToast('正在擴寫文字...', 'info', 2000);

            const prompt = `請擴寫以下文字，添加更多環境描寫、心理活動、感官細節，讓這段話變成一個更完整的場景描寫。保持原意，但讓內容更加豐富。只輸出擴寫後的結果，不要加任何解釋：

原文：
${selectedText}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    // 找到包含選取文字的段落
                    const paragraphs = state.currentDoc.paragraphs;
                    for (let i = 0; i < paragraphs.length; i++) {
                        if (paragraphs[i].content.includes(selectedText)) {
                            // 在獨立編輯畫布中顯示結果
                            currentEditingParagraphId = paragraphs[i].id;
                            el.editCanvasTextarea.value = paragraphs[i].content.replace(selectedText, response);
                            el.editCanvas.classList.add('active');
                            el.editCanvasTextarea.focus();
                            showToast('擴寫完成，請確認修改', 'success', 2000);
                            break;
                        }
                    }
                }
            } catch (error) {
                showToast('擴寫失敗：' + error.message, 'error');
            }
        }

        async function regenerateParagraph(paraId) {
            if (!state.currentDoc || state.isLoading) return;

            if (!state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'error');
                return;
            }

            const paragraphs = state.currentDoc.paragraphs;
            const paraIndex = paragraphs.findIndex(p => p.id === paraId);

            if (paraIndex === -1 || paragraphs[paraIndex].source !== 'ai') {
                showToast('找不到該段落或該段落不是 AI 生成的', 'warning');
                return;
            }

            // 獲取該段落之前的內容作為上下文（最多取前 3 段）
            const contextStart = Math.max(0, paraIndex - 3);
            const contextParagraphs = paragraphs.slice(contextStart, paraIndex);
            const contextText = contextParagraphs.map(p => p.content).join('\n\n');

            // 設置載入狀態
            state.isLoading = true;
            const btn = document.querySelector(`.regenerate-btn[data-id="${paraId}"]`);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳';
            }

            // Add breathing effect to editor
            const editorPaper = document.querySelector('.editor-paper');
            if (editorPaper) {
                editorPaper.classList.add('ai-writing');
            }

            showToast('正在重新生成...', 'info', 2000);

            try {
                // 構建 prompt：使用之前的內容作為上下文，要求重寫這一段
                const prompt = contextText + '\n\n請繼續這個故事，重新生成接下來的段落。';

                const response = await callAPI(prompt);

                if (response) {
                    // 更新段落內容
                    paragraphs[paraIndex].content = response;
                    paragraphs[paraIndex].timestamp = Date.now();

                    renderParagraphs();
                    autoSave();
                    showToast('重新生成完成', 'success', 2000);

                    // 觸發自動同步（心靈同步功能）
                    setTimeout(() => triggerAutoSync(), 500);
                }
            } catch (error) {
                showToast(`重新生成失敗: ${error.message}`, 'error');
            } finally {
                state.isLoading = false;

                // Remove breathing effect from editor
                if (editorPaper) {
                    editorPaper.classList.remove('ai-writing');
                }
            }
        }

        // ============================================
        // Cloud Status & Backup Functions
        // ============================================
        async function checkAndPerformAutoBackup() {
            if (!storageManager.isLoggedIn()) return;

            try {
                const lastAutoBackup = localStorage.getItem('moyun_lastAutoBackup');
                const now = Date.now();
                const oneDayAgo = now - (24 * 60 * 60 * 1000);

                if (!lastAutoBackup || parseInt(lastAutoBackup) < oneDayAgo) {
                    console.log('⏰ 執行自動備份...');
                    const backupId = await storageManager.createCloudBackup('系統自動備份');
                    if (backupId) {
                        localStorage.setItem('moyun_lastAutoBackup', now.toString());
                        console.log('✓ 自動備份完成');
                    }
                }
            } catch (error) {
                console.error('自動備份失敗:', error);
            }
        }

        async function loadDeviceCount() {
            if (!storageManager.isLoggedIn()) return;

            try {
                const count = await storageManager.getActiveDeviceCount();
                const deviceCountEl = document.getElementById('deviceCount');
                if (deviceCountEl) {
                    deviceCountEl.textContent = count;
                }
            } catch (error) {
                console.error('載入裝置數量失敗:', error);
            }
        }

        async function renderBackupList() {
            const backupListEl = document.getElementById('backupList');
            if (!backupListEl) return;

            if (!storageManager.isLoggedIn()) {
                backupListEl.innerHTML = '<p class="backup-hint">請先登入以使用備份功能</p>';
                return;
            }

            try {
                backupListEl.innerHTML = '<p class="backup-hint">載入中...</p>';
                const backups = await storageManager.getCloudBackups();

                if (backups.length === 0) {
                    backupListEl.innerHTML = '<p class="backup-hint">尚無備份紀錄</p>';
                    return;
                }

                backupListEl.innerHTML = backups.map(backup => {
                    const date = new Date(backup.timestamp);
                    const dateStr = date.toLocaleString('zh-TW');
                    return `
                        <div class="backup-item">
                            <div class="backup-info">
                                <div class="backup-note">${escapeHtml(backup.note)}</div>
                                <div class="backup-date">${dateStr}</div>
                            </div>
                            <button class="backup-restore-btn" onclick="restoreBackup('${backup.id}')">還原</button>
                        </div>
                    `;
                }).join('');
            } catch (error) {
                console.error('載入備份列表失敗:', error);
                backupListEl.innerHTML = '<p class="backup-hint">載入失敗，請稍後再試</p>';
            }
        }

        async function createManualBackup() {
            if (!storageManager.isLoggedIn()) {
                showToast('請先登入以使用備份功能', 'warning');
                return;
            }

            const btn = document.getElementById('createBackupBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '建立中...';
            }

            try {
                const backupId = await storageManager.createCloudBackup('手動備份');
                if (backupId) {
                    showToast('備份建立成功', 'success');
                    await renderBackupList();
                } else {
                    showToast('備份建立失敗', 'error');
                }
            } catch (error) {
                console.error('建立備份失敗:', error);
                showToast('備份建立失敗：' + error.message, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '手動建立備份';
                }
            }
        }

        // 強制用本地資料覆蓋雲端
        async function forceFixCloudData() {
            if (!storageManager.isLoggedIn()) {
                showToast('請先登入以使用此功能', 'warning');
                return;
            }

            showConfirmModal(
                '強制覆蓋雲端',
                '此操作會使用本地資料強制覆蓋雲端資料。如果雲端資料較新，將會遺失。確定要繼續嗎？',
                async () => {
                    hideConfirmModal();

                    const btn = document.getElementById('forceFixCloudBtn');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = '修復中...';
                    }

                    try {
                        console.log('🔧 開始強制修復雲端資料...');
                        const userId = storageManager.getUserId();

                        // 1. 上傳文檔索引和所有文檔
                        let docIndex = loadFromStorage(STORAGE.DOC_INDEX, []);
                        if (!Array.isArray(docIndex)) {
                            docIndex = Object.values(docIndex);
                        }

                        if (docIndex.length > 0) {
                            await firebaseDB.ref(`users/${userId}/docs/index`).set(docIndex);
                            console.log(`✓ 已上傳文檔索引 (${docIndex.length} 個文檔)`);

                            for (const doc of docIndex) {
                                const docData = loadFromStorage(STORAGE.DOC_PREFIX + doc.id);
                                if (docData) {
                                    await firebaseDB.ref(`users/${userId}/docs/${doc.id}`).set(docData);
                                    console.log(`✓ 已上傳文檔: ${doc.title || doc.id}`);
                                }
                            }
                        }

                        // 2. 上傳世界觀圖書館
                        let worldLibrary = loadFromStorage(STORAGE.WORLD_LIBRARY, []);
                        if (!Array.isArray(worldLibrary)) {
                            worldLibrary = Object.values(worldLibrary);
                        }
                        await firebaseDB.ref(`users/${userId}/worldLibrary`).set(worldLibrary);
                        console.log(`✓ 已上傳世界觀圖書館 (${worldLibrary.length} 個)`);

                        // 3. 上傳全域設定 (排除 apiKey)
                        const settings = loadFromStorage(STORAGE.GLOBAL_SETTINGS, {});
                        const settingsToSync = { ...settings };
                        delete settingsToSync.apiKey;
                        await firebaseDB.ref(`users/${userId}/settings`).set(settingsToSync);
                        console.log('✓ 已上傳全域設定');

                        console.log('✅ 雲端資料修復完成！');
                        showToast('雲端資料已修復！', 'success');

                    } catch (error) {
                        console.error('修復失敗:', error);
                        showToast('修復失敗：' + error.message, 'error');
                    } finally {
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = '🔧 強制用本地覆蓋雲端';
                        }
                    }
                }
            );
        }

        async function restoreBackup(backupId) {
            showConfirmModal('還原備份', '確定要還原此備份嗎？目前的資料將被覆蓋。', async () => {
                hideConfirmModal();

                const toastEl = showToast('正在還原備份...', 'info', 0);

                try {
                    const success = await storageManager.restoreCloudBackup(backupId);

                    if (toastEl && toastEl.parentNode) {
                        toastEl.remove();
                    }

                    if (success) {
                        showToast('備份還原成功，即將重新載入...', 'success');
                        setTimeout(() => {
                            location.reload();
                        }, 1500);
                    } else {
                        showToast('備份還原失敗', 'error');
                    }
                } catch (error) {
                    if (toastEl && toastEl.parentNode) {
                        toastEl.remove();
                    }
                    console.error('還原備份失敗:', error);
                    showToast('還原失敗：' + error.message, 'error');
                }
            });
        }

        // ============================================
        // Authentication Functions
        // ============================================
        async function signInWithGoogle() {
            if (!firebaseAuth) {
                showToast('Firebase 尚未設定，請先填入設定', 'warning');
                return;
            }

            try {
                const provider = new firebase.auth.GoogleAuthProvider();

                // 偵測是否為行動裝置
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                if (isMobile) {
                    // 行動裝置使用 Redirect Flow（避免 PWA 模式下 popup 失效）
                    await firebaseAuth.signInWithRedirect(provider);
                } else {
                    // 桌面裝置使用 Popup Flow（較好的使用者體驗）
                    const result = await firebaseAuth.signInWithPopup(provider);
                    console.log('✓ 登入成功:', result.user.email);
                    showToast('登入成功！', 'success');
                }
            } catch (error) {
                console.error('登入失敗:', error);
                if (error.code === 'auth/popup-closed-by-user') {
                    showToast('登入已取消', 'info');
                } else {
                    showToast('登入失敗：' + error.message, 'error');
                }
            }
        }

        async function signOut() {
            if (!firebaseAuth) return;

            try {
                await firebaseAuth.signOut();
                console.log('✓ 已登出');
                showToast('已登出', 'info');
            } catch (error) {
                console.error('登出失敗:', error);
                showToast('登出失敗', 'error');
            }
        }
        async function initAuthListener() {
            if (!firebaseAuth) {
                // Firebase not configured, hide login panel or show message
                return;
            }

            // 處理 Redirect 登入結果（當使用者從 Google 導回時）
            console.log('🔍 檢查 Redirect 登入結果...');
            try {
                const result = await firebaseAuth.getRedirectResult();
                console.log('getRedirectResult 返回:', result);

                if (result && result.user) {
                    console.log('✓ Redirect 登入成功:', result.user.email);
                    showToast('登入成功 (Redirect)', 'success');
                    // onAuthStateChanged 會自動觸發，不需要額外操作
                } else if (result && result.credential) {
                    // 有憑證但沒有 user（不太可能發生）
                    console.log('收到憑證但沒有用戶資訊');
                } else {
                    // result 為 null，表示沒有進行中的 redirect 登入
                    console.log('無 redirect 登入（正常情況）');
                }
            } catch (error) {
                console.error('❌ Redirect 登入錯誤:', error);
                console.error('錯誤代碼:', error.code);
                console.error('錯誤訊息:', error.message);

                // 顯示錯誤給使用者（排除取消操作）
                if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                    showToast('登入失敗：' + error.message, 'error');
                }
            }

            // 監聽認證狀態變化
            firebaseAuth.onAuthStateChanged(async (user) => {
                storageManager.setUser(user);
                updateUserUI(user);

                if (user) {
                    console.log('🔐 用戶已登入，開始同步資料');

                    // 只在非 redirect 情況下顯示歡迎訊息（redirect 已在上方處理）
                    const isFromRedirect = sessionStorage.getItem('authRedirectHandled');
                    if (!isFromRedirect) {
                        showToast('歡迎回來，' + (user.displayName || '使用者'), 'success');
                    }
                    sessionStorage.setItem('authRedirectHandled', 'true');

                    // 更新裝置心跳
                    await storageManager.updateDeviceHeartbeat();

                    // 強制執行完整的資料同步
                    console.log('⏳ 執行 syncAllData...');
                    await storageManager.syncAllData();
                    console.log('✓ syncAllData 完成');

                    // 檢查是否需要自動備份（24小時一次）
                    await checkAndPerformAutoBackup();

                    // 載入裝置統計
                    await loadDeviceCount();

                    // 同步完成後，強制從 localStorage 重新讀取最新的 docIndex
                    // 使用直接讀取而非 loadFromStorage，確保取得同步後的最新資料
                    try {
                        const docIndexData = localStorage.getItem(STORAGE.DOC_INDEX);
                        if (docIndexData) {
                            state.docIndex = JSON.parse(docIndexData);
                            console.log(`✓ 重新載入 docIndex，共 ${state.docIndex.length} 個文檔`);
                        } else {
                            state.docIndex = [];
                            console.log('⚠️ docIndex 為空');
                        }
                    } catch (e) {
                        console.error('❌ 載入 docIndex 失敗:', e);
                        state.docIndex = [];
                    }

                    ensureDocIndexIsArray();
                    renderDocList();

                    // 載入最新的文檔（同步後的版本）
                    if (state.docIndex.length > 0) {
                        console.log(`📄 載入最新文檔: ${state.docIndex[0].id}`);
                        loadDocument(state.docIndex[0].id);
                    } else {
                        console.log('⚠️ 沒有文檔，建立新文檔');
                        createDocument();
                    }

                    // Reload global settings
                    loadGlobalSettings();
                    renderWorldLibrarySelect();

                    console.log('✓ 登入後同步與載入完成');
                } else {
                    // 登出時清除標記
                    console.log('🔓 用戶已登出');
                    sessionStorage.removeItem('authRedirectHandled');
                }
            });

            // Listen for sync status changes
            storageManager.onSyncStatusChange(updateSyncStatusUI);
        }

        // ============================================
        // Event Listeners
        // ============================================
        function initEventListeners() {
            // Navbar buttons
            el.menuBtn.addEventListener('click', openDrawerLeft);
            el.brainBtn.addEventListener('click', openPanelRight);
            el.navTitle.addEventListener('click', showTitleModal);
            
            // Overlay
            el.overlay.addEventListener('click', closeAllPanels);

            // Login/Logout
            el.loginBtn.addEventListener('click', signInWithGoogle);
            el.logoutBtn.addEventListener('click', signOut);

            // Panel close
            el.panelClose.addEventListener('click', closePanelRight);
            
            // New document
            el.newDocBtn.addEventListener('click', createDocument);
            
            // Checkpoint
            el.checkpointBtn.addEventListener('click', performCheckpoint);

            // Add Character
            el.addCharacterBtn.addEventListener('click', createCharacter);

            // Inspiration Drawer
            el.generateConflictBtn.addEventListener('click', generateConflict);

            // World Library
            console.log('📚 綁定世界觀圖書館事件監聽器...');
            el.worldLibrarySelect.addEventListener('change', () => {
                loadWorldFromLibrary(el.worldLibrarySelect.value);
            });

            if (el.worldSaveBtn) {
                el.worldSaveBtn.addEventListener('click', saveWorldToLibrary);
                console.log('✅ worldSaveBtn 事件監聽器已綁定');
            } else {
                console.error('❌ worldSaveBtn 元素不存在！');
            }

            if (el.worldDeleteBtn) {
                el.worldDeleteBtn.addEventListener('click', deleteWorldFromLibrary);
                console.log('✅ worldDeleteBtn 事件監聽器已綁定');
            } else {
                console.error('❌ worldDeleteBtn 元素不存在！');
            }

            // Default World & Prompt buttons
            el.setDefaultWorldBtn.addEventListener('click', setDefaultWorld);
            el.restoreDefaultWorldBtn.addEventListener('click', restoreDefaultWorld);
            el.setDefaultPromptBtn.addEventListener('click', setDefaultPrompt);
            el.restoreDefaultPromptBtn.addEventListener('click', restoreDefaultPrompt);

            // Settings
            el.saveSettingsBtn.addEventListener('click', saveGlobalSettings);
            el.clearAllBtn.addEventListener('click', clearAllData);
            el.temperature.addEventListener('input', (e) => {
                el.tempValue.textContent = e.target.value;
            });

            // Cloud Backup
            const createBackupBtn = document.getElementById('createBackupBtn');
            if (createBackupBtn) {
                createBackupBtn.addEventListener('click', createManualBackup);
            }

            // Force Fix Cloud Data
            const forceFixCloudBtn = document.getElementById('forceFixCloudBtn');
            if (forceFixCloudBtn) {
                forceFixCloudBtn.addEventListener('click', forceFixCloudData);
            }

            // Memory & settings auto-save
            [el.storyAnchors, el.styleFingerprint, el.worldSetting, el.customPrompt].forEach(textarea => {
                textarea.addEventListener('input', autoSave);
            });
            
            // Input field
            el.inputField.addEventListener('input', () => autoResizeTextarea(el.inputField));
            el.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmit();
                }
            });
            
            // Send button
            el.sendBtn.addEventListener('click', handleSubmit);

            // Style Tags
            if (el.styleTagBar) {
                el.styleTagBar.querySelectorAll('.style-tag').forEach(btn => {
                    btn.addEventListener('click', () => toggleStyleTag(btn.dataset.style));
                });
            }

            // Director Mode Toggle
            if (el.directorModeToggle) {
                el.directorModeToggle.addEventListener('click', toggleDirectorMode);
            }

            // Title modal
            el.titleModalClose.addEventListener('click', hideTitleModal);
            el.titleModalCancel.addEventListener('click', hideTitleModal);
            el.titleModalConfirm.addEventListener('click', () => {
                const newTitle = el.titleModalInput.value.trim() || '未命名文檔';
                if (state.currentDoc) {
                    state.currentDoc.title = newTitle;
                }
                el.navTitle.textContent = newTitle;
                autoSave();
                hideTitleModal();
            });
            el.titleModalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    el.titleModalConfirm.click();
                }
            });
            el.titleModal.addEventListener('click', (e) => {
                if (e.target === el.titleModal) hideTitleModal();
            });
            
            // Confirm modal
            el.confirmModalClose.addEventListener('click', hideConfirmModal);
            el.confirmModalCancel.addEventListener('click', hideConfirmModal);
            el.confirmModalConfirm.addEventListener('click', () => {
                if (confirmCallback) confirmCallback();
            });
            el.confirmModal.addEventListener('click', (e) => {
                if (e.target === el.confirmModal) hideConfirmModal();
            });
            
            // Scroll behavior
            window.addEventListener('scroll', handleScroll, { passive: true });
            
            // Focus Mode
            el.focusModeBtn.addEventListener('click', toggleFocusMode);
            el.focusModeExit.addEventListener('click', exitFocusMode);

            // Selection Menu - 已移除，功能整合到長按選單
            // document.addEventListener('mouseup', debounce(handleTextSelection, 100));
            // document.addEventListener('touchend', debounce(handleTextSelection, 100));
            // el.refineBtn.addEventListener('click', refineSelectedText);
            // el.expandBtn.addEventListener('click', expandSelectedText);
            // el.editBtn.addEventListener('click', enableEditing);
            // el.deleteTextBtn.addEventListener('click', deleteSelectedText);

            // Edit Canvas
            el.editCanvasCancel.addEventListener('click', closeEditCanvas);
            el.editCanvasConfirm.addEventListener('click', saveEditCanvas);
            el.editCanvasDelete.addEventListener('click', deleteFromEditCanvas);
            el.editCanvas.addEventListener('click', (e) => {
                if (e.target === el.editCanvas) closeEditCanvas();
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    saveCurrentDocument();
                    showToast('已儲存', 'success', 1500);
                }
                if (e.key === 'Escape') {
                    closeAllPanels();
                    hideTitleModal();
                    hideConfirmModal();
                    exitFocusMode();
                    hideSelectionMenu();
                }
            });
            
            // Before unload
            window.addEventListener('beforeunload', () => {
                saveCurrentDocument();
            });
        }

        // ============================================
        // Edit Canvas - 獨立編輯畫布
        // ============================================
        let currentEditingParagraphId = null;

        function openEditCanvas(paraId) {
            const para = state.currentDoc?.paragraphs?.find(p => p.id === paraId);
            if (!para) return;

            currentEditingParagraphId = paraId;
            el.editCanvasTextarea.value = para.content;
            el.editCanvas.classList.add('active');
            el.editCanvasTextarea.focus();
        }

        function closeEditCanvas() {
            el.editCanvas.classList.remove('active');
            currentEditingParagraphId = null;
            el.editCanvasTextarea.value = '';
        }

        function saveEditCanvas() {
            if (!currentEditingParagraphId) return;

            const para = state.currentDoc?.paragraphs?.find(p => p.id === currentEditingParagraphId);
            if (!para) return;

            const newContent = el.editCanvasTextarea.value.trim();

            if (newContent === '') {
                // 空訊息清理：自動刪除該段落
                const paraIndex = state.currentDoc.paragraphs.findIndex(p => p.id === currentEditingParagraphId);
                if (paraIndex !== -1) {
                    state.currentDoc.paragraphs.splice(paraIndex, 1);
                }
                showToast('空段落已刪除', 'info', 2000);
            } else {
                para.content = newContent;
                showToast('段落已更新', 'success', 2000);
            }

            renderParagraphs();
            autoSave();
            closeEditCanvas();
        }

        function deleteFromEditCanvas() {
            if (!currentEditingParagraphId) return;

            showConfirmModal('刪除段落', '確定要刪除此段落嗎？', () => {
                const paraIndex = state.currentDoc.paragraphs.findIndex(p => p.id === currentEditingParagraphId);
                if (paraIndex !== -1) {
                    state.currentDoc.paragraphs.splice(paraIndex, 1);
                    renderParagraphs();
                    autoSave();
                    showToast('段落已刪除', 'success', 2000);
                }
                hideConfirmModal();
                closeEditCanvas();
            });
        }

        // ============================================
        // Edit Canvas AI Functions - 編輯畫布 AI 輔助功能
        // ============================================
        async function refineInEditCanvas() {
            if (!currentEditingParagraphId || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            const content = el.editCanvasTextarea.value.trim();
            if (!content) {
                showToast('內容不能為空', 'warning');
                return;
            }

            const refineBtn = document.getElementById('editCanvasRefine');
            const expandBtn = document.getElementById('editCanvasExpand');

            // 設置載入狀態
            if (refineBtn) {
                refineBtn.disabled = true;
                refineBtn.innerHTML = '<span>⏳</span><span>潤飾中...</span>';
            }
            if (expandBtn) expandBtn.disabled = true;

            const prompt = `請潤飾以下文字，使其更加優美、有文采，保持原意不變，但讓描寫更加生動細膩。只輸出潤飾後的結果，不要加任何解釋：

原文：
${content}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    el.editCanvasTextarea.value = response;
                    showToast('潤飾完成', 'success', 2000);
                }
            } catch (error) {
                showToast('潤飾失敗：' + error.message, 'error');
            } finally {
                if (refineBtn) {
                    refineBtn.disabled = false;
                    refineBtn.innerHTML = '<span>✨</span><span>潤飾全文</span>';
                }
                if (expandBtn) expandBtn.disabled = false;
            }
        }

        async function expandInEditCanvas() {
            if (!currentEditingParagraphId || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            const content = el.editCanvasTextarea.value.trim();
            if (!content) {
                showToast('內容不能為空', 'warning');
                return;
            }

            const refineBtn = document.getElementById('editCanvasRefine');
            const expandBtn = document.getElementById('editCanvasExpand');

            // 設置載入狀態
            if (expandBtn) {
                expandBtn.disabled = true;
                expandBtn.innerHTML = '<span>⏳</span><span>擴寫中...</span>';
            }
            if (refineBtn) refineBtn.disabled = true;

            const prompt = `請擴寫以下文字，添加更多環境描寫、心理活動、感官細節，讓這段話變成一個更完整的場景描寫。保持原意，但讓內容更加豐富。只輸出擴寫後的結果，不要加任何解釋：

原文：
${content}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    el.editCanvasTextarea.value = response;
                    showToast('擴寫完成', 'success', 2000);
                }
            } catch (error) {
                showToast('擴寫失敗：' + error.message, 'error');
            } finally {
                if (expandBtn) {
                    expandBtn.disabled = false;
                    expandBtn.innerHTML = '<span>➕</span><span>擴寫全文</span>';
                }
                if (refineBtn) refineBtn.disabled = false;
            }
        }

        function initEditCanvasAiActions() {
            const refineBtn = document.getElementById('editCanvasRefine');
            const expandBtn = document.getElementById('editCanvasExpand');

            if (refineBtn) {
                refineBtn.addEventListener('click', refineInEditCanvas);
            }

            if (expandBtn) {
                expandBtn.addEventListener('click', expandInEditCanvas);
            }
        }

        // ============================================
        // Long Press Interaction - 長按互動
        // ============================================
        let longPressTimer = null;
        let longPressTarget = null;
        let longPressStartX = 0;
        let longPressStartY = 0;
        const LONG_PRESS_DURATION = 600;
        const MOVE_THRESHOLD = 10;

        function handleLongPressStart(e) {
            const paragraph = e.target.closest('.paragraph');
            if (!paragraph) return;

            longPressTarget = paragraph;
            longPressStartX = e.touches ? e.touches[0].clientX : e.clientX;
            longPressStartY = e.touches ? e.touches[0].clientY : e.clientY;

            longPressTimer = setTimeout(() => {
                // 震動反饋
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                showParagraphMenu(paragraph.dataset.id);
            }, LONG_PRESS_DURATION);
        }

        function handleLongPressMove(e) {
            if (!longPressTimer) return;

            const currentX = e.touches ? e.touches[0].clientX : e.clientX;
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaX = Math.abs(currentX - longPressStartX);
            const deltaY = Math.abs(currentY - longPressStartY);

            // 如果移動距離超過閾值，取消長按
            if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
        }

        function handleLongPressEnd() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
        }

        // ============================================
        // Action Sheet - 美觀的段落操作選單
        // ============================================
        let currentActionSheetParagraphId = null;

        function showActionSheet(paraId) {
            currentActionSheetParagraphId = paraId;
            const overlay = document.getElementById('actionSheetOverlay');
            const sheet = document.getElementById('actionSheet');

            if (overlay && sheet) {
                overlay.classList.add('active');
                sheet.classList.add('active');
            }
        }

        function hideActionSheet() {
            currentActionSheetParagraphId = null;
            const overlay = document.getElementById('actionSheetOverlay');
            const sheet = document.getElementById('actionSheet');

            if (overlay && sheet) {
                overlay.classList.remove('active');
                sheet.classList.remove('active');
            }
        }

        function initActionSheet() {
            const overlay = document.getElementById('actionSheetOverlay');
            const editBtn = document.getElementById('actionSheetEdit');
            const refineBtn = document.getElementById('actionSheetRefine');
            const expandBtn = document.getElementById('actionSheetExpand');
            const deleteBtn = document.getElementById('actionSheetDelete');
            const cancelBtn = document.getElementById('actionSheetCancel');

            if (overlay) {
                overlay.addEventListener('click', hideActionSheet);
            }

            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    if (currentActionSheetParagraphId) {
                        openEditCanvas(currentActionSheetParagraphId);
                    }
                    hideActionSheet();
                });
            }

            if (refineBtn) {
                refineBtn.addEventListener('click', () => {
                    if (currentActionSheetParagraphId) {
                        refineParagraph(currentActionSheetParagraphId);
                    }
                    hideActionSheet();
                });
            }

            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    if (currentActionSheetParagraphId) {
                        expandParagraph(currentActionSheetParagraphId);
                    }
                    hideActionSheet();
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (currentActionSheetParagraphId) {
                        deleteParagraph(currentActionSheetParagraphId);
                    }
                    hideActionSheet();
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', hideActionSheet);
            }
        }

        function showParagraphMenu(paraId) {
            // 使用新的 Action Sheet
            showActionSheet(paraId);
        }

        async function refineParagraph(paraId) {
            if (!state.currentDoc || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            const paragraph = state.currentDoc.paragraphs.find(p => p.id === paraId);
            if (!paragraph || !paragraph.content.trim()) {
                showToast('找不到段落或段落內容為空', 'warning');
                return;
            }

            showToast('正在潤飾段落...', 'info', 2000);

            const prompt = `請潤飾以下文字，使其更加優美、有文采，保持原意不變，但讓描寫更加生動細膩。只輸出潤飾後的結果，不要加任何解釋：

原文：
${paragraph.content}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    // 在獨立編輯畫布中顯示結果供用戶確認
                    currentEditingParagraphId = paraId;
                    el.editCanvasTextarea.value = response;
                    el.editCanvas.classList.add('active');
                    el.editCanvasTextarea.focus();
                    showToast('潤飾完成，請確認修改', 'success', 2000);
                }
            } catch (error) {
                showToast('潤飾失敗：' + error.message, 'error');
            }
        }

        async function expandParagraph(paraId) {
            if (!state.currentDoc || !state.globalSettings.apiKey) {
                showToast('請先設定 API Key', 'warning');
                return;
            }

            const paragraph = state.currentDoc.paragraphs.find(p => p.id === paraId);
            if (!paragraph || !paragraph.content.trim()) {
                showToast('找不到段落或段落內容為空', 'warning');
                return;
            }

            showToast('正在擴寫段落...', 'info', 2000);

            const prompt = `請擴寫以下文字，添加更多環境描寫、心理活動、感官細節，讓這段話變成一個更完整的場景描寫。保持原意，但讓內容更加豐富。只輸出擴寫後的結果，不要加任何解釋：

原文：
${paragraph.content}`;

            try {
                const response = await callAPI(prompt);
                if (response) {
                    // 在獨立編輯畫布中顯示結果供用戶確認
                    currentEditingParagraphId = paraId;
                    el.editCanvasTextarea.value = response;
                    el.editCanvas.classList.add('active');
                    el.editCanvasTextarea.focus();
                    showToast('擴寫完成，請確認修改', 'success', 2000);
                }
            } catch (error) {
                showToast('擴寫失敗：' + error.message, 'error');
            }
        }

        function deleteParagraph(paraId) {
            showConfirmModal('刪除段落', '確定要刪除此段落嗎？', () => {
                const paraIndex = state.currentDoc.paragraphs.findIndex(p => p.id === paraId);
                if (paraIndex !== -1) {
                    state.currentDoc.paragraphs.splice(paraIndex, 1);
                    renderParagraphs();
                    autoSave();
                    showToast('段落已刪除', 'success', 2000);
                }
                hideConfirmModal();
            });
        }

        // ============================================
        // Initialization
        // ============================================
        // 輔助函數：確保 docIndex 是有效陣列
        function ensureDocIndexIsArray() {
            if (!Array.isArray(state.docIndex)) {
                console.warn('ensureDocIndexIsArray: state.docIndex 資料異常，已重置');
                state.docIndex = [];
            }
        }

        function init() {
            // ============================================
            // Local-First 原則：優先載入本地資料
            // 無論是否登入，都先從 LocalStorage 載入並顯示內容
            // 雲端同步在背景執行，不阻塞初始化
            // ============================================

            // Load global settings
            loadGlobalSettings();

            // Load document index with safety check
            let docIndexData = loadFromStorage(STORAGE.DOC_INDEX, []);
            // 強制轉換：若為物件則透過 Object.values() 轉回陣列
            if (docIndexData && typeof docIndexData === 'object' && !Array.isArray(docIndexData)) {
                console.warn('init: docIndex 是物件，正在轉換為陣列');
                docIndexData = Object.values(docIndexData);
            }
            state.docIndex = Array.isArray(docIndexData) ? docIndexData : [];
            ensureDocIndexIsArray();

            // Initialize or load document
            if (state.docIndex.length === 0) {
                // No documents - create first one
                createDocument();
            } else {
                // Load most recent document
                loadDocument(state.docIndex[0].id);
            }

            // Initialize UI
            initPanelTabs();
            initEventListeners();
            initActionSheet();           // 初始化 Action Sheet
            initEditCanvasAiActions();   // 初始化編輯畫布 AI 功能
            renderDocList();
            renderWorldLibrarySelect();  // 初始化世界觀圖書館下拉選單

            // 初始化 Firebase 認證監聽（背景執行，不阻塞初始化）
            // Auth 狀態變更時才會觸發雲端同步
            initAuthListener();

            console.log('墨韻 MòYùn v2.1 初始化完成 (支援雲端同步)');

            // Initialize Style Tags & Director Mode UI
            updateStyleTagsUI();
            updateDirectorModeUI();

            // Welcome toast
            if (!state.globalSettings.apiKey) {
                showToast('歡迎！請先在設定中填入 API Key', 'info', 5000);
            }

            // Initialize offline storage and network monitoring
            initOfflineStorage();
        }

        // ============================================
        // Offline Storage Integration
        // ============================================
        async function initOfflineStorage() {
            // Initialize network status UI
            updateNetworkStatus();

            // Setup network listeners
            OfflineStorage.setupNetworkListeners(
                async () => {
                    // On online
                    updateNetworkStatus();
                    showToast('網路已恢復，正在同步資料...', 'info', 3000);

                    // Auto-sync pending changes
                    const result = await OfflineStorage.syncPendingChanges(storageManager);
                    if (result.success && result.count > 0) {
                        showToast(`已同步 ${result.count} 個變更`, 'success', 3000);
                    }
                },
                () => {
                    // On offline
                    updateNetworkStatus();
                    showToast('網路已斷開，將暫存至本地', 'warning', 3000);
                }
            );

            // Periodic sync check (every 30 seconds)
            setInterval(async () => {
                if (OfflineStorage.isOnline) {
                    const status = await OfflineStorage.getSyncStatus();
                    if (status.pendingChangesCount > 0) {
                        console.log(`⏳ 待同步變更: ${status.pendingChangesCount}`);
                    }
                }
            }, 30000);
        }

        function updateNetworkStatus() {
            const statusEl = el.networkStatus;
            if (!statusEl) return;

            const isOnline = navigator.onLine;
            const indicator = statusEl.querySelector('.status-indicator');
            const text = statusEl.querySelector('.status-text');

            statusEl.classList.remove('online', 'offline', 'syncing');
            indicator.classList.remove('online', 'offline');

            if (isOnline) {
                statusEl.classList.add('online');
                indicator.classList.add('online');
                text.textContent = '線上';
            } else {
                statusEl.classList.add('offline');
                indicator.classList.add('offline');
                text.textContent = '離線保存中';
            }
        }

        // Start
        document.addEventListener('DOMContentLoaded', init);

        // ============================================
        // PWA Service Worker Registration
        // ============================================
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then((registration) => {
                        console.log('✓ Service Worker 註冊成功:', registration.scope);

                        // 檢查更新
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('發現新版本 Service Worker');

                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // 新版本可用，提示用戶刷新
                                    showToast('發現新版本，請重新整理頁面', 'info', 5000);
                                }
                            });
                        });
                    })
                    .catch((error) => {
                        console.error('✗ Service Worker 註冊失敗:', error);
                    });
            });

            // 監聽 Service Worker 控制變更
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
