// ============================================
// MoYun 墨韻 - Document Manager Module
// 文檔管理：建立、載入、儲存、刪除文檔
// ============================================

// ============================================
// Document CRUD Operations
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

    // 自動滾動到文檔底部，方便閱讀最新內容
    setTimeout(() => {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTop = mainContent.scrollHeight;
        }
    }, 150);
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

// ============================================
// Auto Save (with debounce)
// ============================================
let autoSave = debounce(() => {
    // 1. 執行原本的儲存邏輯 (LocalStorage + Firebase)
    saveCurrentDocument();

    // 2. 執行離線儲存邏輯 (IndexedDB)
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
// ============================================
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
// World Library Management
// ============================================
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
    console.log('儲存世界觀到圖書館...');

    const name = el.worldNameInput.value.trim();
    const content = el.worldSetting.value.trim();

    console.log('世界觀名稱:', name);
    console.log('世界觀內容長度:', content.length);

    if (!name) {
        console.warn('世界觀名稱為空');
        showToast('請輸入世界觀名稱', 'warning');
        el.worldNameInput.focus();
        return;
    }

    if (!content) {
        console.warn('世界觀內容為空');
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
            console.log('更新現有世界觀:', name);
            library[existingIndex].content = content;
            library[existingIndex].lastModified = Date.now();
            savedWorldId = library[existingIndex].id;
            saveWorldLibrary(library);
            isUpdate = true;
        } else {
            // 新增
            console.log('新增世界觀:', name);
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

        console.log('世界觀儲存完成，已選中 ID:', savedWorldId);

        // 同步到雲端（如果已登入）
        if (storageManager.isLoggedIn()) {
            console.log('同步世界觀到雲端...');
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

// ============================================
// Default World & Prompt Settings
// ============================================
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

function restoreDefaultWorld() {
    const defaultWorld = state.globalSettings.defaultWorldSetting || '';
    el.worldSetting.value = defaultWorld;

    // 同步到當前文檔
    if (state.currentDoc) {
        state.currentDoc.worldSetting = defaultWorld;
        saveCurrentDocument();
    }

    showToast('已回復預設世界觀', 'success');
}

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

function restoreDefaultPrompt() {
    const defaultPrompt = state.globalSettings.defaultCustomPrompt || '你是一位資深小說家，擅長細膩的心理描寫與環境塑造。請以第三人稱視角續寫故事，保持文風一致，注重角色內心活動的刻畫。每次續寫至少 1200 字，描寫要具體且富有畫面感。';
    el.customPrompt.value = defaultPrompt;

    // 同步到當前文檔
    if (state.currentDoc) {
        state.currentDoc.customPrompt = defaultPrompt;
        saveCurrentDocument();
    }

    showToast('已回復預設系統指令', 'success');
}

// ============================================
// Paragraph Operations
// ============================================
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
// Text Selection Operations
// ============================================
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

                // 計算選單顯示位置（選取範圍的中心點）
                const x = rect.left + rect.width / 2;
                const y = rect.top;

                console.log('文字選取:', text.substring(0, 30) + '...', '座標:', x, y);
                showSelectionMenu(x, y);
                return;
            }
        }

        // 沒有有效選取，隱藏選單
        hideSelectionMenu();
        selectedText = '';
        selectedRange = null;
    }, 50);
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
