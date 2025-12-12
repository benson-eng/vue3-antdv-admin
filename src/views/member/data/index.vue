<script setup lang="ts">
import { ref, computed } from 'vue';
import { getBaseColumns, type TableColumnItem, type TableListItem } from './columns';
import { getBaseSchemas } from './formSchemas';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { message, Modal } from 'ant-design-vue';
import { deleteMember, getMemberList, addMember, updateMember } from '@/api/backend/member';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';

const { t } = useI18n('routes.member.dataPage');

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
      title: `${record.id ? t('edit') : t('add')} ${t('member')}`,
      width: 700,
      onFinish: async (values) => {
        try {
          if (record.id) {
            await updateMember(Number(record.id), values);
            message.success(t('editSuccess'));
          } else {
            await addMember(values);
            message.success(t('addSuccess'));
          }
          dynamicTableInstance?.reload();
        } catch (error) {
          console.error(t('saveFailed'), error);
          message.error(record.id ? t('editFailed') : t('addFailed'));
          throw error;
        }
      },
    },
    formProps: {
      labelWidth: 100,
      schemas: getBaseSchemas(t),
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
    message.success(t('deleteSuccess'));
    dynamicTableInstance?.reload();
  } catch (error) {
    console.error(t('deleteFailed'), error);
    message.error(t('deleteFailed'));
  }
};

/**
 * @description 批量刪除會員資料
 * @param rowIds 選中的會員ID列表
 */
const delRowsConfirm = async (rowIds: string[]) => {
  Modal.confirm({
    title: t('confirmDelete'),
    content: t('confirmDeleteBatch', { count: rowIds.length }),
    async onOk() {
      try {
        await Promise.all(rowIds.map((id) => deleteMember(Number(id))));
        message.success(t('batchDeleteSuccess'));
        dynamicTableInstance?.reload();
      } catch (error) {
        console.error(t('batchDeleteFailed'), error);
        message.error(t('batchDeleteFailed'));
      }
    },
  });
};

// 列配置（放在最後）
const columns = ref<TableColumnItem[]>([
  ...getBaseColumns(t),
  {
    title: t('operation'),
    width: 280,
    dataIndex: 'ACTION',
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: t('edit'),
        auth: {
          perm: 'member:data:update',
          effect: 'disable',
        },
        onClick: () => openFormModal(record),
      },
      {
        label: t('editStatus'),
        auth: {
          perm: 'member:data:status',
          effect: 'disable',
        },
        onClick: () => {
          message.info(t('statusFeatureDeveloping'));
        },
      },
      {
        label: t('editBalance'),
        auth: {
          perm: 'member:data:balance',
          effect: 'disable',
        },
        onClick: () => {
          message.info(t('balanceFeatureDeveloping'));
        },
      },
      {
        label: t('accountDetail'),
        auth: 'member:data:read',
        onClick: () => {
          message.info(t('detailFeatureDeveloping'));
        },
      },
      {
        label: t('delete'),
        auth: 'member:data:delete',
        popConfirm: {
          title: t('confirmDeleteMember'),
          onConfirm: () => delRowConfirm(record),
        },
      },
    ],
  },
]);
</script>

<template>
  <div>
    <DynamicTable
      row-key="id"
      :header-title="t('title')"
      :columns="columns"
      :data-request="loadTableData"
      :row-selection="rowSelection"
    >
      <template #toolbar>
        <a-button v-auth="'member:data:create'" type="primary" @click="openFormModal({})"> 
          {{ t('addAccount') }}
        </a-button>
        <a-button v-auth="'member:data:update'" type="default"> 
          {{ t('batchModify') }}
        </a-button>
        <a-button 
          v-auth="'member:data:delete'" 
          type="danger" 
          :disabled="!isCheckRows" 
          @click="delRowsConfirm(rowSelection.selectedRowKeys)"
        >
          {{ t('batchDelete') }}
        </a-button>
        <a-button v-auth="'member:data:export'" type="default" :disabled="!isCheckRows">
          {{ t('export') }}
        </a-button>
      </template>
    </DynamicTable>
  </div>
</template>
