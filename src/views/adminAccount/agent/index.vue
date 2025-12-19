<script setup lang="tsx">
import type { Dayjs } from 'dayjs';
import type { TableColumnItem, TableListItem } from './columns';
import type { AgentFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Switch, Tag } from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';
import AgentApi from '@/api/backend/adminAccount/agent';
import MasterAgentApi from '@/api/backend/adminAccount/masterAgent';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { baseColumns } from './columns';
import { getAgentSchemas, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountAgent' });

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
    throw new Error('Website 不可包含 http/https');
  }

  const isAllEmpty = [hashKey, apiDomain, whiteIPList, website].every(v => !v);
  if (isAllEmpty) {
    return { isAllEmpty: true, payload: { website: '', hashKey: '', apiDomain: '', whiteIPList: '' } };
  }

  // 四欄聯動：有填就必須全部填
  const hasAny = [hashKey, apiDomain, whiteIPList, website].some(v => !!v);
  const hasAll = [hashKey, apiDomain, whiteIPList, website].every(v => !!v);
  if (hasAny && !hasAll) {
    throw new Error('請完整填寫設定欄位，或全部留空');
  }

  if (whiteIPList && whiteIPList.length > 255) {
    throw new Error('White IP List 長度不可超過 255');
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

const loadTableData = async (params: LoadDataParams): Promise<TableListResponse> => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const listRaw = await AgentApi.getAgentListByMasterAgent({ masterAgent });
  const listBase = (Array.isArray(listRaw) ? listRaw : [])
    .filter((a: any) => a?.name !== `${masterAgent}agent`)
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
  const apiSettings = accounts.length ? await AgentApi.getAgentApiSettings({ agentAccounts: accounts }) : [];
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
    if (searchIsEnabled.value !== undefined) {
      if (Boolean(i?.isEnabled) !== (searchIsEnabled.value === 'true')) {
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
    message.success('更新成功');
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
    tableInstance?.reload();
  }
};

const openPasswordModal = async (record: Partial<TableListItem>) => {
  if (!record.account) {
    return;
  }
  await showModal({
    modalProps: {
      title: `變更密碼：${record.account}`,
      width: 520,
      async onFinish(values) {
        await AgentApi.updateAgentAccountPassword({
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

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯代理商' : '新增代理商',
      width: 860,
      async onFinish(values: AgentFormValues) {
        const roleIds = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        const account = String(values.account ?? '').trim();
        if (!account) {
          throw new Error('請輸入帳號');
        }

        if (isEdit && record?.id) {
          await AgentApi.updateAgentAccount({
            ...buildUpdatePayload(record),
            account,
            name: String(values.name ?? ''),
            prefix: String(values.prefix ?? ''),
            roles: roleIds,
          });

          await persistAgentApiSettings({
            agentAccount: account,
            masterAgent,
            values,
            hasExistingSettings: Boolean((record as any)?.hashKey || (record as any)?.apiDomain || (record as any)?.whiteIPList || (record as any)?.website),
            oldHashKey: (record as any)?.hashKey,
          });

          message.success('編輯成功');
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

          await persistAgentApiSettings({
            agentAccount: account,
            masterAgent,
            values,
            hasExistingSettings: false,
          });

          message.success('新增成功');
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 130,
      schemas: getAgentSchemas({ canEditApiSettings: canEditApiSettings.value }),
    },
  });

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      prefix: (record as any).prefix ?? '',
      roles: roleIds,
      website: normalizeWebsiteForForm((record as any)?.website),
      hashKey: (record as any)?.hashKey ? '**************' : '',
      apiDomain: (record as any)?.apiDomain ?? '',
      whiteIPList: (record as any)?.whiteIPList ?? '',
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  }
  else {
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
  ...baseColumns,
  {
    title: '啟用',
    dataIndex: 'isEnabled',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        checked={Boolean(record.isEnabled)}
        checkedChildren="啟用"
        unCheckedChildren="停用"
        onChange={checked => toggleEnabled(record, Boolean(checked))}
      />
    ),
  },
  {
    title: '狀態',
    dataIndex: 'statusTag',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Tag color={record.isEnabled ? 'green' : 'red'}>{record.isEnabled ? '啟用' : '停用'}</Tag>
    ),
  },
  {
    title: '操作',
    dataIndex: 'ACTION',
    width: 200,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '編輯',
        type: 'link',
        onClick: () => openFormModal(record),
      },
      {
        label: '改密碼',
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
    header-title="代理商管理"
    :data-request="loadTableData"
    :columns="columns"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
          <a-col :span="6">
            <a-form-item label="總代理" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-select
                v-if="canSelectMasterAgent"
                v-model:value="selectedMasterAgent"
                :options="masterAgentOptions"
                allow-clear
                placeholder="請選擇總代理"
                @change="onMasterAgentChanged"
              />
              <a-input v-else v-model:value="selectedMasterAgent" disabled />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item label="帳號/名稱" class="mb-0" :label-col="{ span: 7 }" :wrapper-col="{ span: 17 }">
              <a-input v-model:value="searchKeyword" placeholder="請輸入關鍵字" />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item label="啟用" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-select v-model:value="searchIsEnabled" :options="statusOptions" allow-clear placeholder="全部" />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item label="建立時間" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-range-picker v-model:value="searchDateRange" style="width: 100%" :allow-clear="true" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" :disabled="!canCreate || !selectedMasterAgent" @click="openFormModal()">
          新增
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>
