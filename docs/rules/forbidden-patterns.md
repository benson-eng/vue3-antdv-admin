# 禁止實作模式（Forbidden Patterns）

本文件定義在本專案中 **明確禁止使用的實作模式**。
凡出現以下任一模式，皆視為 **結構或責任設計錯誤**，必須回頭修正。

> 本文件用來回答一個問題：
> **「哪些做法，就算能動，也一定會出事？」**

---

## 一、DOM 修補型解法（全面禁止）

### ❌ 使用 MutationObserver 修正 UI / Layout 行為

```ts
// ❌ 禁止
const observer = new MutationObserver(() => {
  // 嘗試修正 DOM 位置或狀態
});
observer.observe(target, { childList: true });
```

### 禁止原因：

MutationObserver 屬於事後補救

代表結構與責任分離失敗

在搜尋、分頁、重載時極易失效

正確方向：

回到 Page / Search / Table 的責任劃分

修正元件層級與資料流，而非監聽 DOM

---

## 二、CSS / Layout 修補型解法（全面禁止）

### ❌ 使用 sticky / overflow hack 補救錯誤結構

```css
/* ❌ 禁止 */
.table-wrapper {
  position: sticky;
  top: 0;
}

```

### 禁止行為包含：

- 為了固定搜尋區，對 table 容器加 sticky

- 用 overflow/height hack 掩蓋跑版

- 多層巢狀 sticky 疊加

### 禁止原因：

- sticky 是 Page 層責任，不是 Table 層

- CSS 無法修正結構責任錯置

- 會造成 scroll 行為不可預期

---

## 三、DynamicTable 錯誤使用方式（禁止）

### ❌ 使用錯誤的資料綁定屬性

```vue
<!-- ❌ 禁止 -->
<DynamicTable :get-list-func="loadTableData" />
```

### 唯一合法方式：

```vue
<DynamicTable :data-request="loadTableData" />
```

---

### ❌ 在 loadTableData 中手動轉換資料結構（一般情境）

```vue
// ❌ 禁止（一般情境）
return {
  list: data.items,
  total: data.meta.totalItems,
};
```

### 說明：

- DynamicTable 已定義標準回傳格式

- 手動轉換會造成行為不一致

> ⚠️ 例外：
> 若為 Vue2 → Vue3 轉換期行為模擬，
> 且已明確標註目的，才允許集中處理（見轉換期規範）。

---

### ❌ 在 onMounted 中強制 reload 表格

```ts
// ❌ 禁止
onMounted(() => {
  tableInstance?.reload();
});
```

### 禁止原因：

- DynamicTable 會自動進行首次載入

- 手動 reload 多半代表流程誤解

---

## 四、DOM / 狀態強制同步（全面禁止）

### ❌ 使用 JS 操作 DOM 來同步狀態

```ts
// ❌ 禁止
document.querySelector('.row')?.classList.add('active');
```

### 禁止原因：

- 破壞 Vue 單向資料流

- 狀態不可追蹤、不可測試

- 長期維護成本極高

---

## 五、Search / Table 責任混用（禁止）

### ❌ 將搜尋區放入 Table 結構中

```vue
<!-- ❌ 禁止 -->
<DynamicTable>
  <SearchForm />
</DynamicTable>
```

### 正確責任劃分：

- Search 屬於 Page

- Table 僅負責資料顯示

---

## 六、欄位顯示的錯誤處理方式（禁止）

### ❌ 以 render / CSS / DOM 判斷權限來隱藏欄位

```ts
// ❌ 禁止
customRender: () => userLevel === 1 ? 'xxx' : null;
```

```css
/* ❌ 禁止 */
.hidden-column {
  display: none;
}

```

### 正確方式：

- 欄位是否存在，必須在 columns 定義階段 決定

- 使用條件式組裝 columns（而非事後隱藏）

---

## 七、AI 常見「看似合理但必須拒絕」的建議（重要）

以下說法 一律視為 Forbidden Pattern，即使 AI 建議也必須拒絕：

- 「先用 MutationObserver 撐一下」

- 「加個 setTimeout 等 DOM ready 再處理」

- 「CSS 補一下比較快」

- 「不影響功能就先這樣」

> 凡是「先撐、先補、先能動」的解法，
> 都代表設計方向錯誤。

---

## 八、處理原則（統一行為準則）

當遇到 Forbidden Pattern 時，必須遵循以下順序：

1. ❌ 不接受修補型解法

2. 🔍 檢查責任是否錯置（Page / Search / Table）

3. 🧱 修正結構與資料流

4. ✅ 以「結構正確」為完成標準，而非「畫面看起來正常」

---

## 九、Readonly 模式的資料流規範（強制）

Readonly 模式不得僅依賴 UI disabled 屬性。

以下行為一律禁止：

- 僅使用 `:disabled` 來實作 readonly
- 在 readonly 模式下仍透過 `v-model` / `emit` / `computed setter` 寫回父層資料
- 透過 `watch`、初始化流程或副作用間接修改父層資料
- 切換 step / tab 時導致父層 record 被異動

正確做法：

- Readonly 模式必須在「資料寫入路徑」中斷
- Step 組件應使用 local 副本（localForm），或 readonly-safe setter
- 檢視模式下，任何 Step 不得改變父層 record 狀態
- UI disabled 僅為輔助行為，不得作為唯一 readonly 保證

---

## 十、規範優先權說明

- 本文件位於 docs/rules

- 優先權高於：

  - SOP

  - 範例程式碼

  - AI 建議

- 若任何實作與本文件衝突，一律視為錯誤實作

---

---

## Appendix A：Table Columns 專屬 Forbidden Patterns

本附錄為 `rules/table-columns.md` 的**強制禁止對應清單**。
凡違反以下任一項，視為 **columns.ts(x) 結構設計錯誤**。

---

### A-1 ❌ 在 columns.ts(x) 內出現業務邏輯

以下行為一律禁止：

- 在 `customRender` 中撰寫 if / else 業務判斷
- 根據 row 資料改變欄位意義
- 根據資料內容決定是否顯示欄位
- 在 column 中拼湊、加工 API 回傳資料

> columns.ts 僅能描述「欄位結構」，不得承載「語意邏輯」。

---

### A-2 ❌ 在 columns.ts(x) 出現任何顯示文字（i18n 違規）

包含但不限於：

- `title: '帳號'`
- `customRender` 直接回傳 `'啟用' / '停用'`
- Tag / Button / Text 內硬編碼文字

正確方式：

- 一律使用 i18n key
- 或交由外部 render helper 處理顯示文字

---

### A-3 ❌ 在 customRender 中處理權限或角色判斷

```ts
// ❌ 禁止
customRender: () => userLevel === 1 ? 'xxx' : null;
```

權限只能影響：

- 欄位是否被加入 columns

- 不得影響欄位行為或語意

### A-4 ❌ 在非 columns.ts 的地方控制查詢欄位顯示

以下行為一律禁止：

- 在 Page template 中手動插入查詢 input

- 在 useTable 外層加工查詢 UI

- 在 component 中自行拼湊查詢欄位

唯一合法來源：

- columns.ts(x) 中的 formItemProps

---

### A-5 ❌ 在 columns.ts(x) 存取任何外部狀態

包含但不限於：

- store

- route / query

- window / document

- component instance

columns.ts(x) 必須為 純結構描述檔案。

---

### A-6 判斷原則（給 AI / Code Review）

只要在 columns.ts 看到「看起來像邏輯的東西」，一律判定為 Forbidden。
