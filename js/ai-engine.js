// ============================================
// MoYun 墨韻 - AI Engine Module
// AI 引擎：API 通訊、續寫、潤飾、擴寫等功能
// ============================================

// ============================================
// API Communication
// ============================================
function buildSystemPrompt() {
    const parts = [];

    // 1. 底層邏輯指令 (根據 logicMode 決定)
    const logicMode = state.currentDoc?.logicMode || 'claude';
    let instruction = '';

    if (logicMode === 'custom') {
        // 自訂模式：使用 customPrompt
        instruction = el.customPrompt?.value?.trim() || '';
    } else {
        // Gemini / Claude：使用預設的 LOGIC_PRESETS
        const preset = LOGIC_PRESETS[logicMode];
        if (preset) {
            instruction = preset.instruction;
        }
    }

    if (instruction) {
        parts.push(instruction);
    }

    // 2. 世界觀設定 (Claude 模式用 XML 包裹)
    const worldSetting = el.worldSetting?.value?.trim();
    if (worldSetting) {
        if (logicMode === 'claude') {
            parts.push(`<world_setting>\n${worldSetting}\n</world_setting>`);
        } else {
            parts.push(`【世界觀設定】\n${worldSetting}`);
        }
    }

    // 3. 文風基因 (Style DNA) - 全域設定
    const styleDNA = state.globalSettings?.authorStyleProfile?.trim() ||
                     document.getElementById('styleDNA')?.value?.trim();
    if (styleDNA) {
        if (logicMode === 'claude') {
            parts.push(`<style_reference>\n${styleDNA}\n</style_reference>`);
        } else {
            parts.push(`【文風參考】\n${styleDNA}`);
        }
    }

    // 4. 角色印象筆記 (權重最高，防止 OOC)
    const aiCharNote = el.aiCharacterNoteText?.value?.trim();
    const userCharNote = el.userCharacterNoteText?.value?.trim();
    if (aiCharNote || userCharNote) {
        let charNotes = '';
        if (logicMode === 'claude') {
            charNotes = '<character_profiles priority="highest">\n';
            if (aiCharNote) {
                charNotes += `<ai_character>\n${aiCharNote}\n</ai_character>\n`;
            }
            if (userCharNote) {
                charNotes += `<user_character>\n${userCharNote}\n</user_character>\n`;
            }
            charNotes += '</character_profiles>';
        } else {
            charNotes = '**【角色設定 - 最高優先級，嚴禁違反】**\n';
            if (aiCharNote) {
                charNotes += `\n[AI 主筆角色]\n${aiCharNote}`;
            }
            if (userCharNote) {
                charNotes += `\n\n[用戶主筆角色]\n${userCharNote}`;
            }
        }
        parts.push(charNotes);
    }

    // 5. 角色心理混音台 Prompt
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
        // 跳過空內容或只有空白字元的段落 (修復空訊息過濾)
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
    const history = options.customHistory || buildConversationHistory();

    // 注入增強 Prompt：如果最後一則訊息是 user，替換其 content 為包含風格標籤的 userContent
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        history[history.length - 1].content = userContent;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    if (state.globalSettings.apiFormat === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'MoYun';
    }

    // 建構 messages 陣列，過濾空的 system message (修復 API 空訊息過濾)
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...history);

    const requestBody = {
        model: modelName,
        messages: messages,
        temperature: parseFloat(temperature),
        top_p: 0.95,
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

async function callAPIForAnalysis(prompt) {
    const { apiEndpoint, apiKey, modelName } = state.globalSettings;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // 確保不使用 Stream 模式
    if (state.globalSettings.apiFormat === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'MoYun';
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                stream: false // 明確禁止流式傳輸
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 請求失敗 (${response.status}): ${errText}`);
        }

        const data = await response.json();

        // 檢查資料結構
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            const debugMsg = "API 回傳結構異常:\n" + JSON.stringify(data, null, 2);
            console.error(debugMsg);
            alert(debugMsg);
            return '';
        }

        return data.choices[0].message.content || '';

    } catch (error) {
        console.error("API Error:", error);
        alert("API 連線錯誤:\n" + error.message);
        throw error;
    }
}

// ============================================
// Style Tags
// ============================================
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

function getActiveStylePrompts() {
    const prompts = [];
    state.activeStyleTags.forEach(tagId => {
        if (STYLE_TAGS[tagId]) {
            prompts.push(STYLE_TAGS[tagId].prompt);
        }
    });
    return prompts;
}

// ============================================
// Main Submit Handler
// ============================================
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

    if (newPara) {
        // 添加 streaming 類別以顯示閃爍游標
        newPara.classList.add('streaming');
        // 初始滾動到段落頂部
        newPara.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
        const response = await callAPI(userPrompt, { stream: true });

        // 處理 SSE Stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullContent = '';

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

// ============================================
// Extract Style DNA (提取文風基因)
// ============================================
async function extractStyleDNA() {
    if (!state.currentDoc?.paragraphs?.length || state.currentDoc.paragraphs.length < 3) {
        showToast('內容太少，請先寫一些故事', 'warning');
        return;
    }

    if (!state.globalSettings.apiKey) {
        showToast('請先設定 API Key', 'error');
        return;
    }

    const extractStyleBtn = document.getElementById('extractStyleBtn');
    const styleDNATextarea = document.getElementById('styleDNA');

    if (extractStyleBtn) {
        extractStyleBtn.disabled = true;
        extractStyleBtn.textContent = '⏳ 分析中...';
    }

    try {
        // 優先取用戶撰寫的段落來分析風格（品質過濾：只分析超過 50 字的段落）
        const userParagraphs = state.currentDoc.paragraphs
            .filter(p => p.source === 'user' && p.content?.trim() && p.content.length > 50)
            .map(p => p.content);

        // 如果用戶段落不夠，補充一些 AI 段落
        let contentToAnalyze = userParagraphs.slice(-8).join('\n\n');
        if (userParagraphs.length < 3) {
            const allContent = state.currentDoc.paragraphs
                .filter(p => p.content?.trim() && p.content.length > 50)
                .slice(-10)
                .map(p => p.content)
                .join('\n\n');
            contentToAnalyze = allContent;
        }

        const analysisPrompt = `你是一位文學評論家。請閱讀以下文字片段，分析這位作者的「敘事風格」。

請用描述性的語言總結其：
- 句式節奏（長短句交錯？簡潔俐落？綿延流暢？）
- 感官側重（偏好視覺描寫？聽覺？觸覺？心理活動？）
- 用詞氛圍（典雅？口語化？帶有詩意？冷峻？溫暖？）

請忽略短促的對話或指令，專注於描寫類段落的敘事質感。
請不要列出條列式規則，而是給出一份約 100 字的「風格側寫」，像是在向另一位作家描述這種寫作風格的特徵。

【文字片段】
${contentToAnalyze}

請直接輸出風格側寫，不要加標題或額外說明。`;

        const response = await callAPIForAnalysis(analysisPrompt);

        if (response && response.trim()) {
            // 填入 styleDNA textarea
            if (styleDNATextarea) {
                styleDNATextarea.value = response.trim();
            }
            // 同時存入全域設定
            state.globalSettings.authorStyleProfile = response.trim();
            saveGlobalSettings();
            showToast('文風基因提取完成！', 'success');
        } else {
            showToast('無法分析風格，請重試', 'warning');
        }
    } catch (error) {
        showToast(`提取失敗: ${error.message}`, 'error');
    } finally {
        if (extractStyleBtn) {
            extractStyleBtn.disabled = false;
            extractStyleBtn.textContent = '🧬 提取文風';
        }
    }
}

// ============================================
// Regenerate Paragraph (重新生成段落)
// 支援指導重寫 (Directed Regeneration)
// ============================================
async function regenerateParagraph(paraId, instruction = null) {
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

    // === 保存歷史紀錄 ===
    if (typeof saveParagraphHistory === 'function') {
        saveParagraphHistory(paraId);
    }

    // 建立乾淨歷史：取得該段落之前的所有段落 (修復重複對話)
    const contextParagraphs = state.currentDoc.paragraphs.slice(0, paraIndex);

    // 建構 customHistory，過濾掉空內容
    const customHistory = [];
    let currentRole = null;
    let currentContent = '';

    contextParagraphs.forEach(p => {
        // 跳過空內容或只有空白字元的段落
        if (!p.content || !p.content.trim()) {
            return;
        }

        const role = p.source === 'user' ? 'user' : 'assistant';

        if (role === currentRole) {
            currentContent += '\n\n' + p.content;
        } else {
            if (currentRole && currentContent.trim()) {
                customHistory.push({ role: currentRole, content: currentContent });
            }
            currentRole = role;
            currentContent = p.content;
        }
    });

    if (currentRole && currentContent.trim()) {
        customHistory.push({ role: currentRole, content: currentContent });
    }

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

    // 根據是否有指令顯示不同提示
    if (instruction) {
        showToast(`正在按指令重寫：${instruction.substring(0, 20)}...`, 'info', 2000);
    } else {
        showToast('正在重新生成...', 'info', 2000);
    }

    try {
        // 構建 prompt：根據是否有指令決定
        let prompt;
        if (instruction && instruction.trim()) {
            // 指導重寫模式：包含用戶指令
            prompt = `請根據以下指令重新撰寫接下來的段落：

【重寫指令】${instruction.trim()}

請依照指令調整風格、語氣或內容方向，重新生成這一段。不要在文中提及指令，直接輸出故事內容。`;
        } else {
            // 普通重生模式
            prompt = '請繼續這個故事，重新生成接下來的段落。';
        }

        // 添加 user 訊息到 customHistory
        customHistory.push({ role: 'user', content: prompt });

        const response = await callAPI(prompt, { stream: true, customHistory: customHistory });

        // 處理 streaming response
        if (response && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            // 更新段落顯示為 streaming 狀態
            const paraElement = document.querySelector(`.paragraph[data-id="${paraId}"]`);
            if (paraElement) {
                paraElement.classList.add('streaming');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullContent += delta;
                                // 即時更新段落內容
                                paragraphs[paraIndex].content = fullContent;
                                const contentEl = paraElement?.querySelector('.paragraph-content');
                                if (contentEl) {
                                    contentEl.innerHTML = parseMarkdown(fullContent);
                                }
                            }
                        } catch (e) {
                            // 忽略解析錯誤
                        }
                    }
                }
            }

            // 移除 streaming 狀態
            if (paraElement) {
                paraElement.classList.remove('streaming');
            }

            if (fullContent) {
                paragraphs[paraIndex].content = fullContent;
                paragraphs[paraIndex].timestamp = Date.now();

                renderParagraphs();
                autoSave();
                showToast(instruction ? '指導重寫完成' : '重新生成完成', 'success', 2000);

                // 觸發自動同步（心靈同步功能）
                setTimeout(() => triggerAutoSync(), 500);
            }
        }
    } catch (error) {
        showToast(`重新生成失敗: ${error.message}`, 'error');
    } finally {
        state.isLoading = false;

        // Remove breathing effect from editor
        if (editorPaper) {
            editorPaper.classList.remove('ai-writing');
        }

        // 恢復按鈕狀態
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄';
        }
    }
}

// ============================================
// Directed Regeneration (指導重寫)
// 彈出輸入框讓用戶輸入指令
// ============================================
function showDirectedRegenerationPrompt(paraId) {
    // 使用 prompt 對話框取得用戶指令
    const instruction = window.prompt(
        '請輸入重寫指令（例如：讓語氣更悲傷、增加更多對話、描寫更細膩等）：',
        ''
    );

    if (instruction === null) {
        // 用戶取消
        return;
    }

    if (!instruction.trim()) {
        showToast('請輸入有效的指令', 'warning');
        return;
    }

    // 執行指導重寫
    regenerateParagraph(paraId, instruction.trim());
}

// ============================================
// Text Selection Operations (選取文字操作)
// ============================================
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

// ============================================
// Paragraph AI Operations (段落 AI 操作)
// ============================================
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

    // === 保存歷史紀錄 ===
    if (typeof saveParagraphHistory === 'function') {
        saveParagraphHistory(paraId);
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

    // === 保存歷史紀錄 ===
    if (typeof saveParagraphHistory === 'function') {
        saveParagraphHistory(paraId);
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

// ============================================
// Extract Character Impression (角色印象筆記 - 擷取生成)
// ============================================
async function extractCharacterImpression() {
    if (!state.currentDoc?.paragraphs?.length || state.currentDoc.paragraphs.length < 2) {
        showToast('內容太少，請先寫一些故事', 'warning');
        return;
    }

    if (!state.globalSettings.apiKey) {
        showToast('請先設定 API Key', 'error');
        return;
    }

    const btn = el.extractCharacterBtn;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 分析中...';
    }

    try {
        // 取得最近的故事內容
        const recentContent = state.currentDoc.paragraphs
            .slice(-15)
            .map(p => `[${p.source === 'user' ? '用戶' : 'AI'}]: ${p.content}`)
            .join('\n\n');

        const analysisPrompt = `你是一位文學編輯，請分析以下故事對話，識別出兩個主要角色：
1. AI 主筆角色（由 AI 續寫時主要描寫的角色）
2. 用戶主筆角色（由用戶輸入時主要描寫的角色）

【故事對話】
${recentContent}

請分析 AI 在續寫時對這些角色的「當下理解」，這是用來檢查 AI 是否有錯誤的設定或幻覺。

請以 JSON 格式回傳，結構如下：
{
  "aiCharacter": {
    "角色名稱": "角色的名字",
    "身分本質": "AI 認為這個角色是誰（職業、種族、身分等）",
    "當前狀態": "角色現在的處境、位置、正在做什麼",
    "性格特質": "角色展現出的性格",
    "關鍵經歷": "故事中提到的重要背景或經歷"
  },
  "userCharacter": {
    "角色名稱": "角色的名字",
    "身分本質": "這個角色是誰（職業、種族、身分等）",
    "當前狀態": "角色現在的處境、位置、正在做什麼",
    "性格特質": "角色展現出的性格",
    "關鍵經歷": "故事中提到的重要背景或經歷"
  }
}

請直接回傳 JSON，不要加任何其他說明。如果無法識別某個角色，該欄位填寫 "未識別"。`;

        const response = await callAPIForAnalysis(analysisPrompt);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);

            if (result.aiCharacter) {
                el.aiCharacterNoteText.value = JSON.stringify(result.aiCharacter, null, 2);
            }
            if (result.userCharacter) {
                el.userCharacterNoteText.value = JSON.stringify(result.userCharacter, null, 2);
            }

            autoSave();
            showToast('角色印象擷取完成！請檢查是否有錯誤理解', 'success');
        } else {
            showToast('無法解析回應，請重試', 'warning');
        }
    } catch (error) {
        showToast(`擷取失敗: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 擷取生成';
        }
    }
}
