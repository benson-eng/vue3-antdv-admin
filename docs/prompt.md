# Vue3 Admin 頁面生成標準流程

## 📋 快速使用模板

```markdown
請為我生成一個管理頁面，按照項目標準流程執行：

### 基礎信息
- 模塊名稱: __________ (中文)
- 模塊代碼: __________ (英文，用於路由)
- 頁面名稱: __________ (中文)
- 頁面代碼: __________ (英文，用於路由)
- 路由路徑: /______/______
- 模塊圖標: ant-design:____-outlined
- 頁面圖標: ant-design:____-outlined
- 菜單排序: __

### 功能需求
- [x] 基礎 CRUD (增刪改查)
- [x] 搜索功能
- [ ] 批量操作 (批量刪除/修改)
- [ ] 導入導出
- [ ] 樹形結構
- [ ] 其他特殊功能: __________

### 頁面截圖
[附上 UI 截圖]

### 數據結構 (可選)
```typescript
interface Entity {
  id: string;
  // 其他字段...
}
```

### 執行要求
1. 使用 `create_file` 生成文件: columns.tsx, formSchemas.ts, index.vue, API, 路由配置
2. 嚴格遵循項目規範 (DynamicTable, useTable, useFormModal)
3. 使用 `get_errors` 執行質量檢查: TypeScript + ESLint + 框架規範
4. 使用 `replace_string_in_file` 自動修復所有可修復的錯誤
5. 提供生成報告

### 工具使用規範
- ✅ **創建文件**: 使用 `create_file`
- ✅ **修改文件**: 使用 `replace_string_in_file` 或 `multi_replace_string_in_file`
- ✅ **檢查錯誤**: 使用 `get_errors`
- ✅ **讀取文件**: 使用 `read_file`
- ❌ **禁止**: 使用 `run_in_terminal` + `cat/echo` 創建或修改代碼文件
```

---

## 🎯 詳細流程說明

### 階段一: 需求分析

#### 1. 截圖分析
- 識別 Ant Design 組件 (Table, Form, Modal, Select, DatePicker 等)
- 識別數據字段和類型
- 識別交互功能 (搜索、排序、操作按鈕等)
- 識別布局結構

#### 2. 字段映射
根據截圖確定:
- 表格列 (列名、寬度、是否可搜索、是否可排序)
- 搜索項 (輸入框、下拉選擇、日期範圍等)
- 表單項 (新增/編輯時的字段)
- 操作按鈕 (查看、編輯、刪除、自定義操作)

**重要提醒**:
- ⚠️ 仔細比對截圖中的所有搜索欄位,不要遺漏
- ⚠️ 注意區分「表格顯示欄位」和「僅搜索欄位」
- ⚠️ 僅搜索欄位需設置 `hideInTable: true`
- ⚠️ 僅表格顯示欄位需設置 `hideInSearch: true`
- ⚠️ 確認時間範圍欄位使用 `RangePicker`
- ⚠️ 確認數字比較欄位使用 `InputNumber`

#### 3. UI 樣式分析
仔細觀察截圖中的視覺呈現:

**搜索表單佈局**:
- 檢查表單是橫向排列還是縱向排列
- 計算每行顯示幾個欄位 (常見: 3個/行 `span: 8`, 4個/行 `span: 6`)
- 注意特殊欄位佔位 (如時間範圍可能佔 2 個位置)
- 使用 `colProps: { span: X }` 控制佈局

**狀態顯示樣式**:
- 是否使用 Tag 組件 (彩色標籤)
- 是否使用圓點 + 文字 (如: 🟢 啟用中)
- 是否使用文字顏色區分 (如: 綠色/紅色文字)
- 根據實際設計選擇合適的 `customRender` 方案

**操作按鈕樣式**:
- 是否為連結樣式 (`type: 'link'` 藍色文字)
- 是否為按鈕樣式 (`type: 'default'` / `type: 'primary'`)
- 按鈕數量和排列方式
- 是否有下拉菜單 (更多操作)

**其他視覺元素**:
- 圖標使用 (如會員等級、狀態指示器)
- 特殊格式化 (金額、百分比、日期等)
- 連結樣式 (是否可點擊跳轉)

**案例參考** (會員管理頁面):
```typescript
// 橫向 4 欄位佈局
formItemProps: {
  component: 'Input',
  colProps: { span: 6 }, // 24/6 = 4 欄位/行
}

// 圓點 + 文字狀態
customRender: ({ record }) => {
  const enable = ~~record.status === 1;
  return (
    <div class="flex items-center gap-1">
      <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
      <span>{enable ? '啟用中' : '停用'}</span>
    </div>
  );
}

// 連結樣式按鈕
actions: ({ record }) => [
  { label: '查看', type: 'link', onClick: () => {} },
]
```

**⚠️ 重要**: 這些只是案例參考,實際實現必須以用戶提供的截圖為準!

---

### 階段二: 代碼生成

#### 📝 協作方式要求
**優先使用 VS Code 原生編輯功能**:
- ✅ 使用 `create_file` 創建新文件
- ✅ 使用 `replace_string_in_file` 或 `multi_replace_string_in_file` 編輯文件
- ✅ 使用 `read_file` 讀取文件內容
- ❌ 避免使用 `run_in_terminal` + `cat` 創建文件
- ❌ 避免使用 heredoc 方式生成代碼

**優勢**:
- 更好的錯誤提示和定位
- 支持部分更新,不需要覆蓋整個文件
- 更清晰的變更歷史
- 更符合 IDE 協作習慣

#### 文件結構
```
src/views/{module}/{page}/
├── columns.tsx          # 表格列定義 + 搜索表單
├── formSchemas.ts       # 新增/編輯表單配置
└── index.vue            # 主頁面組件

src/router/routes/modules/
└── {module}.ts          # 路由配置

src/api/backend/
└── {module}.ts          # API 接口定義
```

#### columns.tsx 生成規範
```typescript
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag, Space, Button } from 'ant-design-vue';

export interface TableListItem {
  id: string;
  // 定義所有字段類型
}

export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  // ID 列 - 必須設置 hideInSearch
  {
    title: 'ID',
    dataIndex: 'id',
    width: 80,
    hideInSearch: true,
  },
  
  // 可搜索的文本列
  {
    title: '名稱',
    dataIndex: 'name',
    width: 150,
    // 不設置 hideInSearch，會自動生成 Input 搜索框
  },
  
  // 下拉選擇搜索 - 帶搜索表單寬度控制
  {
    title: '狀態',
    dataIndex: 'status',
    width: 100,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: '全部', value: undefined },
          { label: '啟用', value: 1 },
          { label: '禁用', value: 0 },
        ],
      },
      colProps: { span: 6 }, // 控制搜索表單中的寬度 (每行4個欄位)
    },
    customRender: ({ record }) => {
      const enable = ~~record.status === 1;
      // 方式1: 使用 Tag 組件
      return <Tag color={enable ? 'success' : 'error'}>{enable ? '啟用' : '禁用'}</Tag>;
      
      // 方式2: 使用圓點 + 文字 (更接近原生樣式)
      return (
        <div class="flex items-center gap-1">
          <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{enable ? '啟用中' : '停用'}</span>
        </div>
      );
    },
  },
  
  // 僅用於搜索的欄位 - 設置 hideInTable: true
  {
    title: '註冊IP',
    dataIndex: 'registerIp',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入IP',
      },
    },
    hideInTable: true, // 不在表格中顯示
  },
  
  // 時間範圍搜索
  {
    title: '註冊時間',
    dataIndex: 'registerTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: ['開始時間', '結束時間'],
        showTime: true,
      },
    },
    hideInTable: true,
  },
  
  // 數字輸入搜索
  {
    title: '存款次數',
    dataIndex: 'depositCount',
    width: 120,
    formItemProps: {
      component: 'InputNumber',
      componentProps: {
        placeholder: '請輸入次數',
        min: 0,
      },
    },
    hideInTable: true,
  },
  
  // 時間列 - 必須設置 hideInSearch 和格式化
  {
    title: '創建時間',
    dataIndex: 'createdAt',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => formatToDateTime(record.createdAt),
  },
];
```

#### formSchemas.ts 生成規範
```typescript
import type { FormSchema } from '@/components/core/schema-form/';

export const baseSchemas: FormSchema[] = [
  {
    field: 'name',
    component: 'Input',
    label: '名稱',
    rules: [{ required: true, message: '請輸入名稱' }],
  },
  {
    field: 'type',
    component: 'Select',
    label: '類型',
    rules: [{ required: true, message: '請選擇類型' }],
    componentProps: {
      options: [
        { label: '類型一', value: 1 },
        { label: '類型二', value: 2 },
      ],
    },
  },
  {
    field: 'status',
    component: 'RadioGroup',
    label: '狀態',
    defaultValue: 1,
    componentProps: {
      options: [
        { label: '啟用', value: 1 },
        { label: '禁用', value: 0 },
      ],
    },
  },
];
```

#### index.vue 生成規範
```vue
<template>
  <div>
    <DynamicTable
      row-key="id"
      header-title="頁面標題"
      :data-request="loadTableData"
      :columns="columns"
      :row-selection="rowSelection"
    >
      <template #toolbar>
        <a-button type="primary" @click="openFormModal({})">
          新增
        </a-button>
      </template>
    </DynamicTable>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { message } from 'ant-design-vue';
  import { useTable } from '@/components/core/dynamic-table';
  import { useFormModal } from '@/hooks/useModal/';
  import { baseColumns } from './columns';
  import { baseSchemas } from './formSchemas';
  import type { TableListItem, TableColumnItem } from './columns';
  import type { LoadDataParams } from '@/components/core/dynamic-table';
  import Api from '@/api/';

  defineOptions({
    name: 'ModuleName',
  });

  const [DynamicTable, dynamicTableInstance] = useTable({
    formProps: { autoSubmitOnEnter: true }, // 啟用 Enter 鍵提交
  });
  const [showModal] = useFormModal();

  // 批量選擇 (必須在 loadTableData 之前定義)
  const rowSelection = ref({
    selectedRowKeys: [] as string[],
    onChange: (selectedRowKeys: string[]) => {
      rowSelection.value.selectedRowKeys = selectedRowKeys;
    },
  });

  // 是否勾選了表格行
  const isCheckRows = computed(() => rowSelection.value.selectedRowKeys.length);

  // 數據加載 - 直接返回 API 數據,不要手動轉換格式
  const loadTableData = async (params: LoadDataParams) => {
    const data = await Api.module.list(params);
    rowSelection.value.selectedRowKeys = []; // 加載新數據時清空選中
    return data; // ✅ 直接返回,API 已是 { items: [], meta: {} } 格式
  };

  // 新增/編輯
  const openFormModal = async (record: Partial<TableListItem>) => {
    const [formRef] = await showModal({
      modalProps: {
        title: `${record.id ? '編輯' : '新增'}`,
        width: 700,
        onFinish: async (values) => {
          if (record.id) {
            await Api.module.update(Number(record.id), values);
            message.success('編輯成功');
          } else {
            await Api.module.create(values);
            message.success('新增成功');
          }
          dynamicTableInstance?.reload();
        },
      },
      formProps: {
        labelWidth: 100,
        schemas: baseSchemas.map((schema) => {
          // 編輯時某些欄位可能不必填
          if (schema.field === 'password' && record.id) {
            return { ...schema, rules: [] };
          }
          return schema;
        }),
      },
    });

    if (record.id) {
      formRef?.setFieldsValue(record);
    }
  };

  // 刪除
  const delRowConfirm = async (record: TableListItem) => {
    await Api.module.delete(Number(record.id));
    message.success('刪除成功');
    dynamicTableInstance?.reload();
  };

  // 表格列配置
  const columns = ref<TableColumnItem[]>([
    ...baseColumns,
    {
      title: '操作',
      width: 200,
      dataIndex: 'ACTION',
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      actions: ({ record }) => [
        {
          label: '編輯',
          type: 'link', // 藍色連結樣式
          onClick: () => openFormModal(record),
        },
        {
          label: '刪除',
          type: 'link',
          popConfirm: {
            title: '確定要刪除嗎？',
            onConfirm: () => delRowConfirm(record),
          },
        },
      ],
    },
  ]);

  // 批量刪除
  const delRowsConfirm = async (rowIds: string[]) => {
    Modal.confirm({
      title: '確認刪除',
      content: `確定要刪除選中的 ${rowIds.length} 筆資料嗎?`,
      async onOk() {
        await Promise.all(rowIds.map((id) => Api.module.delete(Number(id))));
        message.success('批量刪除成功');
        dynamicTableInstance?.reload();
      },
    });
  };
</script>
```

**⚠️ 關鍵注意事項**:
1. 使用 `:data-request` 而非 `:get-list-func`
2. `loadTableData` 直接返回 API 數據,不要手動轉換格式
3. 不需要在 `onMounted` 中手動調用 `reload()`
4. 使用 `rowSelection` ref 管理選中行,而非 `getSelectRowKeys()`
5. 在 `loadTableData` 中清空選中狀態
6. `columns` 使用 `ref<TableColumnItem[]>` 類型
7. 操作按鈕可設置 `type: 'link'` 為藍色連結樣式

---

### 階段三: 質量檢查

#### 1. TypeScript 檢查
```bash
✓ 所有類型定義完整
✓ 無 any 類型濫用
✓ 導入路徑正確
✓ Props 類型匹配
✓ 泛型使用正確
```

#### 2. ESLint 檢查
```bash
✓ 無未使用的變量
✓ 無未使用的導入
✓ 命名規範正確
✓ 代碼格式化正確
✓ 無語法錯誤
```

#### 3. 框架規範檢查清單

**columns.tsx**
- [ ] 導入 `TableColumn` 類型
- [ ] 定義 `TableListItem` 接口 (包含所有搜索和表格欄位)
- [ ] 定義 `TableColumnItem` 類型別名
- [ ] ID 列設置 `hideInSearch: true`
- [ ] 時間列設置 `hideInSearch: true`
- [ ] 時間列使用 `formatToDateTime` 格式化
- [ ] 狀態列配置 `formItemProps` 和 `customRender`
- [ ] 可搜索字段不設置 `hideInSearch` 或配置 `formItemProps`
- [ ] 僅搜索欄位設置 `hideInTable: true`
- [ ] 僅顯示欄位設置 `hideInSearch: true`
- [ ] 時間範圍搜索使用 `RangePicker`
- [ ] 數字搜索使用 `InputNumber`
- [ ] 操作列設置 `hideInSearch: true`
- [ ] 操作列設置 `fixed: 'right'`

**formSchemas.ts**
- [ ] 導入 `FormSchema` 類型
- [ ] 必填字段設置 `rules: [{ required: true }]`
- [ ] Select 配置 `options` 或 `request`
- [ ] TreeSelect 配置 `fieldNames`
- [ ] 合理設置 `colProps.span` 控制布局
- [ ] 文本域配置 `autoSize`

**index.vue**
- [ ] 使用 `defineOptions` 設置組件名稱
- [ ] 導入 `useTable` 和 `useFormModal`
- [ ] 實現 `loadTableData` 函數
- [ ] 實現 `openFormModal` 函數
- [ ] 實現 `delRowConfirm` 函數
- [ ] 編輯時調用 `formRef?.setFieldsValue`
- [ ] 提交後調用 `dynamicTableInstance?.reload()`
- [ ] 配置操作列 `actions`
- [ ] 新增按鈕配置權限 (如需要)

**路由配置**
- [ ] 文件創建在 `src/router/routes/modules/`
- [ ] 導入 `useI18n` 的 `t` 函數
- [ ] 設置 `name`, `path`, `meta`
- [ ] 使用 `t('routes.module.page')` 設置多語言標題
- [ ] 配置 `icon` 和 `orderNo`
- [ ] 在 `index.ts` 中導入和導出

#### 4. 自動修復流程

**使用 VS Code 工具鏈**:
```
1. get_errors 檢查錯誤
   ↓
2. 使用 replace_string_in_file/multi_replace_string_in_file 修復
   ↓
3. 再次 get_errors 驗證
   ↓
4. 重複直到無錯誤
```

**執行順序**:
1. 使用 `get_errors` 檢查 TypeScript 錯誤
2. 使用 `replace_string_in_file` 修復類型錯誤和導入問題
3. 使用 `get_errors` 檢查 ESLint 規範
4. 使用 `multi_replace_string_in_file` 批量修復格式問題
5. 手動修復邏輯問題
6. 再次 `get_errors` 檢查確認無錯誤

**注意**: 所有文件修改操作都應使用 VS Code 編輯器工具,不使用終端命令

---

### 階段四: 生成報告

```markdown
## 頁面生成報告

### 基本信息
- 模塊: XXX管理
- 頁面: XXX資料
- 路由: /xxx/xxx
- 生成時間: 2025-12-10

### 文件清單
✅ src/views/xxx/xxx/columns.tsx (120 行)
✅ src/views/xxx/xxx/formSchemas.ts (60 行)
✅ src/views/xxx/xxx/index.vue (180 行)
✅ src/router/routes/modules/xxx.ts (25 行)

### 質量檢查
✅ TypeScript: 通過 (0 錯誤)
✅ ESLint: 通過 (0 錯誤, 0 警告)
✅ 框架規範: 通過 (檢查 20 項)

### 功能清單
✅ 列表查詢
✅ 搜索篩選
✅ 新增數據
✅ 編輯數據
✅ 刪除數據
[ ] 批量操作 (未配置)
[ ] 導入導出 (未配置)

### 使用說明
1. 確認路由已註冊
2. 連接實際 API: 替換 `Api.module` 為實際接口
3. 調整權限碼: 根據實際需求配置
4. 訪問頁面: http://localhost:8088/xxx/xxx
```

---

## 🛠️ 代碼生成最佳實踐

### 文件創建流程
```typescript
// 1. 使用 create_file 創建新文件
create_file({
  filePath: '/path/to/file.tsx',
  content: '完整的文件內容'
})

// 2. 如果需要修改,使用 replace_string_in_file
replace_string_in_file({
  filePath: '/path/to/file.tsx',
  oldString: '需要替換的內容(包含上下文)',
  newString: '新的內容'
})

// 3. 批量修改使用 multi_replace_string_in_file
multi_replace_string_in_file({
  replacements: [
    { filePath: '...', oldString: '...', newString: '...' },
    { filePath: '...', oldString: '...', newString: '...' },
  ]
})
```

### 錯誤檢查流程
```typescript
// 1. 生成所有文件後,檢查錯誤
get_errors({
  filePaths: [
    '/path/to/views/module/page/',
    '/path/to/api/backend/module.ts',
    '/path/to/router/routes/modules/module.ts'
  ]
})

// 2. 根據錯誤信息,使用 replace_string_in_file 修復
// 3. 再次 get_errors 驗證
// 4. 重複直到無錯誤
```

### 為什麼使用 VS Code 工具?
- ✅ **精確定位**: 可以精確修改特定代碼段,不影響其他部分
- ✅ **錯誤追蹤**: get_errors 提供準確的行號和錯誤信息
- ✅ **批量操作**: multi_replace 可以同時修改多個文件
- ✅ **歷史記錄**: 所有修改都有清晰的變更記錄
- ✅ **類型安全**: 編輯器能即時反饋類型錯誤

---

## 🔧 常見問題處理

### Q1: 左側菜單不顯示
**原因**: 圖標格式錯誤  
**解決**: 使用 `ant-design:xxx-outlined` 格式

### Q2: 搜索表單不顯示
**原因**: 所有列都設置了 `hideInSearch: true`  
**解決**: 移除需要搜索的列的 `hideInSearch`

### Q3: 編輯數據不回顯
**原因**: 未調用 `setFieldsValue`  
**解決**: 在 `openFormModal` 中添加回顯邏輯

### Q4: 提交後列表不刷新
**原因**: 未調用 `reload()`  
**解決**: 在 `onFinish` 中添加 `dynamicTableInstance?.reload()`

### Q5: TypeScript 類型錯誤
**原因**: 類型定義不完整  
**解決**: 
- 確保定義了 `TableListItem` 接口
- 使用 `TableColumn<TableListItem>` 泛型
- 導入必要的類型

### Q6: DynamicTable 屬性錯誤 - 使用 :data-request 而非 :get-list-func
**原因**: 使用了錯誤的屬性名稱  
**解決**: 
```vue
<!-- ❌ 錯誤 -->
<DynamicTable :get-list-func="loadTableData" />

<!-- ✅ 正確 -->
<DynamicTable :data-request="loadTableData" />
```

### Q7: loadTableData 數據格式錯誤
**原因**: 手動轉換了 API 返回格式  
**解決**: 
```typescript
// ❌ 錯誤 - 不要手動轉換
const loadTableData = async (params: LoadDataParams) => {
  const data = await getMemberList(params);
  return {
    list: data.items || [],
    total: data.meta?.totalItems || 0,
  };
};

// ✅ 正確 - 直接返回 API 數據
const loadTableData = async (params: LoadDataParams) => {
  const data = await getMemberList(params);
  return data; // API 已返回 { items: [], meta: {} } 格式
};
```

### Q8: onMounted 手動 reload 不是標準做法
**原因**: DynamicTable 會自動加載數據  
**解決**: 
```typescript
// ❌ 不需要 - DynamicTable 自動加載
onMounted(() => {
  dynamicTableInstance?.reload();
});

// ✅ 正確 - 移除 onMounted,讓 DynamicTable 自動處理
```

### Q9: 批量選擇使用 getSelectRowKeys() 方法不存在
**原因**: 應該使用 rowSelection ref 管理選中行  
**解決**: 
```typescript
// ❌ 錯誤
dynamicTableInstance?.getSelectRowKeys()

// ✅ 正確 - 使用 rowSelection ref
const rowSelection = ref({
  selectedRowKeys: [] as string[],
  onChange: (selectedRowKeys: string[]) => {
    rowSelection.value.selectedRowKeys = selectedRowKeys;
  },
});

// 在 loadTableData 中清空選中
const loadTableData = async (params: LoadDataParams) => {
  const data = await getMemberList(params);
  rowSelection.value.selectedRowKeys = []; // 加載新數據時清空選中
  return data;
};

// 在模板中使用
<DynamicTable :row-selection="rowSelection" />
<a-button :disabled="!isCheckRows" @click="delRows(rowSelection.selectedRowKeys)">
```

### Q10: MSW Mock 數據不加載
**原因**: 
1. API 路徑缺少 `/api` 前綴
2. VITE_MOCK_IN_PROD 環境變量設置錯誤
3. loadTableData 返回格式錯誤

**解決**: 
```typescript
// 1. API 路徑必須包含 /api 前綴
const memberApiPath = {
  list: '/api/member/list', // ✅ 正確
  // list: '/member/list',  // ❌ 錯誤
};

// 2. .env.development 設置
VITE_MOCK_IN_PROD = true  // ✅ 字符串 'true'

// 3. MSW handler 路徑
http.get(serverApi('/member/list'), ...) // serverApi 會自動加 /api
```

### Q11: Vue template 語法錯誤 - Element is missing end tag
**原因**: 批量替換時 template 標籤未正確閉合  
**解決**: 
- 清除 Vite 緩存: `rm -rf node_modules/.vite`
- 檢查 template 中所有標籤是否正確閉合
- 特別注意 `<a-button>`, `</DynamicTable>`, `</template>` 等標籤

### Q12: 搜索表單佈局控制 - 使用 colProps
**原因**: 需要根據截圖調整表單欄位的寬度和排列  
**解決**: 
```typescript
// Ant Design Grid 系統: 一行總共 24 格
// span: 24 = 1欄位/行 (100%)
// span: 12 = 2欄位/行 (50%)
// span: 8  = 3欄位/行 (33.3%)
// span: 6  = 4欄位/行 (25%)

{
  title: '會員帳號',
  dataIndex: 'account',
  formItemProps: {
    component: 'Input',
    colProps: { span: 6 }, // 根據截圖決定 span 值
  },
}

// 時間範圍等較寬的欄位可能需要更大的 span
{
  title: '註冊時間',
  dataIndex: 'registerTime',
  formItemProps: {
    component: 'RangePicker',
    colProps: { span: 12 }, // 視截圖決定
  },
  hideInTable: true,
}
```
**⚠️ 注意**: 必須根據實際截圖確定每行顯示幾個欄位,不要假設固定值

### Q13: 狀態顯示樣式 - 根據截圖選擇
**原因**: 不同頁面可能使用不同的狀態顯示方式  
**解決**: 
```tsx
// 方式 1: Tag 標籤 (常見於系統管理頁面)
customRender: ({ record }) => {
  const enable = ~~record.status === 1;
  return <Tag color={enable ? 'success' : 'error'}>{enable ? '啟用' : '禁用'}</Tag>;
}

// 方式 2: 圓點 + 文字 (常見於會員/訂單頁面)
customRender: ({ record }) => {
  const enable = ~~record.status === 1;
  return (
    <div class="flex items-center gap-1">
      <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
      <span>{enable ? '啟用中' : '停用'}</span>
    </div>
  );
}

// 方式 3: 純文字顏色 (簡約風格)
customRender: ({ record }) => {
  const enable = ~~record.status === 1;
  return <span class={enable ? 'text-green-600' : 'text-red-600'}>{enable ? '啟用' : '禁用'}</span>;
}
```
**⚠️ 注意**: 必須根據截圖選擇正確的樣式,不要隨意決定

### Q14: 操作列按鈕樣式 - 根據截圖選擇
**原因**: 不同頁面的操作按鈕樣式可能不同  
**解決**: 
```typescript
// 樣式 1: 連結樣式 (藍色文字,無邊框)
actions: ({ record }) => [
  {
    label: '查看',
    type: 'link',
    onClick: () => openFormModal(record),
  },
]

// 樣式 2: 默認按鈕樣式 (有邊框)
actions: ({ record }) => [
  {
    label: '編輯',
    type: 'default',
    onClick: () => openFormModal(record),
  },
]

// 樣式 3: 主要按鈕樣式 (藍色背景)
actions: ({ record }) => [
  {
    label: '處理',
    type: 'primary',
    onClick: () => handleRecord(record),
  },
]
```
**⚠️ 注意**: 必須根據截圖確定按鈕樣式,優先匹配設計稿

---

## 📚 參考資源

### 項目示例
- 用戶管理: `src/views/system/user/`
- 角色管理: `src/views/system/role/`
- 部門管理: `src/views/system/dept/`
- 字典管理: `src/views/system/dict-type/`

### 路由配置示例
```typescript
import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const moduleName = 'member';

const routes: RouteRecordRaw[] = [
  {
    path: '/member',
    name: 'Member',
    redirect: '/member/data',
    meta: {
      title: t('routes.member.member'),
      icon: 'ant-design:user-outlined',
      orderNo: 2,
    },
    children: [
      {
        path: 'data',
        name: `${moduleName}-data`,
        component: () => import('@/views/member/data/index.vue'),
        meta: {
          title: t('routes.member.data'),
          icon: 'ant-design:team-outlined',
        },
      },
    ],
  },
];

export default routes;
```

### 常用圖標
```
ant-design:user-outlined
ant-design:team-outlined
ant-design:setting-outlined
ant-design:file-text-outlined
ant-design:unordered-list-outlined
ant-design:table-outlined
ant-design:form-outlined
```

### 常用組件
```typescript
// 輸入組件
Input, InputPassword, InputTextArea, InputNumber

// 選擇組件
Select, TreeSelect, Cascader, RadioGroup, Checkbox

// 日期組件
DatePicker, RangePicker, TimePicker
---

## 📌 重要提醒

### VS Code 協作優先原則
1. **所有代碼文件操作都使用 VS Code 編輯器工具**
2. **終端命令僅用於**: npm/pnpm 安裝、git 操作、開發服務器啟動
---

## 📝 實戰經驗總結 (基於會員管理頁面開發)

### 關鍵錯誤回顧

#### 1. DynamicTable 屬性錯誤
- ❌ **錯誤**: 使用 `:get-list-func="loadTableData"`
- ✅ **正確**: 使用 `:data-request="loadTableData"`

#### 2. 數據格式轉換錯誤
- ❌ **錯誤**: 手動轉換 `{ list: data.items, total: data.meta.totalItems }`
- ✅ **正確**: 直接返回 API 數據 `return data` (已是標準格式)

#### 3. 自動加載邏輯錯誤
- ❌ **錯誤**: 在 `onMounted` 中調用 `reload()`
- ✅ **正確**: DynamicTable 自動加載,不需要手動觸發

#### 4. 批量選擇邏輯錯誤
- ❌ **錯誤**: 使用 `dynamicTableInstance?.getSelectRowKeys()`
- ✅ **正確**: 使用 `rowSelection.value.selectedRowKeys`

#### 5. MSW Mock 配置問題
- API 路徑必須包含 `/api` 前綴
- `.env.development` 中 `VITE_MOCK_IN_PROD = true` (字符串)
- MSW handler 使用 `serverApi('/member/list')` 自動加前綴

#### 6. Template 語法錯誤
- 批量替換時要特別注意標籤閉合
- 清除 Vite 緩存: `rm -rf node_modules/.vite`

### UI 樣式實現技巧 (會員管理案例)

**重要**: 以下是會員管理頁面的具體實現,僅作參考,實際開發必須以截圖為準

#### 案例: 搜索表單橫向 4 欄位排列
```typescript
formItemProps: {
  component: 'Input',
  colProps: { span: 6 }, // 24/6 = 4 欄位/行
}

// 時間範圍佔 2 個欄位位置
formItemProps: {
  component: 'RangePicker',
  colProps: { span: 12 }, // 24/12 = 2 欄位/行
}
```

#### 案例: 狀態顯示圓點樣式
```tsx
customRender: ({ record }) => {
  const enable = ~~record.status === 1;
  return (
    <div class="flex items-center gap-1">
      <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
      <span>{enable ? '啟用中' : '停用'}</span>
    </div>
  );
}
```

#### 案例: 操作按鈕連結樣式
```typescript
actions: ({ record }) => [
  {
    label: '查看',
    type: 'link',
    onClick: () => openFormModal(record),
  },
]
```

### 完整開發流程

1. **需求分析**: 仔細比對 UI 截圖,確認所有欄位
2. **創建文件**: 使用 `create_file` 生成 4 個核心文件
3. **MSW Mock**: 配置 mock 數據和環境變量
4. **錯誤檢查**: 使用 `get_errors` 檢查 TypeScript 錯誤
5. **錯誤修復**: 使用 `replace_string_in_file` 修復錯誤
6. **樣式調整**: 根據截圖微調 UI 樣式
7. **功能測試**: 測試 CRUD 操作和批量選擇

### 檢查清單 (實戰版)

**index.vue**:
- [ ] 使用 `:data-request` 綁定
- [ ] `loadTableData` 直接返回數據
- [ ] 定義 `rowSelection` ref
- [ ] 在 `loadTableData` 中清空選中
- [ ] `columns` 使用 `ref<TableColumnItem[]>`
- [ ] 操作按鈕設置 `type: 'link'`
**columns.tsx**:
- [ ] 根據截圖設置搜索欄位 `colProps: { span: X }`
- [ ] 根據截圖選擇狀態顯示樣式 (Tag / 圓點 / 純文字)
- [ ] 根據截圖設置連結樣式 (`<a>` / `<span>` / Tag)
- [ ] 僅搜索欄位設置 `hideInTable: true`
- [ ] 僅顯示欄位設置 `hideInSearch: true`
- [ ] 連結欄位使用 `<a class="text-blue-500">`
- [ ] 僅搜索欄位設置 `hideInTable: true`

**API 配置**:
- [ ] API 路徑包含 `/api` 前綴
- [ ] MSW handler 使用 `serverApi()`
- [ ] `.env.development` 設置 `VITE_MOCK_IN_PROD = true`

---

**最後更新**: 2025-12-10  
**版本**: v2.2 (加入實戰經驗總結)
Upload, Rate, Slider, Switch
```

---

**最後更新**: 2025-12-10  
**版本**: v2.1 (優化 VS Code 協作流程)
Upload, Rate, Slider, Switch
```

---

**最後更新**: 2025-12-10  
**版本**: v2.0