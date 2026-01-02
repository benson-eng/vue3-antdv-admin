# 幣別 API 導入報告

**檢查日期：** 2025-12-16  
**模組：** adminAccount / 幣別管理（Currency）  
**目的：** 導入 Vue2 版本的 4 個 API 函式（getCurrencyType, createCurrencyType, updateCurrencyType, deleteCurrencyType）並對應到現有的 RESTful API 結構

---

## API 對應關係

| Vue2 API 函式 | Vue2 路徑 | Vue3 對應函式 | Vue3 路徑 | 說明 |
|--------------|----------|--------------|----------|------|
| `getCurrencyType` | `POST /AdminSystem/api/getCurrencyType` | `getCurrencyType` | `POST /AdminSystem/api/getCurrencyType` | 查詢幣別列表（支援 masterAgent 過濾） |
| `createCurrencyType` | `POST /AdminSystem/api/createCurrencyType` | `createCurrencyType` | `POST /AdminSystem/api/createCurrencyType` | 新增幣別 |
| `updateCurrencyType` | `POST /AdminSystem/api/updateCurrencyType` | `updateCurrencyType` | `POST /AdminSystem/api/updateCurrencyType` | 更新幣別（需 id, currencyName, currencySymbol） |
| `deleteCurrencyType` | `POST /AdminSystem/api/deleteCurrencyType` | `deleteCurrencyType` | `POST /AdminSystem/api/deleteCurrencyType` | 刪除幣別（需 id, masterAgent） |

**對應到現有函式：**
- `getCurrencyType` → 對應 `list` (line 59)
- `createCurrencyType` → 對應 `create` (line 60)
- `updateCurrencyType` → 對應 `update` (line 61)
- `deleteCurrencyType` → 對應 `delete` (line 62)

---

## 檔案更新清單

### 1. `src/api/backend/adminAccount/currency.ts`

**新增內容：**
- 新增 `ICurrency` 介面（對應 Vue2 的 ICurrency 類型）
- 新增 `getCurrencyType` 函式：查詢幣別列表，支援 `masterAgent` 參數過濾
- 新增 `createCurrencyType` 函式：新增幣別，使用 `ICurrency` 類型
- 新增 `updateCurrencyType` 函式：更新幣別，參數包含 `id`, `currencyName`, `currencySymbol`
- 新增 `deleteCurrencyType` 函式：刪除幣別，參數包含 `id`, `masterAgent`
- 更新 `CurrencyItem` 介面：新增 `currencySymbol?` 和 `masterAgent?` 欄位
- 更新 `default` export：新增 4 個新函式的導出

**API 路徑：**
- 所有 Vue2 API 保持使用 `/AdminSystem/api/*` 路徑
- 透過 `src/utils/mockSwitch.ts` 自動映射到 `/api/adminAccount/currency`（mock 模式）

### 2. `src/utils/mockSwitch.ts`

**新增映射：**
```typescript
'/AdminSystem/api/getCurrencyType': '/api/adminAccount/currency',
'/AdminSystem/api/createCurrencyType': '/api/adminAccount/currency',
'/AdminSystem/api/updateCurrencyType': '/api/adminAccount/currency',
'/AdminSystem/api/deleteCurrencyType': '/api/adminAccount/currency',
```

**說明：**
- 在 mock 模式下，所有 `/AdminSystem/api/*` 的幣別相關請求會自動轉換為 `/api/adminAccount/currency`
- 實際連線模式下，直接使用原始 `/AdminSystem/api/*` 路徑

### 3. `mocks/adminAccountCurrency.ts`

**更新內容：**
- 更新 `CurrencyItem` 介面：新增 `currencySymbol?` 和 `masterAgent?` 欄位
- 更新 POST handler：統一處理所有 POST 請求，根據 request body 判斷操作類型
  - `getCurrencyType`: 只有 `masterAgent`，返回過濾後的列表
  - `createCurrencyType`: 有 `currencyName` 和 `currencySymbol`，新增資料
  - `updateCurrencyType`: 有 `id`, `currencyName`, `currencySymbol`，更新資料
  - `deleteCurrencyType`: 有 `id` 和 `masterAgent`，刪除資料
- 保持現有的 GET、PUT、DELETE handlers 不變（用於 RESTful API）

---

## 類型定義

### ICurrency 介面
```typescript
export interface ICurrency {
  id?: number;
  currencyName: string;
  currencySymbol: string;
  masterAgent?: string;
}
```

### CurrencyItem 介面（更新後）
```typescript
export interface CurrencyItem {
  id: number;
  account: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol?: string;  // 新增
  status: number;
  orderNo: number;
  createdAt: string;
  masterAgent?: string;  // 新增
}
```

---

## Mock 處理邏輯

### POST `/api/adminAccount/currency` Handler

根據 request body 結構自動判斷操作類型：

1. **查詢（getCurrencyType）**
   - Body: `{ masterAgent?: string }`
   - 返回：過濾後的幣別列表（支援分頁）

2. **新增（createCurrencyType）**
   - Body: `{ currencyName: string; currencySymbol: string; masterAgent?: string }`
   - 返回：新增的幣別資料

3. **更新（updateCurrencyType）**
   - Body: `{ id: number; currencyName: string; currencySymbol: string }`
   - 返回：更新後的幣別資料

4. **刪除（deleteCurrencyType）**
   - Body: `{ id: number; masterAgent: string }`
   - 返回：刪除成功訊息

---

## 驗證結果

### TypeScript / ESLint 檢查
- ✅ `src/api/backend/adminAccount/currency.ts`: 無錯誤
- ✅ `mocks/adminAccountCurrency.ts`: 無錯誤（已修復類型問題）
- ✅ `src/utils/mockSwitch.ts`: 無錯誤

### 功能驗證建議
1. 在 mock 模式 (`VITE_ENABLE_MOCK=true`) 下測試：
   - `getCurrencyType({ masterAgent: 'salesacc1' })` 應返回過濾後的列表
   - `createCurrencyType({ currencyName: 'TWD', currencySymbol: 'NT$' })` 應成功新增
   - `updateCurrencyType({ id: 1, currencyName: 'CNY', currencySymbol: '¥' })` 應成功更新
   - `deleteCurrencyType({ id: 1, masterAgent: 'salesacc1' })` 應成功刪除

2. 確認所有 API 函式都已正確導出在 `Api.adminAccount.currency` 物件中

---

## 使用範例

### 前端呼叫方式

```typescript
import Api from '@/api';

// 查詢幣別列表
const result = await Api.adminAccount.currency.getCurrencyType({ 
  masterAgent: 'salesacc1' 
});

// 新增幣別
const newCurrency = await Api.adminAccount.currency.createCurrencyType({
  currencyName: 'TWD',
  currencySymbol: 'NT$',
  masterAgent: 'salesacc1'
});

// 更新幣別
const updated = await Api.adminAccount.currency.updateCurrencyType({
  id: 1,
  currencyName: 'CNY',
  currencySymbol: '¥'
});

// 刪除幣別
await Api.adminAccount.currency.deleteCurrencyType({
  id: 1,
  masterAgent: 'salesacc1'
});
```

---

## 注意事項

1. **路徑轉換**：Vue2 API 使用 `/AdminSystem/api/*` 路徑，在 mock 模式下會自動轉換為 `/api/adminAccount/currency`
2. **請求方法**：Vue2 API 全部使用 POST 方法，與 RESTful API（GET/PUT/DELETE）不同
3. **參數格式**：Vue2 API 的參數格式與 RESTful API 不同，需注意參數結構
4. **向後相容**：現有的 RESTful API（`list`, `create`, `update`, `delete`）保持不變，可繼續使用

---

## 後續建議

1. 考慮將 Vue2 API 逐步遷移到 RESTful API 格式
2. 統一使用 RESTful API 的命名和參數格式
3. 在實際連線模式下測試所有 API 端點
4. 更新相關文件和使用範例

---

**報告完成時間：** 2025-12-16
