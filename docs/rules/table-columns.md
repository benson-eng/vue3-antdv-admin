# Table Columns 規範（Table Columns Rules）

> 本文件用於規範後台列表頁（Dynamic Table / Ant Design Vue Table）中
> **columns.ts / columns.tsx** 的撰寫方式與行為約束。
> 目的在於：**消除隱性規則、確保 Vue2 / Vue3 對齊、避免 UI 與 API 行為漂移**。

## 1. 檔案職責（Single Responsibility）

`columns.ts(x)` **只負責欄位結構定義**，不得包含任何業務或狀態邏輯。

### ❌ 禁止內容

- API 呼叫
- 資料轉換與加工邏輯
- 狀態管理（store / ref / reactive）
- component instance 操作
- route / query / window / document

### ✅ 允許內容

- `title`
- `dataIndex`
- `width / align`
- `customRender`（僅顯示層）
- `formItemProps`
- 欄位層級的條件顯示（權限）

## 2. title 規範（i18n 強制）

### 2.1 禁止硬編碼文字

```ts
// ❌ 禁止
title: '帳號';
```

### 2.2 title 僅作為語意 key

- title 不可直接顯示文字

- 實際顯示內容由 i18n 決定

  - Vue2：adminAccount.column.xxx

  - Vue3：pt('column.xxx')

---

## 3. dataIndex 規範（API 對齊）

### 3.1 dataIndex 必須 100% 對應後端回傳欄位

```ts
dataIndex: 'account';
```

#### ❌ 禁止行為

- 臆造欄位名稱

- 在 column 內組合資料

- 在 customRender 中拼湊業務資料

> 資料轉換必須在：

> - API adapter

> - list data processor

> - useTable 的 beforeFetch / afterFetch

---

## 4. customRender 使用規範

### 4.1 僅限「顯示層轉換」

### ✅ 允許用途

- enum → 文字

- boolean → Tag / Icon

- 狀態顏色顯示

```ts
customRender: ({ text }) => {
  return text
    ? h(Tag, { color: 'green' }, () => '啟用')
    : h(Tag, { color: 'red' }, () => '停用');
};
```

## ❌ 禁止用途

- 發 API

- 修改資料

- 依賴 store / route / 外部狀態

---

## 5. formItemProps 規範（查詢區）

### 5.1 是否可查詢的唯一判斷依據

```ts
formItemProps: {
  component: 'Input',
}
```

- 有 formItemProps → 顯示在查詢區

- 無 formItemProps → 僅列表顯示

---

## 5.2 component 類型限制

### ✅ 允許的 component

- Input

- InputNumber

- Select

- DatePicker

- RangePicker

### ❌ 禁止

- 自訂 component

- 在 columns.ts 內 import UI 元件

---

## 6. 權限與條件顯示規範

### 6.1 權限只影響「是否顯示欄位」

```ts
if (userLevel < 3) {
  columns.push(adminOnlyColumn);
}
```

### ❌ 禁止

- 在 customRender 判斷權限

- 同一欄位依權限改變行為或意義

---

## 7. 欄位順序建議（UX 一致性）

建議欄位排列順序：

1. 核心識別欄位（account / id）

2. 名稱 / 描述

3. 狀態

4. 數值 / 統計

5. 時間欄位

6. 操作欄位（action）

---

## 8. 時間欄位統一規範

### 8.1 僅允許以下欄位名稱

- createdAt

- updatedAt

- deletedAt

### 8.2 無資料時的顯示規則

```ts
customRender: ({ text }) => text || '-';
```

### ❌ 禁止顯示

- Invalid Date

- 1970-01-01

- 空字串造成版面抖動

---

## 9. 明確禁止的行為（Forbidden）

columns.ts(x) 嚴禁出現以下內容：

- 呼叫 useI18n()（只能接收 pt 參數）

- import store

- 存取 route / query

- 使用 window / document

- 操作 DOM

---

## 10. 建議的 columns.ts 結構範例

```ts
export const getBaseColumns = (
  pt: (key: string) => string,
  userLevel: number,
): TableColumnItem[] => {
  const columns: TableColumnItem[] = [
    {
      title: pt('column.account'),
      dataIndex: 'account',
      formItemProps: {
        component: 'Input',
      },
    },
  ];

  if (userLevel < 3) {
    columns.push({
      title: pt('column.status'),
      dataIndex: 'status',
      customRender: ({ text }) => renderStatusTag(text),
    });
  }

  return columns;
};
```

---

## 11. 核心原則總結

> columns.ts(x) 是「描述 UI 結構」，不是「執行業務邏輯」

- 結構清楚

- 行為可預期

- Vue2 / Vue3 可對齊

- API / UI / 權限邊界明確

---

## 12. 給 AI / Code Review 的一句話規則

「任何看起來像邏輯的東西，都不該出現在 columns.ts。」
