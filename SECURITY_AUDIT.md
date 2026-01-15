# 墨韻 (MòYùn) - 安全性審查報告

## 審查日期
2026-01-15

## 審查範圍
本次安全性審查針對跨站腳本攻擊 (XSS) 防護進行全面檢查和加固。

---

## 已實施的安全措施

### 1. 輸入驗證與輸出轉義

#### ✅ HTML 轉義函數
- **位置**: `js/utils.js:6-11`
- **功能**: `escapeHtml()` 函數用於轉義所有用戶輸入的 HTML 特殊字符
- **實現**: 使用 `textContent` API 安全地轉義 `<`, `>`, `&`, `"`, `'` 等字符

#### ✅ Toast 通知安全
- **位置**: `js/ui.js:118-131`
- **修復**: 在 `showToast()` 函數中使用 `escapeHtml()` 轉義消息內容
- **風險等級**: 高 → 已修復
- **原因**: Toast 消息可能包含來自 API 的錯誤訊息或用戶輸入

#### ✅ 角色名稱與 ID 轉義
- **位置**: `js/ui.js:393-469` - `renderCharacterList()`
- **實現**: 所有角色名稱和 ID 在渲染時都使用 `escapeHtml()` 轉義
- **保護範圍**:
  - 角色名稱輸入框
  - data-* 屬性
  - 焦點狀態顯示

#### ✅ 段落內容渲染
- **位置**: `js/ui.js:274-301` - `renderParagraphs()`
- **實現**: 段落 ID 使用 `escapeHtml()` 轉義
- **內容處理**: 使用 `parseMarkdown()` 並經過 HTML 清理

#### ✅ 文檔列表渲染
- **位置**: `js/ui.js:226-265` - `renderDocList()`
- **實現**: 文檔 ID 和標題都使用 `escapeHtml()` 轉義

---

### 2. Markdown 解析安全

#### ✅ HTML 清理函數
- **位置**: `js/utils.js:60-72`
- **功能**: `sanitizeHtml()` 函數清理 Markdown 生成的 HTML
- **防護措施**:
  1. 移除 `<script>` 標籤
  2. 移除所有內聯事件處理器 (onclick, onerror, onload 等)
  3. 移除 `javascript:` 協議
  4. 禁用 data: URI 用於圖片 (防止 Base64 XSS)

#### ✅ Markdown 解析配置
- **位置**: `js/utils.js:38-58`
- **配置**:
  - 禁用 headerIds 防止 ID 注入
  - 禁用 mangle 保持內容原樣
  - 錯誤時回退到安全的 HTML 轉義

---

### 3. Content Security Policy (CSP)

#### ✅ CSP Meta 標籤
- **位置**: `index.html:10-22`
- **實施的策略**:
  ```
  default-src 'self'
  script-src 'self' 'unsafe-inline' (CDN允許列表)
  style-src 'self' 'unsafe-inline' (Google Fonts)
  connect-src (Firebase, OpenRouter, OpenAI 允許列表)
  frame-src 'none' (禁用 iframe)
  object-src 'none' (禁用 Flash 等對象)
  upgrade-insecure-requests (強制 HTTPS)
  ```

#### ⚠️ 注意事項
- `'unsafe-inline'` 在 script-src 和 style-src 中啟用
- **原因**: 支援內聯樣式和現有的內聯腳本
- **建議**: 未來考慮使用 nonce 或 hash 來替代 unsafe-inline

---

### 4. Modal 對話框安全

#### ✅ 確認對話框
- **位置**: `js/ui.js:155-160`
- **實現**: 使用 `textContent` 而非 `innerHTML`
- **效果**: 自動轉義所有 HTML 標籤，防止注入

---

### 5. 資料儲存安全

#### ✅ IndexedDB 實作
- **位置**: `js/offline.js`
- **安全性**:
  - 僅儲存用戶自己的數據
  - 使用結構化數據，不直接儲存 HTML
  - 同步狀態追蹤

#### ✅ LocalStorage 使用
- **位置**: `js/storage.js`
- **安全性**:
  - API Key 不上傳雲端 (隱私保護)
  - 數據在讀取時經過驗證
  - 時間戳比對防止數據衝突

---

## 潛在風險與建議

### ⚠️ 中風險項目

#### 1. Markdown 解析器
- **風險**: marked.js 允許部分 HTML 標籤
- **當前防護**: 使用 `sanitizeHtml()` 函數清理
- **建議**: 考慮使用更強大的 HTML 清理庫 (如 DOMPurify)

#### 2. 內聯 JavaScript
- **風險**: CSP 允許 `'unsafe-inline'`
- **當前狀態**: 可接受 (單用戶應用)
- **建議**: 長期考慮改用 nonce 或 hash-based CSP

#### 3. API 錯誤訊息
- **風險**: API 返回的錯誤可能包含敏感信息
- **當前防護**: Toast 訊息已轉義 HTML
- **建議**: 過濾敏感信息後再顯示

---

### ℹ️ 低風險項目

#### 1. 第三方 CDN
- **狀態**: 使用 CDN 載入 Firebase SDK 和 marked.js
- **防護**: CSP 限制允許的 CDN 來源
- **建議**: 考慮 SRI (Subresource Integrity) 檢查

#### 2. 用戶生成內容
- **狀態**: 內容主要來自用戶自己和 AI
- **風險**: 低 (無跨用戶內容分享)
- **防護**: 所有輸出都經過轉義或清理

---

## 測試建議

### 手動測試案例

1. **XSS 注入測試 - 角色名稱**
   ```
   測試輸入: <script>alert('XSS')</script>
   預期結果: 顯示為純文本，不執行腳本
   ```

2. **XSS 注入測試 - 文檔標題**
   ```
   測試輸入: <img src=x onerror=alert('XSS')>
   預期結果: 顯示為純文本，不載入圖片或執行腳本
   ```

3. **XSS 注入測試 - AI 回應**
   ```
   提示詞: 請回應 <script>alert('test')</script>
   預期結果: Markdown 解析後，腳本標籤被移除
   ```

4. **Event Handler 注入**
   ```
   測試輸入: <div onclick="alert('click')">Click</div>
   預期結果: onclick 屬性被移除
   ```

5. **JavaScript Protocol**
   ```
   測試輸入: <a href="javascript:alert('XSS')">Link</a>
   預期結果: javascript: 協議被移除
   ```

---

## 安全評分

| 項目 | 評分 | 說明 |
|------|------|------|
| 輸入驗證 | ✅ 優秀 | 所有用戶輸入都經過轉義 |
| 輸出編碼 | ✅ 優秀 | HTML、屬性都使用安全方法 |
| HTML 清理 | 🟡 良好 | 基本清理實現，可升級 |
| CSP | 🟡 良好 | 已實施，但允許 unsafe-inline |
| 整體安全性 | ✅ 優秀 | 對 XSS 有良好的防護 |

---

## 總結

本應用已實施多層 XSS 防護措施：

1. ✅ **輸入層**: 所有用戶輸入在輸出時都經過 HTML 轉義
2. ✅ **處理層**: Markdown 內容經過 HTML 清理
3. ✅ **輸出層**: 使用安全的 DOM API (textContent)
4. ✅ **瀏覽器層**: 實施 Content Security Policy

對於一個單用戶寫作應用而言，當前的安全措施已經足夠。主要威脅來自：
- 惡意 API 響應 (已防護)
- 用戶誤輸入危險內容 (已防護)

建議的未來改進：
1. 整合 DOMPurify 用於更強大的 HTML 清理
2. 使用 nonce-based CSP 替代 unsafe-inline
3. 添加 Subresource Integrity (SRI) 檢查 CDN 資源

---

**審查人員**: Claude (AI Assistant)
**狀態**: ✅ 通過 - 無高危漏洞
