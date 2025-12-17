# API 導入 Prompt 範例

```markdown
請為我生成一個管理頁面，按照項目標準流程執行：

### 基礎信息
- 模塊名稱: 後台帳戶 (中文)
- 模塊代碼: adminAccount (英文，用於路由)
- 頁面名稱: 幣別管理 (中文)
- 頁面代碼: currency (英文，用於路由)
- 路由路徑: /adminAccount/currency
- 模塊圖標: ant-design:User-outlined
- 頁面圖標: ant-design:PayCircle-outlined
- 菜單排序: 1

### 頁面截圖
附上 UI 圖（例如 `assets/currency-table.png`）：  
- 表格欄位：ID、帳號、貨幣名稱/代碼、狀態（Tag + 圓點）、排序、建立時間  
- 搜索欄：帳號 Input、貨幣代碼 Input、狀態 Select、排序 InputNumber、建立時間 RangePicker  
- 操作按鈕：查看、編輯（兩者都用 Link 樣式）、刪除（popConfirm + 變色）  
- toolbar：新增按鈕 + 批量刪除按鈕（需根據 `rowSelection` 控制 disabled）

### 功能需求
- [x] 基礎 CRUD (list/create/update/delete)
- [x] 搜索功能（Input/Select/InputNumber/RangePicker）
- [x] 狀態顯示 Tag + 圓點
- [x] 批量操作（批量刪除）

### API 資訊
- `list`: `GET /api/adminAccount/currency` → 回傳 `{ items: CurrencyItem[]; meta: { currentPage; totalItems; totalPages; itemsPerPage } }`
- `create`: `POST /api/adminAccount/currency`
- `update`: `PUT /api/adminAccount/currency/:id`
- `delete`: `DELETE /api/adminAccount/currency/:id`
- 權限：`adminAccount:currency:*`
- mock 檔案：`mocks/adminAccountCurrency.ts`，需用 `resultPageSuccess` + `resultSuccess`、支援 `page/pageSize` 以及 faker 生成 `createdAt/updatedAt`

### 執行要求
1. 使用 `create_file` 生成：`src/views/adminAccount/currency/columns.tsx`、`formSchemas.ts`、`index.vue`、`src/api/backend/adminAccount/currency.ts`、`src/router/routes/modules/adminAccount.ts`、`mocks/adminAccountCurrency.ts`
2. `columns.tsx` 要採用 `TableColumn<TableListItem>`，ID 隱藏搜索、狀態用 Tag+圓點、操作列固定右側。
3. `formSchemas.ts` 包含 account/currencyName/currencyCode/status/orderNo + `rules`，`status` Select 有啟用/停用 option。
4. `index.vue` template 內使用 `DynamicTable` + toolbar + rowSelection；`openFormModal` 需用 `useFormModal` 跳出 modal，`loadTableData` 直接返回 API（`Api.list(params)`）。
5. mock 檔案要模擬 list/create/update/delete，path 用 `serverApi('/adminAccount/currency')`，list 返回 `resultPageSuccess`。
6. 執行 `get_errors` 檢查 TypeScript/ESLint/框架規範，若出錯用 `replace_string_in_file` 修復，再次 `get_errors`。
7. 產出報告（參考 `docs/adminAccountCurrency生成報告.md`）記錄檔案/功能/測試結果。

### 附加說明
- 有圖片的話，在 prompt 最下方額外寫 `![currency table](assets/currency-table.png)`，並在「頁面截圖」段落說明哪個圖代表什麼欄位。
- 如果需要 mock 轉換 `/AdminSystem/api/...`，請補 `src/utils/mockSwitch.ts` 的對應映射。
```

可依照這個範例 prompt 修改模組、欄位與 API 資訊後直接送出。需要我再出一份針對其他模組（例如 system/role）的 prompt 版本嗎？
