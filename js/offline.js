// ============================================
// Offline Storage Manager - IndexedDB
// 離線儲存管理器
// ============================================

const OfflineStorage = {
    dbName: 'MoyunOfflineDB',
    dbVersion: 1,
    db: null,
    isOnline: navigator.onLine,
    pendingSyncs: [],

    // 初始化 IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('❌ IndexedDB 開啟失敗:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB 已就緒');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 創建 documents store
                if (!db.objectStoreNames.contains('documents')) {
                    const docStore = db.createObjectStore('documents', { keyPath: 'id' });
                    docStore.createIndex('lastModified', 'lastModified', { unique: false });
                    docStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // 創建 pendingChanges store (用於存放離線時的變更)
                if (!db.objectStoreNames.contains('pendingChanges')) {
                    const changeStore = db.createObjectStore('pendingChanges', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    changeStore.createIndex('timestamp', 'timestamp', { unique: false });
                    changeStore.createIndex('docId', 'docId', { unique: false });
                }

                // 創建 settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('📦 IndexedDB 結構已建立');
            };
        });
    },

    // 儲存文檔到 IndexedDB
    async saveDocument(docId, docData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');

            const data = {
                id: docId,
                ...docData,
                lastModified: Date.now(),
                syncStatus: this.isOnline ? 'synced' : 'pending'
            };

            const request = store.put(data);

            request.onsuccess = () => {
                console.log(`💾 文檔已存入 IndexedDB: ${docId}`);
                resolve(data);
            };

            request.onerror = () => {
                console.error('❌ IndexedDB 儲存失敗:', request.error);
                reject(request.error);
            };
        });
    },

    // 從 IndexedDB 讀取文檔
    async getDocument(docId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const request = store.get(docId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ IndexedDB 讀取失敗:', request.error);
                reject(request.error);
            };
        });
    },

    // 獲取所有文檔
    async getAllDocuments() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ IndexedDB 讀取所有文檔失敗:', request.error);
                reject(request.error);
            };
        });
    },

    // 記錄待同步的變更
    async addPendingChange(docId, changeType, changeData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
            const store = transaction.objectStore('pendingChanges');

            const change = {
                docId,
                changeType, // 'update', 'create', 'delete'
                changeData,
                timestamp: Date.now()
            };

            const request = store.add(change);

            request.onsuccess = () => {
                console.log(`📝 已記錄待同步變更: ${changeType} - ${docId}`);
                this.pendingSyncs.push(change);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('❌ 記錄變更失敗:', request.error);
                reject(request.error);
            };
        });
    },

    // 獲取所有待同步變更
    async getPendingChanges() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingChanges'], 'readonly');
            const store = transaction.objectStore('pendingChanges');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // 清除已同步的變更
    async clearPendingChange(changeId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
            const store = transaction.objectStore('pendingChanges');
            const request = store.delete(changeId);

            request.onsuccess = () => {
                console.log(`✅ 已清除同步變更: ${changeId}`);
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // 同步所有待處理的變更到 Firebase
    async syncPendingChanges(storageManager) {
        if (!this.isOnline) {
            console.log('📴 目前離線，無法同步');
            return { success: false, reason: 'offline' };
        }

        try {
            const pendingChanges = await this.getPendingChanges();

            if (pendingChanges.length === 0) {
                console.log('✅ 沒有待同步的變更');
                return { success: true, count: 0 };
            }

            console.log(`🔄 開始同步 ${pendingChanges.length} 個變更...`);

            let successCount = 0;
            let failedChanges = [];

            for (const change of pendingChanges) {
                try {
                    // 根據變更類型執行對應操作
                    if (change.changeType === 'update' || change.changeType === 'create') {
                        // 同步到 Firebase
                        const docKey = `moyun_doc_${change.docId}`;
                        await storageManager.saveCloud(`docs/${change.docId}`, change.changeData);

                        // 更新文檔的同步狀態
                        const doc = await this.getDocument(change.docId);
                        if (doc) {
                            doc.syncStatus = 'synced';
                            await this.saveDocument(change.docId, doc);
                        }
                    }

                    // 清除已成功同步的變更
                    await this.clearPendingChange(change.id);
                    successCount++;

                } catch (error) {
                    console.error(`❌ 同步變更失敗:`, change, error);
                    failedChanges.push({ change, error: error.message });
                }
            }

            console.log(`✅ 同步完成: ${successCount}/${pendingChanges.length} 成功`);

            return {
                success: true,
                count: successCount,
                failed: failedChanges
            };

        } catch (error) {
            console.error('❌ 同步過程發生錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // 監聽網路狀態變化
    setupNetworkListeners(onOnline, onOffline) {
        window.addEventListener('online', () => {
            console.log('🌐 網路已恢復');
            this.isOnline = true;
            if (onOnline) onOnline();
        });

        window.addEventListener('offline', () => {
            console.log('📴 網路已斷開');
            this.isOnline = false;
            if (onOffline) onOffline();
        });
    },

    // 檢查同步狀態
    async getSyncStatus() {
        const pendingChanges = await this.getPendingChanges();
        const allDocs = await this.getAllDocuments();
        const pendingDocs = allDocs.filter(doc => doc.syncStatus === 'pending');

        return {
            isOnline: this.isOnline,
            pendingChangesCount: pendingChanges.length,
            pendingDocsCount: pendingDocs.length,
            totalDocs: allDocs.length
        };
    }
};

// 初始化離線儲存
(async () => {
    try {
        await OfflineStorage.init();
        console.log('🚀 離線儲存系統已啟動');
    } catch (error) {
        console.error('❌ 離線儲存系統初始化失敗:', error);
    }
})();
