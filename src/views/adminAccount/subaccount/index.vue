<script setup lang="tsx">
import type { Dayjs } from 'dayjs';
import type { TableColumnItem, TableListItem } from './columns';
import type { SubaccountFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, ref, watch } from 'vue';
import SubaccountApi from '@/api/backend/adminAccount/subaccount';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { useTableConfig } from '../masterAgent/useTableConfig';
import { baseColumns } from './columns';
import { getSubaccountSchemas, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountSubaccount' });

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const userStore = useUserStore();
const canEdit = computed(() => userStore.level < 4);
const canCreate = computed(() => userStore.level < 4);

const [DynamicTable, tableInstance] = useTable({
  search: true,
});
const [showModal] = useFormModal();

const searchKeyword = ref<string>('');
const searchIsEnabled = ref<'true' | 'false' | undefined>(undefined);
const searchDateRange = ref<[Dayjs, Dayjs] | undefined>(undefined);

const statusOptions = [
  { label: '啟用', value: 'true' },
  { label: '停用', value: 'false' },
];

interface TableListResponse {
  items: TableListItem[];
  meta: { totalItems: number };
}

const toBase32 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
};

const generateBackendKey = () => {
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

const normalizeList = (listRaw: any[]) => {
  return (Array.isArray(listRaw) ? listRaw : []).map((i: any) => ({
    ...i,
    id: Number(i?.id),
    account: String(i?.account ?? '').split('.')[0],
    name: String(i?.name ?? ''),
    isEnabled: Boolean(i?.isEnabled),
    allowRedemptionCode: Boolean(i?.allowRedemptionCode),
    roles: Array.isArray(i?.roles) ? i.roles : [],
  }));
};

const loadTableData = async (params: LoadDataParams): Promise<TableListResponse> => {
  // 從搜尋條件構建 API filter 參數
  const keyword = searchKeyword.value.trim();
  const range = searchDateRange.value;
  
  // 處理日期範圍
  let startDate: Date | undefined;
  let dueDate: Date | undefined;
  if (range && Array.isArray(range) && range.length === 2) {
    const start = range[0];
    const end = range[1];
    if (start && end) {
      startDate = start.startOf('day').toDate();
      dueDate = end.endOf('day').toDate();
    }
  }

  // 構建 API payload
  // 關鍵字過濾：原來的行為是同時過濾帳號和名稱，但 API 的 filter.account 可能只支持帳號過濾
  // 為了保持原來的行為（同時過濾帳號和名稱），關鍵字改為在前端過濾
  // 如果只需要過濾帳號，可以將關鍵字傳遞給 API：...(keyword && { account: keyword })
  const payload = {
    filter: {
      // 日期範圍：通過後端 API 過濾
      ...(startDate && { startDate }),
      ...(dueDate && { dueDate }),
      // 關鍵字：在前端過濾（保持同時過濾帳號和名稱的行為）
      // 如果需要改為後端過濾，取消下面這行的註釋，並移除前端過濾邏輯
      // ...(keyword && { account: keyword }),
    },
  };

  // 調試用：輸出 payload 和搜尋條件
  console.log('[loadTableData] 搜尋條件:', {
    keyword: keyword || '(無)',
    isEnabled: searchIsEnabled.value ?? '(全部)',
    dateRange: range ? `${range[0]?.format('YYYY-MM-DD')} ~ ${range[1]?.format('YYYY-MM-DD')}` : '(無)',
  });
  console.log('[loadTableData] API payload:', payload);

  // 調用後端 API 進行查詢（使用日期範圍過濾）
  const listRaw = await SubaccountApi.getAdminSubaccountList(payload);
  const list = normalizeList(listRaw as any);

  // 前端過濾：同時過濾帳號和名稱（保持原來的行為）
  let filtered = list;
  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    filtered = list.filter((i: any) => {
      const acc = String(i?.account ?? '').toLowerCase();
      const name = String(i?.name ?? '').toLowerCase();
      // 如果帳號或名稱包含關鍵字，則保留
      return acc.includes(keywordLower) || name.includes(keywordLower);
    });
  }

  // 如果 API 不支持 isEnabled 過濾，在前端進行過濾
  if (searchIsEnabled.value !== undefined) {
    filtered = filtered.filter((i: any) => {
      return Boolean(i?.isEnabled) === (searchIsEnabled.value === 'true');
    });
  }

  // 前端分頁處理（如果後端不支持分頁）
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  const totalItems = filtered.length;
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + limit;

  return {
    items: filtered.slice(startIdx, endIdx),
    meta: { totalItems },
  };
};

const buildUpdatePayload = (record: Partial<TableListItem>, overrides: Record<string, any> = {}) => {
  const roleIds = Array.isArray(record.roles)
    ? record.roles.map((r: any) => Number(r?.id)).filter((n: number) => Number.isFinite(n))
    : [];

  return {
    id: Number(record.id),
    account: String(record.account ?? ''),
    name: String(record.name ?? ''),
    isEnabled: Boolean(record.isEnabled),
    roles: roleIds,
    allowRedemptionCode: Boolean((record as any).allowRedemptionCode),
    ...overrides,
  };
};

const toggleEnabled = async (record: TableListItem) => {
  if (!canEdit.value) {
    return;
  }
  const newStatus = !record.isEnabled;
  try {
    await SubaccountApi.updateAdminSubaccount(buildUpdatePayload(record, { isEnabled: newStatus }));
    message.success('更新成功');
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
  }
};

const toggleRedemption = async (record: TableListItem) => {
  if (!canEdit.value) {
    return;
  }
  const currentStatus = Boolean((record as any).allowRedemptionCode);
  const newStatus = !currentStatus;
  try {
    await SubaccountApi.updateAdminSubaccount(buildUpdatePayload(record, { allowRedemptionCode: newStatus }));
    message.success('更新成功');
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
  }
};

const openPasswordModal = async (record: Partial<TableListItem>) => {
  if (!record.account || !canEdit.value) {
    return;
  }
  await showModal({
    modalProps: {
      title: `變更密碼：${record.account}`,
      width: 520,
      async onFinish(values) {
        await SubaccountApi.updateAdminAccountPassword({
          account: String(record.account),
          newPassword: String(values.newPassword),
        });
        message.success('變更成功');
        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: passwordSchemas,
    },
  });
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);
  const showAuthenticator = userStore.level !== 3;

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯子帳戶' : '新增子帳戶',
      width: 720,
      async onFinish(values: SubaccountFormValues) {
        const roleIds = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        const account = String(values.account ?? '').trim();
        if (!account) {
          throw new Error('請輸入帳號');
        }

        if (isEdit && record?.id) {
          await SubaccountApi.updateAdminSubaccount({
            ...buildUpdatePayload(record),
            account,
            name: String(values.name ?? ''),
            roles: roleIds,
            allowRedemptionCode: Boolean(values.allowRedemptionCode),
          });
          message.success('編輯成功');
        }
        else {
          await SubaccountApi.createAdminSubaccount({
            account,
            password: '123456',
            name: String(values.name ?? ''),
            isEnabled: true,
            roles: roleIds,
            backendKey: generateBackendKey(),
            authenticator: userStore.level === 3 ? false : Boolean(values.authenticator),
          });
          message.success('新增成功');
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: getSubaccountSchemas({ showAuthenticator }),
    },
  });

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      roles: roleIds,
      allowRedemptionCode: Boolean((record as any).allowRedemptionCode),
      authenticator: Boolean((record as any).authenticator),
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  }
  else {
    formRef?.setFieldsValue({
      allowRedemptionCode: false,
      authenticator: userStore.level !== 3,
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: false } }]);
  }
};

/**
 * 處理重置（重置按鈕）
 * 僅清空搜尋欄位，不自動觸發查詢
 */
const handleReset = async (): Promise<void> => {
  searchKeyword.value = '';
  searchIsEnabled.value = undefined;
  searchDateRange.value = undefined;
};

const baseColumnsWithAction = computed<TableColumnItem[]>(() => {
  // 按照 masterAgent 的欄位順序組織：account, name, roles, statusTag (對應 isEnabled), createDatetime, ...
  // baseColumns 順序：account[0], name[1], roles[2], createDatetime[3], lastLoginDatetime[4], lastLoginIP[5]
  return [
    baseColumns[0], // account
    baseColumns[1], // name
    baseColumns[2], // roles
    {
      title: '狀態',
      dataIndex: 'statusTag',
      width: 100,
      hideInSearch: true,
      customRender: ({ record }) => (
        <Tag color={record.isEnabled ? 'success' : 'error'}>{record.isEnabled ? '啟用' : '停用'}</Tag>
      ),
    },
    baseColumns[3], // createDatetime
    baseColumns[4], // lastLoginDatetime
    baseColumns[5], // lastLoginIP
    {
      title: '兌換碼',
      dataIndex: 'allowRedemptionCode',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) => {
        const isEnabled = Boolean((record as any).allowRedemptionCode);
        return <Tag color={isEnabled ? 'green' : 'default'}>{isEnabled ? '啟用' : '停用'}</Tag>;
      },
    },
    {
      title: '操作',
      dataIndex: 'ACTION',
      width: 320,
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap',
          },
        };
      },
      actions: ({ record }) => {
        const isEnabled = Boolean(record.isEnabled);
        const isRedemptionEnabled = Boolean((record as any).allowRedemptionCode);
        return [
          {
            label: isEnabled ? '停用' : '啟用',
            type: 'link',
            danger: isEnabled,
            disabled: !canEdit.value,
            onClick: () => toggleEnabled(record),
          },
          {
            label: isRedemptionEnabled ? '停用兌換碼' : '啟用兌換碼',
            type: 'link',
            disabled: !canEdit.value,
            onClick: () => toggleRedemption(record),
          },
          {
            label: '編輯',
            type: 'link',
            disabled: !canEdit.value,
            onClick: () => openFormModal(record),
          },
          {
            label: '改密碼',
            type: 'link',
            disabled: !canEdit.value,
            onClick: () => openPasswordModal(record),
          },
        ];
      },
    },
  ];
});

// 使用表格配置 Hook
// 注意：useTableConfig 接收 baseColumnsWithAction，但內部使用 visibleColumns（根據 visibleColumnKeys 過濾）來計算 scrollX
// visibleColumns 只包含可見欄位，所以 scrollX 只基於可見欄位計算，這是正確的
const tableConfig = useTableConfig(baseColumnsWithAction);

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  // 原因：當 scroll.x 為數字時，表示表格內部有固定寬度欄位，且總和超過容器寬度
  // 此時表格內部會出現滾動條，外層 container 也需要允許滾動，以確保表格內容可以完整顯示
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 若 visibleColumnKeys 尚未初始化完成（空或無效），不得套用 hideInTable（維持全部顯示）
  // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
  const isVisibleKeysValid = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return baseColumnsWithAction.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = isVisibleKeysValid ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumnItem = {
      ...col,
      hideInTable: !isVisible,
    };

    // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100; // 預設最小寬度 100px
    }

    // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
    // 這樣可以避免初始 render 時被壓縮為 0
    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
// 初始化階段不得反向覆寫 visibleColumnKeys，避免 columns ↔ visibleColumnKeys 的循環更新
// 同步僅反映「使用者在 column setting 中的操作」，不可改變預設欄位集合與順序
let isInitialized = false;
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // Guard: 初始化階段不得反向覆寫 visibleColumnKeys
    // 等待 visibleColumnKeys 初始化完成後才開始同步
    const currentKeys = tableConfig.visibleColumnKeys.value;
    if (!isInitialized) {
      // 檢查 visibleColumnKeys 是否已初始化（包含所有預設欄位）
      const expectedKeys = baseColumnsWithAction.value.map(col => {
        return (col.dataIndex as string) || (col.key as string) || '';
      }).filter(key => key);
      
      const hasAllExpectedKeys = expectedKeys.every(key => currentKeys.includes(key));
      if (hasAllExpectedKeys && currentKeys.length >= expectedKeys.length) {
        isInitialized = true;
      } else {
        // 尚未初始化完成，不進行同步
        return;
      }
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumnItem) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true, flush: 'post' },
);

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - 日期範圍：後端 API 過濾
 * - 關鍵字：前端過濾
 * - isEnabled：前端過濾
 * 因此為 HYBRID 模式
 */
const searchMode = computed<SearchMode>(() => {
  /** 日期範圍由後端過濾 */
  const hasBackendFilter = searchDateRange.value !== undefined;
  /** 關鍵字和啟用狀態由前端過濾 */
  const hasFrontendFilter = searchKeyword.value.trim() !== '' || searchIsEnabled.value !== undefined;

  if (hasBackendFilter && hasFrontendFilter) {
    return 'HYBRID';
  }
  if (hasBackendFilter && !hasFrontendFilter) {
    return 'BACKEND';
  }
  if (!hasBackendFilter && hasFrontendFilter) {
    return 'FRONTEND';
  }
  /**
   * 沒有任何搜尋條件時，根據實現邏輯判斷
   * 由於日期範圍是後端過濾，關鍵字和 isEnabled 是前端過濾，預設為 HYBRID
   */
  return 'HYBRID';
});

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const mode = searchMode.value;
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[mode];
});

// 避免 antd table 內被 tree-shake 的 import
void Modal;
</script>

<template>
  <div class="subaccount-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        header-title="子帳戶管理"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="{ x: tableConfig.scrollX.value }"
        :form-props="{
          schemas: [],
          resetFunc: handleReset,
        }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>子帳戶管理</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
        <template #form-formHeader>
          <a-col :span="24">
            <a-row :gutter="16" align="middle" style="margin-bottom: 16px">
              <a-col :span="8">
                <a-form-item label="帳號/名稱" class="mb-0" :label-col="{ span: 7 }" :wrapper-col="{ span: 17 }">
                  <a-input v-model:value="searchKeyword" placeholder="請輸入關鍵字" />
                </a-form-item>
              </a-col>

              <a-col :span="8">
                <a-form-item label="啟用" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                  <a-select v-model:value="searchIsEnabled" :options="statusOptions" allow-clear placeholder="全部" />
                </a-form-item>
              </a-col>

              <a-col :span="8">
                <a-form-item label="建立時間" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                  <a-range-picker v-model:value="searchDateRange" style="width: 100%" :allow-clear="true" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-col>
        </template>

        <template #toolbar>
          <a-space>
            <a-button type="primary" :disabled="!canCreate" @click="openFormModal()">
              新增
            </a-button>
          </a-space>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>
