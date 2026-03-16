<script setup lang="tsx">
import type { TableColumnItem, TableListItem } from './columns';
import type { SubaccountChildFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { computed, inject, nextTick, watch } from 'vue';
import SubaccountApi from '@/api/backend/adminAccount/subaccount';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '../masterAgent/useTableConfig';
import { baseColumns } from './columns';
import { getSubaccountChildSchemas, loadRolesOnce, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountSubaccountChildren' });

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const userStore = useUserStore();
const canEdit = computed(() => userStore.level < 4);
const canCreate = computed(() => userStore.level < 4);

const [DynamicTable, tableInstance] = useTable({
  search: true,
});
const [showModal] = useFormModal();

// 從 Layout inject 站長選單狀態（與 agent 頁面一致）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（與 agent 頁面一致）
// 優先使用 Layout 提供的值，如果沒有則使用 userStore.masterAgent（Level 4 用戶）
const selectedMasterAgent = computed(() => {
  // 優先使用 Layout 提供的站長值
  if (masterAgentCtx?.selectedMasterAgent.value) {
    return String(masterAgentCtx.selectedMasterAgent.value || '').trim();
  }
  // Level 4 用戶：如果 Layout 沒有值，使用 userStore.masterAgent
  if (userStore.level === 4) {
    return String(userStore.masterAgent || '').trim();
  }
  return '';
});

// 使用 computed 取得 contextVersion（與 agent 頁面一致）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

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

/**
 * 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格（與 agent 頁面一致）
 */
watch(
  () => contextVersion.value,
  async () => {
    // 重置 DynamicTable 查詢條件
    const searchFormRef = tableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    // 清空表格資料並自動重新載入
    await tableInstance?.reload(true);
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  },
);

// 對於 Level 4 用戶，同時監聽 userStore.masterAgent 變化
// 這是既有系統機制（userStore 是系統層狀態管理）
if (userStore.level === 4) {
  watch(
    () => userStore.masterAgent,
    async () => {
      // 當 userStore.masterAgent 變化時，重新載入表格資料
      await tableInstance?.reload(true);
      await nextTick();
      window.dispatchEvent(new Event('resize'));
    },
  );
}

const loadTableData = async (params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  // 使用從 Layout provide 取得的站長值（與 agent 頁面一致）
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 從表單 params 獲取查詢條件
  const accountParam = String(params.account || '').trim();
  const createDatetime = params.createDatetime;

  // 處理日期範圍
  let startDate: Date | undefined;
  let dueDate: Date | undefined;
  if (Array.isArray(createDatetime) && createDatetime.length === 2) {
    const start = createDatetime[0];
    const end = createDatetime[1];
    if (start && end) {
      startDate = dayjs(start).startOf('day').toDate();
      dueDate = dayjs(end).endOf('day').toDate();
    }
  }

  // 構建 API payload（保留既有 Breadcrumb 站長相關參數）
  const payload = {
    filter: {
      account: accountParam || undefined,
      masterAccount: `${masterAgent}agent`,
      ...(startDate && { startDate }),
      ...(dueDate && { dueDate }),
    },
  };

  // 暫時加入 console.log 確認點擊【查詢】時參數是否正確帶出
  console.log('loadTableData payload:', payload);

  const listRaw = await SubaccountApi.getAdminSubaccountList(payload);
  const list = normalizeList(listRaw as any);

  // 分頁處理
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  const totalItems = list.length;
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + limit;

  return {
    items: list.slice(startIdx, endIdx),
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

const toggleEnabled = async (record: TableListItem, checked: boolean) => {
  if (!canEdit.value) {
    return;
  }
  try {
    await SubaccountApi.updateAdminSubaccount(buildUpdatePayload(record, { isEnabled: checked }));
    message.success('更新成功');
    await tableInstance?.reload();
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
    await tableInstance?.reload();
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
};

const handleToggleAccount = (record: TableListItem) => {
  // 檢查角色：row.roles 不存在或為空陣列
  const roles = record.roles || [];
  if (!Array.isArray(roles) || roles.length === 0) {
    message.warning('此帳號尚未設定角色，請先更新角色後再進行變更');
    return;
  }

  // 有角色時，顯示確認視窗
  const isEnabled = Boolean(record.isEnabled);
  const action = isEnabled ? '停用' : '啟用';

  Modal.confirm({
    title: `確定要${action}帳號「${record.account}」嗎？`,
    onOk: async () => {
      await toggleEnabled(record, !isEnabled);
    },
  });
};

const toggleRedemption = async (record: TableListItem, checked: boolean) => {
  if (!canEdit.value) {
    return;
  }
  try {
    await SubaccountApi.updateAdminSubaccount(buildUpdatePayload(record, { allowRedemptionCode: checked }));
    message.success('更新成功');
    await tableInstance?.reload();
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
    await tableInstance?.reload();
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
};

const handleToggleRedemption = (record: TableListItem) => {
  const isEnabled = Boolean((record as any).allowRedemptionCode);
  const action = isEnabled ? '停用' : '啟用';

  Modal.confirm({
    title: `確定要${action}帳號「${record.account}」的兌換碼功能嗎？`,
    onOk: async () => {
      await toggleRedemption(record, !isEnabled);
    },
  });
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
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    message.warning('請先選擇總代理');
    return;
  }

  // Step 1: 在開窗前先確保 roles 已載入
  let rolesOptions: Array<{ label: string; value: number }> = [];
  try {
    rolesOptions = await loadRolesOnce();
  }
  catch (error) {
    console.error('載入角色清單失敗:', error);
    message.error('載入角色清單失敗');
    return;
  }

  // Step 2: 編輯狀態 roles 對齊（在開窗前先處理，避免重複觸發）
  // 如果角色不存在，將它們添加到選項中（與 agent 頁面一致）
  let finalRolesOptions = [...rolesOptions];
  let finalRoleIds: number[] = [];

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
    const roleOptionsValues = rolesOptions.map(r => r.value);

    // 找出不存在的角色
    const missingRoleIds = roleIds.filter(id => !roleOptionsValues.includes(id));

    // 將不存在的角色添加到選項中
    if (missingRoleIds.length > 0) {
      const missingRoles = (record.roles || []).filter((r: any) => {
        const roleId = Number(r.id);
        return Number.isFinite(roleId) && missingRoleIds.includes(roleId);
      });

      const missingRoleOptions = missingRoles.map((r: any) => ({
        label: r.name ? `${r.name}(${r.id})` : String(r.id),
        value: Number(r.id),
      }));

      // 將不存在的角色添加到選項中
      finalRolesOptions = [...rolesOptions, ...missingRoleOptions];
    }

    // 使用完整的 roleIds（包括不存在的角色）
    finalRoleIds = roleIds;
  }

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯家族帳戶' : '新增家族帳戶',
      width: 720,
      async onFinish(values: SubaccountChildFormValues) {
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
          await SubaccountApi.createAdminChildSubaccount({
            masterAccount: masterAgent,
            account,
            password: '123456',
            name: String(values.name ?? ''),
            isEnabled: true,
            roles: roleIds,
            backendKey: generateBackendKey(),
          });
          message.success('新增成功');
        }

        await tableInstance?.reload();
        await nextTick();
        window.dispatchEvent(new Event('resize'));
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: getSubaccountChildSchemas(finalRolesOptions),
    },
  });

  if (isEdit && record) {
    // 使用完整的 roleIds（包括不存在的角色）
    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      roles: finalRoleIds,
      allowRedemptionCode: Boolean((record as any).allowRedemptionCode),
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  }
  else {
    formRef?.setFieldsValue({ allowRedemptionCode: false });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: false } }]);
  }
};

/**
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料（不使用快取），行為等同於 tableInstance.reload(true)
 */
const handleFormSubmit = async () => {
  await tableInstance?.reload(true);
  await nextTick();
  window.dispatchEvent(new Event('resize'));
};

// 定義所有欄位（包含操作欄）
const baseColumnsWithAction = computed<TableColumnItem[]>(() => [
  ...baseColumns,
  {
    title: '兌換碼',
    dataIndex: 'allowRedemptionCode',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => {
      const isEnabled = Boolean((record as any).allowRedemptionCode);
      return (
        <Tag color={isEnabled ? 'green' : 'default'}>
          {isEnabled ? '啟用' : '停用'}
        </Tag>
      );
    },
  },
  {
    title: '狀態',
    dataIndex: 'statusTag',
    width: 100,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Tag color={record.isEnabled ? 'green' : 'red'}>
        {record.isEnabled ? '啟用' : '停用'}
      </Tag>
    ),
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
          whiteSpace: 'nowrap', // 禁止換行
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
          disabled: !canEdit.value,
          danger: isEnabled,
          onClick: () => handleToggleAccount(record),
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
        {
          label: isRedemptionEnabled ? '停用兌換碼' : '啟用兌換碼',
          type: 'link',
          disabled: !canEdit.value,
          onClick: () => handleToggleRedemption(record),
        },
      ];
    },
  },
]);

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumnsWithAction);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  return baseColumnsWithAction.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

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

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumnItem) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const currentKeys = tableConfig.visibleColumnKeys.value;
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true, flush: 'post' },
);

// 類型 B：有搜尋區頁面 - 使用 computed 組合 scroll 對象
// 只傳入 scroll.x，不傳入 scroll.y，讓 useScroll 根據 autoHeight 自動計算 scroll.y
// useScroll 會在 autoHeight 啟用時自動計算並設置 scroll.y
const tableScroll = computed(() => {
  return {
    x: tableConfig.scrollX.value,
    // 不傳入 y，讓 useScroll 根據 autoHeight: true 自動計算
  };
});

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

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - account：後端 API 查詢（filter.account）
 * - createDatetime：後端 API 查詢（filter.startDate、filter.dueDate）
 * - masterAgent：後端 API 查詢（filter.masterAccount）
 * 所有搜尋條件都通過後端 API 查詢，因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 嘗試獲取搜尋表單的值
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return 'BACKEND';
  }

  try {
    const formValues = searchFormRef.getFieldsValue();
    const hasAccount = Boolean(formValues?.account?.trim());
    const hasDateRange = Boolean(formValues?.createDatetime && Array.isArray(formValues.createDatetime) && formValues.createDatetime.length === 2);

    // 所有搜尋條件都通過後端 API 查詢，因此無論是否有搜尋條件，都顯示為 BACKEND
    return 'BACKEND';
  }
  catch {
    return 'BACKEND';
  }
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
  <div class="subaccount-children-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="tableScroll"
        :auto-height="true"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: false,
        }"
        @search="handleFormSubmit"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>家族管理</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
        <template #toolbar>
          <a-button type="primary" :disabled="!canCreate || !selectedMasterAgent" @click="openFormModal()">
            新增
          </a-button>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>
