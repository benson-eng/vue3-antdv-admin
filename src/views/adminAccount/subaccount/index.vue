<script setup lang="tsx">
import type { Dayjs } from 'dayjs';
import type { TableColumnItem, TableListItem } from './columns';
import type { SubaccountFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Switch, Tag } from 'ant-design-vue';
import { computed, ref, watch } from 'vue';
import SubaccountApi from '@/api/backend/adminAccount/subaccount';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { baseColumns } from './columns';
import { getSubaccountSchemas, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountSubaccount' });

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
  const listRaw = await SubaccountApi.getAdminSubaccountList({ filter: {} });
  const list = normalizeList(listRaw as any);

  const keyword = searchKeyword.value.trim().toLowerCase();
  const range = searchDateRange.value;
  const start = range?.[0]?.startOf?.('day')?.valueOf?.();
  const end = range?.[1]?.endOf?.('day')?.valueOf?.();

  const filtered = list.filter((i: any) => {
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
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
    tableInstance?.reload();
  }
};

const toggleRedemption = async (record: TableListItem, checked: boolean) => {
  if (!canEdit.value) {
    return;
  }
  try {
    await SubaccountApi.updateAdminSubaccount(buildUpdatePayload(record, { allowRedemptionCode: checked }));
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

watch([searchKeyword, searchIsEnabled, searchDateRange], () => {
  tableInstance?.reload();
});

const columns = ref<TableColumnItem[]>([
  ...baseColumns,
  {
    title: '兌換碼',
    dataIndex: 'allowRedemptionCode',
    width: 140,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        disabled={!canEdit.value}
        checked={Boolean((record as any).allowRedemptionCode)}
        checkedChildren="啟用"
        unCheckedChildren="停用"
        onChange={checked => toggleRedemption(record, Boolean(checked))}
      />
    ),
  },
  {
    title: '啟用',
    dataIndex: 'isEnabled',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        disabled={!canEdit.value}
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
    width: 220,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
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
    ],
  },
]);

// 避免 antd table 內被 tree-shake 的 import
void Modal;
</script>

<template>
  <DynamicTable
    row-key="id"
    header-title="子帳戶管理"
    :data-request="loadTableData"
    :columns="columns"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
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
</template>
