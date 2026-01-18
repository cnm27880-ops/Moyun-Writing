// ============================================
// MoYun 墨韻 - Main Application Logic
// 主應用程式：初始化、事件綁定、編輯畫布、長按互動
// ============================================

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

    // 如果段落正在 streaming（AI 生成中），不允許長按
    if (paragraph.classList.contains('streaming')) {
        return;
    }

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
    }
    longPressTarget = null;
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

        // 取得段落資訊
        const para = state.currentDoc?.paragraphs?.find(p => p.id === paraId);
        const isAiParagraph = para?.source === 'ai';
        const hasHistory = para?.history && para.history.length > 0;

        // 控制「指導重寫」按鈕顯示（僅 AI 段落）
        const directedRegenBtn = document.getElementById('actionSheetDirectedRegen');
        if (directedRegenBtn) {
            directedRegenBtn.style.display = isAiParagraph ? 'flex' : 'none';
        }

        // 控制「還原」按鈕顯示（僅有歷史紀錄時）
        const restoreBtn = document.getElementById('actionSheetRestore');
        if (restoreBtn) {
            if (hasHistory) {
                restoreBtn.style.display = 'flex';
                const historyCount = para.history.length;
                const spanEl = restoreBtn.querySelector('span:last-child');
                if (spanEl) {
                    spanEl.textContent = `還原上一版（${historyCount}）`;
                }
            } else {
                restoreBtn.style.display = 'none';
            }
        }
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
    const directedRegenBtn = document.getElementById('actionSheetDirectedRegen');
    const restoreBtn = document.getElementById('actionSheetRestore');
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

    // 指導重寫按鈕
    if (directedRegenBtn) {
        directedRegenBtn.addEventListener('click', () => {
            if (currentActionSheetParagraphId) {
                hideActionSheet();
                // 稍微延遲以確保 Action Sheet 關閉後再顯示 prompt
                setTimeout(() => {
                    if (typeof showDirectedRegenerationPrompt === 'function') {
                        showDirectedRegenerationPrompt(currentActionSheetParagraphId);
                    }
                }, 100);
            }
        });
    }

    // 還原按鈕
    if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
            if (currentActionSheetParagraphId) {
                if (typeof restoreParagraphFromHistory === 'function') {
                    restoreParagraphFromHistory(currentActionSheetParagraphId);
                }
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
    console.log('綁定世界觀圖書館事件監聽器...');
    el.worldLibrarySelect.addEventListener('change', () => {
        loadWorldFromLibrary(el.worldLibrarySelect.value);
    });

    if (el.worldSaveBtn) {
        el.worldSaveBtn.addEventListener('click', saveWorldToLibrary);
        console.log('worldSaveBtn 事件監聽器已綁定');
    } else {
        console.error('worldSaveBtn 元素不存在！');
    }

    if (el.worldDeleteBtn) {
        el.worldDeleteBtn.addEventListener('click', deleteWorldFromLibrary);
        console.log('worldDeleteBtn 事件監聽器已綁定');
    } else {
        console.error('worldDeleteBtn 元素不存在！');
    }

    // Default World & Prompt buttons (已從 UI 移除，保留安全檢查)
    if (el.setDefaultWorldBtn) {
        el.setDefaultWorldBtn.addEventListener('click', setDefaultWorld);
    }
    if (el.restoreDefaultWorldBtn) {
        el.restoreDefaultWorldBtn.addEventListener('click', restoreDefaultWorld);
    }
    if (el.setDefaultPromptBtn) {
        el.setDefaultPromptBtn.addEventListener('click', setDefaultPrompt);
    }
    if (el.restoreDefaultPromptBtn) {
        el.restoreDefaultPromptBtn.addEventListener('click', restoreDefaultPrompt);
    }

    // Settings
    el.saveSettingsBtn.addEventListener('click', saveGlobalSettings);
    el.clearAllBtn.addEventListener('click', clearAllData);
    el.temperature.addEventListener('input', (e) => {
        el.tempValue.textContent = e.target.value;
    });

    // Endpoint 下拉選單選擇事件
    if (el.endpointSelect) {
        el.endpointSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                el.apiEndpoint.value = e.target.value;
            }
        });
    }

    // Model 下拉選單選擇事件
    if (el.modelSelect) {
        el.modelSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                el.modelName.value = e.target.value;
            }
        });
    }

    // 刪除 Endpoint 按鈕
    if (el.deleteEndpointBtn) {
        el.deleteEndpointBtn.addEventListener('click', () => {
            const currentEndpoint = el.apiEndpoint.value.trim();
            if (!currentEndpoint) {
                showToast('請先選擇要刪除的端點', 'warning');
                return;
            }
            deleteFromHistory('endpoint', currentEndpoint);
        });
    }

    // 刪除 Model 按鈕
    if (el.deleteModelBtn) {
        el.deleteModelBtn.addEventListener('click', () => {
            const currentModel = el.modelName.value.trim();
            if (!currentModel) {
                showToast('請先選擇要刪除的模型', 'warning');
                return;
            }
            deleteFromHistory('model', currentModel);
        });
    }

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

    // Memory & settings auto-save (移除 styleFingerprint)
    [el.storyAnchors, el.worldSetting, el.customPrompt, el.aiCharacterNoteText, el.userCharacterNoteText].forEach(textarea => {
        if (textarea) {
            textarea.addEventListener('input', autoSave);
        }
    });

    // Character Note Tabs (角色印象筆記標籤切換)
    if (el.characterNoteTabs) {
        el.characterNoteTabs.querySelectorAll('.character-note-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const role = tab.dataset.role;
                // 切換標籤狀態
                el.characterNoteTabs.querySelectorAll('.character-note-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // 切換內容區域
                el.aiCharacterNote.classList.toggle('active', role === 'ai');
                el.userCharacterNote.classList.toggle('active', role === 'user');
            });
        });
    }

    // Extract Character Button (擷取生成按鈕)
    if (el.extractCharacterBtn) {
        el.extractCharacterBtn.addEventListener('click', extractCharacterImpression);
    }

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

    // 禁用主編輯器區域的系統複製粘貼選單（手機長按選單）
    el.editorBody.addEventListener('contextmenu', (e) => {
        // 如果不是在編輯模式下，禁用 contextmenu
        const target = e.target.closest('.paragraph-content');
        if (target && target.getAttribute('contenteditable') !== 'true') {
            e.preventDefault();
        }
    });

    // 禁用選擇開始事件（額外的保護層）
    el.editorBody.addEventListener('selectstart', (e) => {
        const target = e.target.closest('.paragraph-content');
        if (target && target.getAttribute('contenteditable') !== 'true') {
            e.preventDefault();
        }
    });

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
                console.log(`待同步變更: ${status.pendingChangesCount}`);
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

// ============================================
// Initialization
// ============================================
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
    initDirectorPanel();         // 初始化導演面板（邏輯模式選擇器）
    initEventListeners();
    initActionSheet();           // 初始化 Action Sheet
    initEditCanvasAiActions();   // 初始化編輯畫布 AI 功能
    initEditorBodyDelegation();  // 初始化編輯器 Event Delegation（效能優化）
    renderDocList();
    renderWorldLibrarySelect();  // 初始化世界觀圖書館下拉選單

    // 初始化 Firebase 認證監聽（背景執行，不阻塞初始化）
    // Auth 狀態變更時才會觸發雲端同步
    initAuthListener();

    console.log('墨韻 MoYun v2.1 初始化完成 (支援雲端同步)');

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

// Start
document.addEventListener('DOMContentLoaded', init);

// ============================================
// PWA Service Worker Registration
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('Service Worker 註冊成功:', registration.scope);

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
                console.error('Service Worker 註冊失敗:', error);
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
