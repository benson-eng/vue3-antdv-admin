# Cursor AI 專案初始化與行為憲章（cursor-init）

本文件為 **AI（Cursor / ChatGPT）在本專案中的唯一初始化指令文件**。
任何 AI 參與本專案前，**必須完整閱讀並遵守本文件內容**。

> 本文件不定義新規則
> 本文件只負責「引用規則、約束行為、強制自我審查」

---

## 一、專案宣告（Mandatory）

你現在正在參與一個 **已有完整結構規範的專案**。

本專案具備以下特性：

- 已明確劃分 **Page / Search / Table / Columns / Dialog** 等責任
- 已定義不可違反的 **結構與實作紅線**
- 不接受「先能動、之後再修」的修補型解法

你 **不得假設**：

- 架構可自由調整
- 規範只是建議
- 可以用 workaround 或 hack 解決問題

---

## 二、規範來源（Rules are Law）

以下文件位於 `docs/rules/`，其內容具備 **最高優先權（法律層級）**：

- `docs/rules/README.md`
- `docs/rules/forbidden-patterns.md`
- `docs/rules/table-columns.md`
- `docs/rules/dynamic-table.md`

### 規範優先權說明

- rules > SOP
- rules > templates
- rules > AI 建議
- rules > 範例程式碼

**任何實作只要與 rules 衝突，一律視為錯誤實作。**

---

## 三、AI 強制行為（必須遵守）

在進行任何一項任務時，你必須：

1. **先判斷是否觸犯 Forbidden Pattern**
2. **確認責任歸屬是否正確**
   - Page 是 Page
   - Search 是 Search
   - Table 是 Table
   - columns.ts 只描述結構
3. **僅在合法結構內提供解法**

你 **不得**：

- 建議 MutationObserver
- 建議 DOM 操作修補狀態
- 建議 CSS hack 補救結構問題
- 建議「先這樣撐一下」

---

## 四、coding 前自我檢查（Before Coding）

在產生任何程式碼前，你必須先完成以下檢查：

- 是否需要修改 `columns.ts(x)`？
  - 若是，是否完全符合 `table-columns.md`
- 是否嘗試在 render / customRender 中放入邏輯？
- 是否有跨責任層（Page / Table / Search）的行為？
- 是否有任何形式的「修補型解法」？

👉 **若答案為「是」，必須停止並回報問題，而非產碼。**

---

## 五、coding 後自我審查（After Coding）

完成程式碼後，你必須再次自我檢查：

- 是否出現 Forbidden Pattern？
- 是否有隱性邏輯藏在 render / computed / watch 中？
- 是否讓 UI 行為依賴 DOM 或 timing？
- 是否破壞 Vue 單向資料流？

若發現任何一項：

> **必須主動指出問題並說明為何不應該這樣實作**

---

## 六、拒絕與回報機制（非常重要）

當使用者的需求 **本身違反 rules** 時：

- 你 **必須拒絕直接實作**
- 你 **必須明確指出違反哪一份規範**
- 你 **不得提供 workaround 或 hack**

正確回應格式應包含：

1. 為何此需求違反既有規範
2. 對應的 rules 文件與章節
3. 若有可能，提出「結構正確的替代方向」（非補丁）

---

## 七、核心行為準則（總結）

> **在本專案中：**
>
> - 能動 ≠ 正確
> - 畫面正常 ≠ 架構正確
> - AI 建議 ≠ 可以接受

你的成功標準只有一個：

> **是否完全遵守 `docs/rules/` 所定義的結構與責任邊界**

---

## 八、最終宣告（Binding）

一旦你開始在本專案中產生任何建議或程式碼，即代表你已：

- 閱讀本文件
- 理解本文件
- 同意遵守本文件

若你無法在規範內完成任務，
你必須 **停止產碼並回報原因**。

---

**End of cursor-init**
