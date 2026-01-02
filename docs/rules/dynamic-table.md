# DynamicTable 使用規範（Rules）

本文件定義 DynamicTable / useTable 在本專案中的 **唯一合法使用方式**。
凡違反本文件規範之實作，皆視為結構錯誤，必須修正。

---

## 一、DynamicTable 的角色定位（不可混用）

### DynamicTable 是什麼？

- 資料呈現元件（Table Layer）
- 負責：
  - 資料顯示
  - 分頁
  - 排序
  - 列操作（actions）

### DynamicTable 不是什麼？

- ❌ 不是頁面容器
- ❌ 不負責搜尋區定位
- ❌ 不負責 sticky 行為
- ❌ 不負責 layout 結構

---

## 二、Page / Search / Table 結構責任（強制）

### 正確結構責任劃分

| 層級   | 責任                       |
| ------ | -------------------------- |
| Page   | 版型、sticky、區塊順序     |
| Search | 查詢條件、欄位排列         |
| Table  | 資料顯示、scroll、row 操作 |

### ❌ 禁止結構

- Search 區塊放入 table scroll container
- 由 DynamicTable 自行處理 sticky
- 用 CSS / JS 補救錯誤結構

---

## 三、搜尋區（Search Area）規範

### 必須遵守

- 搜尋區 **必須位於 page 層**
- 搜尋區 **不得** 位於 table scroll container 內
- 搜尋區 **不得** 使用 MutationObserver 修正位置

### 結論一句話

> 搜尋區是 Page 的責任，不是 Table 的責任

---

## 四、資料載入規範（強制）

### 唯一合法綁定方式

```vue
<DynamicTable :data-request="loadTableData" />
```

### 禁止使用

```
:get-list-func
```

## 五、loadTableData 規範（非常重要）

### 正確寫法

```
const loadTableData = async (params: LoadDataParams) => {
  const data = await Api.xxx.list(params);
  return data; // 必須直接回傳 API 結果
};
```

### 禁止行為

❌ 手動轉換為 { list, total }

❌ 在 onMounted 中手動呼叫 reload()

❌ 在此處處理 UI 狀態（如 sticky、scroll 修正）

## 六、rowSelection 使用規範

### 正確方式

使用 rowSelection ref 管理選中狀態

在 loadTableData 中清空選中狀態

```
rowSelection.value.selectedRowKeys = [];
```

### 禁止方式

❌ 使用 getSelectRowKeys()

## 七、欄位顯示 / 搜尋規範

規則對照表
使用情境 設定方式
僅顯示於表格 hideInSearch: true
僅顯示於搜尋 hideInTable: true
時間顯示欄位 必須 hideInSearch: true
時間搜尋欄位 使用 RangePicker

## 八、禁止修補型解法（重申）

以下行為在 DynamicTable 使用中 一律禁止：

使用 MutationObserver 修正搜尋區或 layout 行為

使用 sticky / overflow hack 補救錯誤結構

使用 JS 強制同步 DOM 狀態

若需要此類解法，代表結構設計錯誤，
必須回到 Page / Search / Table 的責任劃分重新調整。
