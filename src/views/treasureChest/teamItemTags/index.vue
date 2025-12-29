<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message, Modal, Switch } from 'ant-design-vue';
import { useTable } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import {
  itemTagList,
  addItemTag,
  updateItemTag,
  removeItemTag,
  bulkUpdateItemTagOrder,
  type ItemTag,
  type ItemTypes,
} from '@/api/backend/treasureChestSystem';
import { getColumns } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';

defineOptions({
  name: 'TeamItemTags',
});

const { t } = useI18n('page.teamItemTags');
const userStore = useUserStore();

const [DynamicTable, dynamicTableInstance] = useTable({
  formProps: { autoSubmitOnEnter: true },
});

const [showModal] = useFormModal();

// 總代理選擇
const masterAgent = ref<string>('');
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);

// 表格數據
const tableData = ref<ItemTag[]>([]);
const isShowOrderSubmitBtn = ref(false);
const originalOrder = ref<number[]>([]);

// 道具類型選項（只顯示 teamBadge）
const itemTypes: ItemTypes[] = ['teamBadge'];

// 獲取總代理列表
const fetchMasterAgents = async () => {
  const list = await getMasterAgentList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));
  
  // 如果用戶等級 >= 4，自動選擇第一個總代理
  if (userStore.level >= 4 && list && list.length > 0) {
    masterAgent.value = list[0].account;
    await loadItemTagList();
  }
};

// 載入標籤列表
const loadItemTagList = async () => {
  if (!masterAgent.value) {
    tableData.value = [];
    dynamicTableInstance?.reload();
    return;
  }
  
  try {
    const res: any = await itemTagList({ masterAgent: masterAgent.value });
    console.log('itemTagList API 回傳:', res);
    
    // 對齊 Vue2 邏輯：res.data 可能是陣列或 { data: [...] } 格式
    // 根據實際回傳格式，後端直接回傳陣列：[{...}, {...}]
    // Vue2 的處理：res.data.forEach(...)，表示 res.data 是陣列
    // Vue3 的 request 對於 AdminSystem API 返回 response，res.data 是後端的回傳
    // 如果後端直接回傳陣列，則 res.data 就是陣列
    // 如果後端回傳 { data: [...] }，則 res.data.data 是陣列
    let dataArray: ItemTag[] = [];
    
    // 檢查各種可能的回傳格式
    if (Array.isArray(res)) {
      // 如果 request 函數直接返回陣列
      dataArray = res;
    } else if (Array.isArray(res.data)) {
      // 後端直接回傳陣列（實際情況）
      dataArray = res.data;
    } else if (res.data && Array.isArray(res.data.data)) {
      // 後端回傳 { data: [...] } 格式（Vue2 包裝後的情況）
      dataArray = res.data.data;
    } else if (res.data && res.data.error) {
      // 如果有錯誤，不處理數據
      console.error('API 回傳錯誤:', res.data.error);
      tableData.value = [];
      dynamicTableInstance?.reload();
      return;
    }
    
    console.log('解析後的數據陣列:', dataArray);
    
    // 對齊 Vue2 邏輯：只顯示 teamBadge 類型的標籤
    // Vue2: res.data.forEach(function(item:any) { if (item.itemType === "teamBadge") { nData.push(item); } })
    const filteredData = dataArray.filter(item => item.itemType === 'teamBadge');
    console.log('過濾後的 teamBadge 數據:', filteredData);
    
    // 對齊 Vue2 邏輯：將 enabled 轉換為布林值
    // Vue2: this.itemTagList = nData.map(d => { return { ...d, enabled: !!d.enabled }; });
    tableData.value = filteredData.map(d => ({ ...d, enabled: !!d.enabled }));
    originalOrder.value = filteredData.map(d => d.order);
    isShowOrderSubmitBtn.value = false;
    
    // 刷新表格
    dynamicTableInstance?.reload();
  } catch (error) {
    console.error('載入標籤列表失敗', error);
    message.error(t('loadFailed'));
    tableData.value = [];
    dynamicTableInstance?.reload();
  }
};

// 總代理變更處理
const handleMasterAgentChange = async (value: string) => {
  masterAgent.value = value;
  await loadItemTagList();
};

// 載入表格數據
const loadTableData = async (params: LoadDataParams) => {
  // 如果沒有選擇 masterAgent，返回空數據
  if (!masterAgent.value) {
    return {
      ...params,
      items: [],
      total: 0,
    };
  }
  
  // 如果 tableData 已經有數據，直接返回
  if (tableData.value.length > 0) {
    return {
      ...params,
      items: tableData.value,
      total: tableData.value.length,
    };
  }
  
  // 如果 tableData 為空，嘗試載入數據
  await loadItemTagList();
  
  return {
    ...params,
    items: tableData.value,
    total: tableData.value.length,
  };
};

// 打開新增/編輯表單彈窗
const openFormModal = async (record?: ItemTag) => {
  const [formRef] = await showModal({
    modalProps: {
      title: record ? t('formTitle.edit') : t('formTitle.create'),
      width: 500,
      onFinish: async (values) => {
        try {
          if (record) {
            await updateItemTag({
              tagID: record.id,
              masterAgent: masterAgent.value,
              tag: values.tag,
              itemType: values.itemType,
            });
            message.success(t('updateSuccess'));
          } else {
            await addItemTag({
              masterAgent: masterAgent.value,
              tag: values.tag,
              itemType: values.itemType || 'teamBadge',
            });
            message.success(t('createSuccess'));
          }
          await loadItemTagList();
          dynamicTableInstance?.reload();
        } catch (error) {
          console.error('保存失敗', error);
          message.error(record ? t('updateFailed') : t('createFailed'));
          throw error;
        }
      },
    },
    formProps: {
      labelWidth: 100,
      schemas: [
        {
          field: 'itemType',
          label: t('form.itemType'),
          component: 'Select',
          componentProps: {
            disabled: true,
            options: itemTypes.map(type => ({
              label: t(`itemType.${type}`),
              value: type,
            })),
          },
          defaultValue: 'teamBadge',
        },
        {
          field: 'tag',
          label: t('form.tag'),
          component: 'Input',
          componentProps: {
            placeholder: t('form.tagPlaceholder'),
          },
          rules: [{ required: true, message: t('form.tagRequired') }],
        },
      ],
    },
  });

  if (record) {
    formRef?.setFieldsValue({
      tag: record.tag,
      itemType: record.itemType,
    });
  }
};

// 刪除標籤
const handleDelete = async (record: ItemTag) => {
  Modal.confirm({
    title: t('removeTagPopMessageBox.title'),
    content: t('removeTagPopMessageBox.content'),
    async onOk() {
      try {
        await removeItemTag({
          tagID: record.id,
          masterAgent: masterAgent.value,
        });
        message.success(t('deleteSuccess'));
        await loadItemTagList();
        dynamicTableInstance?.reload();
      } catch (error) {
        console.error('刪除失敗', error);
        message.error(t('deleteFailed'));
      }
    },
  });
};

// 更新標籤啟用狀態
const handleEnabledChange = async (record: ItemTag, enabled: boolean) => {
  try {
    await updateItemTag({
      tagID: record.id,
      masterAgent: masterAgent.value,
      enabled,
    });
    message.success(t('updateSuccess'));
    await loadItemTagList();
    dynamicTableInstance?.reload();
  } catch (error) {
    console.error('更新失敗', error);
    message.error(t('updateFailed'));
  }
};

// 行拖拽排序處理
const handleRowReorder = (oldIndex: number, newIndex: number) => {
  const [targetRow] = tableData.value.splice(oldIndex, 1);
  tableData.value.splice(newIndex, 0, targetRow);
  tableData.value = tableData.value.map((tag, index) => ({
    ...tag,
    order: index + 1,
  }));
  isShowOrderSubmitBtn.value = true;
};

// 提交順序變更
const handleOrderSubmit = async () => {
  try {
    const updateTags = tableData.value.map((tag, index) => ({
      tagID: tag.id,
      masterAgent: masterAgent.value,
      order: index + 1,
    }));
    await bulkUpdateItemTagOrder({ updateTags });
    message.success(t('orderUpdateSuccess'));
    await loadItemTagList();
    dynamicTableInstance?.reload();
    isShowOrderSubmitBtn.value = false;
  } catch (error) {
    console.error('更新順序失敗', error);
    message.error(t('orderUpdateFailed'));
  }
};

// 列配置
const columns = computed(() => getColumns(t, handleEnabledChange));

onMounted(() => {
  fetchMasterAgents();
});
</script>

<template>
  <div>
    <div v-if="userStore.level < 4" class="mb-4">
      <div class="flex items-center gap-4 mb-4">
        <div class="input_group">
          <div class="txt">
            <label>{{ t('masterAgent') }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="masterAgent"
              :options="masterAgentOptions"
              :disabled="isMasterAgentDisabled"
              :placeholder="t('selectMasterAgent')"
              style="width: 200px"
              @change="handleMasterAgentChange"
            />
          </div>
        </div>
        <a-button type="primary" @click="openFormModal()">
          {{ t('add') }}
        </a-button>
        <a-button
          v-if="isShowOrderSubmitBtn"
          type="warning"
          @click="handleOrderSubmit"
        >
          {{ t('btn.submitOrder') }}
        </a-button>
      </div>
    </div>
    <div v-else class="mb-4">
      <a-alert :message="t('noPermission')" type="warning" show-icon />
    </div>

    <DynamicTable
      v-if="userStore.level < 4"
      row-key="id"
      :header-title="t('title')"
      :columns="columns"
      :data-request="loadTableData"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enabled'">
          <Switch
            :checked="record.enabled"
            @change="(checked: boolean) => handleEnabledChange(record, checked)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'ACTION'">
          <a-space>
            <a-button type="link" size="small" @click="openFormModal(record)">
              {{ t('edit') }}
            </a-button>
            <a-button type="link" size="small" danger @click="handleDelete(record)">
              {{ t('delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </DynamicTable>
  </div>
</template>

<style lang="less" scoped>
.sortable-ghost {
  opacity: 0.8;
  color: #fff !important;
  background: #42b983 !important;
}

.input_group {
  display: flex;
  align-items: center;
  gap: 8px;

  .txt {
    min-width: 80px;
    text-align: right;

    label {
      margin: 0;
      font-weight: normal;
    }
  }

  .my_input {
    width: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>

