# chatroom/rooms 功能對齊分析

## 【Step 1】Vue2 的實際執行流程

### 1. 頁面初始化
- `created()` 時：
  - 呼叫 `buildDataTableColumns()` - 建立主表格欄位
  - 呼叫 `buildDataTableColumns4()` - 建立 Dialog4 表格欄位
- **不自動載入資料**，等待 `onMasterAgentChanged` 觸發

### 2. 使用者選擇 masterAgent（onMasterAgentChanged）
流程順序：
1. 檢查 `params.masterAgent` 是否存在，不存在則 return
2. 設定 `isTableLoading = true`
3. 設定 `this.masterAgent = params.masterAgent`
4. **API 呼叫 1**：`await getTreasureItemList(this.masterAgent)`
5. **API 呼叫 2**：`await getRooms()`
6. 設定 `isTableLoading = false`

### 3. getTreasureItemList 執行流程
1. 呼叫 `treasureItemList({ masterAgent })`
2. 取得 `res.data.rows`（注意：是 `res.data.rows`，不是 `res.rows`）
3. 過濾 `r.type === "teamBadge"` 的項目
4. 對每個 `r.items` 過濾 `item.enabled === 1`
5. 設定到 `this.treasureItemList`

### 4. getRooms 執行流程
1. 清空 `this.dataList = []`
2. 呼叫 `queryRooms({ masterAgent: this.masterAgent })`
3. 檢查 `if (res)`（注意：Vue2 只檢查 `res` 存在，不檢查 `res.data`）
4. 設定 `this.dataList = res.data`
5. 呼叫 `this.extraDataInit()` - 建立按鈕組態

### 5. 表格資料來源
- DataTable 使用 `:data="dataList"` 直接綁定
- **不使用 data-request 或自動載入**
- 資料完全由 `getRooms()` 手動設定

### 6. Dialog2 歷史訊息（openDialogForm2）
1. 設定 `dataForm2 = defaultDataForm2()`（startTime = new Date()）
2. 清空 `messageData = []`
3. 設定 `dialogTitle2`
4. 設定 `nowRoomID = data.roomID`
5. 開啟 dialog（`isDialogForm2 = true`）
6. **不立即呼叫 API**，等待使用者點擊「搜尋」按鈕

### 7. Dialog2 搜尋訊息（searchMessage）
1. 表單驗證
2. **API 呼叫 1**：`await queryRoomRelationships()`（在 searchMessage 內呼叫）
3. 清空 `memberList = {}`
4. 設定 `lastPostData = postData`
5. **API 呼叫 2**：`await setMessageData(postData)`

### 8. setMessageData 執行流程
1. 呼叫 `queryRoomHistoryMessages(postData)`
2. 處理 `res.data`（注意：是 `res.data`，不是 `res`）
3. 對每個 item 解析 JSON，設定 `type` 和 `messageStr`
4. 收集 `memberIDs`（排除 "admin"）
5. **API 呼叫**：`queryAccountBaseInfo({ masterAgent, accounts: memberIDs })`
6. 處理 `res2.data`，建立 `memberList`
7. 設定 `this.messageData = res.data`

### 9. Dialog4 禁言管理（openDialogForm4）
1. 設定 `isDialogForm4 = true`
2. 設定 `nowRoomID = obj.roomID`
3. **API 呼叫**：`await queryRoomRelationships()`
4. 設定 `dialogTitle4`

### 10. queryRoomRelationships 執行流程（Dialog4 專用）
1. 清空 `relationshipsList = []` 和 `relationshipsListObj = {}`
2. 呼叫 `queryRoomRelationships({ masterAgent, roomID })`
3. 處理 `res.data.relationships`（注意：是 `res.data.relationships`）
4. 對每個 item 設定 `recordID` 和 `memberID2`
5. 建立 `relationshipsList` 和 `relationshipsListObj`
6. **API 呼叫**：`queryAccountBaseInfo({ masterAgent, accounts: memberIDs })`
7. 合併資料：`relationshipsList.map((item) => { ...item, ...item2 })`
8. 呼叫 `extraDataInit4()`

### 11. submitForm（編輯房間）
1. 表單驗證
2. 呼叫 `updateRoom(postData)`
3. 關閉 dialog
4. 設定 `isTableLoading = true`
5. **API 呼叫 1**：`await getTreasureItemList(this.masterAgent)`
6. **API 呼叫 2**：`await getRooms()`
7. 設定 `isTableLoading = false`

### 12. clickMuteUser / clickUnMuteUser
- `clickMuteUser`：
  1. 呼叫 `muteUser(postData)`
  2. **API 呼叫**：`await queryRoomRelationships()`
  3. **API 呼叫**：`await setMessageData(this.lastPostData)`
- `clickUnMuteUser`：
  1. 呼叫 `unmuteUser(postData)`
  2. **API 呼叫**：`await queryRoomRelationships()`
  3. 如果 `isDialogForm5 === true`，呼叫 `await setMessageData(this.lastPostData)`

## 【Step 2】Vue3 目前的實作比對

### ❌ 不一致項目

#### 1. 表格資料來源方式錯誤
- **Vue2**：DataTable 使用 `:data="dataList"` 直接綁定，不自動載入
- **Vue3**：使用 `:data-request="loadTableData"`，會自動觸發載入
- **問題**：Vue3 的表格會嘗試自動載入，但 Vue2 是手動控制

#### 2. getRooms 的資料結構處理
- **Vue2**：`if (res) { this.dataList = res.data; }`（只檢查 res 存在）
- **Vue3**：`if (res && res.data) { dataList.value = res.data; }`（檢查 res 和 res.data）
- **問題**：Vue3 多了一層檢查，但這可能是防禦性編程，需要確認 API 回傳格式

#### 3. getTreasureItemList 的資料結構處理
- **Vue2**：`res.data.rows.reduce(...)`（使用 `res.data.rows`）
- **Vue3**：`res.rows.reduce(...)`（使用 `res.rows`）
- **問題**：Vue3 少了 `data` 層級，可能導致錯誤

#### 4. queryRoomRelationships 的資料結構處理
- **Vue2**：`res.data.relationships.forEach(...)`（使用 `res.data.relationships`）
- **Vue3**：`res.data.relationships.forEach(...)`（正確）
- **狀態**：✅ 一致

#### 5. setMessageData 的資料結構處理
- **Vue2**：`res.data.forEach(...)` 和 `this.messageData = res.data`
- **Vue3**：`res.data.forEach(...)` 和 `messageData.value = res.data`
- **狀態**：✅ 一致

#### 6. submitForm3 的驗證時機
- **Vue2**：先驗證，驗證通過後才 `closeDialogForm3()`，然後呼叫 API
- **Vue3**：先 `closeDialogForm3()`，然後才呼叫 API（沒有表單驗證）
- **問題**：Vue3 缺少表單驗證步驟

#### 7. searchMessage 的驗證時機
- **Vue2**：使用 `(this.$refs["dataForm2"] as Form).validate(async(valid) => { if (valid) { ... } })`
- **Vue3**：直接執行，沒有表單驗證
- **問題**：Vue3 缺少表單驗證步驟

#### 8. submitForm 的驗證時機
- **Vue2**：使用 `(this.$refs["dataForm"] as Form).validate(async(valid) => { if (valid) { ... } })`
- **Vue3**：直接執行，沒有表單驗證
- **問題**：Vue3 缺少表單驗證步驟

#### 9. submitForm5 的驗證時機
- **Vue2**：使用 `(this.$refs["dataForm5"] as Form).validate(async(valid) => { if (valid) { ... } })`
- **Vue3**：直接執行，沒有表單驗證
- **問題**：Vue3 缺少表單驗證步驟

#### 10. Dialog2 的 FastDatePicker 組件
- **Vue2**：使用 `<FastDatePicker @changed="onDateChanged" />`
- **Vue3**：使用 `<a-date-picker>`，但沒有 FastDatePicker 的快速選擇功能
- **問題**：功能不完全對齊

#### 11. Dialog2 的資料初始化
- **Vue2**：`dataForm2.startTime = new Date()`（Date 物件）
- **Vue3**：`dataForm2.startTime = dayjs()`（Dayjs 物件）
- **問題**：型別不一致，但功能應該相同

#### 12. extraDataInit 的按鈕組態邏輯
- **Vue2**：根據 `getAuthLevel` 決定按鈕組態
  - `getAuthLevel < 4`：顯示 4 個按鈕（廣播、歷史訊息、編輯、禁言）
  - `getAuthLevel > 1`：顯示 3 個按鈕（歷史訊息、編輯、禁言）
- **Vue3**：只根據 `getAuthLevel.value < 4` 決定是否顯示廣播按鈕
- **問題**：Vue3 的邏輯不完整，應該也要處理 `getAuthLevel > 1` 的情況

#### 13. clickMuteUser / clickUnMuteUser 的訊息提示
- **Vue2**：沒有顯示成功/失敗訊息
- **Vue3**：有顯示 `message.success/error`
- **問題**：Vue3 多加了訊息提示，但這可能是改進，需要確認是否應該移除

#### 14. submitForm5 的訊息提示
- **Vue2**：沒有顯示成功/失敗訊息
- **Vue3**：有顯示 `message.success/error`
- **問題**：Vue3 多加了訊息提示

## 【Step 3】需要修正的項目

### 高優先級（行為不一致）

1. **表格資料來源**：移除 `data-request`，改用 `:data` 直接綁定
2. **getTreasureItemList**：修正資料結構，使用 `res.data.rows`
3. **表單驗證**：所有 submit 函數都需要加入表單驗證
4. **extraDataInit**：修正按鈕組態邏輯，對齊 Vue2 的權限判斷

### 中優先級（可能影響功能）

5. **getRooms**：確認 API 回傳格式，是否需要檢查 `res.data`
6. **clickMuteUser/clickUnMuteUser**：確認是否需要移除訊息提示
7. **submitForm5**：確認是否需要移除訊息提示

### 低優先級（UI/UX 差異）

8. **FastDatePicker**：需要確認是否要實作快速選擇功能
9. **dataForm2.startTime**：型別從 Date 改為 Dayjs，功能應該相同









