        class StorageManager {
            constructor() {
                this.user = null;
                this.syncStatus = 'idle'; // idle, syncing, synced, error
                this.listeners = [];
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
                    const dataWithTimestamp = {
                        ...data,
                        _lastModified: Date.now()
                    };
                    await firebaseDB.ref(`users/${this.getUserId()}/${path}`).set(dataWithTimestamp);
                    this.notifySyncStatus('synced');
                    return true;
                } catch (error) {
                    console.error('Cloud save error:', error);
                    this.notifySyncStatus('error');

                    // 檢測 PERMISSION_DENIED 錯誤，提供友善提示
                    if (error.code === 'PERMISSION_DENIED' ||
                        (error.message && error.message.includes('PERMISSION_DENIED'))) {
                        showToast('同步失敗：請檢查 Firebase 規則設定', 'error');
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
                const cloudIndex = await this.loadCloud('docs/index');

                // 建立文檔 ID 到資料的對應表
                const localMap = new Map();
                const cloudMap = new Map();

                localIndex.forEach(doc => localMap.set(doc.id, doc));
                (cloudIndex || []).forEach(doc => cloudMap.set(doc.id, doc));

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
                            console.log(`📤 文檔 ${docId} 本地較新 (${new Date(localTime).toLocaleString()} > ${new Date(cloudTime).toLocaleString()})，標記上傳`);
                        } else if (cloudTime > localTime) {
                            // 雲端較新，使用雲端版本並下載
                            mergedIndex.push(cloudDoc);
                            toDownload.push(docId);
                            console.log(`📥 文檔 ${docId} 雲端較新 (${new Date(cloudTime).toLocaleString()} > ${new Date(localTime).toLocaleString()})，標記下載`);
                        } else {
                            // 時間戳相同，使用本地版本
                            mergedIndex.push(localDoc);
                            console.log(`✓ 文檔 ${docId} 時間戳相同，保持本地版本`);
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

                // 保存合併後的索引（使用直接寫入，繞過保護機制）
                console.log(`💾 保存合併後的索引 (共 ${mergedIndex.length} 個文檔)`);
                localStorage.setItem(STORAGE.DOC_INDEX, JSON.stringify(mergedIndex));
                await this.saveCloud('docs/index', mergedIndex);

                console.log('✓ 文檔索引同步完成');
            }

            async syncWorldLibrary() {
                const localLibrary = this.loadLocal(STORAGE.WORLD_LIBRARY, []);
                const cloudLibrary = await this.loadCloud('worldLibrary');

                if (cloudLibrary && Array.isArray(cloudLibrary) && localLibrary.length === 0) {
                    // 從雲端載入到本地
                    this.saveLocal(STORAGE.WORLD_LIBRARY, cloudLibrary);
                } else if (localLibrary.length > 0 && !cloudLibrary) {
                    // 上傳本地到雲端
                    await this.saveCloud('worldLibrary', localLibrary);
                } else if (cloudLibrary && Array.isArray(cloudLibrary) && localLibrary.length > 0) {
                    // 合併本地和雲端的世界觀圖書館（以 id 去重）
                    const mergedMap = new Map();

                    // 先加入雲端的資料
                    cloudLibrary.forEach(world => {
                        if (world.id) {
                            mergedMap.set(world.id, world);
                        }
                    });

                    // 再加入本地的資料（會覆蓋相同 id 的雲端資料，保留最新版本）
                    localLibrary.forEach(world => {
                        if (world.id) {
                            // 比較時間戳，保留較新的版本
                            const existing = mergedMap.get(world.id);
                            if (!existing || (world.lastModified || 0) > (existing.lastModified || 0)) {
                                mergedMap.set(world.id, world);
                            }
                        }
                    });

                    const merged = Array.from(mergedMap.values());

                    // 同步到本地和雲端
                    this.saveLocal(STORAGE.WORLD_LIBRARY, merged);
                    await this.saveCloud('worldLibrary', merged);
                }
            }
        }

        // Create global storage manager instance
        const storageManager = new StorageManager();

const storageManager = new StorageManager();
