<script setup lang="tsx">
import type { TableColumnItem, TableListItem } from './columns';
import type { AgentFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, inject, nextTick, ref, watch } from 'vue';
import AgentApi from '@/api/backend/adminAccount/agent';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { useTableConfig } from '../masterAgent/useTableConfig';
import { getBaseColumns } from './columns';
import { MASTER_AGENT_SELECT_KEY } from './constants';
import { getAgentSchemas, getPasswordSchemas, loadRolesOnce } from './formSchemas';

defineOptions({ name: 'AdminAccountAgent' });

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.adminAccount');
const commonT = useI18n('common').t;
const userStore = useUserStore();
const canCreate = computed(() => userStore.level === 2 || userStore.level === 4);
const canEditApiSettings = computed(() => userStore.level <= 2);

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();

// 從 Layout 根元件 provide 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
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
  /**
   * 160-bit
   */
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

const normalizeWebsiteForForm = (raw?: string) => {
  if (!raw) {
    return '';
  }
  const cleaned = String(raw).replace(/^(http:\/\/|https:\/\/)/i, '');
  // Vue2：website 會長成 `${website}-${masterAgent}`，編輯時只顯示前段
  return cleaned.split('-')[0] || '';
};

const validateAndNormalizeApiSettings = (args: {
  website?: string;
  hashKey?: string;
  apiDomain?: string;
  whiteIPList?: string;
  masterAgent: string;
  oldHashKey?: string;
}) => {
  const website = String(args.website ?? '').trim();
  const apiDomain = String(args.apiDomain ?? '').trim();
  const whiteIPList = String(args.whiteIPList ?? '').trim();

  // hashKey：若是 ********** 代表使用者未改，沿用舊值
  let hashKey = String(args.hashKey ?? '').trim();
  if (hashKey.includes('*') && args.oldHashKey) {
    hashKey = String(args.oldHashKey);
  }

  const invalidProtocolRegex = /^(http:\/\/|https:\/\/)/i;
  if (website && invalidProtocolRegex.test(website)) {
    throw new Error(t('rules.websiteProtocol'));
  }

  const isAllEmpty = [hashKey, apiDomain, whiteIPList, website].every(v => !v);
  if (isAllEmpty) {
    return { isAllEmpty: true, payload: { website: '', hashKey: '', apiDomain: '', whiteIPList: '' } };
  }

  // 四欄聯動：有填就必須全部填
  const hasAny = [hashKey, apiDomain, whiteIPList, website].some(v => !!v);
  const hasAll = [hashKey, apiDomain, whiteIPList, website].every(v => !!v);
  if (hasAny && !hasAll) {
    throw new Error(t('rules.fourFieldsRequired'));
  }

  if (whiteIPList && whiteIPList.length > 255) {
    throw new Error(t('rules.whiteIPListLength'));
  }

  const websitePayload = website ? `${website}-${args.masterAgent}` : '';
  return {
    isAllEmpty: false,
    payload: { website: websitePayload, hashKey, apiDomain, whiteIPList },
  };
};

const persistAgentApiSettings = async (args: {
  agentAccount: string;
  masterAgent: string;
  values: Partial<AgentFormValues>;
  hasExistingSettings: boolean;
  oldHashKey?: string;
}) => {
  if (!canEditApiSettings.value) {
    return;
  }

  const normalized = validateAndNormalizeApiSettings({
    website: args.values.website,
    hashKey: args.values.hashKey,
    apiDomain: args.values.apiDomain,
    whiteIPList: args.values.whiteIPList,
    masterAgent: args.masterAgent,
    oldHashKey: args.oldHashKey,
  });

  if (normalized.isAllEmpty) {
    if (args.hasExistingSettings) {
      await AgentApi.deleteAgentApiSettings({ agentAccount: args.agentAccount });
    }
    return;
  }

  await AgentApi.updateAgentApiSettings({
    agentAccount: args.agentAccount,
    ...normalized.payload,
  });
};

const loadTableData = async (_params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  // 使用從 LayoutBreadcrumb provide 取得的站長值
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const response = await AgentApi.getAgentListByMasterAgent({ masterAgent });
  // Vue2 版本返回 { data: [...] }，需要解構
  const listRaw = (response as any)?.data ?? response;
  const listBase = (Array.isArray(listRaw) ? listRaw : [])
    // .filter((a: any) => a?.name !== `${masterAgent}agent`)
    .map((a: any) => ({
      ...a,
      id: Number(a.id),
      account: String(a.account ?? '').split('.')[0],
      name: String(a.name ?? ''),
      prefix: String(a.prefix ?? ''),
      isEnabled: Boolean(a.isEnabled),
      isMaintained: Boolean(a.isMaintained),
      roles: Array.isArray(a.roles) ? a.roles : [],
    }));

  const accounts = listBase.map((a: any) => a.account).filter(Boolean);
  const apiSettingsResponse = accounts.length ? await AgentApi.getAgentApiSettings({ agentAccounts: accounts }) : null;
  // Vue2 版本返回 { data: [...] }，需要解構
  const apiSettings = (apiSettingsResponse as any)?.data ?? (Array.isArray(apiSettingsResponse) ? apiSettingsResponse : []);
  const apiMap: Record<string, any> = {};
  (Array.isArray(apiSettings) ? apiSettings : []).forEach((item: any) => {
    const acc = String(item?.account ?? '');
    const s = item?.apiSettings ?? {};
    apiMap[acc] = {
      website: s?.website ?? '',
      apiDomain: s?.apiDomain ?? '',
      whiteIPList: s?.whiteIPList ?? '',
      hashKey: s?.hashKey ?? '',
    };
  });

  const merged = listBase.map((a: any) => ({
    ...a,
    ...(apiMap[a.account] ?? { website: '', apiDomain: '', whiteIPList: '', hashKey: '' }),
  }));
  return {
    items: merged,
    meta: {
      totalItems: merged.length,
    },
  };
};

// 注意：過濾邏輯已移至 loadTableData 中，與 masterAgent/index.vue 保持一致
// 不再需要 filteredItems computed，因為過濾在 loadTableData 中完成

const buildUpdatePayload = (record: Partial<TableListItem>, overrides: Record<string, any> = {}) => {
  const roleIds = Array.isArray(record.roles)
    ? record.roles.map((r: any) => Number(r?.id)).filter((n: number) => Number.isFinite(n))
    : [];

  return {
    id: Number(record.id),
    account: String(record.account ?? ''),
    name: String(record.name ?? ''),
    prefix: String(record.prefix ?? ''),
    isEnabled: Boolean(record.isEnabled),
    isMaintained: Boolean(record.isMaintained),
    roles: roleIds,
    ...overrides,
  };
};

const toggleEnabled = async (record: TableListItem, checked: boolean) => {
  try {
    await AgentApi.updateAgentAccount(buildUpdatePayload(record, { isEnabled: checked }));
    message.success(t('message.updateSuccess'));
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error(t('message.updateFailed'));
    tableInstance?.reload();
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
  const action = isEnabled ? t('labels.disable') : t('labels.enable');

  Modal.confirm({
    title: t('confirm.enableAccount', {
      action,
      account: record.account,
    }),
    onOk: async () => {
      await toggleEnabled(record, !isEnabled);
    },
  });
};

const openPasswordModal = async (record: Partial<TableListItem>) => {
  if (!record.account) {
    return;
  }
  await showModal({
    modalProps: {
      title: t('dialog.changePassword', { account: record.account }),
      width: 520,
      async onFinish(values) {
        await AgentApi.updateAgentAccountPassword({
          account: String(record.account),
          newPassword: String(values.newPassword),
        });
        message.success(t('message.changePasswordSuccess'));
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: getPasswordSchemas(t),
    },
  });
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    message.warning(t('page.selectMasterAgentFirst'));
    return;
  }

  // Step 2: 在開窗前先確保 roles 已載入
  let rolesOptions: Array<{ label: string; value: number }> = [];
  try {
    rolesOptions = await loadRolesOnce();
  }
  catch (error) {
    console.error('載入角色清單失敗:', error);
    message.error(t('message.loadRolesFailed'));
    return;
  }

  // Step 3: 編輯狀態 roles 對齊（在開窗前先處理，避免重複觸發）
  // 如果角色不存在，將它們添加到選項中（與站台設定一樣）
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

  // 使用 ref 保存表單實例，用於驗證
  const formInstanceRef = ref<any>(null);

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? t('dialog.editAgent') : t('dialog.createAgent'),
      width: 860,
      async onFinish(values: AgentFormValues) {
        const roleIds = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        const account = String(values.account ?? '').trim();
        if (!account) {
          throw new Error(t('rules.accountRequired'));
        }

        // Step 4: API 設定四欄聯動驗證（只要其中一個有輸入，另外三個都要有輸入）
        if (canEditApiSettings.value) {
          const website = String(values.website ?? '').trim();
          const hashKey = String(values.hashKey ?? '').trim();
          const apiDomain = String(values.apiDomain ?? '').trim();
          const whiteIPList = String(values.whiteIPList ?? '').trim();

          // 檢查是否有任何一個欄位有值
          const hasAny = [website, hashKey, apiDomain, whiteIPList].some(v => !!v);
          // 檢查是否全部都有值
          const hasAll = [website, hashKey, apiDomain, whiteIPList].every(v => !!v);

          // 四欄聯動：有填就必須全部填
          if (hasAny && !hasAll) {
            throw new Error(t('rules.fourFieldsRequired'));
          }
        }

        if (isEdit && record?.id) {
          await AgentApi.updateAgentAccount({
            ...buildUpdatePayload(record),
            account,
            name: String(values.name ?? ''),
            prefix: String(values.prefix ?? ''),
            roles: roleIds,
          });

          try {
            await persistAgentApiSettings({
              agentAccount: account,
              masterAgent,
              values,
              hasExistingSettings: Boolean((record as any)?.hashKey || (record as any)?.apiDomain || (record as any)?.whiteIPList || (record as any)?.website),
              oldHashKey: (record as any)?.hashKey,
            });
          }
          catch (error: any) {
            const errorMsg = error?.message || t('message.apiSettingsSaveFailed');
            message.error(errorMsg);
            throw error;
          }

          message.success(t('message.editSuccess'));
        }
        else {
          await AgentApi.createAgentAccount({
            account,
            password: '123456',
            name: String(values.name ?? ''),
            prefix: String(values.prefix ?? ''),
            isEnabled: true,
            roles: roleIds,
            backendKey: generateBackendKey(),
            masterAgentAccount: masterAgent,
          });

          try {
            await persistAgentApiSettings({
              agentAccount: account,
              masterAgent,
              values,
              hasExistingSettings: false,
            });
          }
          catch (error: any) {
            const errorMsg = error?.message || t('message.apiSettingsSaveFailed');
            message.error(errorMsg);
            throw error;
          }

          message.success(t('message.createSuccess'));
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 130,
      // 設定表單驗證觸發時機
      validateTrigger: ['blur', 'change'],
      schemas: getAgentSchemas({
        canEditApiSettings: canEditApiSettings.value,
        pt: t,
        masterAgent,
        onHashKeyGen: generateBackendKey,
        rolesOptions: finalRolesOptions, /**
                                          * 傳入角色選項（包含不存在的角色，已添加到選項中）
                                          */
        getFormInstance: () => formInstanceRef.value, // 傳入獲取表單實例的函數
      }),
    },
  });

  // 保存表單實例引用，用於驗證
  formInstanceRef.value = formRef;

  // 使用 nextTick 確保表單已完全初始化後再設定值
  await nextTick();

  if (isEdit && record) {
    // 使用完整的 roleIds（包含不存在的角色，已添加到選項中）
    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      prefix: (record as any).prefix ?? '',
      roles: finalRoleIds,
      website: normalizeWebsiteForForm((record as any)?.website),
      hashKey: (record as any)?.hashKey ? '**************' : '',
      apiDomain: (record as any)?.apiDomain ?? '',
      whiteIPList: (record as any)?.whiteIPList ?? '',
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  }
  else {
    // 新增時，API 設定欄位預設為空
    formRef?.setFieldsValue({
      website: '',
      hashKey: '',
      apiDomain: '',
      whiteIPList: '',
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: false } }]);
  }
};

// 定義所有欄位（包含操作欄）
// 注意：masterAgent 已從搜尋 schema 中移除，改為 page-level 控制元件
const baseColumnsWithAction = computed<TableColumnItem[]>(() => {
  return [
    ...getBaseColumns(t),
    {
      title: t('column.accountStatus'),
      dataIndex: 'statusTag',
      width: 100,
      hideInSearch: true,
      customRender: ({ record }) => (
        <Tag color={record.isEnabled ? 'success' : 'error'}>
          {record.isEnabled ? t('labels.enable') : t('labels.disable')}
        </Tag>
      ),
    },
    {
      title: t('action.operation'),
      dataIndex: 'ACTION',
      width: 320, // 調寬操作欄位，避免按鈕換行
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      /**
       * 防止內容換行
       */
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
      actions: ({ record }) => {
        const isEnabled = Boolean(record.isEnabled);
        return [
          {
            label: isEnabled ? commonT('action.disable') : commonT('action.enable'),
            type: 'link',
            /** 停用按鈕使用 danger 樣式 */
            danger: isEnabled,
            onClick: () => {
              handleToggleAccount(record);
            },
          },
          {
            label: commonT('action.edit'),
            type: 'link',
            onClick: () => openFormModal(record),
          },
          {
            label: commonT('action.changePassword'),
            type: 'link',
            onClick: () => openPasswordModal(record),
          },
        ];
      },
    },
  ];
});

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
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料，使用當前選取的站長值
 */
const handleFormSubmit = () => {
  tableInstance?.reload(true);
};

/**
 * 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格
 */
watch(
  () => contextVersion.value,
  () => {
    // 重置 DynamicTable 查詢條件
    const searchFormRef = tableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    // 清空表格資料並自動重新載入
    tableInstance?.reload(true);
  },
);

// 注意：過濾條件現在通過表單的 getFieldsValue 直接傳遞到 loadTableData 的 params 中
// 不再需要手動同步表單值到額外的 ref，因為過濾邏輯在 loadTableData 中處理

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Context Selector）
 * - account、createDatetime：搜尋表單欄位，但目前未在 loadTableData 中使用
 * 因此為 BACKEND 模式
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
    const hasSearchConditions = hasAccount || hasDateRange;

    // 目前搜尋條件未在 API 中使用，也未實現前端過濾
    // 因此無論是否有搜尋條件，都顯示為 BACKEND
    // 如果未來實現了前端過濾或後端查詢，可以根據實際情況調整
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
  <div class="agent-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="{ x: tableConfig.scrollX.value }"
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
            <span>{{ t('page.agentManagement') }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
        <template #toolbar>
          <a-button type="primary" :disabled="!canCreate || !selectedMasterAgent" @click="openFormModal()">
            {{ t('button.add') }}
          </a-button>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>
