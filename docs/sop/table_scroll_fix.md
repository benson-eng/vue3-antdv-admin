# Table Scroll 修正 SOP

> 文件目的：
> 解決 Ant Design Vue Table 在「欄位顯示切換、只剩少量欄位」時，仍出現橫向 scrollbar、欄位壓扁或暴走的問題。
>
> 本 SOP 採用 **分層責任 + 分階段修正**，避免 DOM hack 與不可維護解法。

---

## 適用情境

- 使用 Ant Design Vue `a-table`
- 支援「列設置（顯示 / 隱藏 / 排序）」
- 有設定 `scroll.x`
- 出現以下任一問題：
  - 只剩 1~2 欄仍有橫向 scrollbar
  - 第一欄忽大忽小、暴走撐滿
  - 初始畫面欄位被壓到只剩一個字（直立文字）

---

## 核心原則（必讀）

> **scroll.x 決定的是 table 內部結構**  
> **overflow-x 決定的是 layout 是否顯示 scrollbar**

兩者責任必須分離，否則一定會出現誤判。

---

## Phase 1：統一欄位寬度角色（Column 層）

### 目標

- 防止初始 render 欄位被壓扁
- 防止第一欄無限制撐寬

### 規範

1. 僅文字型欄位可使用 `flexible`
2. 所有 `flexible` 欄位 **必須設定 `minWidth`**
3. 狀態 / Tag / 操作欄位必須使用固定 `width`
4. 不調整欄位顯示內容與順序

### 範例

```ts
{
  dataIndex: 'account',
  flexible: true,
  minWidth: 140,
}
```

### 驗收條件

- 初始畫面不再出現「一個字寬」欄位
- 不會出現直立文字

---

## Phase 2：統一 scroll.x 計算邏輯（Table Config 層）

### 目標

- scroll.x 只由欄位策略決定
- 禁止任何 DOM 量測行為

### 規範

1. 依「可見欄位」重新計算固定寬度總和
2. 若存在任一 `flexible` 欄位：
   - `scroll.x = '100%'`
3. 僅在「全部為固定欄位」時，才可使用數值 scroll.x
4. 禁止：
   - DOM 寬度監聽
   - MutationObserver
   - setTimeout

### 驗收條件

- 關閉欄位後，scroll.x 會自動切換為 `'100%'`
- 不存在 magic number

---

## Phase 3：切斷 Layout 層對 scrollbar 的誤控制（關鍵）

### 目標

- 解決「只剩一欄仍出現 scrollbar」的根本問題

### 規範

1. table 外層必須包一層 container
2. container **預設 `overflow-x: hidden`**
3. 僅當 `scroll.x !== '100%'` 時，才允許 `overflow-x: auto`
4. 禁止直接修改 `.ant-table` 內部 DOM 樣式

### 範例

```vue
<div
  class="table-container"
  :class="{ 'enable-x-scroll': scrollX !== '100%' }"
>
  <a-table :scroll="{ x: scrollX }" />
</div>
```

```css
.table-container {
  overflow-x: hidden;
}

.table-container.enable-x-scroll {
  overflow-x: auto;
}
```

### 驗收條件

- 只剩 1~2 欄時，橫向 scrollbar 完全消失
- 欄位很多時，仍可正常橫向捲動

---

## Phase 4：驗收與防回歸（收尾）

### 必須確認的行為

1. 初始進入頁面時，不論資料量多少，都不應出現橫向 scrollbar
2. 關閉欄位到 1~2 欄時，table 寬度需自適應容器
3. 欄位數增加時，橫向 scrollbar 只在必要時出現
4. 若有條件判斷，需加上註解說明原因

---

## 明確禁止事項（Forbidden Patterns）

- 使用 MutationObserver 修正 scrollbar
- 監聽 DOM scrollWidth / offsetWidth
- 使用 setTimeout 延遲修正
- 直接操作 `.ant-table-body` 樣式

以上做法皆屬「事後補救」，不可維護。

---

## 一句話總結（可寫入專案規範）

> **Table 是否出現 scrollbar，不是 UI 問題，
> 而是「欄位策略 × scroll 決策 × layout overflow」的結果。**

---

## 使用建議

- 請依 Phase 1 → Phase 4 順序逐步執行
- 每一階段都可單獨驗證與回退
- 強烈建議搭配 Cursor AI 逐步執行

