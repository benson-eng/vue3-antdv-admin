<script setup lang="tsx">
import type { Dayjs } from 'dayjs';
import type { TableColumnItem, TableListItem } from './columns';
import type { AgentFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Switch, Tag } from 'ant-design-vue';
import { computed, nextTick, onMounted, ref } from 'vue';
import AgentApi from '@/api/backend/adminAccount/agent';
import MasterAgentApi from '@/api/backend/adminAccount/masterAgent';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { getBaseColumns } from './columns';
import { getAgentSchemas, getPasswordSchemas, loadRolesOnce } from './formSchemas';

defineOptions({ name: 'AdminAccountAgent' });

const { t } = useI18n('page.adminAccount');
const { t: tCommon } = useI18n();
const userStore = useUserStore();
const canCreate = computed(() => userStore.level === 2 || userStore.level === 4);
const canEditApiSettings = computed(() => userStore.level <= 2);
const canSelectMasterAgent = computed(() => userStore.level < 4);

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();

const masterAgentOptions = ref<{ label: string; value: string }[]>([]);
const selectedMasterAgent = ref<string>(userStore.level >= 4 ? String(userStore.masterAgent || '') : '');

const searchKeyword = ref<string>('');
const searchDateRange = ref<[Dayjs, Dayjs] | undefined>(undefined);

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

const loadMasterAgentOptions = async () => {
  if (!canSelectMasterAgent.value) {
    return;
  }
  try {
    const list = await MasterAgentApi.getMasterAgentAccountList({});
    masterAgentOptions.value = (Array.isArray(list) ? list : [])
      .map((i: any) => String(i?.account ?? '').trim())
      .filter(Boolean)
      .map(account => ({ label: account, value: account }));

    // 自動帶入第一個選項
    if (masterAgentOptions.value.length > 0 && !selectedMasterAgent.value) {
      selectedMasterAgent.value = masterAgentOptions.value[0].value;
      // 自動觸發表格重新載入
      tableInstance?.reload();
    }
  }
  catch (e) {
    console.error(e);
    masterAgentOptions.value = [];
  }
};

onMounted(async () => {
  await loadMasterAgentOptions();
});

const onMasterAgentChanged = () => {
  tableInstance?.reload();
};

const calculateTableScrollX = () => {
  /** 帳號 + 名稱 + 前綴 + 角色 + Website + API Domain + White IP List */
  const baseColumnsWidth = 140 + 140 + 80 + 220 + 200 + 200 + 220;
  /** 建立時間 + 最後登入時間 + 最後登入 IP */
  const datetimeColumnsWidth = 180 + 180 + 160;
  /** 啟用 + 狀態 */
  const statusColumnsWidth = 120 + 120;
  /** 操作 */
  const actionColumnWidth = 200;
  const totalWidth = baseColumnsWidth + datetimeColumnsWidth + statusColumnsWidth + actionColumnWidth;
  /** 加上一些緩衝空間，確保不會出現跑版 */
  return totalWidth + 50;
};

const loadTableData = async (params: LoadDataParams): Promise<TableListResponse> => {
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

  const keyword = searchKeyword.value.trim().toLowerCase();
  const range = searchDateRange.value;
  const start = range?.[0]?.startOf?.('day')?.valueOf?.();
  const end = range?.[1]?.endOf?.('day')?.valueOf?.();

  const filtered = merged.filter((i: any) => {
    if (keyword) {
      const acc = String(i?.account ?? '').toLowerCase();
      const name = String(i?.name ?? '').toLowerCase();
      if (!acc.includes(keyword) && !name.includes(keyword)) {
        return false;
      }
    }
    if (start != null && end != null) {
      const ts = i?.createDatetime ? new Date(i.createDatetime).getTime() : Number.NaN;
      if (Number.isFinite(ts)) {
        if (ts < start || ts > end) {
          return false;
        }
      }
    }
    return true;
  });

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

const columns = ref<TableColumnItem[]>([
  ...getBaseColumns(t),
  {
    title: t('labels.enable'),
    dataIndex: 'isEnabled',
    width: 120,
    align: 'center',
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        checked={Boolean(record.isEnabled)}
        checkedChildren={t('labels.enable')}
        unCheckedChildren={t('labels.disable')}
        onChange={checked => toggleEnabled(record, Boolean(checked))}
      />
    ),
  },
  {
    title: t('column.accountStatus'),
    dataIndex: 'statusTag',
    width: 120,
    align: 'center',
    hideInSearch: true,
    customRender: ({ record }) => (
      <Tag color={record.isEnabled ? 'green' : 'red'}>
        {record.isEnabled ? t('labels.enable') : t('labels.disable')}
      </Tag>
    ),
  },
  {
    title: t('action.operation'),
    dataIndex: 'ACTION',
    width: 200,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: t('action.edit'),
        type: 'link',
        onClick: () => openFormModal(record),
      },
      {
        label: t('action.changePassword'),
        type: 'link',
        onClick: () => openPasswordModal(record),
      },
    ],
  },
]);

// 避免 antd table 內被 tree-shake 的 import
void Modal;
</script>

<template>
  <DynamicTable
    row-key="id"
    :header-title="t('page.agentManagement')"
    :data-request="loadTableData"
    :columns="columns"
    :scroll="{ x: calculateTableScrollX() }"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
          <a-col :span="6">
            <a-form-item :label="t('page.masterAgent')" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-select
                v-if="canSelectMasterAgent"
                v-model:value="selectedMasterAgent"
                :options="masterAgentOptions"
                :allow-clear="false"
                :placeholder="t('page.selectMasterAgent')"
                @change="onMasterAgentChanged"
              />
              <a-input v-else v-model:value="selectedMasterAgent" disabled />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item :label="t('column.account')" class="mb-0" :label-col="{ span: 7 }" :wrapper-col="{ span: 17 }">
              <a-input v-model:value="searchKeyword" :placeholder="t('labels.input')" />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item :label="t('column.createDatetime')" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-range-picker
                v-model:value="searchDateRange"
                style="width: 100%"
                :allow-clear="true"
                :placeholder="[tCommon('startTime'), tCommon('dueTime')]"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" :disabled="!canCreate || !selectedMasterAgent" @click="openFormModal()">
          {{ t('button.add') }}
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>
