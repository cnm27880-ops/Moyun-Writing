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
            styleDNA: $('styleDNA'),
            extractStyleBtn: $('extractStyleBtn'),
            worldSetting: $('worldSetting'),
            customPrompt: $('customPrompt'),
            customPromptGroup: $('customPromptGroup'),

            // Logic Mode Selector (導演面板)
            logicModeSelect: $('logicModeSelect'),
            logicModeHint: $('logicModeHint'),

            // Character Notes (角色印象筆記)
            extractCharacterBtn: $('extractCharacterBtn'),
            characterNoteTabs: $('characterNoteTabs'),
            aiCharacterNote: $('aiCharacterNote'),
            userCharacterNote: $('userCharacterNote'),
            aiCharacterNoteText: $('aiCharacterNoteText'),
            userCharacterNoteText: $('userCharacterNoteText'),

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
            endpointSelect: $('endpointSelect'),
            deleteEndpointBtn: $('deleteEndpointBtn'),
            apiKey: $('apiKey'),
            modelName: $('modelName'),
            modelSelect: $('modelSelect'),
            deleteModelBtn: $('deleteModelBtn'),
            temperature: $('temperature'),
            tempValue: $('tempValue'),
            saveSettingsBtn: $('saveSettingsBtn'),
            clearAllBtn: $('clearAllBtn'),

            // Director / Character Mixer
            addCharacterBtn: $('addCharacterBtn'),
            characterList: $('characterList'),
            characterEmpty: $('characterEmpty'),
            directorFocusBar: $('directorFocusBar'),

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

            // Directed Regeneration Modal
            directedRegenModal: $('directedRegenModal'),
            directedRegenInput: $('directedRegenInput'),
            directedRegenModalClose: $('directedRegenModalClose'),
            directedRegenModalCancel: $('directedRegenModalCancel'),
            directedRegenModalConfirm: $('directedRegenModalConfirm'),

            // Focus Mode
            focusModeBtn: $('focusModeBtn'),
            focusModeExit: $('focusModeExit'),

            // Selection Menu - 已移除，功能整合到長按選單
            // selectionMenu: $('selectionMenu'),
            // refineBtn: $('refineBtn'),
            // expandBtn: $('expandBtn'),
            // editBtn: $('editBtn'),
            // deleteTextBtn: $('deleteTextBtn'),

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
        let directedRegenCallback = null;

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

        function showDirectedRegenModal(onConfirm) {
            if (!el.directedRegenModal) return;
            el.directedRegenInput.value = '';
            el.directedRegenModal.classList.add('active');
            el.directedRegenInput.focus();
            directedRegenCallback = onConfirm;
        }

        function hideDirectedRegenModal() {
            if (!el.directedRegenModal) return;
            el.directedRegenModal.classList.remove('active');
            directedRegenCallback = null;
        }

        // ============================================
        // Drawer & Panel Controls
        // ============================================
        function openDrawerLeft() {
            if (el.drawerLeft) el.drawerLeft.classList.add('open');
            if (el.overlay) el.overlay.classList.add('active');
        }

        function closeDrawerLeft() {
            if (el.drawerLeft) el.drawerLeft.classList.remove('open');
            if (el.overlay) el.overlay.classList.remove('active');
        }

        function openPanelRight() {
            if (el.panelRight) el.panelRight.classList.add('open');
            if (el.overlay) el.overlay.classList.add('active');
        }

        function closePanelRight() {
            if (el.panelRight) el.panelRight.classList.remove('open');
            if (el.overlay) el.overlay.classList.remove('active');
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
            if (!el.docList) return;

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
            if (!el.editorBody) return;

            if (!state.currentDoc?.paragraphs?.length) {
                el.editorBody.innerHTML = '';
                return;
            }

            // 預設 contenteditable="false"，需要雙擊或透過選單的「編輯」按鈕才能編輯
            // 效能優化：使用 Event Delegation，不在迴圈內綁定事件
            el.editorBody.innerHTML = state.currentDoc.paragraphs.map(p => {
                const hasHistory = p.history && p.history.length > 0;
                return `
                <div class="paragraph ${p.source === 'user' ? 'user' : 'ai'}${hasHistory ? ' has-history' : ''}" data-id="${escapeHtml(p.id)}">
                    <span class="paragraph-tag">${p.source === 'user' ? '你' : 'AI'}</span>
                    <div class="paragraph-content" contenteditable="false">${parseMarkdown(p.content)}</div>
                    ${p.source === 'ai' ? `<button class="regenerate-btn" data-id="${escapeHtml(p.id)}" title="重新生成">🔄</button>` : ''}
                </div>
            `;
            }).join('');

            // 事件綁定已移至 initEditorBodyDelegation() 使用 Event Delegation 模式
        }

        // ============================================
        // Event Delegation for Editor Body
        // 效能優化：使用單一監聽器處理所有段落事件
        // ============================================
        let editorBodyDelegationInitialized = false;

        function initEditorBodyDelegation() {
            if (editorBodyDelegationInitialized || !el.editorBody) return;
            editorBodyDelegationInitialized = true;

            // 雙擊事件 - 啟用編輯模式
            el.editorBody.addEventListener('dblclick', (e) => {
                const content = e.target.closest('.paragraph-content');
                if (content) {
                    content.setAttribute('contenteditable', 'true');
                    content.focus();
                }
            });

            // 失焦事件 - 保存並退出編輯模式
            el.editorBody.addEventListener('focusout', (e) => {
                const content = e.target.closest('.paragraph-content');
                if (content && content.getAttribute('contenteditable') === 'true') {
                    const paragraph = content.closest('.paragraph');
                    const paraId = paragraph?.dataset.id;
                    if (paraId && state.currentDoc?.paragraphs) {
                        const para = state.currentDoc.paragraphs.find(p => p.id === paraId);
                        if (para) {
                            para.content = content.innerText;
                            autoSave();
                        }
                    }
                    content.setAttribute('contenteditable', 'false');
                }
            });

            // 貼上事件 - 只貼純文字
            el.editorBody.addEventListener('paste', (e) => {
                const content = e.target.closest('.paragraph-content');
                if (content && content.getAttribute('contenteditable') === 'true') {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                }
            });

            // 輸入事件 - 即時更新段落內容（可選，用於更頻繁的保存）
            el.editorBody.addEventListener('input', (e) => {
                const content = e.target.closest('.paragraph-content');
                if (content && content.getAttribute('contenteditable') === 'true') {
                    // 可在此實現即時保存或標記為已修改
                }
            });

            // 點擊事件 - 重新生成按鈕
            el.editorBody.addEventListener('click', (e) => {
                const regenerateBtn = e.target.closest('.regenerate-btn');
                if (regenerateBtn) {
                    e.stopPropagation();
                    const paraId = regenerateBtn.dataset.id;
                    if (paraId && typeof regenerateParagraph === 'function') {
                        regenerateParagraph(paraId);
                    }
                }
            });

            // 長按事件 - Mouse Events
            el.editorBody.addEventListener('mousedown', (e) => {
                if (e.target.closest('.paragraph') && typeof handleLongPressStart === 'function') {
                    handleLongPressStart(e);
                }
            });

            el.editorBody.addEventListener('mousemove', (e) => {
                if (typeof handleLongPressMove === 'function') {
                    handleLongPressMove(e);
                }
            });

            el.editorBody.addEventListener('mouseup', () => {
                if (typeof handleLongPressEnd === 'function') {
                    handleLongPressEnd();
                }
            });

            // 長按事件 - Touch Events
            el.editorBody.addEventListener('touchstart', (e) => {
                if (e.target.closest('.paragraph') && typeof handleLongPressStart === 'function') {
                    handleLongPressStart(e);
                }
            }, { passive: true });

            el.editorBody.addEventListener('touchmove', (e) => {
                if (typeof handleLongPressMove === 'function') {
                    handleLongPressMove(e);
                }
            }, { passive: true });

            el.editorBody.addEventListener('touchend', () => {
                if (typeof handleLongPressEnd === 'function') {
                    handleLongPressEnd();
                }
            });

            console.log('Editor body event delegation initialized');
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
        // Theme Management - 主題管理
        // ============================================
        const THEME_STORAGE_KEY = 'moyun_theme';

        function toggleTheme(theme) {
            // 設定主題
            document.documentElement.setAttribute('data-theme', theme);

            // 保存到 localStorage
            localStorage.setItem(THEME_STORAGE_KEY, theme);

            // 更新按鈕狀態
            updateThemeButtonsUI(theme);

            showToast(theme === 'dark' ? '已切換至深色模式' : '已切換至淺色模式', 'success', 2000);
        }

        function updateThemeButtonsUI(theme) {
            const lightBtn = document.getElementById('themeLightBtn');
            const darkBtn = document.getElementById('themeDarkBtn');

            if (lightBtn && darkBtn) {
                lightBtn.classList.toggle('active', theme === 'light');
                darkBtn.classList.toggle('active', theme === 'dark');
            }
        }

        function initTheme() {
            // 從 localStorage 讀取主題設定
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

            // 如果沒有保存的設定，檢查系統偏好
            let theme = savedTheme;
            if (!theme) {
                // 檢查系統是否偏好深色模式
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    theme = 'dark';
                } else {
                    theme = 'light';
                }
            }

            // 套用主題（不顯示 toast）
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeButtonsUI(theme);

            // 綁定按鈕事件
            const lightBtn = document.getElementById('themeLightBtn');
            const darkBtn = document.getElementById('themeDarkBtn');

            if (lightBtn) {
                lightBtn.addEventListener('click', () => toggleTheme('light'));
            }
            if (darkBtn) {
                darkBtn.addEventListener('click', () => toggleTheme('dark'));
            }

            // 監聽系統主題變更
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                    // 只有在用戶沒有手動設定時才跟隨系統
                    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                        const newTheme = e.matches ? 'dark' : 'light';
                        document.documentElement.setAttribute('data-theme', newTheme);
                        updateThemeButtonsUI(newTheme);
                    }
                });
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

        // ============================================
        // Director Panel - 導演面板初始化
        // ============================================
        function initDirectorPanel() {
            if (!el.logicModeSelect) return;

            // 監聽邏輯模式變更
            el.logicModeSelect.addEventListener('change', (e) => {
                const newMode = e.target.value;
                if (state.currentDoc) {
                    state.currentDoc.logicMode = newMode;
                    updateLogicModeUI(newMode);
                    autoSave();
                    showToast(`已切換至：${LOGIC_PRESETS[newMode]?.name || newMode}`, 'success', 2000);
                }
            });
        }

        function updateLogicModeUI(mode) {
            // 更新提示文字
            if (el.logicModeHint) {
                switch (mode) {
                    case 'gemini':
                        el.logicModeHint.textContent = '三段式思考：感知 → 判斷 → 行動。適合推演角色內心算計。';
                        break;
                    case 'claude':
                        el.logicModeHint.textContent = '文學沉浸模式：Show, Don\'t Tell + 生理反應展現心理 + 嚴禁代行用戶角色心聲。';
                        break;
                    case 'custom':
                        el.logicModeHint.textContent = '使用你在設定頁的自訂 System Prompt。';
                        break;
                }
            }

            // 控制 customPrompt 顯示/隱藏
            if (el.customPromptGroup) {
                el.customPromptGroup.style.display = (mode === 'custom') ? 'block' : 'none';
            }
        }

        function syncDirectorPanelFromDoc() {
            if (!state.currentDoc) return;

            // 同步邏輯模式選擇器
            const logicMode = state.currentDoc.logicMode || 'claude';
            if (el.logicModeSelect) {
                el.logicModeSelect.value = logicMode;
            }
            updateLogicModeUI(logicMode);

            // 同步世界觀
            if (el.worldSetting) {
                el.worldSetting.value = state.currentDoc.worldSetting || '';
            }

            // 同步文風基因 (從全域設定載入)
            if (el.styleDNA) {
                el.styleDNA.value = state.globalSettings?.authorStyleProfile || '';
            }

            // 同步角色印象筆記
            if (el.aiCharacterNoteText) {
                el.aiCharacterNoteText.value = state.currentDoc.aiCharacterNote || '';
            }
            if (el.userCharacterNoteText) {
                el.userCharacterNoteText.value = state.currentDoc.userCharacterNote || '';
            }

            // 同步自訂 Prompt
            if (el.customPrompt) {
                el.customPrompt.value = state.currentDoc.customPrompt || '';
            }
        }

        function renderCharacterList() {
            if (!el.characterList || !el.characterEmpty) return;

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
            if (!el.directorFocusBar) return;

            const characters = state.currentDoc?.characters || [];
            const focusCharacterId = state.currentDoc?.focusCharacterId;
            const focusCharacter = characters.find(c => c.id === focusCharacterId);

            // 如果沒有角色，隱藏焦點欄
            if (characters.length === 0) {
                el.directorFocusBar.classList.remove('active');
                el.directorFocusBar.innerHTML = '';
                return;
            }

            el.directorFocusBar.classList.add('active');

            // 生成角色選項
            const characterOptions = characters.map(c => {
                const isSelected = c.id === focusCharacterId;
                return `<option value="${c.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
            }).join('');

            // 生成動力標籤（按權重排序，最多顯示 3 個）
            let drivesHtml = '';
            if (focusCharacter && Object.keys(focusCharacter.drives).length > 0) {
                const sortedDrives = Object.entries(focusCharacter.drives)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);

                drivesHtml = sortedDrives.map(([driveId, value]) => {
                    const drive = CORE_DRIVES[driveId];
                    return `<span class="focus-drive-tag">${drive.icon} ${drive.name} ${value}%</span>`;
                }).join('');
            } else {
                drivesHtml = '<span class="focus-drive-hint">選擇角色後設定驅動力</span>';
            }

            el.directorFocusBar.innerHTML = `
                <div class="focus-character-row">
                    <span class="focus-label">🎥 當前焦點：</span>
                    <select class="focus-character-select" id="focusCharacterSelect">
                        <option value="">-- 選擇角色 --</option>
                        ${characterOptions}
                    </select>
                </div>
                <div class="focus-drives">${drivesHtml}</div>
            `;

            // 綁定下拉選單變更事件
            const selectEl = document.getElementById('focusCharacterSelect');
            if (selectEl) {
                selectEl.addEventListener('change', (e) => {
                    const selectedId = e.target.value || null;
                    setFocusCharacter(selectedId);
                });
            }
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

        // Focus Mode State
        let isFocusMode = false;

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

        // selectionMenu 已移除，以下函數保留但不執行任何操作
        function showSelectionMenu(x, y) {
            // 已移除，功能整合到長按選單
        }

        function hideSelectionMenu() {
            // 已移除，功能整合到長按選單
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
