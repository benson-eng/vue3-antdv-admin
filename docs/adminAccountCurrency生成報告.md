# 後台帳戶 - 幣別管理頁面生成報告

**檢查日期：** 2025-12-16  
**檢查分支：** poc_shang  
**檢查文件：** `src/views/adminAccount/currency/`、`src/api/backend/adminAccount/currency.ts`、`src/router/routes/modules/adminAccount.ts`

---

## 📋 檢查摘要

| 檢查項目 | 狀態 | 說明 |
|---------|------|------|
| 頁面結構 | ✅ 通過 | `index.vue`、`columns.tsx`、`formSchemas.ts` 均按規範存在 |
| DynamicTable 使用 | ✅ 通過 | `useTable` + `:data-request` + `rowSelection` 正確 |
| SchemaForm / Modal | ✅ 通過 | `useFormModal` + `baseSchemas` 正確被使用 |
| API 封裝 | ✅ 通過 | `src/api/backend/adminAccount/currency.ts` 提供 list/create/update/delete |
| 路由與 i18n | ✅ 通過 | `/adminAccount/currency` 已註冊並補上多語系 |
| TypeScript / ESLint | ✅ 通過 | `read_lints` 沒有警告 |

---

## 📁 檔案清單

- ✅ `src/views/adminAccount/currency/index.vue`（139 行）  
- ✅ `src/views/adminAccount/currency/columns.tsx`（105 行）  
- ✅ `src/views/adminAccount/currency/formSchemas.ts`（48 行）  
- ✅ `src/api/backend/adminAccount/currency.ts`（64 行）  
- ✅ `src/router/routes/modules/adminAccount.ts`（29 行）  
- ✅ `docs/prompt_shang.md`（110 行；列出 prompt + 分段流程）  
- ✅ `src/locales/lang/zh-CN/routes/adminAccount.json`  
- ✅ `src/locales/lang/en/routes/adminAccount.json`

---

## 🔍 檢查結果（要點）

1. **頁面結構**：template/toolbar、`columns` ref、`rowSelection`、`openFormModal` 等依照規範排列。
2. **欄位配置**：`columns.tsx` 定義 ID、帳號、色 Tag 狀態、排序、建立時間，所有搜索欄使用 `colProps` 控制 span。
3. **表單 schema**：`formSchemas.ts` 包含 account/currencyName/currencyCode/status/orderNo，`rules` 與 `componentProps` 完整。
4. **API & 路由**：新增 `/api/adminAccount/currency` 對應 CRUD，路由 meta 使用 t() 配合新增 i18n。
5. **質量檢查**：執行 `read_lints`（相當於 `get_errors`）確認無 TypeScript/ESLint/框架錯誤。

---

## ✅ 功能清單

- ✅ 列表查詢與排序  
- ✅ 搜索欄（Input、Select、InputNumber）  
- ✅ 狀態 Tag + 圓點顯示  
- ✅ toolbar 新增 + 批量刪除按鈕  
- ✅ 操作列（查看、編輯、刪除）  
- ✅ Modal 新增/編輯表單 + 回填  
- ✅ API list/create/update/delete  
- ✅ 路由註冊 + 多語系  
- ✅ 語系檔覆蓋（中文與英文）  
- ✅ 質量檢查（`read_lints` 通過）

---

## 📌 待完成 / 建議

1. 如需更細語系，可在 `src/locales/lang/{zh-CN,en}/routes` 補充描述階層。  
2. 若後端尚未提供 `/api/adminAccount/currency`，請 mock 或向後端請求對應接口。  
3. 建議後續補上權限模組配置（v-auth）與批量操作權限。

---

## 📝 總結

本次依 `prompt_shang.md` 指令完成「後台帳戶 / 幣別管理」的畫面與路由、API、i18n 配置，並以 `read_lints` 確認無錯誤。請依照需求將該頁面註冊至選單並與後端對接，完成後再補充報告中的建議項目。
