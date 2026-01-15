        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        }

        // 安全函數：HTML 跳脫 (防止 XSS 攻擊)
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function debounce(fn, delay) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => fn(...args), delay);
            };
        }

        function countChars(text) {
            return text ? text.replace(/\s/g, '').length : 0;
        }

        function formatDate(timestamp) {
            const d = new Date(timestamp);
            const now = new Date();
            const diff = now - d;
            
            if (diff < 60000) return '剛剛';
            if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
            
            return d.toLocaleDateString('zh-TW');
        }

        function parseMarkdown(text) {
            if (!text) return '';
            try {
                marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
                return marked.parse(text);
            } catch (e) {
                return text.replace(/\n/g, '<br>');
            }
        }

        // ============================================
        // Storage Functions (with Cloud Sync)
        // ============================================
        function getCloudPath(key) {
            // Map local storage keys to cloud paths
            if (key === STORAGE.GLOBAL_SETTINGS) return 'settings';
            if (key === STORAGE.DOC_INDEX) return 'docs/index';
            if (key === STORAGE.WORLD_LIBRARY) return 'worldLibrary';
            if (key.startsWith(STORAGE.DOC_PREFIX)) {
                const docId = key.replace(STORAGE.DOC_PREFIX, '');
                return `docs/${docId}`;
            }
            return null;
        }

        function saveToStorage(key, data) {
            try {
                // 防呆機制：保護 docIndex 不被空陣列意外覆蓋
                if (key === STORAGE.DOC_INDEX) {
                    if (Array.isArray(data) && data.length === 0) {
                        const existingData = localStorage.getItem(key);
                        if (existingData) {
                            try {
                                const existing = JSON.parse(existingData);
                                if (Array.isArray(existing) && existing.length > 0) {
                                    console.warn('saveToStorage: 阻止空陣列覆蓋現有 docIndex 資料');
                                    return; // 拒絕寫入
                                }
                            } catch (e) {
                                // 如果解析失敗，允許寫入
                            }
                        }
                    }
                }

                // Add timestamp for sync comparison
                const dataWithTimestamp = {
                    ...data,
                    _lastModified: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(dataWithTimestamp));

                // If logged in, also sync to cloud
                const cloudPath = getCloudPath(key);
                if (storageManager.isLoggedIn() && cloudPath) {
                    storageManager.saveCloud(cloudPath, dataWithTimestamp);
                }
            } catch (e) {
                console.error('Storage save error:', e);
                showToast('儲存失敗', 'error');
            }
        }

        function loadFromStorage(key, defaultValue = null) {
            try {
                const data = localStorage.getItem(key);
                if (!data) return defaultValue;

                const parsed = JSON.parse(data);

                // 特殊處理：docIndex 必須是陣列
                if (key === STORAGE.DOC_INDEX) {
                    if (!Array.isArray(parsed)) {
                        console.warn('loadFromStorage: DOC_INDEX 資料損壞，已重置為預設值');
                        return defaultValue;
                    }
                }

                return parsed;
            } catch (e) {
                console.error('Storage load error:', e);
                return defaultValue;
            }
        }

        function removeFromStorage(key) {
            try {
                localStorage.removeItem(key);

                // If logged in, also remove from cloud
                const cloudPath = getCloudPath(key);
                if (storageManager.isLoggedIn() && cloudPath) {
                    storageManager.removeCloud(cloudPath);
                }
            } catch (e) {
                console.error('Storage remove error:', e);
            }
        }
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            const maxHeight = window.innerHeight * 0.5; // 50vh max
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        }
        function ensureDocIndexIsArray() {
            if (!Array.isArray(state.docIndex)) {
                console.warn('ensureDocIndexIsArray: state.docIndex 資料異常，已重置');
                state.docIndex = [];
            }
        }
