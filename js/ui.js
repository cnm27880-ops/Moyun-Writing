// ============================================
// DOM Elements
// ============================================
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

        const el = {
            // Navigation
            navbar: $('navbar'),
            menuBtn: $('menuBtn'),
            navTitle: $('navTitle'),
            brainBtn: $('brainBtn'),
            
            // Overlay
            overlay: $('overlay'),
            
            // Left Drawer
            drawerLeft: $('drawerLeft'),
            newDocBtn: $('newDocBtn'),
            docList: $('docList'),
            
            // Right Panel
            panelRight: $('panelRight'),
            panelClose: $('panelClose'),
            checkpointBtn: $('checkpointBtn'),
            storyAnchors: $('storyAnchors'),
            styleFingerprint: $('styleFingerprint'),
            worldSetting: $('worldSetting'),
            customPrompt: $('customPrompt'),

            // World Library
            worldLibrarySelect: $('worldLibrarySelect'),
            worldNameInput: $('worldNameInput'),
            worldSaveBtn: $('worldSaveBtn'),
            worldDeleteBtn: $('worldDeleteBtn'),
            setDefaultWorldBtn: $('setDefaultWorldBtn'),
            restoreDefaultWorldBtn: $('restoreDefaultWorldBtn'),
            setDefaultPromptBtn: $('setDefaultPromptBtn'),
            restoreDefaultPromptBtn: $('restoreDefaultPromptBtn'),

            // Settings
            apiFormat: $('apiFormat'),
            apiEndpoint: $('apiEndpoint'),
            apiKey: $('apiKey'),
            modelName: $('modelName'),
            temperature: $('temperature'),
            tempValue: $('tempValue'),
            saveSettingsBtn: $('saveSettingsBtn'),
            clearAllBtn: $('clearAllBtn'),

            // Director / Character Mixer
            addCharacterBtn: $('addCharacterBtn'),
            characterList: $('characterList'),
            characterEmpty: $('characterEmpty'),
            statusBar: $('statusBar'),
            statusFocus: $('statusFocus'),
            statusDrives: $('statusDrives'),

            // Inspiration Drawer
            generateConflictBtn: $('generateConflictBtn'),
            inspirationContent: $('inspirationContent'),

            // Network Status
            networkStatus: $('networkStatus'),

            // Editor
            editorBody: $('editorBody'),
            inputField: $('inputField'),
            inputFieldWrapper: $('inputFieldWrapper'),
            sendBtn: $('sendBtn'),

            // Style Tags & Director Mode
            styleTagBar: $('styleTagBar'),
            directorModeToggle: $('directorModeToggle'),

            // Toasts
            toastContainer: $('toastContainer'),
            
            // Title Modal
            titleModal: $('titleModal'),
            titleModalInput: $('titleModalInput'),
            titleModalClose: $('titleModalClose'),
            titleModalCancel: $('titleModalCancel'),
            titleModalConfirm: $('titleModalConfirm'),
            
            // Confirm Modal
            confirmModal: $('confirmModal'),
            confirmModalTitle: $('confirmModalTitle'),
            confirmModalMessage: $('confirmModalMessage'),
            confirmModalClose: $('confirmModalClose'),
            confirmModalCancel: $('confirmModalCancel'),
            confirmModalConfirm: $('confirmModalConfirm'),

            // Focus Mode
            focusModeBtn: $('focusModeBtn'),
            focusModeExit: $('focusModeExit'),

            // Selection Menu
            selectionMenu: $('selectionMenu'),
            refineBtn: $('refineBtn'),
            expandBtn: $('expandBtn'),
            editBtn: $('editBtn'),
            deleteTextBtn: $('deleteTextBtn'),

            // Input Area
            inputArea: $('inputArea'),

            // User Panel (Cloud Sync)
            userPanel: $('userPanel'),
            loginBtn: $('loginBtn'),
            userInfo: $('userInfo'),
            userAvatar: $('userAvatar'),
            userAvatarImg: $('userAvatarImg'),
            userName: $('userName'),
            syncDot: $('syncDot'),
            syncText: $('syncText'),
            logoutBtn: $('logoutBtn'),

            // Edit Canvas
            editCanvas: $('editCanvas'),
            editCanvasTextarea: $('editCanvasTextarea'),
            editCanvasCancel: $('editCanvasCancel'),
            editCanvasConfirm: $('editCanvasConfirm'),
            editCanvasDelete: $('editCanvasDelete')
        };
        function showToast(message, type = 'info', duration = 3000) {
            const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            // XSS Protection: Escape HTML in message
            toast.innerHTML = `
                <span class="toast-icon">${icons[type]}</span>
                <span class="toast-message">${escapeHtml(message)}</span>
                <button class="toast-close">×</button>
            `;
            
            el.toastContainer.appendChild(toast);
            toast.querySelector('.toast-close').onclick = () => removeToast(toast);
            setTimeout(() => removeToast(toast), duration);
        }

        function removeToast(toast) {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }

        // ============================================
        // Modal Functions
        // ============================================
        let confirmCallback = null;

        function showTitleModal() {
            el.titleModalInput.value = state.currentDoc?.title || '';
            el.titleModal.classList.add('active');
            el.titleModalInput.focus();
            el.titleModalInput.select();
        }

        function hideTitleModal() {
            el.titleModal.classList.remove('active');
        }

        function showConfirmModal(title, message, onConfirm) {
            el.confirmModalTitle.textContent = title;
            el.confirmModalMessage.textContent = message;
            el.confirmModal.classList.add('active');
            confirmCallback = onConfirm;
        }

        function hideConfirmModal() {
            el.confirmModal.classList.remove('active');
            confirmCallback = null;
        }

        // ============================================
        // Drawer & Panel Controls
        // ============================================
        function openDrawerLeft() {
            el.drawerLeft.classList.add('open');
            el.overlay.classList.add('active');
        }

        function closeDrawerLeft() {
            el.drawerLeft.classList.remove('open');
            el.overlay.classList.remove('active');
        }

        function openPanelRight() {
            el.panelRight.classList.add('open');
            el.overlay.classList.add('active');
        }

        function closePanelRight() {
            el.panelRight.classList.remove('open');
            el.overlay.classList.remove('active');
        }

        function closeAllPanels() {
            closeDrawerLeft();
            closePanelRight();
        }

        // ============================================
        // Navbar Scroll Behavior
        // ============================================
        const handleScroll = debounce(() => {
            const currentScrollY = window.scrollY;

            // Show navbar when scrolling up or when near top (< 50px)
            if (currentScrollY < 50 || currentScrollY < state.lastScrollY) {
                if (state.navbarHidden) {
                    el.navbar.classList.remove('hidden');
                    state.navbarHidden = false;
                }
            }
            // Hide navbar when scrolling down and past 50px
            else if (currentScrollY > 50 && currentScrollY > state.lastScrollY) {
                if (!state.navbarHidden) {
                    el.navbar.classList.add('hidden');
                    state.navbarHidden = true;
                }
            }

            state.lastScrollY = currentScrollY;
        }, 50);

        // ============================================
        // Document Management
        function renderDocList() {
            // 防禦性檢查：確保 state.docIndex 是陣列
            if (!Array.isArray(state.docIndex)) {
                console.warn('renderDocList: state.docIndex 不是陣列，已重置為空陣列');
                state.docIndex = [];
            }

            if (state.docIndex.length === 0) {
                el.docList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📚</div>
                        <p class="empty-state-text">尚無文檔</p>
                    </div>
                `;
                return;
            }

            el.docList.innerHTML = state.docIndex.map(doc => `
                <div class="doc-item ${doc.id === state.currentDocId ? 'active' : ''}" data-id="${escapeHtml(doc.id)}">
                    <div class="doc-item-title">${escapeHtml(doc.title) || '未命名文檔'}</div>
                    <div class="doc-item-meta">
                        <span>${formatDate(doc.lastModified)}</span>
                    </div>
                    ${doc.previewText ? `<div class="doc-item-preview">${escapeHtml(doc.previewText)}</div>` : ''}
                    <div class="doc-item-actions">
                        <button class="doc-action-btn" data-action="open" data-id="${escapeHtml(doc.id)}">開啟</button>
                        <button class="doc-action-btn danger" data-action="delete" data-id="${escapeHtml(doc.id)}">刪除</button>
                    </div>
                </div>
            `).join('');
            
            // Bind events
            el.docList.querySelectorAll('.doc-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.doc-action-btn')) return;
                    loadDocument(item.dataset.id);
                });
            });
            
            el.docList.querySelectorAll('.doc-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    
                    if (action === 'open') {
                        loadDocument(id);
                    } else if (action === 'delete') {
                        deleteDocument(id);
                    }
                });
            });
        }

        function renderParagraphs() {
            if (!state.currentDoc?.paragraphs?.length) {
                el.editorBody.innerHTML = '';
                return;
            }

            // 預設 contenteditable="false"，需要雙擊或透過選單的「編輯」按鈕才能編輯
            el.editorBody.innerHTML = state.currentDoc.paragraphs.map(p => `
                <div class="paragraph ${p.source === 'user' ? 'user' : 'ai'}" data-id="${escapeHtml(p.id)}">
                    <span class="paragraph-tag">${p.source === 'user' ? '你' : 'AI'}</span>
                    <div class="paragraph-content" contenteditable="false">${parseMarkdown(p.content)}</div>
                    ${p.source === 'ai' ? `<button class="regenerate-btn" data-id="${escapeHtml(p.id)}" title="重新生成">🔄</button>` : ''}
                </div>
            `).join('');

            // Bind edit events
            el.editorBody.querySelectorAll('.paragraph-content').forEach(content => {
                const paraId = content.parentElement.dataset.id;

                // 電腦端：雙擊觸發編輯
                content.addEventListener('dblclick', () => {
                    content.setAttribute('contenteditable', 'true');
                    content.focus();
                });

                // 失去焦點時：保存並禁用編輯
                content.addEventListener('blur', () => {
                    // 保存內容
                    const para = state.currentDoc.paragraphs.find(p => p.id === paraId);
                    if (para) {
                        para.content = content.innerText;
                        autoSave();
                    }

                    // 退出編輯模式
                    content.setAttribute('contenteditable', 'false');
                });

                // 貼上純文字
                content.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                });
            });

            // Bind regenerate button events for AI paragraphs
            el.editorBody.querySelectorAll('.regenerate-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const paraId = btn.dataset.id;
                    if (typeof regenerateParagraph === 'function') {
                        regenerateParagraph(paraId);
                    }
                });
            });

            // Bind long press events for paragraphs
            el.editorBody.querySelectorAll('.paragraph').forEach(para => {
                para.addEventListener('mousedown', (e) => {
                    if (typeof handleLongPressStart === 'function') {
                        handleLongPressStart(e);
                    }
                });
                para.addEventListener('mousemove', (e) => {
                    if (typeof handleLongPressMove === 'function') {
                        handleLongPressMove(e);
                    }
                });
                para.addEventListener('mouseup', () => {
                    if (typeof handleLongPressEnd === 'function') {
                        handleLongPressEnd();
                    }
                });
                para.addEventListener('touchstart', (e) => {
                    if (typeof handleLongPressStart === 'function') {
                        handleLongPressStart(e);
                    }
                });
                para.addEventListener('touchmove', (e) => {
                    if (typeof handleLongPressMove === 'function') {
                        handleLongPressMove(e);
                    }
                });
                para.addEventListener('touchend', () => {
                    if (typeof handleLongPressEnd === 'function') {
                        handleLongPressEnd();
                    }
                });
            });
        }

        function addParagraph(content, source = 'user') {
            if (!state.currentDoc) return;
            
            const paragraph = {
                id: generateId(),
                content: content.trim(),
                source: source,
                timestamp: Date.now()
            };
            
            state.currentDoc.paragraphs.push(paragraph);
            renderParagraphs();
            autoSave();
            
            // Scroll to new paragraph
            const newPara = el.editorBody.querySelector(`[data-id="${paragraph.id}"]`);
            if (newPara) {
                newPara.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // ============================================
        // Panel Tabs
        // ============================================
        function initPanelTabs() {
            const tabs = $$('.panel-tab');
            const sections = $$('.panel-section');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const target = tab.dataset.panel;

                    tabs.forEach(t => t.classList.remove('active'));
                    sections.forEach(s => s.classList.remove('active'));

                    tab.classList.add('active');
                    $(`${target}Section`).classList.add('active');

                    // Update stats when stats tab is opened
                    if (target === 'stats') {
                        updateStats();
                    }

                    // Update device count and backup list when settings tab is opened
                    if (target === 'settings') {
                        if (typeof loadDeviceCount === 'function') {
                            loadDeviceCount();
                        }
                        if (typeof renderBackupList === 'function') {
                            renderBackupList();
                        }
                    }
                });
            });
        }
        function renderCharacterList() {
            if (!state.currentDoc?.characters?.length) {
                el.characterEmpty.style.display = 'block';
                // 清除其他角色卡片
                const existingCards = el.characterList.querySelectorAll('.character-card');
                existingCards.forEach(card => card.remove());
                return;
            }

            el.characterEmpty.style.display = 'none';

            // 生成角色卡片 HTML
            const html = state.currentDoc.characters.map(character => {
                const isFocused = character.id === state.currentDoc.focusCharacterId;
                const charIdEscaped = escapeHtml(character.id);
                const drivesHtml = Object.keys(CORE_DRIVES).map(driveId => {
                    const drive = CORE_DRIVES[driveId];
                    const isActive = character.drives[driveId] !== undefined;
                    const value = character.drives[driveId] || 50;

                    return `
                        <div class="drive-item ${isActive ? 'active' : ''}" data-drive-id="${driveId}">
                            <input type="checkbox" class="drive-checkbox" id="drive-${charIdEscaped}-${driveId}"
                                   ${isActive ? 'checked' : ''} data-character-id="${charIdEscaped}" data-drive-id="${driveId}">
                            <label class="drive-label" for="drive-${charIdEscaped}-${driveId}">
                                <span class="drive-icon">${drive.icon}</span>
                                <span>${drive.name}</span>
                            </label>
                            <div class="drive-slider-wrapper">
                                <input type="range" class="drive-slider" min="0" max="100" value="${value}"
                                       style="--thumb-color: ${drive.color};"
                                       data-character-id="${charIdEscaped}" data-drive-id="${driveId}">
                                <span class="drive-value">${value}%</span>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="character-card ${isFocused ? 'focused' : ''}" data-character-id="${escapeHtml(character.id)}">
                        <div class="character-header">
                            <input type="text" class="character-name-input" value="${escapeHtml(character.name)}"
                                   placeholder="角色名稱" data-character-id="${escapeHtml(character.id)}">
                            <div class="character-actions">
                                <button class="character-action-btn focus-btn ${isFocused ? 'active' : ''}"
                                        title="設為焦點" data-action="focus" data-character-id="${escapeHtml(character.id)}">🎯</button>
                                <button class="character-action-btn delete-btn" title="刪除角色"
                                        data-action="delete" data-character-id="${escapeHtml(character.id)}">🗑️</button>
                            </div>
                        </div>
                        <div class="sync-controls">
                            <label class="sync-toggle">
                                <input type="checkbox" ${character.autoSync ? 'checked' : ''}
                                       data-action="auto-sync" data-character-id="${escapeHtml(character.id)}">
                                <span class="sync-switch"></span>
                                <span>自動同步</span>
                            </label>
                            <button class="analyze-now-btn" data-action="analyze" data-character-id="${escapeHtml(character.id)}">
                                <span>🧠</span>
                                <span>立即分析</span>
                            </button>
                        </div>
                        <div class="drives-mixer">
                            ${drivesHtml}
                        </div>
                    </div>
                `;
            }).join('');

            // 保留 empty state 元素，只替換角色卡片
            const existingCards = el.characterList.querySelectorAll('.character-card');
            existingCards.forEach(card => card.remove());
            el.characterEmpty.insertAdjacentHTML('beforebegin', html);

            // 綁定事件
            bindCharacterEvents();
        }

        function bindCharacterEvents() {
            // 角色名稱輸入
            el.characterList.querySelectorAll('.character-name-input').forEach(input => {
                input.addEventListener('blur', () => {
                    updateCharacterName(input.dataset.characterId, input.value);
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });
            });

            // 角色操作按鈕
            el.characterList.querySelectorAll('.character-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const characterId = btn.dataset.characterId;

                    if (action === 'focus') {
                        setFocusCharacter(characterId);
                    } else if (action === 'delete') {
                        deleteCharacter(characterId);
                    }
                });
            });

            // 自動同步開關
            el.characterList.querySelectorAll('[data-action="auto-sync"]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    toggleCharacterAutoSync(checkbox.dataset.characterId, checkbox.checked);
                });
            });

            // 立即分析按鈕
            el.characterList.querySelectorAll('[data-action="analyze"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    analyzeCharacterState(btn.dataset.characterId);
                });
            });

            // 動力 Checkbox
            el.characterList.querySelectorAll('.drive-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const characterId = checkbox.dataset.characterId;
                    const driveId = checkbox.dataset.driveId;
                    const driveItem = checkbox.closest('.drive-item');
                    const slider = driveItem.querySelector('.drive-slider');

                    driveItem.classList.toggle('active', checkbox.checked);
                    updateCharacterDrive(characterId, driveId, parseInt(slider.value), checkbox.checked);
                });
            });

            // 動力滑桿
            el.characterList.querySelectorAll('.drive-slider').forEach(slider => {
                // 設置滑桿顏色
                const driveId = slider.dataset.driveId;
                const drive = CORE_DRIVES[driveId];
                slider.style.setProperty('--thumb-color', drive.color);

                // 添加動態 style 來設置滑桿顏色
                const updateSliderStyle = () => {
                    slider.style.background = `linear-gradient(to right, ${drive.color} 0%, ${drive.color} ${slider.value}%, var(--border) ${slider.value}%, var(--border) 100%)`;
                };
                updateSliderStyle();

                slider.addEventListener('mousedown', () => {
                    state.isSliderDragging = true;
                });

                slider.addEventListener('mouseup', () => {
                    state.isSliderDragging = false;
                });

                slider.addEventListener('input', () => {
                    const valueDisplay = slider.parentElement.querySelector('.drive-value');
                    valueDisplay.textContent = slider.value + '%';
                    updateSliderStyle();

                    const characterId = slider.dataset.characterId;
                    const driveId = slider.dataset.driveId;
                    const checkbox = slider.closest('.drive-item').querySelector('.drive-checkbox');

                    if (checkbox.checked) {
                        updateCharacterDrive(characterId, driveId, parseInt(slider.value), true);
                    }
                });
            });
        }

        function updateStatusBar() {
            const focusCharacter = state.currentDoc?.characters?.find(
                c => c.id === state.currentDoc.focusCharacterId
            );

            if (!focusCharacter || Object.keys(focusCharacter.drives).length === 0) {
                el.statusBar.classList.remove('active');
                return;
            }

            el.statusBar.classList.add('active');
            el.statusFocus.innerHTML = `🎥 焦點：${escapeHtml(focusCharacter.name)}`;

            // 生成動力標籤（按權重排序）
            const sortedDrives = Object.entries(focusCharacter.drives)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);  // 最多顯示 4 個

            el.statusDrives.innerHTML = sortedDrives.map(([driveId, value]) => {
                const drive = CORE_DRIVES[driveId];
                return `<span class="status-drive-tag">${drive.icon}${drive.name.slice(0,2)} ${value}%</span>`;
            }).join('');
        }
        function updateStyleTagsUI() {
            if (!el.styleTagBar) return;
            el.styleTagBar.querySelectorAll('.style-tag').forEach(btn => {
                const tagId = btn.dataset.style;
                if (state.activeStyleTags.has(tagId)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function toggleDirectorMode() {
            state.directorMode = !state.directorMode;
            updateDirectorModeUI();
            // 顯示 Toast 提示
            if (state.directorMode) {
                showToast('🎬 導演模式：輸入指令來控制劇情', 'info', 2000);
            }
        }

        function updateDirectorModeUI() {
            if (!el.directorModeToggle || !el.inputField) return;

            if (state.directorMode) {
                el.directorModeToggle.classList.add('active');
                if (el.inputFieldWrapper) {
                    el.inputFieldWrapper.classList.add('director-mode');
                }
                el.inputField.placeholder = '輸入劇情指令 (System Instruction)...';
            } else {
                el.directorModeToggle.classList.remove('active');
                if (el.inputFieldWrapper) {
                    el.inputFieldWrapper.classList.remove('director-mode');
                }
                el.inputField.placeholder = '繼續你的故事...';
            }
        }
        function renderWorldLibrarySelect() {
            const rawLibrary = loadWorldLibrary();
            const select = el.worldLibrarySelect;

            // 保留第一个默认选项，清除其他
            select.innerHTML = '<option value="">-- 從圖書館選擇 --</option>';

            // 確保資料是陣列格式（相容 LocalStorage Array 和 Firebase Object）
            const library = Array.isArray(rawLibrary) ? rawLibrary : Object.values(rawLibrary || {});

            library.forEach(world => {
                const option = document.createElement('option');
                option.value = world.id;
                option.textContent = world.name;
                select.appendChild(option);
            });
        }
        function toggleFocusMode() {
            isFocusMode = !isFocusMode;
            document.body.classList.toggle('focus-mode', isFocusMode);
            el.focusModeBtn.classList.toggle('active', isFocusMode);
        }

        function exitFocusMode() {
            if (isFocusMode) {
                isFocusMode = false;
                document.body.classList.remove('focus-mode');
                el.focusModeBtn.classList.remove('active');
            }
        }

        // ============================================
        // Text Selection Menu
        // ============================================
        let selectedText = '';
        let selectedRange = null;

        function showSelectionMenu(x, y) {
            const menu = el.selectionMenu;

            // 先設為顯示狀態以獲取尺寸
            menu.style.display = 'flex';
            menu.classList.add('active');

            // 獲取選單尺寸
            const menuRect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 計算選單位置（預設顯示在選取範圍上方）
            let posX = x - menuRect.width / 2;
            let posY = y - menuRect.height - 15; // 上方留 15px 間距

            // 水平方向邊界檢查
            const margin = 10;
            if (posX < margin) {
                posX = margin;
            }
            if (posX + menuRect.width > viewportWidth - margin) {
                posX = viewportWidth - menuRect.width - margin;
            }

            // 垂直方向邊界檢查
            if (posY < margin) {
                // 上方空間不足，顯示在下方
                posY = y + 25;
            }
            if (posY + menuRect.height > viewportHeight - margin) {
                // 下方也不足，強制顯示在上方
                posY = viewportHeight - menuRect.height - margin;
            }

            // 設定選單位置
            menu.style.left = posX + 'px';
            menu.style.top = posY + 'px';

            console.log('📍 選單位置:', posX, posY);
        }

        function hideSelectionMenu() {
            el.selectionMenu.classList.remove('active');
        }
        function updateUserUI(user) {
            if (user) {
                // Logged in
                el.loginBtn.classList.add('hidden');
                el.userInfo.classList.remove('hidden');
                el.userName.textContent = user.displayName || user.email;
                if (user.photoURL) {
                    el.userAvatarImg.src = user.photoURL;
                } else {
                    el.userAvatarImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="35" r="25" fill="%23888"/><circle cx="50" cy="100" r="40" fill="%23888"/></svg>';
                }
            } else {
                // Logged out
                el.loginBtn.classList.remove('hidden');
                el.userInfo.classList.add('hidden');
            }
        }

        function updateSyncStatusUI(status) {
            const dot = el.syncDot;
            const text = el.syncText;

            dot.classList.remove('syncing', 'error');

            switch (status) {
                case 'syncing':
                    dot.classList.add('syncing');
                    text.textContent = '同步中...';
                    break;
                case 'synced':
                    text.textContent = '已同步';
                    break;
                case 'error':
                    dot.classList.add('error');
                    text.textContent = '同步失敗';
                    break;
                default:
                    text.textContent = '已同步';
            }
        }
