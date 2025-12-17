# Cursor Prompt 範本（Shang）

這份文件整理你剛才的需求 + 進階欄位/分段 prompt，方便直接複製到對話框裡執行，
並符合 `docs/prompt.md` 的專案規範（DynamicTable + useFormModal + TypeScript + get_errors）。

---
## 1. 基本模組資訊（可直接複製到 prompt 前半段）
> 請為我生成一個管理頁面，按照項目標準流程執行：
>
> ### 基礎信息
> - 模塊名稱: 後台帳戶 (中文)
> - 模塊代碼: adminAccount (英文，用於路由)
> - 頁面名稱: 幣別管理 (中文)
> - 頁面代碼: currency (英文，用於路由)
> - 路由路徑: /adminAccount/currency
> - 模塊圖標: ant-design:User-outlined
> - 頁面圖標: ant-design:PayCircle-outlined
> - 菜單排序: 1
>
> ### 頁面截圖
> 此圖為 Vue2 畫面，請幫我轉換成目前專案的 Ant Design 風格：
> - 表格欄位要考慮可搜索與排序
> - 搜索欄位包含下拉選、輸入框、時間區間、數字輸入
> - 表單項（新增/編輯）要有 key 欄位、狀態選擇、排序欄
> - 操作按鈕包含查看、編輯、刪除（刪除需 popConfirm）
>
> ### 功能需求
> - [x] 基礎 CRUD (增刪改查)
> - [x] 批量操作 (批量刪除/修改)
>
> ### 執行要求
> 1. 使用 `create_file` 生成 files: columns.tsx, formSchemas.ts, index.vue, API, 路由配置
> 2. 嚴格遵循項目規範（DynamicTable, useTable, useFormModal）
> 3. 使用 `get_errors` 檢查 TypeScript + ESLint + 框架規範
> 4. 使用 `replace_string_in_file` 修復可自動修復的錯誤
> 5. 提供頁面生成報告

---
## 2. 分段 prompt：逐步產生三個核心檔案
請依序把下面三段 prompt 逐一貼給 Cursor，確認階段完成再進行下一段。
（也可以用 `split` + `replace_string_in_file` 先產出空殼再補內容）

### 2.1 生成 `index.vue` 骨架
```
請先生成 `/src/views/adminAccount/currency/index.vue`：
- template 使用 `<DynamicTable>` 包含 `:data-request="loadTableData"`、`:columns="columns"`、`:row-selection="rowSelection"`
- toolbar 插入一個主要 `a-button type="primary"`（標籤「新增」）和一組批量操作按鈕（如「批量刪除」）
- script setup 引入 `ref`、`computed`、`Modal`、`message`、`useTable`、`useFormModal`、`baseColumns`、`baseSchemas`、`Api`
- 實作 `const [DynamicTable, dynamicTableInstance] = useTable({ formProps: { autoSubmitOnEnter: true } })`
- rowSelection 以 `ref({...})` 管理 selectedRowKeys
- `loadTableData` 直接 `return Api.adminAccount.currency.list(params)` 並在呼叫前清空選中
- `openFormModal(record)` 使用 `showModal`，在 onFinish 依 record.id 切換 `Api.create/Api.update`，成功後 message，呼叫 `dynamicTableInstance?.reload()`
- `delRowConfirm` + `delRowsConfirm`（`Modal.confirm`）
- `columns` 為 `ref<TableColumnItem[]>([...baseColumns, 操作列])`
- 操作列 `actions` 包含「查看」「編輯」「刪除」，刪除需要 `popConfirm`
- `defineOptions({ name: 'AdminAccountCurrency' })`
```

### 2.2 寫出 `columns.tsx`
```
請生成 `/src/views/adminAccount/currency/columns.tsx`：
- 匯入 `TableColumn`、`Tag`、`Space`、`Button`、`formatToDateTime`
- 定義 `interface TableListItem`（id、account、currencyName、currencyCode、status、orderNo、createdAt）
- `baseColumns`：
  1. ID 欄 `hideInSearch: true`, `width: 80`
  2. 帳號/貨幣名稱/貨幣代碼：設定 `formItemProps`（Input）、`colProps: { span: 6 }`，`sorter: true`
  3. 狀態欄：`formItemProps.component: 'Select'`、options（1=啟用、0=禁用）、`customRender` 顯示 Tag+圓點
  4. 排序欄 `orderNo` 使用 `InputNumber` 搜索、`sorter: true`
  5. 註冊時間 `createdAt`：`formItemProps` 改 `RangePicker`、`hideInTable: false`、`hideInSearch: true`、`customRender: formatToDateTime`
  6. 操作欄：`fixed: 'right'`、`actions` 包含三個連結，`type: 'link'`
- 全欄位都要提供適當 `width` 與 `hideInTable/hideInSearch`
- `status` customRender 裡 `const enable = ~~record.status === 1`、Tag 顏色 `enable ? 'success' : 'default'`
```

### 2.3 製作 `formSchemas.ts`
```
請生成 `/src/views/adminAccount/currency/formSchemas.ts`：
- 匯入 `FormSchema`
- `baseSchemas` 包含：
  1. `account`（Input + `rules: [{ required: true }]` + `colProps: { span: 12 }`）
  2. `currencyCode`（Input + `colProps: { span: 12 }`）
  3. `currencyName`（Input + required）
  4. `status`（Select，options 1=啟用/0=禁用，`defaultValue: 1`）
  5. `orderNo`（InputNumber，`componentProps: { min: 0 }`）
- 所有 schema 都應設定 `label`、`componentProps`、必要的 `colProps`
- 若有描述欄位或 multi-line，可再補 `InputTextArea`
```

---
## 3. 補充說明
- 加上 `API` 路徑 `/src/api/backend/adminAccount/currency.ts`，其 `list/create/update/delete` 都要有 `/api/adminAccount/currency` 前綴。
- 路由放在 `src/router/routes/modules/adminAccount.ts`，`meta.icon` 使用 `ant-design:PayCircle-outlined`，`name`/`meta.title` 用 `t('routes.adminAccount.currency')`。
- 圖片使用方式：先拖圖到對話框，再在 prompt 的「### 頁面截圖」段落提到上傳的檔名（例如 `assets/member-data.png`），說明哪個區塊要解析。
- 生成後必須 `get_errors({ filePaths: [...] })` 驗證，若報錯再呼叫 `replace_string_in_file` 修改。
- 最終提交時提供同檔報告（模組/頁面/路由/功能清單/檢查結果），可參考 `docs/prompt.md` 的報告格式。

---
## 4. 直接貼到 Cursor 的範本（整合版）
> 你也可以直接把整段範本貼一次，讓 Cursor 依序呼叫上面的內容：
> ```
> [第一段基本資訊 + 執行要求]
> [第二段 index.vue prompt]
> [第三段 columns.tsx prompt]
> [第四段 formSchemas.ts prompt]
> ```
> 生成完畢後再用 `get_errors` 跑一次，確認 TypeScript/ESLint/框架 checklist 都過。

---
最後記得保持 prompt 裡的格式一致（標題、`-` 表示項目）並說明每個欄位應該怎麼 render，你就可以直接複製貼到 Cursor 上執行。
