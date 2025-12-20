<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { TableColumnItem, TableListItem } from './columns';
import type { TokenFormValues } from './formSchemas';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal } from 'ant-design-vue';
import { computed, ref } from 'vue';
import Api, { TokenType } from '@/api/backend/adminAccount/token';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';

import { baseColumns, getTokenIconUrl } from './columns';
import { getTokenSchemas, TransactionLimitType } from './formSchemas';

defineOptions({ name: 'AdminAccountToken' });

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level <= 2);

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();

const searchMasterAgent = ref<string | undefined>(undefined);

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

const pickIconFile = (fileList?: UploadFile[]) => {
  const f = fileList?.[0]?.originFileObj;
  return f instanceof File ? f : undefined;
};

const loadTableData = async (_params: LoadDataParams) => {
  // ⚠️ 對齊 Vue2：需先選總代理才查詢
  if (!searchMasterAgent.value) {
    rowSelection.value.selectedRowKeys = [];
    rowSelection.value.selectedRows = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  const items = (await Api.queryTokens({ masterAgent: searchMasterAgent.value })) ?? [];
  rowSelection.value.selectedRowKeys = [];
  rowSelection.value.selectedRows = [];
  return {
    items,
    meta: { totalItems: items.length },
  };
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);
  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯代幣' : '新增代幣',
      width: 720,
      async onFinish(values: TokenFormValues) {
        const iconFileList = (values.iconFileList ?? []) as UploadFile[];
        if (!iconFileList.length) {
          throw new Error('請上傳代幣圖示');
        }

        const transactionLimit
          = values.transactionLimitType === TransactionLimitType.CanGift
            ? Number(values.transactionLimit ?? 0)
            : 0;

        if (values.transactionLimitType === TransactionLimitType.CanGift && transactionLimit <= 0) {
          throw new Error('贈送上限需大於 0');
        }

        if (isEdit && record?.id) {
          await Api.updateToken({
            id: Number(record.id),
            masterAgent: values.masterAgent,
            name: values.name,
            transactionLimit,
            // 有新選檔才送 iconFile（對齊 Vue2 isIconFilePic）
            iconFile: pickIconFile(iconFileList),
          });
          message.success('編輯成功');
        }
        else {
          const file = pickIconFile(iconFileList);
          if (!file) {
            // 未選新檔（只會是 url 預覽）→ 新增不允許
            throw new Error('請選擇要上傳的圖片檔案');
          }
          await Api.createToken({
            masterAgent: values.masterAgent,
            type: values.type ?? TokenType.GACHAPON_TICKET,
            name: values.name,
            transactionLimit,
            iconFile: file,
          });
          message.success('新增成功');
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: getTokenSchemas({ isEdit }),
    },
  });

  if (isEdit && record) {
    const iconFileList: UploadFile[] = record.iconUrl
      ? [
          {
            uid: `token-icon-${record.id}`,
            name: String(record.iconUrl).split('/').at(-1) || 'icon.png',
            status: 'done',
            url: getTokenIconUrl(record.iconUrl),
          } as UploadFile,
        ]
      : [];

    formRef?.setFieldsValue({
      id: Number(record.id),
      masterAgent: record.masterAgent ?? searchMasterAgent.value,
      type: record.type,
      name: record.name,
      transactionLimitType:
        record.transactionLimit && record.transactionLimit > 0
          ? TransactionLimitType.CanGift
          : TransactionLimitType.NotGift,
      transactionLimit: record.transactionLimit ?? 0,
      iconFileList,
    });
  }
  else {
    // 預設帶入搜尋區已選的 masterAgent
    if (searchMasterAgent.value) {
      formRef?.setFieldsValue({ masterAgent: searchMasterAgent.value });
    }
    formRef?.setFieldsValue({
      type: TokenType.GACHAPON_TICKET,
      transactionLimitType: TransactionLimitType.NotGift,
      transactionLimit: 0,
      iconFileList: [],
    });
  }
};

const delRowConfirm = async (record: TableListItem) => {
  await Api.removeToken({
    id: Number(record.id),
    masterAgent: record.masterAgent,
  });
  message.success('刪除成功');
  tableInstance?.reload();
};

/** ✅ 批量刪除：逐筆刪 */
const delRowsConfirm = () => {
  const rows = rowSelection.value.selectedRows;
  if (!rows.length) { return; }
  Modal.confirm({
    title: '確認刪除',
    content: `將逐筆刪除 ${rows.length} 筆，是否繼續？`,
    async onOk() {
      for (const row of rows) {
        await Api.removeToken({
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

<template>
  <a-result v-if="!hasPermission" status="403" title="權限不足" sub-title="您的帳號等級無法使用此功能" />

  <DynamicTable
    v-else
    row-key="id"
    header-title="代幣管理"
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
              <AdminAccountSelector v-model="searchMasterAgent" value-type="account" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" @click="openFormModal()">
          新增
        </a-button>
        <a-button type="default" :disabled="!hasSelected" @click="delRowsConfirm">
          批量刪除
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>
