<script setup lang="tsx">
import type { TableColumnItem, TableListItem } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Switch } from 'ant-design-vue';
import { computed, ref } from 'vue';
import Api from '@/api/backend/adminAccount/shareholder';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { baseColumns } from './columns';
import { baseSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountShareholder' });

const userStore = useUserStore();
const canCreate = computed(() => userStore.level === 2);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});
const [showModal] = useFormModal();

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

const loadTableData = async (_params: LoadDataParams): Promise<TableListResponse> => {
  const list = await Api.getShareholderList({});
  const items = (Array.isArray(list) ? list : [])
    .filter((i: any) => i?.isMasterAccount)
    .map((i: any) => ({
      id: Number(i.id),
      account: String(i.account ?? ''),
      name: String(i.name ?? ''),
      isEnabled: Boolean(i.isEnabled),
      isMasterAccount: Boolean(i.isMasterAccount),
      roles: Array.isArray(i.roles) ? i.roles : [],
    }));

  return {
    items,
    meta: {
      totalItems: items.length,
    },
  };
};

const toggleEnabled = async (record: TableListItem, checked: boolean) => {
  try {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
    await Api.updateShareholderAccount({
      id: Number(record.id),
      account: record.account,
      name: record.name,
      roles: roleIds,
      isEnabled: checked,
    });
    message.success('更新成功');
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('更新失敗');
    tableInstance?.reload();
  }
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯股東' : '新增股東',
      width: 700,
      async onFinish(values) {
        const payloadRoles = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        if (isEdit && record?.id) {
          await Api.updateShareholderAccount({
            id: Number(record.id),
            account: String(values.account),
            name: String(values.name),
            roles: payloadRoles,
            isEnabled: Boolean(record.isEnabled),
          });
          message.success('編輯成功');
        }
        else {
          await Api.createShareholderAccount({
            account: String(values.account),
            password: '123456',
            name: String(values.name),
            roles: payloadRoles,
            backendKey: generateBackendKey(),
          });
          message.success('新增成功');
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: baseSchemas,
    },
  });

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));

    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      roles: roleIds,
    });

    formRef?.updateSchema([
      { field: 'account', componentProps: { disabled: true } },
      { field: 'roles', componentProps: { disabled: userStore.level !== 2 } },
    ]);
  }
  else {
    formRef?.updateSchema([
      { field: 'account', componentProps: { disabled: false } },
      { field: 'roles', componentProps: { disabled: userStore.level !== 2 } },
    ]);
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
    title: '操作',
    dataIndex: 'ACTION',
    width: 140,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '編輯',
        type: 'link',
        onClick: () => openFormModal(record),
      },
    ],
  },
]);
</script>

<template>
  <DynamicTable
    row-key="id"
    header-title="股東管理"
    :data-request="loadTableData"
    :columns="columns"
    :pagination="false"
  >
    <template #toolbar>
      <a-space>
        <a-button type="primary" :disabled="!canCreate" @click="openFormModal()">
          新增
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>



