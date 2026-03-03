<script setup lang="tsx">
import type { Rule } from 'ant-design-vue/es/form';
import type { TableColumnItem, TableListItem } from './columns';
import type { StickerColumns } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { computed, inject, nextTick, reactive, ref, watch } from 'vue';
import {
  addSticker,
  removeSticker,
  stickerList,
  updateSticker,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import { useTable } from '@/components/core/dynamic-table';
import ImageUploadField from '@/components/system/ImageUploadField.vue';
import { useI18n } from '@/hooks/useI18n';
import { ImageSpec } from '@/system/image/imageSpec';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { getBaseColumns } from './columns';
import { useTableConfig } from './useTableConfig';

defineOptions({
  name: 'ChatroomSticker',
});

const { t } = useI18n('page.sticker');

// =========================
// SearchMode 定義
// =========================
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * - BACKEND：資料從後端 API 取得，過濾邏輯在 API 層面完成
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

/**
 * ============ Context 整合 ============
 * 判定：Reader（完全依賴 Breadcrumb Context 的 masterAgent）
 * - 從 Context 讀取 selectedMasterAgent
 * - 當 Context 變化時，自動 reload 表格資料
 * - 此頁面已關閉搜尋區，完全使用自動查詢模式
 */
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 從 Context 取得當前選取的站長值
const contextMasterAgent = computed(() => {
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  return '';
});

// 監聽 Context 版本變化（用於自動同步和 reload）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ============ 狀態管理 ============

// Dialog 狀態
const isDialogShow = ref(false);
const formState = ref<'create' | 'update' | 'unknown'>('unknown');
const form = reactive<Pick<StickerColumns, 'id' | 'name'>>({
  id: -1,
  name: '',
});
const iconFile = ref<File | null>(null);
// 編輯模式下保存原始圖片 URL（用於顯示預覽）
const iconFileUrl = ref<string>('');
// 編輯模式下追蹤圖片是否被修改
const isChangeIconFile = ref(false);
const formRef = ref();

const getI18nText = (path: string) => {
  return t(path);
};

// ============ 表格 ============
// 搜尋主控權：自動查詢模式（使用 Breadcrumb Context 的 masterAgent 自動 reload）
// 注意：tableInstance 需要在其他函數之前定義，因為其他函數會使用它
const [DynamicTable, tableInstance] = useTable({
  search: false, // 關閉搜尋區（使用 Breadcrumb Context 自動 reload）
  immediate: false, // 不立即請求，等待 Context 準備好後再觸發
});

/**
 * ============ 工具函數 ============
 */
const clearForm = () => {
  form.id = -1;
  form.name = '';
  iconFile.value = null;
  iconFileUrl.value = '';
  isChangeIconFile.value = false;
};

const controlDialogShow = (isShow: boolean) => {
  isDialogShow.value = isShow;
};

const beforeDialogClose = () => {
  controlDialogShow(false);
  clearForm();
  nextTick(() => {
    formRef.value?.clearValidate();
    formRef.value?.resetFields();
  });
};

const getFormTitle = () => {
  switch (formState.value) {
    case 'create':
      return getI18nText('labels.createSticker');
    case 'update':
      return getI18nText('labels.updateSticker');
    default:
      return 'unknown';
  }
};

/**
 * ============ 事件處理 ============
 */
const onCreateBtnClick = () => {
  formState.value = 'create';
  controlDialogShow(true);
};

const onUpdateBtnClick = (row: StickerColumns) => {
  form.id = row.id;
  form.name = row.name;
  // 載入現有圖片 URL（用於顯示預覽）
  iconFileUrl.value = row.url || '';
  iconFile.value = null;
  isChangeIconFile.value = false;
  formState.value = 'update';
  controlDialogShow(true);
};

// ============ API 調用 ============
interface TableListResponse {
  items: TableListItem[];
  meta: { totalItems: number };
}

/**
 * 載入表格資料（DynamicTable data-request）
 * 搜尋主控權：自動查詢模式（使用 Breadcrumb Context 的 masterAgent 自動 reload）
 * Context 整合：完全依賴 Context 的 masterAgent（不再使用搜尋表單）
 */
const loadTableData = async (_params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  // Context 整合：完全使用 Context 的 masterAgent（此頁面已關閉搜尋區）
  const masterAgentValue = contextMasterAgent.value;

  if (!masterAgentValue) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    const res = await stickerList({ masterAgent: masterAgentValue });
    let stickerData: StickerColumns[] = [];
    if (res) {
      if (Array.isArray(res)) {
        stickerData = res;
      }
      else if (res.data && Array.isArray(res.data)) {
        stickerData = res.data;
      }
      else if ((res as any).data && Array.isArray((res as any).data)) {
        stickerData = (res as any).data;
      }
    }

    return {
      items: stickerData,
      meta: {
        totalItems: stickerData.length,
      },
    };
  }
  catch (error) {
    console.error('Failed to get sticker list:', error);
    message.error(t('fail'));
    return { items: [], meta: { totalItems: 0 } };
  }
};

const createStickerHandler = async () => {
  try {
    if (!iconFile.value) {
      message.error(getI18nText('notify.required'));
      return;
    }
    // 使用 Context 的 masterAgent
    const masterAgentValue = contextMasterAgent.value;
    if (!masterAgentValue) {
      message.error('請先選擇站長');
      return;
    }
    const res = await addSticker({
      masterAgent: masterAgentValue,
      name: form.name,
      imageFile: iconFile.value,
    });
    if (res) {
      tableInstance?.reload();
      beforeDialogClose();
      message.success(t('success'));
    }
  }
  catch (error) {
    console.error('Failed to create sticker:', error);
    message.error(t('fail'));
  }
};

const updateStickerHandler = async () => {
  try {
    // 使用 Context 的 masterAgent
    const masterAgentValue = contextMasterAgent.value;
    if (!masterAgentValue) {
      message.error('請先選擇站長');
      return;
    }
    // 只有當圖片被修改時才上傳新圖片
    const submitData: any = {
      id: form.id,
      masterAgent: masterAgentValue,
      name: form.name,
    };
    if (isChangeIconFile.value && iconFile.value) {
      submitData.imageFile = iconFile.value;
    }
    const res = await updateSticker(submitData);
    if (res) {
      tableInstance?.reload();
      beforeDialogClose();
      message.success(t('success'));
    }
  }
  catch (error) {
    console.error('Failed to update sticker:', error);
    message.error(t('fail'));
  }
};

const removeStickerHandler = (row: StickerColumns) => {
  const content = `${getI18nText('notify.deleteSticker')} - ${row.name}`;
  const title = getI18nText('notify.title');
  Modal.confirm({
    title,
    content,
    okText: t('confirm'),
    cancelText: t('cancel'),
    onOk: async () => {
      try {
        // 使用 Context 的 masterAgent
        const masterAgentValue = contextMasterAgent.value;
        if (!masterAgentValue) {
          message.error('請先選擇站長');
          return;
        }
        const res = await removeSticker({
          id: row.id,
          masterAgent: masterAgentValue,
        });
        if (res) {
          tableInstance?.reload();
          message.success(t('success'));
        }
      }
      catch (error) {
        console.error('Failed to remove sticker:', error);
        message.error(t('fail'));
      }
    },
  });
};

// ============ 表格配置 ============
// 使用分離的 columns.tsx
// 注意：站長欄位已移除，改為使用 Breadcrumb Context 自動 reload
const baseColumnsWithAction = computed<TableColumnItem[]>(() => {
  return getBaseColumns(t, {
    onEdit: record => onUpdateBtnClick(record),
    onDelete: record => removeStickerHandler(record),
    // 不再傳入 masterAgentOptions 和 showMasterAgentSearch（已關閉搜尋區）
  });
});

const tableConfig = useTableConfig(baseColumnsWithAction);

const columns = computed<TableColumnItem[]>(() => {
  return baseColumnsWithAction.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    const processedCol: TableColumnItem = {
      ...col,
      hideInTable: !isVisible,
    };

    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100;
    }

    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

const onFormConfirm = async () => {
  try {
    await formRef.value?.validate();
    switch (formState.value) {
      case 'create':
        await createStickerHandler();
        break;
      case 'update':
        await updateStickerHandler();
        break;
      default:
        throw new Error('unknown form state');
    }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form:', error);
  }
};

/**
 * 監聽 Context 版本變化，當站長切換時自動 reload 表格資料
 * Reader 模式：Context 變化時，自動重新載入表格資料
 */
watch(
  () => contextVersion.value,
  () => {
    // 清空表格資料並自動重新載入
    tableInstance?.reload(true);
  },
);

/**
 * ============ 表單驗證規則 ============
 */
const getRules = (): Record<string, Rule[]> => {
  return {
    name: [
      {
        required: true,
        message: getI18nText('notify.required'),
        trigger: 'blur',
      },
    ],
  };
};

// 注意：不再需要 fetchMasterAgentList，因為使用 Breadcrumb Context 的站長選項
</script>

<template>
  <div class="app-container chatroom-sticker">
    <div class="table-container">
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="{ x: tableConfig.scrollX.value }"
        :auto-height="true"
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
          <a-button
            type="primary"
            @click="onCreateBtnClick"
          >
            {{ t('add') }}
          </a-button>
        </template>
      </DynamicTable>
    </div>

    <!-- Dialog 編輯/新增 -->
    <a-modal
      v-model:open="isDialogShow"
      :title="getFormTitle()"
      :width="550"
      :mask-closable="false"
      @cancel="beforeDialogClose"
    >
      <a-form
        ref="formRef"
        :model="form"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        :rules="getRules()"
        :label-width="100"
      >
        <a-form-item
          :label="getI18nText('labels.stickerName')"
          name="name"
        >
          <a-input
            v-model:value="form.name"
            :placeholder="t('placeholder.enterStickerName') || `請輸入${getI18nText('labels.stickerName')}`"
            autocomplete="off"
          />
        </a-form-item>
        <a-form-item
          :label="getI18nText('labels.stickerIcon')"
          :required="formState === 'create'"
        >
          <div v-if="formState === 'update' && iconFileUrl && !isChangeIconFile" class="edit-image-preview">
            <img :src="iconFileUrl" alt="stickerIcon" class="preview-image">
            <a-button type="link" size="small" @click="isChangeIconFile = true">
              更換圖片
            </a-button>
          </div>
          <ImageUploadField
            v-if="formState === 'create' || isChangeIconFile"
            v-model="iconFile"
            :spec="ImageSpec.STICKER"
            @update:model-value="(val) => { iconFile = val; if (val) isChangeIconFile = true; }"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="beforeDialogClose">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="onFormConfirm"
        >
          {{ t('confirm') }}
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.chatroom-sticker {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    .input_group {
      display: flex;
      padding: 10px;
      align-items: center;
      .txt {
        width: 100px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .my_input {
        width: 200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    }
  }
}

.edit-image-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .preview-image {
    width: 120px;
    height: 120px;
    object-fit: contain;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    padding: 4px;
    background: #fafafa;
  }
}
</style>
