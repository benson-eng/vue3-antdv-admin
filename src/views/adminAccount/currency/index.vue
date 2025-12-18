<template>
  <DynamicTable
    row-key="id"
    header-title="幣別管理"
    :data-request="loadTableData"
    :columns="columns"
    :row-selection="rowSelection"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
          <!-- 總代理 -->
          <a-col :span="6">
            <a-form-item label="總代理" class="mb-0" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
              <AdminAccountSelector v-model="searchMasterAgent" valueType="account" />
            </a-form-item>
          </a-col>

          <!-- 貨幣名稱 -->
          <!--
          <a-col :span="6">
            <a-form-item label="貨幣名稱" class="mb-0" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
              <a-input
                v-model:value="searchCurrencyName"
                placeholder="請輸入貨幣名稱"
              />
            </a-form-item>
          </a-col>
        -->
          <!-- 貨幣代碼 -->
          <!--
          <a-col :span="6">
            <a-form-item label="貨幣代碼" class="mb-0" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
              <a-input
                v-model:value="searchCurrencyCode"
                placeholder="請輸入貨幣代碼"
              />
            </a-form-item>
          </a-col>
          -->
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" @click="openFormModal()">新增</a-button>
        <a-button type="default" :disabled="!hasSelected" @click="delRowsConfirm">
          批量刪除
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { baseColumns } from './columns';
import { baseSchemas } from './formSchemas';
import type { TableColumnItem, TableListItem } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import Api from '@/api/backend/adminAccount/currency';

defineOptions({ name: 'AdminAccountCurrency' });

type SearchPayload = {
  masterAgent?: string;
  currencyName?: string;
  currencyCode?: string;
};

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();
const searchMasterAgent = ref<string | undefined>(undefined);
const searchCurrencyName = ref('');
const searchCurrencyCode = ref('');

const getSearchPayload = (): SearchPayload => {
  const payload: SearchPayload = {};
  if (searchMasterAgent.value) {
    payload.masterAgent = searchMasterAgent.value;
  }
  const currencyName = searchCurrencyName.value.trim();
  if (currencyName) {
    payload.currencyName = currencyName;
  }

  const currencyCode = searchCurrencyCode.value.trim();
  if (currencyCode) {
    payload.currencyCode = currencyCode;
  }
  return payload;
};

const applySearch = () => {
  tableInstance?.handleSubmit?.(getSearchPayload());
};

const resetSearch = () => {
  searchMasterAgent.value = undefined;
  searchCurrencyName.value = '';
  searchCurrencyCode.value = '';
  tableInstance?.handleSubmit?.({});
};

/** ✅ 同時保存 selectedRowKeys + selectedRows（關鍵） */
const rowSelection = ref({
  selectedRowKeys: [] as Array<string | number>,
  selectedRows: [] as TableListItem[],
  onChange: (keys: Array<string | number>, rows: TableListItem[]) => {
    rowSelection.value.selectedRowKeys = keys;
    rowSelection.value.selectedRows = rows;
  },
});

const hasSelected = computed(() => rowSelection.value.selectedRowKeys.length > 0);

const loadTableData = async (params: LoadDataParams) => {
  const payload = {
    ...params,
    ...getSearchPayload(),
  };
  const data = await Api.list(payload);

  rowSelection.value.selectedRowKeys = [];
  rowSelection.value.selectedRows = [];
  return data;
};


const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯幣別' : '新增幣別',
      width: 700,
      async onFinish(values) {
        // onFinish
        if (isEdit && record?.id) {
          await Api.updateCurrencyType({
            id: Number(record.id),
            currencyName: values.currencyName,
            currencySymbol: values.currencySymbol,
          });
          message.success('編輯成功');
        } else {
          await Api.createCurrencyType({
            adminAccountId: values.adminAccountId,
            currencyName: values.currencyName,
            currencySymbol: values.currencySymbol,
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
    formRef?.setFieldsValue(record);
  }
};

const delRowConfirm = async (record: TableListItem) => {
  await Api.deleteCurrencyType({
    id: Number(record.id),
    masterAgent: record.masterAgent,
  });
  message.success('刪除成功');
  tableInstance?.reload();
};

/** ✅ 批量刪除：用 selectedRows 逐筆刪（不需要 getRowByKey） */
const delRowsConfirm = () => {
  const rows = rowSelection.value.selectedRows;
  if (!rows.length) return;

  Modal.confirm({
    title: '確認刪除',
    content: `目前後端尚未支援批量刪除，將逐筆刪除 ${rows.length} 筆，是否繼續？`,
    async onOk() {
      for (const row of rows) {
        await Api.deleteCurrencyType({
          id: Number(row.id),
          masterAgent: row.masterAgent,
        });
      }
      message.success('刪除完成');
      rowSelection.value.selectedRowKeys = [];
      rowSelection.value.selectedRows = [];
      tableInstance?.reload();
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
