# Page API Query Bar 規範（page-api-query-bar）

## 目的（Why）

在後台頁面中，常見以下混亂情況：

- Context（資料上下文）與查詢條件混在「搜尋區」
- 必要與非必要條件語意不清
- 切換資料歸屬卻未重新載入資料
- 搜尋、查詢、表格過濾行為混用
- UI 看起來在查資料，實際只是在過濾表格

本文件用於**統一定義 API 查詢相關欄位的顯示方式與行為規則**，
作為後台頁面查詢行為的最高準則。

---

## 核心概念（Core Concept）

### API Query Bar 定義

> **API Query Bar = 所有會進入 API payload 的欄位集合**

- 顯示上可為單一區塊或單行
- 行為上必須區分 Context 與 Query
- 不包含任何僅影響前端顯示的欄位

---

## 欄位角色定義（Field Roles）

### 1️⃣ Context Selector（資料上下文選擇）

**用途**
- 決定此頁面目前在操作哪一包資料（Data Scope）

**判斷標準**
> 改變此欄位後，舊資料是否仍然合理？  
否 → Context Selector

**行為規則**
- 通常為必選（或有預設）
- 改變時：
  - 清空資料表
  - 重置 Query 條件（視頁面需求）
  - 依查詢模式決定是否自動載入

**常見例子**
- 站長（Master Agent）
- 站台
- 專案 / 系統來源

---

### 2️⃣ Query Trigger（查詢條件）

**用途**
- 組成 API 查詢條件，用於限縮結果

**特徵**
- 可同時包含必要與非必要欄位
- 非必要欄位未填時，不帶入 API payload
- 不得即時觸發 API
- 通常搭配「查詢」按鈕

**常見例子**
- 時間區間
- 查詢類型 / 狀態（查詢用）

---

### 3️⃣ Table Filter（資料表過濾）

> ❌ 不屬於 API Query Bar

**用途**
- 僅影響前端資料顯示
- 不影響 API payload

**特徵**
- 不重新打 API
- 可即時反應
- 可顯示 / 隱藏

**常見例子**
- 關鍵字搜尋
- 狀態顯示
- 代理商過濾

---

## 顯示規範（UI Rules）

### API Query Bar

- Context Selector 與 Query Trigger **可以顯示在同一區塊 / 同一列**
- 顯示合併不代表行為合併
- API Query Bar 不建議隱藏

**建議排列方式**
```
[ Context Selector ] [ Query A ] [ Query B ]        [ 查詢 ]
```

---

## 查詢模式（Query Mode）

每個頁面需明確指定查詢模式：

### Mode 1：Auto
- Context 或 Query 任一變更即自動查詢

### Mode 2：Semi（推薦）
- Context 變更 → 自動查詢
- Query 變更 → 點「查詢」才查

### Mode 3：Manual
- 所有條件變更皆不自動查詢
- 一律點「查詢」

---

## 行為鐵則（Behavior Rules）

### Context Selector
- 改變時：
  - 清空 table data
  - 清空 Table Filter
  - 依 Query Mode 決定是否查詢

### Query Trigger
- 不得 watch 即時打 API
- 僅在點擊「查詢」時觸發
- 僅帶入已填寫欄位

### Table Filter
- 不得觸發 API
- 不得影響 Query 狀態
- 僅作用於前端資料

---

## 頁面分類範例（Examples）

### 範例 1：站台管理
- Context Selector：無
- Query Trigger：無
- Table Filter：有

➡ 進頁即載入資料

---

### 範例 2：代理商管理
- Context Selector：站長
- Query Trigger：條件 A / B
- Table Filter：代理商 / 狀態

➡ Context 與 Query 顯示於同一 API Query Bar

---

### 範例 3：報表頁
- Context Selector：站台
- Query Trigger：時間區間（必填）
- Table Filter：少量或無

➡ 必須完成查詢條件後才載入資料

---

## 禁止事項（Anti-Patterns）

- ❌ 將 Context Selector 放入 Table Filter
- ❌ Filter 觸發 API
- ❌ Context 變更但保留舊資料
- ❌ 必要查詢條件卻自動載入資料

---

## 結語

> **凡是會進 API payload 的欄位，都屬於 API Query Bar；  
凡是只影響顯示的欄位，一律獨立。**

本文件為後台查詢行為的最高準則。
