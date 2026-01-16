/**
 * 強制修復雲端資料 - 使用本地資料覆蓋雲端
 *
 * 使用方式：
 * 1. 打開瀏覽器開發者工具 (F12)
 * 2. 切換到 Console 標籤
 * 3. 複製並貼上整段代碼
 * 4. 按 Enter 執行
 *
 * 注意：此操作會強制覆蓋雲端資料，請確保本地資料是正確的！
 */

(async function forceFixCloudData() {
    console.log('🔧 開始強制修復雲端資料...\n');

    // 檢查是否已登入
    if (!storageManager || !storageManager.isLoggedIn()) {
        console.error('❌ 未登入 Firebase，無法執行修復');
        alert('請先登入 Firebase 帳號');
        return;
    }

    if (!firebaseDB) {
        console.error('❌ Firebase Database 未初始化');
        alert('Firebase Database 未初始化，請重新整理頁面');
        return;
    }

    const userId = storageManager.getUserId();
    console.log('✓ 已登入，使用者 ID:', userId);

    try {
        // ========================================
        // 1. 修復文檔索引 (docIndex)
        // ========================================
        console.log('\n📄 處理文檔索引...');

        let docIndex = localStorage.getItem(STORAGE.DOC_INDEX);
        if (docIndex) {
            try {
                docIndex = JSON.parse(docIndex);

                // 確保是陣列
                if (!Array.isArray(docIndex)) {
                    console.warn('⚠️ docIndex 不是陣列，嘗試轉換...');
                    docIndex = Object.values(docIndex);
                }

                console.log(`  本地有 ${docIndex.length} 個文檔`);

                // 強制上傳到雲端
                await firebaseDB.ref(`users/${userId}/docs/index`).set(docIndex);
                console.log('  ✓ 文檔索引已上傳到雲端');

                // 上傳每個文檔內容
                for (const doc of docIndex) {
                    const docData = localStorage.getItem(STORAGE.DOC_PREFIX + doc.id);
                    if (docData) {
                        const parsedDoc = JSON.parse(docData);
                        await firebaseDB.ref(`users/${userId}/docs/${doc.id}`).set(parsedDoc);
                        console.log(`  ✓ 已上傳文檔: ${doc.title || doc.id}`);
                    }
                }
            } catch (e) {
                console.error('  ❌ 處理 docIndex 時出錯:', e);
            }
        } else {
            console.log('  ⊘ 本地沒有文檔索引');
        }

        // ========================================
        // 2. 修復世界觀圖書館 (worldLibrary)
        // ========================================
        console.log('\n🌍 處理世界觀圖書館...');

        let worldLibrary = localStorage.getItem(STORAGE.WORLD_LIBRARY);
        if (worldLibrary) {
            try {
                worldLibrary = JSON.parse(worldLibrary);

                // 確保是陣列
                if (!Array.isArray(worldLibrary)) {
                    console.warn('⚠️ worldLibrary 不是陣列，嘗試轉換...');
                    worldLibrary = Object.values(worldLibrary);
                }

                console.log(`  本地有 ${worldLibrary.length} 個世界觀`);

                // 強制上傳到雲端
                await firebaseDB.ref(`users/${userId}/worldLibrary`).set(worldLibrary);
                console.log('  ✓ 世界觀圖書館已上傳到雲端');

                // 列出每個世界觀
                worldLibrary.forEach(world => {
                    console.log(`  ✓ ${world.name || world.id}`);
                });
            } catch (e) {
                console.error('  ❌ 處理 worldLibrary 時出錯:', e);
            }
        } else {
            console.log('  ⊘ 本地沒有世界觀圖書館');
        }

        // ========================================
        // 3. 修復全域設定 (settings)
        // ========================================
        console.log('\n⚙️ 處理全域設定...');

        let settings = localStorage.getItem(STORAGE.GLOBAL_SETTINGS);
        if (settings) {
            try {
                settings = JSON.parse(settings);

                // 移除 apiKey（不上傳到雲端）
                const settingsToSync = { ...settings };
                delete settingsToSync.apiKey;

                // 強制上傳到雲端
                await firebaseDB.ref(`users/${userId}/settings`).set(settingsToSync);
                console.log('  ✓ 全域設定已上傳到雲端 (已排除 apiKey)');
            } catch (e) {
                console.error('  ❌ 處理 settings 時出錯:', e);
            }
        } else {
            console.log('  ⊘ 本地沒有全域設定');
        }

        // ========================================
        // 完成
        // ========================================
        console.log('\n✅ 雲端資料修復完成！');
        console.log('建議：重新整理頁面以確保資料同步正確');

        alert('✅ 雲端資料修復完成！\n\n建議重新整理頁面以確保資料同步正確。');

    } catch (error) {
        console.error('\n❌ 修復過程中發生錯誤:', error);
        alert('❌ 修復失敗：' + error.message);
    }
})();
