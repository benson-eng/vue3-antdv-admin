# Page / Table 開發流程（Page–Table Dev Flow）

本文件定義在本專案中，**人類開發者**建立或轉換一個「列表型頁面」時，
必須遵循的 **標準開發流程（SOP）**。

> 本文件回答的不是「可不可以這樣寫」，
> 而是：
> **「在法律（docs/rules）已成立的前提下，實際應該怎麼做事？」**

---

## 一、適用範圍

本 SOP 適用於以下情境：

- 新增一個列表頁（List / Table Page）
- Vue2 → Vue3 列表頁轉換
- 調整既有列表頁的查詢、欄位或行為

不適用於：

- 純 UI demo
- 非資料導向頁面（純展示頁）

---

## 二、核心原則（先讀）

在開始任何實作前，請確認以下三件事：

1. **rules 是法律，不是建議**
2. **SOP 是流程，不是捷徑**
3. **不能為了快而破壞結構**

> 若某一步驟讓你「很想補一下撐住」，
> 請立刻回頭檢查是否踩到 `forbidden-patterns.md`。

---

## 三、標準開發流程（Step by Step）

### Step 0：確認責任邊界（必做）

在寫任何 code 前，先用一句話回答：

- Page：負責什麼？
- Search：負責什麼？
- Table：負責什麼？
- columns.ts：負責什麼？

若你無法清楚說出來，**禁止開始寫 code**。

---

### Step 1：建立 Page 結構（不碰 Table）

此階段只做：

- 建立 page 檔案
- 定義頁面基本 layout
- 決定是否需要 Search 區

❌ 不做的事：

- 不定義欄位
- 不寫 Table 邏輯
- 不處理資料轉換

---

### Step 2：定義 columns.ts（欄位法律）

建立或調整 `columns.ts(x)`，並嚴格遵守：

- `docs/rules/table-columns.md`
- 欄位是否存在 → 此階段就決定
- 查詢欄位 → 只能用 `formItemProps`

❌ 禁止：

- 在 render 判斷權限
- 在 customRender 放業務邏輯
- 在 columns.ts 讀取外部狀態

> **columns.ts 完成後，欄位結構即視為「定案」**

---

### Step 3：接 DynamicTable（不加工資料）

在 Page 中接上 `DynamicTable`：

- 使用正確的 prop（如 `data-request`）
- 不在 Page 中轉換 table 資料格式
- 不手動 reload 表格

資料格式若不符，**回到 API / adapter 層處理**。

---

### Step 4：處理 Search（僅接線）

Search 的來源只有一個：

- `columns.ts` 中的 `formItemProps`

Page 只負責：

- 接收查詢條件
- 傳遞給 table / data-request

❌ 禁止：

- 在 template 手動插入 input
- 在 Page 拼湊查詢欄位
- 在 Search 中操作 Table 狀態

---

### Step 5：檢查 Forbidden Patterns（強制）

在功能看起來「可以動」之後，**必須檢查一次**：

- 是否有 DOM 操作？
- 是否有 CSS 補救？
- 是否有 reload / setTimeout？
- 是否有「先撐一下」的 code？

👉 若有任一項，**必須回到前面步驟重做**。

---

## 四、Vue2 → Vue3 轉換補充流程

在轉換情境下，允許：

- 使用 adapter 模擬 Vue2 回傳格式
- 暫時保留舊欄位順序或命名
- 集中處理 legacy 行為（可整包移除）

但必須遵守：

- 不污染新結構
- 不在 render / DOM 層補救
- 必須清楚標註 migration 註解

---

## 五、完成判定標準（Done Definition）

一個 Page / Table 開發或轉換完成，必須同時滿足：

- 功能正常
- 沒有 Forbidden Pattern
- columns.ts 可單獨閱讀理解
- 移除任何 migration code 不會破壞新結構

> **完成標準不是「畫面正常」，而是「結構正確」。**

---

## 六、常見錯誤提醒（務必避免）

- 為了快，在 mounted 補資料
- 在 render 裡判斷權限
- 用 CSS 解決本該由結構處理的問題
- 把轉換期例外散落在各處

---

## 七、與其他文件的關係

- 本文件 **服從** `docs/rules/*`
- 本文件 **指導** 人類如何實作
- 若 SOP 與 rules 衝突：
  - 以 rules 為準

---

## 八、一句話總結

> **照法律做事，流程自然會順；
> 流程走不通，代表你走錯層了。**
