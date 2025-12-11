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

/**
 * @description 打開新增/編輯表單彈窗
 * @param record 會員記錄（新增時為空對象）
 */
const openFormModal = async (record: Partial<TableListItem>) => {
  const [formRef] = await showModal({
    modalProps: {
      title: `${record.id ? '編輯' : '新增'}會員`,
      width: 700,
      onFinish: async (values) => {
        try {
          if (record.id) {
            await updateMember(Number(record.id), values);
            message.success('編輯成功');
          } else {
            await addMember(values);
            message.success('新增成功');
          }
          dynamicTableInstance?.reload();
        } catch (error) {
          console.error('保存失敗:', error);
          message.error(record.id ? '編輯失敗' : '新增失敗');
          throw error;
        }
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

/**
 * @description 刪除單筆會員資料
 * @param record 會員記錄
 */
const delRowConfirm = async (record: TableListItem) => {
  try {
    await deleteMember(Number(record.id));
    message.success('刪除成功');
    dynamicTableInstance?.reload();
  } catch (error) {
    console.error('刪除失敗:', error);
    message.error('刪除失敗');
  }
};

const columns = ref<TableColumnItem[]>([
  ...baseColumns,
  {
    title: '操作',
    width: 280,
    dataIndex: 'ACTION',
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '編輯',
        auth: {
          perm: 'member:data:update',
          effect: 'disable',
        },
        onClick: () => openFormModal(record),
      },
      {
        label: '修改狀態',
        auth: {
          perm: 'member:data:status',
          effect: 'disable',
        },
        onClick: () => {
          message.info('修改狀態功能開發中');
        },
      },
      {
        label: '修改餘額',
        auth: {
          perm: 'member:data:balance',
          effect: 'disable',
        },
        onClick: () => {
          message.info('修改餘額功能開發中');
        },
      },
      {
        label: '帳戶詳細',
        auth: 'member:data:read',
        onClick: () => {
          message.info('帳戶詳細功能開發中');
        },
      },
      {
        label: '刪除',
        auth: 'member:data:delete',
        popConfirm: {
          title: '確定要刪除此會員嗎?',
          onConfirm: () => delRowConfirm(record),
        },
      },
    ],
  },
]);

/**
 * @description 批量刪除會員資料
 * @param rowIds 選中的會員ID列表
 */
const delRowsConfirm = async (rowIds: string[]) => {
  Modal.confirm({
    title: '確認刪除',
    content: `確定要刪除選中的 ${rowIds.length} 筆資料嗎?`,
    async onOk() {
      try {
        await Promise.all(rowIds.map((id) => deleteMember(Number(id))));
        message.success('批量刪除成功');
        dynamicTableInstance?.reload();
      } catch (error) {
        console.error('批量刪除失敗:', error);
        message.error('批量刪除失敗');
      }
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
        <a-button v-auth="'member:data:create'" type="primary" @click="openFormModal({})"> 
          新增帳號 
        </a-button>
        <a-button v-auth="'member:data:update'" type="default"> 
          批次修改 
        </a-button>
        <a-button 
          v-auth="'member:data:delete'" 
          type="danger" 
          :disabled="!isCheckRows" 
          @click="delRowsConfirm(rowSelection.selectedRowKeys)"
        >
          批量刪除
        </a-button>
        <a-button v-auth="'member:data:export'" type="default" :disabled="!isCheckRows">
          匯出
        </a-button>
      </template>
    </DynamicTable>
  </div>
</template>
