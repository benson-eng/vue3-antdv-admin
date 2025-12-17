<template>
  <div>
    <DynamicTable
      row-key="id"
      header-title="幣別管理"
      :data-request="loadTableData"
      :columns="columns"
      :row-selection="rowSelection"
    >
      <template #toolbar>
        <a-space>
          <a-button type="primary" @click="openFormModal({})">新增</a-button>
          <a-button type="default" :disabled="!isCheckRows" @click="delRowsConfirm(rowSelection.selectedRowKeys)">
            批量刪除
          </a-button>
        </a-space>
      </template>
    </DynamicTable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal/';
import { baseColumns } from './columns';
import { baseSchemas } from './formSchemas';
import type { TableColumnItem, TableListItem } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import Api from '@/api/backend/adminAccount/currency';

defineOptions({
  name: 'AdminAccountCurrency',
});

const [DynamicTable, dynamicTableInstance] = useTable({
  formProps: { autoSubmitOnEnter: true },
});
const [showModal] = useFormModal();

const rowSelection = ref({
  selectedRowKeys: [] as string[],
  onChange: (selectedRowKeys: string[]) => {
    rowSelection.value.selectedRowKeys = selectedRowKeys;
  },
});

const isCheckRows = computed(() => rowSelection.value.selectedRowKeys.length > 0);

const loadTableData = async (params: LoadDataParams) => {
  const data = await Api.list(params as Record<string, unknown>);
  rowSelection.value.selectedRowKeys = [];
  return data;
};

const openFormModal = async (record: Partial<TableListItem>) => {
  const [formRef] = await showModal({
    modalProps: {
      title: record.id ? '編輯幣別' : '新增幣別',
      width: 700,
      onFinish: async (values) => {
        if (record.id) {
          await Api.update(Number(record.id), values);
          message.success('編輯成功');
        } else {
          await Api.create(values);
          message.success('新增成功');
        }
        dynamicTableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: baseSchemas,
    },
  });

  if (record.id) {
    formRef?.setFieldsValue(record);
  }
};

const delRowConfirm = async (record: TableListItem) => {
  await Api.delete(Number(record.id));
  message.success('刪除成功');
  dynamicTableInstance?.reload();
};

const delRowsConfirm = async (rowIds: string[]) => {
  Modal.confirm({
    title: '確認刪除',
    content: `確定要刪除選中的 ${rowIds.length} 筆資料嗎？`,
    async onOk() {
      await Promise.all(rowIds.map((id) => Api.delete(Number(id))));
      message.success('批量刪除成功');
      dynamicTableInstance?.reload();
    },
  });
};

const columns = ref<TableColumnItem[]>([
  ...baseColumns,
  {
    title: '操作',
    dataIndex: 'ACTION',
    width: 220,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '查看',
        type: 'link',
        onClick: () => openFormModal(record),
      },
      {
        label: '編輯',
        type: 'link',
        onClick: () => openFormModal(record),
      },
      {
        label: '刪除',
        type: 'link',
        popConfirm: {
          title: '確認刪除？',
          onConfirm: () => delRowConfirm(record),
        },
      },
    ],
  },
]);
</script>
