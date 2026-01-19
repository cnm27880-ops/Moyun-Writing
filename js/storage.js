class StorageManager {
    constructor() {
        this.user = null;
        this.syncStatus = 'idle'; // idle, syncing, synced, error
        this.listeners = [];
        this.deviceId = this.getOrCreateDeviceId();
    }

    // Get or create a unique device ID
    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('moyun_deviceId');
        if (!deviceId) {
            // Generate UUID v4
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('moyun_deviceId', deviceId);
        }
        return deviceId;
    }

    // Add listener for sync status changes
    onSyncStatusChange(callback) {
        this.listeners.push(callback);
    }

    // Notify listeners of sync status change
    notifySyncStatus(status) {
        this.syncStatus = status;
        this.listeners.forEach(cb => cb(status));
    }

    // Set current user
    setUser(user) {
        this.user = user;
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.user !== null;
    }

    // Get user ID
    getUserId() {
        return this.user?.uid || null;
    }

    // ============================================
    // Local Storage Operations
    // ============================================
    saveLocal(key, data) {
        try {
            // 防呆機制：保護 docIndex 不被空陣列意外覆蓋
            if (key === STORAGE.DOC_INDEX) {
                if (Array.isArray(data) && data.length === 0) {
                    const existingData = localStorage.getItem(key);
                    if (existingData) {
                        try {
                            const existing = JSON.parse(existingData);
                            if (Array.isArray(existing) && existing.length > 0) {
                                console.warn('StorageManager.saveLocal: 阻止空陣列覆蓋現有 docIndex 資料');
                                return false; // 拒絕寫入
                            }
                        } catch (e) {
                            // 如果解析失敗，允許寫入
                        }
                    }
                }
            }

            // 確保儲存時有時間戳記 (如果是物件)
            // 這裡不需過度處理，因為 utils.js 的 saveToStorage 已經處理過了，
            // 但 StorageManager 可能是直接被調用，所以保險起見保留基本存儲。
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Local save error:', error);
            return false;
        }
    }

    loadLocal(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Local load error:', error);
            return defaultValue;
        }
    }

    removeLocal(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Local remove error:', error);
            return false;
        }
    }

    // ============================================
    // Firebase Operations
    // ============================================
    async saveCloud(path, data) {
        if (!this.isLoggedIn() || !firebaseDB) return false;

        try {
            this.notifySyncStatus('syncing');

            // 確保有最後修改時間
            const dataToSave = (data && typeof data === 'object' && !Array.isArray(data))
                ? { ...data, _lastModified: data._lastModified || Date.now() }
                : data;

            await firebaseDB.ref(`users/${this.getUserId()}/${path}`).set(dataToSave);

            // 更新裝置心跳
            await this.updateDeviceHeartbeat();

            this.notifySyncStatus('synced');
            return true;
        } catch (error) {
            console.error('Cloud save error:', error);
            this.notifySyncStatus('error');

            // 檢測 PERMISSION_DENIED 錯誤，提供友善提示
            if (error.code === 'PERMISSION_DENIED' ||
                (error.message && error.message.includes('PERMISSION_DENIED'))) {
                // 這裡假設 showToast 是全域函數，如果不是，建議改用 console.error 或 callback
                if (typeof showToast === 'function') {
                    showToast('同步失敗：請檢查 Firebase 規則設定', 'error');
                }
            }

            return false;
        }
    }

    async loadCloud(path) {
        if (!this.isLoggedIn() || !firebaseDB) return null;

        try {
            const snapshot = await firebaseDB.ref(`users/${this.getUserId()}/${path}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Cloud load error:', error);
            return null;
        }
    }

    async removeCloud(path) {
        if (!this.isLoggedIn() || !firebaseDB) return false;

        try {
            await firebaseDB.ref(`users/${this.getUserId()}/${path}`).remove();
            return true;
        } catch (error) {
            console.error('Cloud remove error:', error);
            return false;
        }
    }

    // ============================================
    // Device Tracking System
    // ============================================
    async updateDeviceHeartbeat() {
        if (!this.isLoggedIn() || !firebaseDB) return false;

        try {
            const deviceData = {
                lastSeen: Date.now(),
                userAgent: navigator.userAgent
            };
            await firebaseDB.ref(`users/${this.getUserId()}/devices/${this.deviceId}`).set(deviceData);
            return true;
        } catch (error) {
            console.error('Device heartbeat update error:', error);
            return false;
        }
    }

    async getActiveDeviceCount() {
        if (!this.isLoggedIn() || !firebaseDB) return 0;

        try {
            const snapshot = await firebaseDB.ref(`users/${this.getUserId()}/devices`).once('value');
            const devices = snapshot.val();

            if (!devices) return 0;

            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

            // 過濾掉 lastSeen 超過 7 天的裝置
            const activeDevices = Object.values(devices).filter(device => {
                return device.lastSeen && device.lastSeen > sevenDaysAgo;
            });

            return activeDevices.length;
        } catch (error) {
            console.error('Get active device count error:', error);
            return 0;
        }
    }

    // ============================================
    // Hybrid Operations (Local + Cloud)
    // ============================================
    async save(key, data, cloudPath = null) {
        // Always save to local
        this.saveLocal(key, data);

        // If logged in, also save to cloud
        if (this.isLoggedIn() && cloudPath) {
            await this.saveCloud(cloudPath, data);
        }
    }

    async load(key, cloudPath = null, defaultValue = null) {
        // Local-First 原則：永遠優先讀取本地數據
        const localData = this.loadLocal(key, defaultValue);

        // 如果未登入或沒有指定雲端路徑，直接返回本地數據
        if (!this.isLoggedIn() || !cloudPath) {
            return localData;
        }

        // 如果已登入，嘗試獲取雲端數據進行比對
        const cloudData = await this.loadCloud(cloudPath);

        // 如果雲端沒有數據，返回本地數據
        if (!cloudData) {
            return localData;
        }

        // 比較時間戳，使用較新的數據
        const localTimestamp = localData?._lastModified || 0;
        const cloudTimestamp = cloudData?._lastModified || 0;

        if (cloudTimestamp > localTimestamp) {
            // 雲端較新，更新本地並返回
            this.saveLocal(key, cloudData);
            return cloudData;
        } else if (localTimestamp > cloudTimestamp && localData) {
            // 本地較新，更新雲端並返回
            await this.saveCloud(cloudPath, localData);
            return localData;
        }

        // 時間戳相同或無法比較時，優先返回本地數據
        return localData || cloudData;
    }

    async remove(key, cloudPath = null) {
        this.removeLocal(key);
        if (this.isLoggedIn() && cloudPath) {
            await this.removeCloud(cloudPath);
        }
    }

    // ============================================
    // Full Sync Operation
    // ============================================
    async syncAllData() {
        if (!this.isLoggedIn()) return;

        this.notifySyncStatus('syncing');

        try {
            // Update device heartbeat
            await this.updateDeviceHeartbeat();

            // Sync global settings
            await this.syncSettings();

            // Sync document index
            await this.syncDocIndex();

            // Sync world library
            await this.syncWorldLibrary();

            this.notifySyncStatus('synced');
            return true;
        } catch (error) {
            console.error('Full sync error:', error);
            this.notifySyncStatus('error');
            return false;
        } finally {
            // 確保無論成功或失敗，都會解除 syncing 狀態
            if (this.syncStatus === 'syncing') {
                this.notifySyncStatus('idle');
            }
        }
    }

    async syncSettings() {
        const localSettings = this.loadLocal(STORAGE.GLOBAL_SETTINGS);
        const cloudSettings = await this.loadCloud('settings');

        // 保存本機的 apiKey（不同步到雲端）
        const localApiKey = localSettings?.apiKey || '';

        if (cloudSettings && !localSettings) {
            // 從雲端載入設定，但保留本機的 apiKey
            const mergedSettings = { ...cloudSettings, apiKey: localApiKey };
            this.saveLocal(STORAGE.GLOBAL_SETTINGS, mergedSettings);
            return mergedSettings;
        } else if (localSettings && !cloudSettings) {
            // 上傳到雲端時，排除 apiKey
            const settingsToSync = { ...localSettings };
            delete settingsToSync.apiKey;
            await this.saveCloud('settings', settingsToSync);
            return localSettings;
        } else if (localSettings && cloudSettings) {
            // Compare and use newer
            const localTime = localSettings._lastModified || 0;
            const cloudTime = cloudSettings._lastModified || 0;

            if (cloudTime > localTime) {
                // 使用雲端較新的設定，但保留本機的 apiKey
                const mergedSettings = { ...cloudSettings, apiKey: localApiKey };
                this.saveLocal(STORAGE.GLOBAL_SETTINGS, mergedSettings);
                return mergedSettings;
            } else {
                // 上傳本機較新的設定到雲端，但排除 apiKey
                const settingsToSync = { ...localSettings };
                delete settingsToSync.apiKey;
                await this.saveCloud('settings', settingsToSync);
                return localSettings;
            }
        }
        return localSettings;
    }

    async syncDocIndex() {
        // 未登入時直接返回，不執行任何同步邏輯
        if (!this.isLoggedIn()) {
            console.log('syncDocIndex: 未登入，跳過同步');
            return;
        }

        console.log('🔄 開始同步文檔索引 (基於時間戳雙向合併)');

        const localIndex = this.loadLocal(STORAGE.DOC_INDEX, []);
        const cloudData = await this.loadCloud('docs/index');

        // 重要修正：Firebase 可能回傳 Object 而非 Array，需進行正規化
        const cloudIndex = cloudData ? (Array.isArray(cloudData) ? cloudData : Object.values(cloudData)) : [];

        // 建立文檔 ID 到資料的對應表
        const localMap = new Map();
        const cloudMap = new Map();

        localIndex.forEach(doc => localMap.set(doc.id, doc));
        cloudIndex.forEach(doc => cloudMap.set(doc.id, doc));

        // 獲取所有唯一的文檔 ID
        const allDocIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

        const mergedIndex = [];
        const toUpload = [];
        const toDownload = [];

        // 對每個文檔進行時間戳比較
        for (const docId of allDocIds) {
            const localDoc = localMap.get(docId);
            const cloudDoc = cloudMap.get(docId);

            if (localDoc && !cloudDoc) {
                // 只存在於本地，需要上傳
                mergedIndex.push(localDoc);
                toUpload.push(docId);
                console.log(`📤 文檔 ${docId} 只存在於本地，標記上傳`);
            } else if (!localDoc && cloudDoc) {
                // 只存在於雲端，需要下載
                mergedIndex.push(cloudDoc);
                toDownload.push(docId);
                console.log(`📥 文檔 ${docId} 只存在於雲端，標記下載`);
            } else if (localDoc && cloudDoc) {
                // 兩邊都存在，比較時間戳
                const localTime = localDoc._lastModified || localDoc.lastModified || 0;
                const cloudTime = cloudDoc._lastModified || cloudDoc.lastModified || 0;

                if (localTime > cloudTime) {
                    // 本地較新，使用本地版本並上傳
                    mergedIndex.push(localDoc);
                    toUpload.push(docId);
                    console.log(`📤 文檔 ${docId} 本地較新，標記上傳`);
                } else if (cloudTime > localTime) {
                    // 雲端較新，使用雲端版本並下載
                    mergedIndex.push(cloudDoc);
                    toDownload.push(docId);
                    console.log(`📥 文檔 ${docId} 雲端較新，標記下載`);
                } else {
                    // 時間戳相同，使用本地版本
                    mergedIndex.push(localDoc);
                }
            }
        }

        // 執行下載操作
        for (const docId of toDownload) {
            const docData = await this.loadCloud(`docs/${docId}`);
            if (docData) {
                this.saveLocal(STORAGE.DOC_PREFIX + docId, docData);
                console.log(`✓ 已下載文檔 ${docId}`);
            }
        }

        // 執行上傳操作
        for (const docId of toUpload) {
            const docData = this.loadLocal(STORAGE.DOC_PREFIX + docId);
            if (docData) {
                await this.saveCloud(`docs/${docId}`, docData);
                console.log(`✓ 已上傳文檔 ${docId}`);
            }
        }

        // 按最後修改時間排序
        mergedIndex.sort((a, b) => {
            const aTime = a._lastModified || a.lastModified || 0;
            const bTime = b._lastModified || b.lastModified || 0;
            return bTime - aTime;
        });

        // 保存合併後的索引
        if (mergedIndex.length > 0) {
            console.log(`💾 保存合併後的索引 (共 ${mergedIndex.length} 個文檔)`);
            localStorage.setItem(STORAGE.DOC_INDEX, JSON.stringify(mergedIndex));
            await this.saveCloud('docs/index', mergedIndex);
        } else if (cloudIndex.length === 0 && localIndex.length === 0) {
            // 雙方都為空，初始化
            localStorage.setItem(STORAGE.DOC_INDEX, JSON.stringify([]));
        }

        console.log('✓ 文檔索引同步完成');
    }

    async syncWorldLibrary() {
        console.log('🔄 開始同步世界觀圖書館...');

        // 1. 載入本地資料
        const localLibrary = this.loadLocal(STORAGE.WORLD_LIBRARY, []);

        // 2. 載入雲端資料
        const cloudData = await this.loadCloud('worldLibrary');
        // 重要修正：確保轉為陣列，處理 Firebase 可能回傳物件的情況
        const cloudLibrary = cloudData ? (Array.isArray(cloudData) ? cloudData : Object.values(cloudData)) : [];

        // 3. 雙向合併邏輯 (以 ID 為 Key)
        const mergedMap = new Map();

        // 先放入雲端資料
        cloudLibrary.forEach(world => {
            if (world && world.id) {
                mergedMap.set(world.id, world);
            }
        });

        // 再放入本地資料 (若衝突則比較時間戳)
        localLibrary.forEach(world => {
            if (world && world.id) {
                const existing = mergedMap.get(world.id);
                const localTime = world.lastModified || 0;
                const cloudTime = existing ? (existing.lastModified || 0) : -1;

                if (!existing || localTime >= cloudTime) {
                    // 本地較新或雲端不存在，使用本地版本
                    mergedMap.set(world.id, world);
                }
            }
        });

        const merged = Array.from(mergedMap.values());

        // 4. 同步回兩端
        // 只有當資料有變動或需要初始化時才儲存
        if (merged.length > 0 || (localLibrary.length > 0 || cloudLibrary.length > 0)) {
            console.log(`💾 同步世界觀完成，共 ${merged.length} 筆資料`);
            this.saveLocal(STORAGE.WORLD_LIBRARY, merged);
            await this.saveCloud('worldLibrary', merged);
        } else {
            console.log('✓ 世界觀圖書館為空，無需同步');
        }
    }

    // ============================================
    // Version History & Backup System
    // ============================================
    async createCloudBackup(note = '手動備份') {
        if (!this.isLoggedIn() || !firebaseDB) {
            console.error('無法建立備份：未登入');
            return false;
        }

        try {
            console.log('📦 開始建立雲端備份...');

            // 讀取本地所有資料
            const docIndex = this.loadLocal(STORAGE.DOC_INDEX, []);
            const worldLibrary = this.loadLocal(STORAGE.WORLD_LIBRARY, []);
            const globalSettings = this.loadLocal(STORAGE.GLOBAL_SETTINGS, {});

            // 收集所有文檔內容
            const documents = {};
            for (const docInfo of docIndex) {
                const docData = this.loadLocal(STORAGE.DOC_PREFIX + docInfo.id);
                if (docData) {
                    documents[docInfo.id] = docData;
                }
            }

            // 打包成備份資料
            const backupData = {
                timestamp: Date.now(),
                note: note,
                data: {
                    docIndex: docIndex,
                    documents: documents,
                    worldLibrary: worldLibrary,
                    globalSettings: globalSettings
                }
            };

            // 上傳到雲端
            const backupId = Date.now().toString();
            await firebaseDB.ref(`users/${this.getUserId()}/backups/${backupId}`).set(backupData);

            console.log('✓ 備份建立完成:', backupId);
            return backupId;
        } catch (error) {
            console.error('建立備份失敗:', error);
            return false;
        }
    }

    async getCloudBackups() {
        if (!this.isLoggedIn() || !firebaseDB) return [];

        try {
            const snapshot = await firebaseDB.ref(`users/${this.getUserId()}/backups`).once('value');
            const backups = snapshot.val();

            if (!backups) return [];

            // 轉換成陣列並排序（最新的在前）
            const backupList = Object.entries(backups).map(([id, data]) => ({
                id: id,
                timestamp: data.timestamp,
                note: data.note,
                // 不包含完整資料，減少流量
            })).sort((a, b) => b.timestamp - a.timestamp);

            return backupList;
        } catch (error) {
            console.error('讀取備份列表失敗:', error);
            return [];
        }
    }

    async restoreCloudBackup(backupId) {
        if (!this.isLoggedIn() || !firebaseDB) {
            console.error('無法還原備份：未登入');
            return false;
        }

        try {
            console.log('🔄 開始還原備份:', backupId);

            // 從雲端下載完整備份資料
            const snapshot = await firebaseDB.ref(`users/${this.getUserId()}/backups/${backupId}`).once('value');
            const backup = snapshot.val();

            if (!backup || !backup.data) {
                console.error('備份資料不存在或損壞');
                return false;
            }

            const { docIndex, documents, worldLibrary, globalSettings } = backup.data;

            // 保留本機的 apiKey（不覆蓋）
            const currentSettings = this.loadLocal(STORAGE.GLOBAL_SETTINGS, {});
            const mergedSettings = { ...globalSettings, apiKey: currentSettings.apiKey || '' };

            // 強制覆蓋本地資料
            this.saveLocal(STORAGE.DOC_INDEX, docIndex);
            this.saveLocal(STORAGE.WORLD_LIBRARY, worldLibrary);
            this.saveLocal(STORAGE.GLOBAL_SETTINGS, mergedSettings);

            // 還原所有文檔
            for (const [docId, docData] of Object.entries(documents)) {
                this.saveLocal(STORAGE.DOC_PREFIX + docId, docData);
            }

            console.log('✓ 本地資料已還原');

            // 強制覆蓋雲端資料（與 fixCloudData 類似的邏輯）
            await this.saveCloud('docs/index', docIndex);
            await this.saveCloud('worldLibrary', worldLibrary);

            // 上傳設定時排除 apiKey
            const settingsToSync = { ...mergedSettings };
            delete settingsToSync.apiKey;
            await this.saveCloud('settings', settingsToSync);

            // 上傳所有文檔
            for (const [docId, docData] of Object.entries(documents)) {
                await this.saveCloud(`docs/${docId}`, docData);
            }

            console.log('✓ 雲端資料已覆蓋');
            console.log('✅ 備份還原完成！');

            return true;
        } catch (error) {
            console.error('還原備份失敗:', error);
            return false;
        }
    }

    async deleteCloudBackup(backupId) {
        if (!this.isLoggedIn() || !firebaseDB) {
            console.error('無法刪除備份：未登入');
            return false;
        }

        try {
            console.log('🗑️ 刪除備份:', backupId);
            await firebaseDB.ref(`users/${this.getUserId()}/backups/${backupId}`).remove();
            console.log('✓ 備份已刪除:', backupId);
            return true;
        } catch (error) {
            console.error('刪除備份失敗:', error);
            return false;
        }
    }

    async cleanOldBackups(daysToKeep = 3) {
        if (!this.isLoggedIn() || !firebaseDB) {
            console.log('無法清理備份：未登入');
            return 0;
        }

        try {
            console.log(`🧹 開始清理超過 ${daysToKeep} 天的備份...`);

            const backups = await this.getCloudBackups();
            if (!backups || backups.length === 0) {
                console.log('沒有備份需要清理');
                return 0;
            }

            const now = Date.now();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // 轉換為毫秒
            let deletedCount = 0;

            for (const backup of backups) {
                const age = now - backup.timestamp;
                if (age > maxAge) {
                    const success = await this.deleteCloudBackup(backup.id);
                    if (success) {
                        deletedCount++;
                        console.log(`✓ 已刪除舊備份: ${backup.note} (${new Date(backup.timestamp).toLocaleString()})`);
                    }
                }
            }

            if (deletedCount > 0) {
                console.log(`✅ 清理完成，共刪除 ${deletedCount} 個舊備份`);
            } else {
                console.log('✓ 沒有需要清理的舊備份');
            }

            return deletedCount;
        } catch (error) {
            console.error('清理備份失敗:', error);
            return 0;
        }
    }
}

// Create global storage manager instance
const storageManager = new StorageManager();
