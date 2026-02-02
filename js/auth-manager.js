// ============================================
// MoYun 墨韻 - Auth Manager Module
// 認證管理：登入/登出、雲端同步、備份、設定
// ============================================

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
            console.log('登入成功:', result.user.email);
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
        console.log('已登出');
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
    console.log('檢查 Redirect 登入結果...');
    try {
        const result = await firebaseAuth.getRedirectResult();
        console.log('getRedirectResult 返回:', result);

        if (result && result.user) {
            console.log('Redirect 登入成功:', result.user.email);
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
        console.error('Redirect 登入錯誤:', error);
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
            console.log('用戶已登入，開始同步資料');

            // 只在非 redirect 情況下顯示歡迎訊息（redirect 已在上方處理）
            const isFromRedirect = sessionStorage.getItem('authRedirectHandled');
            if (!isFromRedirect) {
                showToast('歡迎回來，' + (user.displayName || '使用者'), 'success');
            }
            sessionStorage.setItem('authRedirectHandled', 'true');

            // 更新裝置心跳
            await storageManager.updateDeviceHeartbeat();

            // 強制執行完整的資料同步
            console.log('執行 syncAllData...');
            await storageManager.syncAllData();
            console.log('syncAllData 完成');

            // 檢查是否需要自動備份（24小時一次）
            await checkAndPerformAutoBackup();

            // 載入裝置統計
            await loadDeviceCount();

            // 同步完成後，強制從 localStorage 重新讀取最新的 docIndex
            try {
                const docIndexData = localStorage.getItem(STORAGE.DOC_INDEX);
                if (docIndexData) {
                    state.docIndex = JSON.parse(docIndexData);
                    console.log(`重新載入 docIndex，共 ${state.docIndex.length} 個文檔`);
                } else {
                    state.docIndex = [];
                    console.log('docIndex 為空');
                }
            } catch (e) {
                console.error('載入 docIndex 失敗:', e);
                state.docIndex = [];
            }

            ensureDocIndexIsArray();
            renderDocList();

            // 載入最新的文檔（同步後的版本）
            if (state.docIndex.length > 0) {
                console.log(`載入最新文檔: ${state.docIndex[0].id}`);
                loadDocument(state.docIndex[0].id);
            } else {
                console.log('沒有文檔，建立新文檔');
                createDocument();
            }

            // Reload global settings
            loadGlobalSettings();
            renderWorldLibrarySelect();

            console.log('登入後同步與載入完成');
        } else {
            // 登出時清除標記
            console.log('用戶已登出');
            sessionStorage.removeItem('authRedirectHandled');
        }
    });

    // Listen for sync status changes
    storageManager.onSyncStatusChange(updateSyncStatusUI);
}

// ============================================
// Cloud Backup Functions
// ============================================
async function checkAndPerformAutoBackup() {
    if (!storageManager.isLoggedIn()) return;

    try {
        const lastAutoBackup = localStorage.getItem('moyun_lastAutoBackup');
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        if (!lastAutoBackup || parseInt(lastAutoBackup) < oneDayAgo) {
            console.log('執行自動備份...');
            const backupId = await storageManager.createCloudBackup('系統自動備份');
            if (backupId) {
                localStorage.setItem('moyun_lastAutoBackup', now.toString());
                console.log('自動備份完成');

                // 自動清理超過三天的舊備份
                await storageManager.cleanOldBackups(3);
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
                    <div class="backup-actions">
                        <button class="backup-restore-btn" onclick="restoreBackup('${backup.id}')">還原</button>
                        <button class="backup-delete-btn" onclick="deleteBackup('${backup.id}')">刪除</button>
                    </div>
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
                console.log('開始強制修復雲端資料...');
                const userId = storageManager.getUserId();

                // 1. 上傳文檔索引和所有文檔
                let docIndex = loadFromStorage(STORAGE.DOC_INDEX, []);
                if (!Array.isArray(docIndex)) {
                    docIndex = Object.values(docIndex);
                }

                if (docIndex.length > 0) {
                    await firebaseDB.ref(`users/${userId}/docs/index`).set(docIndex);
                    console.log(`已上傳文檔索引 (${docIndex.length} 個文檔)`);

                    for (const doc of docIndex) {
                        const docData = loadFromStorage(STORAGE.DOC_PREFIX + doc.id);
                        if (docData) {
                            await firebaseDB.ref(`users/${userId}/docs/${doc.id}`).set(docData);
                            console.log(`已上傳文檔: ${doc.title || doc.id}`);
                        }
                    }
                }

                // 2. 上傳世界觀圖書館
                let worldLibrary = loadFromStorage(STORAGE.WORLD_LIBRARY, []);
                if (!Array.isArray(worldLibrary)) {
                    worldLibrary = Object.values(worldLibrary);
                }
                await firebaseDB.ref(`users/${userId}/worldLibrary`).set(worldLibrary);
                console.log(`已上傳世界觀圖書館 (${worldLibrary.length} 個)`);

                // 3. 上傳全域設定 (排除 apiKey)
                const settings = loadFromStorage(STORAGE.GLOBAL_SETTINGS, {});
                const settingsToSync = { ...settings };
                delete settingsToSync.apiKey;
                await firebaseDB.ref(`users/${userId}/settings`).set(settingsToSync);
                console.log('已上傳全域設定');

                console.log('雲端資料修復完成！');
                showToast('雲端資料已修復！', 'success');

            } catch (error) {
                console.error('修復失敗:', error);
                showToast('修復失敗：' + error.message, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '強制用本地覆蓋雲端';
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

async function deleteBackup(backupId) {
    showConfirmModal('刪除備份', '確定要刪除此備份嗎？此操作無法復原。', async () => {
        hideConfirmModal();

        const toastEl = showToast('正在刪除備份...', 'info', 0);

        try {
            const success = await storageManager.deleteCloudBackup(backupId);

            if (toastEl && toastEl.parentNode) {
                toastEl.remove();
            }

            if (success) {
                showToast('備份已刪除', 'success');
                await renderBackupList();
            } else {
                showToast('刪除備份失敗', 'error');
            }
        } catch (error) {
            if (toastEl && toastEl.parentNode) {
                toastEl.remove();
            }
            console.error('刪除備份失敗:', error);
            showToast('刪除失敗：' + error.message, 'error');
        }
    });
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
    // 更新 Endpoint 下拉選單
    const endpointSelect = el.endpointSelect;
    if (endpointSelect) {
        const currentValue = el.apiEndpoint.value;
        endpointSelect.innerHTML = '<option value="">-- 選擇或輸入新端點 --</option>';
        (state.globalSettings.savedEndpoints || []).forEach(endpoint => {
            const option = document.createElement('option');
            option.value = endpoint;
            option.textContent = endpoint.length > 50 ? endpoint.substring(0, 50) + '...' : endpoint;
            if (endpoint === currentValue) {
                option.selected = true;
            }
            endpointSelect.appendChild(option);
        });
    }

    // 更新 Model 下拉選單
    const modelSelect = el.modelSelect;
    if (modelSelect) {
        const currentValue = el.modelName.value;
        modelSelect.innerHTML = '<option value="">-- 選擇或輸入新模型 --</option>';
        (state.globalSettings.savedModels || []).forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === currentValue) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
    }
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

function deleteFromHistory(type, value) {
    if (type === 'endpoint') {
        const savedEndpoints = state.globalSettings.savedEndpoints || [];
        const index = savedEndpoints.indexOf(value);
        if (index > -1) {
            savedEndpoints.splice(index, 1);
            state.globalSettings.savedEndpoints = savedEndpoints;
            el.apiEndpoint.value = '';
            showToast('端點已從歷史記錄中刪除', 'success');
        } else {
            showToast('此端點不在歷史記錄中', 'warning');
            return;
        }
    } else if (type === 'model') {
        const savedModels = state.globalSettings.savedModels || [];
        const index = savedModels.indexOf(value);
        if (index > -1) {
            savedModels.splice(index, 1);
            state.globalSettings.savedModels = savedModels;
            el.modelName.value = '';
            showToast('模型已從歷史記錄中刪除', 'success');
        } else {
            showToast('此模型不在歷史記錄中', 'warning');
            return;
        }
    }

    // 保存設定並更新 UI
    saveToStorage(STORAGE.GLOBAL_SETTINGS, state.globalSettings);
    if (storageManager.isLoggedIn()) {
        storageManager.syncSettings();
    }
    updateHistoryDatalist();
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
