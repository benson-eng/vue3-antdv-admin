<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { ItemTag, ItemTypes } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, inject, onMounted, ref, watch } from 'vue';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import {
  addItemTag,
  bulkUpdateItemTagOrder,
  itemTagList,
  removeItemTag,
  updateItemTag,
} from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { getColumns } from './columns';

defineOptions({
  name: 'TeamItemTags',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.teamItemTags');
const userStore = useUserStore();

// ARCH04：從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// ARCH04：使用 computed 取得當前選取的站長值（優先使用 Context）
const selectedMasterAgent = computed(() => {
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  return '';
});

// ARCH04：使用 computed 取得 contextVersion（用於監聽變化）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ARCH04：本地 masterAgent 狀態（用於 CRUD 操作和搜尋表單備用）
const masterAgent = ref<string>('');
const localMasterAgentOptions = ref<DefaultOptionType[]>([]);

// ARCH06：此頁面已關閉搜尋區，不再需要這些變數（保留以備未來使用）
// const masterAgentOptions = computed(() => {
//   if (masterAgentCtx?.masterAgentOptions.value && masterAgentCtx.masterAgentOptions.value.length > 0) {
//     return masterAgentCtx.masterAgentOptions.value;
//   }
//   return localMasterAgentOptions.value;
// });

// const isMasterAgentDisabled = computed(() => {
//   if (masterAgentCtx) {
//     return !masterAgentCtx.canSelectMasterAgent.value;
//   }
//   return userStore.level >= 4;
// });

// ARCH06：此頁面使用自動 reload，關閉搜尋區顯示
// 查詢模式：自動查詢模式（Context 變化時自動觸發）
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false, // ARCH06：關閉搜尋區顯示（使用自動 reload）
  immediate: false, // ARCH06：不立即請求，等待 Context 準備好後再觸發
});

const [showModal] = useFormModal();

// 表格數據
const tableData = ref<ItemTag[]>([]);
const isShowOrderSubmitBtn = ref(false);
const originalOrder = ref<number[]>([]);

// ARCH05：啟用/停用操作的 loading 狀態（防止重複點擊）
const enabledChangingIds = ref<Set<number>>(new Set());

// 道具類型選項（只顯示 teamBadge）
const itemTypes: ItemTypes[] = ['teamBadge'];

/**
 * ARCH04：獲取總代理列表（僅在 Context 不可用時作為備用）
 */
const fetchMasterAgents = async () => {
  // ARCH04：如果 Context 可用，不需要本地獲取
  if (masterAgentCtx?.masterAgentOptions.value && masterAgentCtx.masterAgentOptions.value.length > 0) {
    return;
  }

  const list = await getMasterAgentList();
  localMasterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));

  // ARCH06：如果 Context 不可用且用戶等級 >= 4，自動選擇第一個總代理
  // 注意：不再在此處觸發 reload，改由 watch 處理
  if (!masterAgentCtx && userStore.level >= 4 && list && list.length > 0) {
    masterAgent.value = list[0].account;
  }
};

// ARCH03：loadItemTagList 已整合至 loadTableData
/**
 * 此函數保留用於 CRUD 操作後的數據刷新
 */
const loadItemTagList = async () => {
  if (!masterAgent.value) {
    tableData.value = [];
    dynamicTableInstance?.reload();
    return;
  }

  try {
    const res: any = await itemTagList({ masterAgent: masterAgent.value });

    let dataArray: ItemTag[] = [];

    if (Array.isArray(res)) {
      dataArray = res;
    }
    else if (Array.isArray(res.data)) {
      dataArray = res.data;
    }
    else if (res.data && Array.isArray(res.data.data)) {
      dataArray = res.data.data;
    }
    else if (res.data && res.data.error) {
      console.error('API 回傳錯誤:', res.data.error);
      tableData.value = [];
      dynamicTableInstance?.reload();
      return;
    }

    const filteredData = dataArray.filter(item => item.itemType === 'teamBadge');
    tableData.value = filteredData.map(d => ({ ...d, enabled: !!d.enabled }));
    originalOrder.value = filteredData.map(d => d.order);
    isShowOrderSubmitBtn.value = false;

    // ARCH03：刷新表格（會觸發 loadTableData，但由於 masterAgent 未變更，會使用現有 tableData）
    dynamicTableInstance?.reload();
  }
  catch (error) {
    console.error('載入標籤列表失敗', error);
    message.error(t('loadFailed'));
    tableData.value = [];
    dynamicTableInstance?.reload();
  }
};

// ARCH03：總代理變更處理已整合至 DynamicTable 搜尋表單的 onChange
// 此函數保留用於向後兼容，但主要邏輯已移至搜尋表單

/**
 * ARCH06：載入表格數據（使用 Context 的 masterAgent 注入參數）
 * 注意：由於此頁面關閉搜尋區，參數完全由 Context 提供
 * 此方式等同於 beforeFetch 的效果，在 data-request 中注入 Context 參數
 */
const loadTableData = async (_params: LoadDataParams & Record<string, any>) => {
  // ARCH06：使用 Context 的 masterAgent（此頁面不依賴搜尋表單）
  // 等同於 beforeFetch 的效果：在請求前注入 Context 參數
  const finalMasterAgent = selectedMasterAgent.value;

  // 如果沒有選擇 masterAgent，返回空數據
  console.log('finalMasterAgent', finalMasterAgent);
  if (!finalMasterAgent) {
    tableData.value = [];
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }

  // ARCH06：更新本地 masterAgent 狀態（用於 CRUD 操作）
  masterAgent.value = finalMasterAgent;

  // ARCH06：載入標籤列表（使用 Context 的 masterAgent）
  try {
    const res: any = await itemTagList({ masterAgent: finalMasterAgent });

    // 對齊 Vue2 邏輯：res.data 可能是陣列或 { data: [...] } 格式
    let dataArray: ItemTag[] = [];
    if (Array.isArray(res)) {
      dataArray = res;
    }
    else if (Array.isArray(res.data)) {
      dataArray = res.data;
    }
    else if (res.data && Array.isArray(res.data.data)) {
      dataArray = res.data.data;
    }
    else if (res.data && res.data.error) {
      console.error('API 回傳錯誤:', res.data.error);
      tableData.value = [];
      return {
        items: [],
        meta: { totalItems: 0 },
      };
    }

    // 對齊 Vue2 邏輯：只顯示 teamBadge 類型的標籤
    const filteredData = dataArray.filter(item => item.itemType === 'teamBadge');

    // 對齊 Vue2 邏輯：將 enabled 轉換為布林值
    tableData.value = filteredData.map(d => ({ ...d, enabled: !!d.enabled }));
    originalOrder.value = filteredData.map(d => d.order);
    isShowOrderSubmitBtn.value = false;

    return {
      items: tableData.value,
      meta: { totalItems: tableData.value.length },
    };
  }
  catch (error) {
    console.error('載入標籤列表失敗', error);
    message.error(t('loadFailed'));
    tableData.value = [];
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }
};

/**
 * 打開新增/編輯表單彈窗
 */
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
          }
          else {
            await addItemTag({
              masterAgent: masterAgent.value,
              tag: values.tag,
              itemType: values.itemType || 'teamBadge',
            });
            message.success(t('createSuccess'));
          }
          // ARCH03：CRUD 操作後，重新載入數據並刷新表格
          await loadItemTagList();
        }
        catch (error) {
          console.error('保存失敗', error);
          message.error(record ? t('updateFailed') : t('createFailed'));
          throw error;
        }
      },
    },
    formProps: {
      labelWidth: 120,
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
            placeholder: t('form.tagPlaceholder') || '請輸入標籤名稱',
            maxlength: 50,
            showCount: true,
          },
          rules: [
            { required: true, message: t('form.tagRequired') || '請輸入標籤名稱' },
            { max: 50, message: '標籤名稱最多 50 個字元' },
          ],
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

/**
 * 刪除標籤
 */
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
        // ARCH03：刪除後重新載入數據
        await loadItemTagList();
      }
      catch (error) {
        console.error('刪除失敗', error);
        message.error(t('deleteFailed'));
      }
    },
  });
};

/**
 * ARCH05：切換標籤啟用狀態（帶確認對話框和 loading 保護）
 */
const handleToggleEnabled = (record: ItemTag) => {
  const newEnabled = !record.enabled;
  const actionText = newEnabled ? t('table.action.enable') : t('table.action.disable');
  const tagName = record.tag || '';

  // ARCH05：使用 i18n 參數功能組裝確認對話框內容
  Modal.confirm({
    title: t('toggleEnabledPopMessageBox.title'),
    content: t('toggleEnabledPopMessageBox.content', { action: actionText, tag: tagName }),
    async onOk() {
      // ARCH05：防止重複點擊
      if (enabledChangingIds.value.has(record.id)) {
        return;
      }

      enabledChangingIds.value.add(record.id);

      try {
        await updateItemTag({
          tagID: record.id,
          masterAgent: masterAgent.value,
          enabled: newEnabled,
        });
        message.success(t('updateSuccess'));
        // ARCH05：啟用/停用後重新載入數據
        await loadItemTagList();
      }
      catch (error) {
        console.error('更新失敗', error);
        message.error(t('updateFailed'));
      }
      finally {
        enabledChangingIds.value.delete(record.id);
      }
    },
  });
};

/**
 * 行拖拽排序處理（目前未在模板中使用，保留以備未來使用）
 */
const _handleRowReorder = (_oldIndex: number, _newIndex: number) => {
  const [targetRow] = tableData.value.splice(_oldIndex, 1);
  tableData.value.splice(_newIndex, 0, targetRow);
  tableData.value = tableData.value.map((tag, index) => ({
    ...tag,
    order: index + 1,
  }));
  isShowOrderSubmitBtn.value = true;
};

/**
 * 提交順序變更
 */
const handleOrderSubmit = async () => {
  try {
    const updateTags = tableData.value.map((tag, index) => ({
      tagID: tag.id,
      masterAgent: masterAgent.value,
      order: index + 1,
    }));
    await bulkUpdateItemTagOrder({ updateTags });
    message.success(t('orderUpdateSuccess'));
    // ARCH03：順序更新後重新載入數據
    await loadItemTagList();
    isShowOrderSubmitBtn.value = false;
  }
  catch (error) {
    console.error('更新順序失敗', error);
    message.error(t('orderUpdateFailed'));
  }
};

// 列配置
const columns = computed(() => getColumns(t));

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - 搜尋區已關閉（search: false）
 * - 資料直接從後端 API 載入（itemTagList）
 * - 參數由 Context 的 masterAgent 提供
 * - 沒有前端過濾或搜尋功能
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  return 'BACKEND';
});

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const mode = searchMode.value;
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[mode];
});

// ARCH06：監聽 Context 變化，自動觸發表格重新載入
watch(
  contextVersion,
  () => {
    // ARCH06：當 Context 的 masterAgent 變化時，清空表格數據並重新載入
    tableData.value = [];
    masterAgent.value = selectedMasterAgent.value;
    dynamicTableInstance?.reload();
  },
);

// ARCH06：監聽 selectedMasterAgent 變化，自動觸發表格重新載入
watch(
  () => selectedMasterAgent.value,
  (newVal) => {
    if (newVal) {
      // ARCH06：更新本地狀態並觸發重新載入
      masterAgent.value = newVal;
      tableData.value = [];
      dynamicTableInstance?.reload();
    }
    else {
      // ARCH06：如果 masterAgent 為空，清空表格數據
      tableData.value = [];
      masterAgent.value = '';
      dynamicTableInstance?.reload();
    }
  },
  { immediate: true }, // ARCH06：立即執行一次，確保初始載入
);

onMounted(() => {
  fetchMasterAgents();
  // ARCH06：移除自動查詢，改由 watch 的 immediate: true 處理初始載入
});
</script>

<template>
  <div>
    <div v-if="userStore.level >= 4" class="mb-4">
      <a-alert :message="t('noPermission')" type="warning" show-icon />
    </div>

    <DynamicTable
      v-if="userStore.level < 4"
      row-key="id"
      :header-title="t('title')"
      :columns="columns"
      :data-request="loadTableData"
      :pagination="false"
      :auto-height="true"
      :scroll="{ x: 'max-content' }"
    >
      <template #headerTitle>
        <div style="display: flex; align-items: center; gap: 8px">
          <span>{{ t('title') }}</span>
          <Tag :color="searchModeConfig.color" style="margin: 0">
            SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
          </Tag>
        </div>
      </template>
      <template #toolbar>
        <a-space>
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
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enabled'">
          <!-- ARCH05：改為文字顯示，使用 Tag 元件 -->
          <Tag :color="record.enabled ? 'green' : 'default'">
            {{ record.enabled ? t('table.enabledStatus.enabled') : t('table.enabledStatus.disabled') }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'ACTION'">
          <a-space :size="8">
            <a-button type="link" size="small" @click="openFormModal(record)">
              {{ t('edit') }}
            </a-button>
            <a-button
              type="link"
              size="small"
              :loading="enabledChangingIds.has(record.id)"
              @click="handleToggleEnabled(record)"
            >
              {{ record.enabled ? t('table.action.disable') : t('table.action.enable') }}
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
