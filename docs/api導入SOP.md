# API 導入 SOP（純 API 補齊流程）

本 SOP 專注於「當 UI 已存在、只需補 API / mock / 連線」的流程，方便你針對這類需求寫 prompt。

## 1. 確認所需 API（列出清單）

1. 釐清要補的 endpoint：例如 `GET /api/adminAccount/currency`、`POST /api/adminAccount/currency`、`PUT /api/adminAccount/currency/:id`、`DELETE /api/adminAccount/currency/:id`。  
2. 確認返回格式：`{ items: CurrencyItem[]; meta: { currentPage; totalItems; totalPages; itemsPerPage } }`。  
3. 決定 mock 行為：是否支援分頁？是否需 faker 生成多種幣別？是否要提供 create/update/delete 回傳訊息。

## 2. prompt 段落建議（只補 API）

```
### API 資訊補充
- list: GET /api/{module}/{feature} → 描述回傳 schema、分頁資訊
- create/update/delete: 各自的 method + path
- 權限碼（如 adminAccount:currency:*）
- mock 檔案：mocks/{module}{feature}.ts，需使用 serverApi 模擬路徑，list 用 resultPageSuccess，其他用 resultSuccess

### 執行要求（只建 API + mock）
1. `create_file` 生成 `/src/api/backend/{module}/{feature}.ts`，使用 `request` 封裝 CRUD，返回 `API.PageParams`、`resultSuccess` 格式。
2. 若 mock 還沒做，建立 `mocks/{module}{feature}.ts`，用 faker 產生資料，支援 list/create/update/delete。
3. 執行 `get_errors` 檢查並使用 `replace_string_in_file` 修正。
4. 更新報告（docs/xxx生成報告.md）紀錄 API + mock 補齊狀況。
```

## 3. 補充提醒

- 若 API 路徑原本使用 `/AdminSystem/api`，請也更新 `src/utils/mockSwitch.ts` 的 mapping。  
- `mocks/index.ts` 會自動載入，所以只要放在 `mocks/` 就能生效。  
- 若 mock data 有特定欄位（status、createdAt、orderNo），需在 prompt 裡描述清楚。

需要我幫你針對某個模組生成完整 prompt 嗎？
# API 導入 SOP（Prompt 規範）

本 SOP 針對「將新 API 導入專案」的流程，讓你在撰寫 prompt 時能一步步提供必要資訊，確保前端、mock、路由、LCM（Life Cycle Management）三者一致。

## 1. 確認背景資料

1. 取得 API 規格（請求方法、路徑、參數、返回格式、權限）  
2. 確認該 API 屬於哪個模組（如 `adminAccount`、`system`），並對應到 `src/api/backend` 下的子資料夾或 mock 資料夾。  
3. 若有 mock 需求（dev 或 mock 環境），準備 `mocks/{moduleName}{feature}.ts` 的 handler 詳細行為。

## 2. 撰寫 prompt 的基本結構

採用 `docs/prompt_shang.md` 的「快速使用模板」作為基底，補上：

- 模組/頁面基本資訊（名稱、代碼、路由、圖示、排序）
- 功能需求（CRUD、批量、下拉、狀態顯示…）
- 「頁面截圖」段落：附上 UI 圖與對應的欄位說明（表格列、搜索欄、按鈕、CS）
- `執行要求`：列出需 `create_file` 的檔案（columns.tsx/formSchemas.ts/index.vue/API/路由），強調要 `get_errors`、`replace_string_in_file`。

## 3. API 相關 prompt 要素

1. **提供 API 程式碼**（若已有 client 版）  
   - 建議直接貼出 `src/api/backend/{module}/{feature}.ts` 內容，或讓系統依照 `request` 包裝寫法生成。  
   - 指明返回資料的結構（items/meta、欄位類型）與錯誤狀態處理方式。
2. **說明路由/檢查端點**  
   - 例：`list: GET /api/adminAccount/currency`、`create: POST /api/adminAccount/currency`。  
   - 若要 mock，說明 `mocks/adminAccountCurrency.ts` 需要覆寫 `serverApi('/adminAccount/currency')`。
3. **提供 mock 需求**（若需）  
   - 問題：是否需要 `resultPageSuccess`/`resultSuccess`、是否要支持 `page`/`pageSize`、是否要用 faker 生成資料。  
   - 範本：`mocks/adminAccountCurrency.ts` 中 `http.get`, `http.post` 等 Handler 片段。

## 4. 產出過程

1. `create_file`：依 prompt 生成 `columns.tsx`/`formSchemas.ts`/`index.vue`、API、路由、mock 檔案。  
2. `get_errors`：分別針對 TypeScript、ESLint、框架規範。  
3. `replace_string_in_file`：若 `get_errors` 回傳錯誤，使用 `oldString/newString` 修正欄位。  
4. 再執行一次 `get_errors` 確認過。  
5. 撰寫報告（可參考 `docs/adminAccountCurrency生成報告.md`）。

## 5. 測試 + 報告

- 記得在 `mock` 開啟狀態下（`.env.development` 設 `VITE_ENABLE_MOCK=true`）驗證 API。  
- 提供簡短報告內容：頁面清單、功能清單、檢查結果、mock/API 覆蓋範圍。  
- 若有圖片，將對應的 prompt 截圖段落補上 `image: assets/xxx.png`（請放在 prompt 最下方）。

## 附錄

- `src/utils/mockSwitch.ts`：控制 mock 開關與 `serverApi` 門面。  
- `mocks/index.ts`：統一匯入所有 mock handlers。  
- `src/main.ts`：mock 啟動的入口（判斷 `VITE_ENABLE_MOCK`／`VITE_MOCK_IN_PROD`）。

完成後請告訴我需不要幫忙檢查 prompt 是否完整，或需要範例 prompt 供複製。 
