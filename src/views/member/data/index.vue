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

// 批量選擇
const rowSelection = ref({
  selectedRowKeys: [] as string[],
  onChange: (selectedRowKeys: string[]) => {
    rowSelection.value.selectedRowKeys = selectedRowKeys;
  },
});

// 是否勾選了表格行
const isCheckRows = computed(() => rowSelection.value.selectedRowKeys.length);

const loadTableData = async (params: LoadDataParams) => {
  const data = await getMemberList(params);
  rowSelection.value.selectedRowKeys = [];
  return data;
};

// 新增/編輯
const openFormModal = async (record: Partial<TableListItem>) => {
  const [formRef] = await showModal({
    modalProps: {
      title: `${record.id ? '編輯' : '新增'}會員`,
      width: 700,
      onFinish: async (values) => {
        if (record.id) {
          await updateMember(Number(record.id), values);
          message.success('編輯成功');
        } else {
          await addMember(values);
          message.success('新增成功');
        }
        dynamicTableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 100,
      schemas: baseSchemas.map((schema) => {
        // 編輯時密碼不必填
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
  await deleteMember(Number(record.id));
  message.success('刪除成功');
  dynamicTableInstance?.reload();
};

const columns = ref<TableColumnItem[]>([
  ...baseColumns,
  {
    title: '操作',
    width: 240,
    dataIndex: 'ACTION',
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
        label: '修改狀態',
        type: 'link',
        onClick: () => {
          message.info('修改狀態功能開發中');
        },
      },
      {
        label: '修改餘額',
        type: 'link',
        onClick: () => {
          message.info('修改餘額功能開發中');
        },
      },
      {
        label: '帳戶詳細',
        type: 'link',
        onClick: () => {
          message.info('帳戶詳細功能開發中');
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
      await Promise.all(rowIds.map((id) => deleteMember(Number(id))));
      message.success('批量刪除成功');
      dynamicTableInstance?.reload();
    },
  });
};
</script>

<template>
  <div>
    <DynamicTable
      row-key="id"
      header-title="會員資料"
      :columns="columns"
      :data-request="loadTableData"
      :row-selection="rowSelection"
    >
      <template #toolbar>
        <a-button type="primary" @click="openFormModal({})"> 新增帳號 </a-button>
        <a-button type="default"> 批次修改 </a-button>
        <a-button type="default" :disabled="!isCheckRows" @click="delRowsConfirm(rowSelection.selectedRowKeys)">
          匯出
        </a-button>
      </template>
    </DynamicTable>
  </div>
</template>
