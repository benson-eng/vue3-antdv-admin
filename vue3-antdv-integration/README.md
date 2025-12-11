# Vue 3 + Ant Design Vue 登入機制整合

本目錄包含從 Vue 2 + Element UI 轉換為 Vue 3 + Ant Design Vue 的登入機制檔案和參考資料。

## 📁 檔案結構

```
vue3-antdv-integration/
├── README.md                          # 本檔案
├── 整合清單.md                        # 完整的整合清單和說明
├── src/
│   ├── api/
│   │   ├── users.ts                   # 登入 API 調用（參考）
│   │   └── types.d.ts                  # API 類型定義（參考）
│   ├── config/
│   │   └── apiActionSetting.ts        # API 動作設定（參考）
│   ├── router/
│   │   └── permission.ts              # 路由權限守衛（參考）
│   ├── stores/
│   │   └── user.ts.example             # Pinia Store 範例（參考）
│   └── utils/
│       ├── cookies.ts                  # Token Cookie 管理（可直接使用）
│       ├── request.ts                  # 請求攔截器（需要適配）
│       └── vueRequest.ts               # Vue 請求封裝（需要適配）
```

## 📋 檔案說明

### 可直接使用的檔案
- `src/utils/cookies.ts` - Token 管理工具，無需修改

### 需要適配的檔案
- `src/utils/request.ts` - 請求攔截器，需要適配 Vue 3 的 store 使用方式
- `src/utils/vueRequest.ts` - 請求封裝，需要適配 Ant Design Vue 的 message 組件

### 參考檔案（範例）
- `src/api/users.ts` - 登入 API 調用範例
- `src/api/types.d.ts` - API 類型定義範例
- `src/config/apiActionSetting.ts` - 配置檔案範例
- `src/router/permission.ts` - 路由守衛範例（包含 Vue Router 3 和 4 的對比）
- `src/stores/user.ts.example` - Pinia Store 範例

## 🚀 使用方式

1. **查看整合清單**
   - 閱讀 `整合清單.md` 了解完整的檔案清單和轉換需求

2. **在目標專案中使用**
   - 將 `整合清單.md` 的內容提供給目標專案的 AI
   - AI 會根據目標專案的實際結構進行整合

3. **參考檔案**
   - 參考目錄中的範例檔案了解原始結構
   - 根據目標專案調整和轉換

## 📦 安裝依賴

確保目標專案已安裝：

```bash
npm install pinia ant-design-vue axios js-cookie
# 或
yarn add pinia ant-design-vue axios js-cookie
```

如果需要雙因素驗證功能：
```bash
npm install speakeasy base32.js
# 或
yarn add speakeasy base32.js
```

## 🔄 主要轉換工作

### Vue 2 → Vue 3
- Class Component → Composition API
- `this.$router` → `useRouter()`
- Vuex → Pinia
- Vue Router 3 → Vue Router 4
- `process.env.VUE_APP_*` → `import.meta.env.VITE_APP_*`

### Element UI → Ant Design Vue
- `el-form` → `a-form`
- `el-input` → `a-input`
- `el-button` → `a-button`
- `el-checkbox` → `a-checkbox`
- `el-dialog` → `a-modal`
- `Message` → `message` (Ant Design Vue)

## 📝 注意事項

1. **API 基礎 URL**：需要根據目標專案調整 `src/utils/request.ts` 中的配置
2. **i18n**：如果目標專案使用不同的 i18n 方案，需要適配翻譯功能
3. **權限系統**：路由守衛中的權限邏輯可能需要根據目標專案的權限系統調整
4. **登入頁面**：需要從 `src/views/login/index.vue` 轉換為 Vue 3 + Ant Design Vue（未包含在此目錄中，請參考整合清單）

## 📌 重要提示

- 本目錄主要提供參考檔案和整合清單
- 實際的登入頁面組件需要從原始專案的 `src/views/login/index.vue` 轉換
- 建議在目標專案中由 AI 根據實際結構進行整合
