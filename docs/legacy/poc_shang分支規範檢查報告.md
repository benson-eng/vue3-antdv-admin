# poc_shang 分支規範檢查報告

**檢查日期：** 2025-01-27  
**檢查分支：** poc_shang  
**檢查文件：** `src/views/member/data/` 目錄下的頁面文件

---

## 📋 檢查摘要

| 檢查項目 | 狀態 | 說明 |
|---------|------|------|
| 頁面結構標準 | ✅ 通過 | 符合標準結構 |
| 代碼組織規範 | ⚠️ 部分符合 | Script Setup 順序需調整 |
| DynamicTable 使用 | ✅ 通過 | 使用正確 |
| SchemaForm 使用 | ✅ 通過 | 配置正確 |
| Modal 彈窗管理 | ✅ 通過 | 使用 useFormModal 正確 |
| TypeScript 類型定義 | ✅ 通過 | 類型定義完整 |
| 錯誤處理 | ✅ 通過 | 有 try-catch 處理 |
| 權限控制 | ✅ 通過 | 權限配置正確 |
| 註釋規範 | ✅ 通過 | 函數有 JSDoc 註釋 |

---

## 📁 頁面結構標準檢查

### ✅ 通過項目

1. **文件結構符合標準**
   - ✅ `index.vue` - 主頁面文件存在
   - ✅ `columns.tsx` - 表格列配置文件存在
   - ✅ `formSchemas.ts` - 表單配置文件存在

2. **文件命名規範**
   - ✅ 使用 kebab-case 命名（`member/data/`）
   - ✅ TypeScript 文件使用 camelCase（`columns.tsx`, `formSchemas.ts`）

---

## 💻 代碼組織規範檢查

### ⚠️ 需要改進項目

#### 1. Script Setup 組織順序

**規範要求：**
```typescript
// 1. Import 區塊
// 2. defineOptions
// 3. Props & Emits
// 4. 響應式數據
// 5. 計算屬性
// 6. Hooks
// 7. 方法定義
// 8. 生命週期
// 9. 配置對象（最後）
```

**當前代碼問題：**

在 `src/views/member/data/index.vue` 中：

```1:19:src/views/member/data/index.vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { baseColumns, type TableColumnItem, type TableListItem } from './columns';
import { baseSchemas } from './formSchemas';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { message, Modal } from 'ant-design-vue';
import { deleteMember, getMemberList, addMember, updateMember } from '@/api/backend/member';
import type { LoadDataParams } from '@/components/core/dynamic-table';

defineOptions({
  name: 'MemberData',
});

const [DynamicTable, dynamicTableInstance] = useTable({
  formProps: { autoSubmitOnEnter: true },
});

const [showModal] = useFormModal();
```

**問題：**
- ✅ Import 區塊順序正確
- ✅ defineOptions 位置正確
- ⚠️ **配置對象 `columns` 定義在方法之後，但應該放在最後**

**建議調整：**
將 `columns` 配置對象移到文件最後（在 `delRowsConfirm` 函數之後）。

---

## 🎯 DynamicTable 使用檢查

### ✅ 通過項目

1. **初始化表格**
   ```typescript
   const [DynamicTable, dynamicTableInstance] = useTable({
     formProps: { autoSubmitOnEnter: true },
   });
   ```
   - ✅ 使用 `useTable` Hook 正確
   - ✅ 配置了 `autoSubmitOnEnter` 符合規範

2. **數據加載**
   ```typescript
   const loadTableData = async (params: LoadDataParams) => {
     const data = await getMemberList(params);
     rowSelection.value.selectedRowKeys = [];
     return data;
   };
   ```
   - ✅ 使用 `data-request` 屬性（符合規範推薦）
   - ✅ 參數類型正確（`LoadDataParams`）

3. **列配置（columns.tsx）**
   - ✅ 使用 `TableColumn<TableListItem>` 類型
   - ✅ 導出 `baseColumns` 和類型定義
   - ✅ 使用 `customRender` 自定義渲染
   - ✅ 使用 `formItemProps` 配置搜索表單
   - ✅ 使用 `hideInSearch` 和 `hideInTable` 控制顯示

4. **操作列配置**
   ```typescript
   {
     title: '操作',
     width: 280,
     dataIndex: 'ACTION',
     align: 'center',
     fixed: 'right',
     hideInSearch: true,
     actions: ({ record }) => [...]
   }
   ```
   - ✅ 使用 `actions` 配置操作按鈕
   - ✅ 權限控制使用 `auth` 屬性
   - ✅ 使用 `popConfirm` 進行二次確認

### ⚠️ 建議改進

1. **操作列寬度**
   - 當前：`width: 280`（5個操作按鈕）
   - 建議：根據按鈕數量調整，或使用 `minWidth` 讓表格自動調整

2. **customRender 中使用 Tailwind CSS**
   ```typescript
   customRender: ({ record }) => {
     return (
       <div class="flex items-center gap-1">
         <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
         <span>{enable ? '啟用中' : '停用'}</span>
       </div>
     );
   }
   ```
   - ⚠️ 規範建議使用 Ant Design Vue 的 `Tag` 組件（參考 `src/views/system/role/columns.tsx`）
   - 建議改為：
   ```typescript
   import { Tag } from 'ant-design-vue';
   customRender: ({ record }) => {
     const enable = ~~record.status === 1;
     return <Tag color={enable ? 'green' : 'red'}>{enable ? '啟用中' : '停用'}</Tag>;
   }
   ```

---

## 📝 SchemaForm 使用檢查

### ✅ 通過項目

1. **表單配置文件（formSchemas.ts）**
   - ✅ 使用 `FormSchema<MemberFormDto>` 類型
   - ✅ 字段配置完整（`field`, `component`, `label`）
   - ✅ 驗證規則使用 `rules` 配置
   - ✅ 使用 `componentProps` 配置組件屬性
   - ✅ 使用 `defaultValue` 設置默認值

2. **動態表單行為**
   ```typescript
   schemas: baseSchemas.map((schema) => {
     // 編輯時密碼不必填
     if (schema.field === 'password' && record.id) {
       return { ...schema, rules: [] };
     }
     return schema;
   })
   ```
   - ✅ 根據編輯/新增模式動態調整驗證規則
   - ⚠️ 建議：使用 `show` 或 `disabled` 屬性控制顯示/禁用，而不是移除驗證規則

### ⚠️ 建議改進

1. **密碼字段處理**
   - 當前：編輯時移除驗證規則
   - 建議：使用條件顯示或條件驗證
   ```typescript
   {
     field: 'password',
     component: 'InputPassword',
     label: '密碼',
     show: ({ formModel }) => !formModel.id, // 編輯時隱藏
     rules: [{ required: true, message: '請輸入密碼' }],
   }
   ```

2. **表單字段類型**
   - ✅ 支持的組件類型正確（`Input`, `InputPassword`, `Select`, `RadioGroup`）

---

## 🪟 Modal 彈窗管理檢查

### ✅ 通過項目

1. **使用 useFormModal Hook**
   ```typescript
   const [showModal] = useFormModal();
   ```
   - ✅ 使用正確的 Hook

2. **彈窗配置**
   ```typescript
   const [formRef] = await showModal({
     modalProps: {
       title: `${record.id ? '編輯' : '新增'}會員`,
       width: 700,
       onFinish: async (values) => { ... }
     },
     formProps: {
       labelWidth: 100,
       schemas: baseSchemas.map(...)
     }
   });
   ```
   - ✅ `modalProps` 配置正確
   - ✅ `formProps` 配置正確
   - ✅ 編輯模式回填數據使用 `formRef?.setFieldsValue(record)`

3. **錯誤處理**
   - ✅ 在 `onFinish` 中使用 try-catch 處理錯誤
   - ✅ 顯示成功/失敗消息

---

## 🔷 TypeScript 類型定義檢查

### ✅ 通過項目

1. **類型導入**
   ```typescript
   import type { TableColumn } from '@/components/core/dynamic-table';
   import type { FormSchema } from '@/components/core/schema-form/';
   import type { LoadDataParams } from '@/components/core/dynamic-table';
   ```
   - ✅ 使用 `type` 關鍵字導入類型（符合規範）

2. **類型定義**
   ```typescript
   export interface TableListItem { ... }
   export type TableColumnItem = TableColumn<TableListItem>;
   export interface MemberFormDto { ... }
   ```
   - ✅ 類型定義完整
   - ✅ 使用接口定義數據類型

---

## 🛡️ 錯誤處理檢查

### ✅ 通過項目

1. **API 調用錯誤處理**
   ```typescript
   try {
     await updateMember(Number(record.id), values);
     message.success('編輯成功');
     dynamicTableInstance?.reload();
   } catch (error) {
     console.error('保存失敗:', error);
     message.error(record.id ? '編輯失敗' : '新增失敗');
     throw error; // 重新拋出錯誤，讓表單知道提交失敗
   }
   ```
   - ✅ 使用 try-catch 包裹 API 調用
   - ✅ 顯示錯誤消息
   - ✅ 記錄錯誤到控制台
   - ✅ 重新拋出錯誤（讓表單知道提交失敗）

2. **刪除操作錯誤處理**
   ```typescript
   try {
     await deleteMember(Number(record.id));
     message.success('刪除成功');
     dynamicTableInstance?.reload();
   } catch (error) {
     console.error('刪除失敗:', error);
     message.error('刪除失敗');
   }
   ```
   - ✅ 錯誤處理完整

---

## 🔐 權限控制檢查

### ✅ 通過項目

1. **工具欄權限**
   ```vue
   <a-button v-auth="'member:data:create'" type="primary" @click="openFormModal({})">
     新增帳號
   </a-button>
   ```
   - ✅ 使用 `v-auth` 指令控制按鈕顯示

2. **操作列權限**
   ```typescript
   {
     label: '編輯',
     auth: {
       perm: 'member:data:update',
       effect: 'disable',
     },
     onClick: () => openFormModal(record),
   }
   ```
   - ✅ 使用 `auth` 對象配置權限
   - ✅ 使用 `effect: 'disable'` 控制禁用效果

3. **批量操作權限**
   ```vue
   <a-button 
     v-auth="'member:data:delete'" 
     type="danger" 
     :disabled="!isCheckRows" 
     @click="delRowsConfirm(rowSelection.selectedRowKeys)"
   >
     批量刪除
   </a-button>
   ```
   - ✅ 權限控制與禁用狀態結合

---

## 💬 註釋規範檢查

### ✅ 通過項目

1. **函數註釋**
   ```typescript
   /**
    * @description 打開新增/編輯表單彈窗
    * @param record 會員記錄（新增時為空對象）
    */
   const openFormModal = async (record: Partial<TableListItem>) => { ... }
   ```
   - ✅ 使用 JSDoc 格式註釋
   - ✅ 包含 `@description` 和 `@param` 標籤

---

## 📊 詳細問題清單

### 🔴 必須修復的問題

無

### 🟡 建議改進的問題

1. **代碼組織順序**
   - **文件：** `src/views/member/data/index.vue`
   - **問題：** `columns` 配置對象應該放在文件最後
   - **位置：** 第 96-151 行
   - **建議：** 將 `columns` 定義移到所有方法定義之後

2. **customRender 中使用 Tailwind CSS**
   - **文件：** `src/views/member/data/columns.tsx`
   - **問題：** 使用 Tailwind CSS 類名而非 Ant Design Vue 組件
   - **位置：** 第 62-70 行（狀態列）
   - **建議：** 使用 `Tag` 組件（參考規範和 `system/role/columns.tsx`）

3. **密碼字段處理方式**
   - **文件：** `src/views/member/data/index.vue`
   - **問題：** 編輯時通過移除驗證規則來處理密碼字段
   - **位置：** 第 66-72 行
   - **建議：** 使用 `show` 屬性控制顯示，或使用條件驗證規則

### 🟢 可選優化

1. **操作列寬度**
   - 當前操作列有 5 個按鈕，寬度 280px 可能不夠
   - 建議：根據實際按鈕寬度調整，或使用 `minWidth`

2. **批量刪除確認**
   - 當前使用 `Modal.confirm`，符合規範
   - 可選：考慮使用統一的確認組件

---

## ✅ 符合規範的優秀實踐

1. ✅ **頁面結構標準** - 完全符合規範的文件組織結構
2. ✅ **使用 data-request** - 符合規範推薦的數據加載方式
3. ✅ **類型定義完整** - 所有類型都有明確的 TypeScript 定義
4. ✅ **錯誤處理完善** - 所有 API 調用都有錯誤處理
5. ✅ **權限控制多層級** - 工具欄、操作列都有權限控制
6. ✅ **註釋規範** - 函數都有 JSDoc 註釋
7. ✅ **使用 Hooks** - 正確使用 `useTable` 和 `useFormModal`

---

## 📝 總結

### 整體評價：**良好** ✅

`poc_shang` 分支中的會員管理頁面開發**基本符合**頁面設計規範，主要優點：

1. ✅ 頁面結構完全符合標準
2. ✅ 核心組件使用正確
3. ✅ 類型定義和錯誤處理完善
4. ✅ 權限控制到位

### 需要改進的地方：

1. ⚠️ 代碼組織順序（`columns` 配置應放在最後）
2. ⚠️ 建議使用 Ant Design Vue 組件而非 Tailwind CSS（狀態顯示）
3. ⚠️ 密碼字段處理方式可以更優雅

### 建議優先級：

- **高優先級：** 無（無必須修復的問題）
- **中優先級：** 代碼組織順序調整
- **低優先級：** 使用 Tag 組件、優化密碼字段處理

---

**檢查完成時間：** 2025-01-27

