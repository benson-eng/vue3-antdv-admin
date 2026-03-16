<script setup lang="tsx">
import type { TableColumnItem, TableListItem } from './columns';
import type { IconItem } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { addIcon, ImageType, queryIcon, removeIcon } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import ImageUploadField from '@/components/system/ImageUploadField.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { ImageSpec } from '@/system/image/imageSpec';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { getColumns } from './columns';

defineOptions({
  name: 'ImageSetting',
});

const i18n = useI18n('page.imageSetting');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

// CDN Base URL
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';

// =========================
// Context Integration
// =========================

/**
 * 【Context 類型】：Context Reader（Page Type B）
 * - 依賴 Breadcrumb 站長
 * - 切換站長需重新載入資料
 * - 監聽 selectedMasterAgent（Context）變化，自動 reset() + reload(true)
 */
// 從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（唯一資料來源）
const selectedMasterAgent = computed(() => {
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  return '';
});

// 使用 computed 取得 contextVersion（用於監聽變化，僅用於狀態更新）
// 注意：目前未使用，但保留以備未來擴展需求

// 計算是否已選擇 masterAgent（用於控制表格和新增按鈕顯示）
const isSelectedMasterAgent = computed(() => {
  return Boolean(selectedMasterAgent.value);
});

// =========================
// SearchMode 定義
// =========================
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * - BACKEND：資料從後端 API 取得，過濾邏輯在 API 層面完成
 * - masterAgent：後端 API 參數（Context 控制，Breadcrumb Context）
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

// =========================
// DynamicTable Setup
// =========================

/**
 * 【搜尋模型】無搜尋區模式（受控型）
 * - search: false - 移除搜尋表單（masterAgent 由 Context 控制）
 * - immediate: false - 不自動查詢（受控型：手動觸發）
 *
 * 【搜尋主控權】
 * - masterAgent：Context 控制（Breadcrumb Context）
 * - 觸發方式：watch(selectedMasterAgent) 自動觸發 reset() + reload(true)
 *
 * 【資料來源】
 * - masterAgent：Context（selectedMasterAgent.value）
 * - 查詢模式：受控型（Context 變化時自動觸發）
 */
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false, // 🔒 移除搜尋區（masterAgent 由 Context 控制）
  immediate: false, // 🔒 受控型：不自動查詢，Context 變化時觸發
  fetchConfig: {
    listField: 'items' as const,
    totalField: 'total' as any,
  },
});

// =========================
// Methods (需要先定義，供 columns 使用)
// =========================

const isChangeable = (_row: IconItem) => {
  // 根據業務邏輯判斷是否可變更
  return false;
};

const onHandleDelete = (row: IconItem) => {
  const content = `${t('notify.deleteConfirm')} - ID: ${row.id} - ${row.name}`;
  const title = t('notify.deleteTitle');

  Modal.confirm({
    title,
    content,
    okText: t('buttons.confirm'),
    cancelText: t('buttons.cancel'),
    async onOk() {
      try {
        await removeIcon({ masterAgent: selectedMasterAgent.value, id: [row.id] });
        message.success(t('notify.deleteSuccess'));
        await dynamicTableInstance?.reload(true);
        await nextTick();
        window.dispatchEvent(new Event('resize'));
      }
      catch (error: any) {
        message.error(error?.message || t('notify.deleteFailed'));
      }
    },
  });
};

// 列配置
const baseColumns = computed<TableColumnItem[]>(() => {
  const cols = getColumns(t, cdnBaseUrl, onHandleDelete, isChangeable);
  return Array.isArray(cols) ? cols.filter(Boolean) : [];
});

// 使用表格配置 Hook（計算 scroll.x）
const tableConfig = useTableConfig(baseColumns as any);

/**
 * 計算 scroll 配置（AutoHeight 模式）
 * 只傳入 scroll.x，不傳入 scroll.y，讓 useScroll 根據 autoHeight 自動計算 scroll.y
 */
const tableScroll = computed(() => {
  const x = tableConfig.scrollX.value;

  if (x == null || Number.isNaN(x) || !Number.isFinite(x) || (typeof x === 'number' && x <= 0)) {
    return {};
  }

  return { x };
});

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  // 原因：當 scroll.x 為數字時，表示表格內部有固定寬度欄位，且總和超過容器寬度
  // 此時表格內部會出現滾動條，外層 container 也需要允許滾動，以確保表格內容可以完整顯示
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

// 根據 visibleColumnKeys 設置欄位的 hideInTable
const columns = computed<TableColumnItem[]>(() => {
  const src = Array.isArray(baseColumns.value) ? baseColumns.value : [];

  return src
    .filter((col): col is TableColumnItem => col != null)
    .map((col) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

      const normalized: TableColumnItem = {
        ...col,
        hideInTable: !isVisible,
      };

      return normalized;
    });
});

// =========================
// Table Data Loading
// =========================

interface TableListResponse {
  items: TableListItem[];
  meta: { totalItems: number };
}

/**
 * 載入表格資料（受控型搜尋模型）
 *
 * 【資料來源】
 * - masterAgent：Context（selectedMasterAgent.value）
 * - 查詢參數：從 Context 取得
 *
 * 【必要欄位】
 * - masterAgent：必填（後端 API 參數，來自 Context）
 *
 * 【行為】
 * - masterAgent 為空：返回空陣列
 * - masterAgent 有值：呼叫 API 查詢
 */
const loadTableData = async (_params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  // 必要欄位：masterAgent（Context 控制）
  const masterAgentValue = selectedMasterAgent.value;
  if (!masterAgentValue) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    const res = await queryIcon({ masterAgent: masterAgentValue });

    // 根據實際 API 回傳格式：{ data: { result: [...] } }
    let items: IconItem[] = [];
    if (res && res.data && res.data.result && Array.isArray(res.data.result)) {
      items = res.data.result;
    }
    else if (res && res.data && res.data.result) {
      items = Array.isArray(res.data.result) ? res.data.result : [];
    }
    // 處理可能的 Vue2 風格回傳（已解包）
    else if ((res as any)?.result && Array.isArray((res as any).result)) {
      items = (res as any).result;
    }

    return {
      items,
      meta: {
        totalItems: items.length,
      },
    };
  }
  catch (error: any) {
    message.error(error?.message || t('notify.queryFailed'));
    return { items: [], meta: { totalItems: 0 } };
  }
};

// =========================
// Dialog
// =========================

const dialogFormVisible = ref(false);
const dialogStatus = ref<'CREATE' | 'UPDATE'>('CREATE');
const disabledConfirm = ref(false);

const dialogForm = ref<{
  masterAgent: string;
  name: string;
  url: string;
  type: ImageType;
  gameID?: string;
  imageFile: File | null;
}>({
  masterAgent: '',
  name: '',
  url: '',
  type: ImageType.MAIL,
  gameID: '',
  imageFile: null,
});

// =========================
// Methods
// =========================

/**
 * 監聽站長變化（Page Type B：Context Reader）
 * - 監聽 selectedMasterAgent（Context）變化
 * - 切換站長時：reset() + reload(true)
 * - 不得使用 DOM 監聽
 * - 不得修改 Layout
 */
watch(
  () => selectedMasterAgent.value,
  async () => {
    // Context 站長變化時，重新載入資料
    // 注意：無搜尋區模式，不需要 reset，直接 reload 即可
    await dynamicTableInstance?.reload(true);
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  },
);

// 對於 Level 4 用戶，同時監聽 userStore.masterAgent 變化
// 這是既有系統機制（userStore 是系統層狀態管理）
if (userStore.level === 4) {
  watch(
    () => userStore.masterAgent,
    async () => {
      // 當 userStore.masterAgent 變化時，重新載入資料
      await dynamicTableInstance?.reload(true);
      await nextTick();
      window.dispatchEvent(new Event('resize'));
    },
  );
}

const defaultDialogForm = () => ({
  masterAgent: '',
  name: '',
  url: '',
  type: ImageType.MAIL,
  gameID: '',
  imageFile: null,
});

const onHandleCreate = () => {
  disabledConfirm.value = false;
  dialogForm.value = defaultDialogForm();
  dialogStatus.value = 'CREATE';
  dialogFormVisible.value = true;
};

const createDefaultAvatar = async () => {
  if (!dialogForm.value.imageFile) {
    return;
  }

  try {
    // 對齊 Vue2：gameID 為 undefined，而不是空字串
    const postData = {
      masterAgent: selectedMasterAgent.value,
      name: dialogForm.value.name,
      imageFile: dialogForm.value.imageFile,
      type: dialogForm.value.type,
      gameID: undefined as string | undefined,
    };

    const result = await addIcon(postData);

    // 對齊 Vue2：檢查 result.error === undefined 來判斷成功
    // Vue2 的響應格式：{ error?: { code, message }, data?: any, result?: any }
    // Vue3 可能返回 { data: { ... } } 或直接 { error, data }
    const response = result as any;

    if (response && response.error === undefined) {
      // 成功：沒有 error 屬性
      message.success(t('notify.createSuccess'));
      dialogFormVisible.value = false;
      await dynamicTableInstance?.reload(true);
      await nextTick();
      window.dispatchEvent(new Event('resize'));
    }
    else if (response && response.error) {
      // 有錯誤
      const errorMsg = response.error.message || t('notify.createFailed');
      message.error(errorMsg);
    }
    else if (response && response.data && !response.data.error) {
      // Vue3 格式：{ data: { ... } }，且 data 中沒有 error
      message.success(t('notify.createSuccess'));
      dialogFormVisible.value = false;
      await dynamicTableInstance?.reload(true);
      await nextTick();
      window.dispatchEvent(new Event('resize'));
    }
    else {
      // 其他情況視為失敗
      const errorData = response?.data?.error || response?.error;
      if (errorData && errorData.message) {
        message.error(errorData.message);
      }
      else {
        message.error(t('notify.createFailed'));
      }
    }
  }
  catch (error: any) {
    console.error('Failed to create default avatar:', error);
    message.error(error?.message || t('notify.createFailed'));
  }
};

const updateDefaultAvatar = async () => {
  // 注意：Vue2 版本使用 updateDefaultAvatarAction，但這裡可能需要不同的 API
  // 暫時先顯示提示
  message.warning(t('notify.updateNotImplemented'));
  dialogFormVisible.value = false;
};

const onDialogConfirm = async () => {
  if (!dialogForm.value.imageFile) {
    message.error(t('rules.image'));
    return;
  }

  if (!dialogForm.value.name) {
    message.error(t('rules.name'));
    return;
  }

  disabledConfirm.value = true;

  try {
    if (dialogStatus.value === 'CREATE') {
      await createDefaultAvatar();
    }
    else {
      await updateDefaultAvatar();
    }
  }
  finally {
    setTimeout(() => {
      disabledConfirm.value = false;
    }, 1000);
  }
};

// =========================
// Lifecycle
// =========================

/**
 * 頁面首次載入時，如果 selectedMasterAgent 已有值，則自動載入資料
 * - 檢查 selectedMasterAgent 是否有值
 * - 如果有值，調用 reload(true) 載入資料
 * - 如果沒有值，不載入（符合現有邏輯）
 * - 載入完成後觸發 resize 事件以重新計算表格高度
 */
onMounted(async () => {
  // 檢查 selectedMasterAgent 是否有值
  if (selectedMasterAgent.value) {
    await dynamicTableInstance?.reload(true);
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
  // 對於 Level 4 用戶，也檢查 userStore.masterAgent
  else if (userStore.level === 4 && userStore.masterAgent) {
    await dynamicTableInstance?.reload(true);
    await nextTick();
    window.dispatchEvent(new Event('resize'));
  }
});
</script>

<template>
  <div class="image-setting-page">
    <a-result
      v-if="!hasPermission"
      status="403"
      :title="t('noPermission.title')"
      :sub-title="t('noPermission.subTitle')"
    />

    <a-card v-else :bordered="false">
      <!-- Table -->
      <!-- 【受控型搜尋模型 + Context Reader】reset/reload 行為：
           - reset：Context 變化時自動調用 reset()
           - reload：Context 變化時自動調用 reload(true)
           - 新增/刪除成功後：調用 reload(true) 刷新資料
      -->
      <div
        class="table-container"
        :style="{ overflowX: containerOverflowX }"
      >
        <DynamicTable
          row-key="id"
          :data-request="loadTableData"
          :columns="columns"
          :scroll="tableScroll"
          :auto-height="true"
          :form-props="{
            showSubmitButton: false,
            showResetButton: false,
            showAdvancedButton: false,
          }"
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
              v-if="isSelectedMasterAgent"
              type="primary"
              :disabled="!hasPermission"
              @click="onHandleCreate"
            >
              {{ t('buttons.add') }}
            </a-button>
          </template>
        </DynamicTable>
      </div>

      <!-- Dialog -->
      <a-modal
        v-model:open="dialogFormVisible"
        :title="dialogStatus === 'CREATE' ? t('buttons.create') : t('buttons.edit')"
        :confirm-loading="disabledConfirm"
        :mask-closable="false"
        :width="700"
        @ok="onDialogConfirm"
        @cancel="dialogFormVisible = false"
      >
        <a-form
          :model="dialogForm"
          :label-col="{ span: 6 }"
          :wrapper-col="{ span: 18 }"
        >
          <a-form-item
            :label="t('labels.name')"
            :rules="[{ required: true, message: t('rules.name') }]"
          >
            <a-input
              v-model:value="dialogForm.name"
              style="width: 100%"
            />
          </a-form-item>

          <a-form-item
            :label="t('labels.image')"
            :rules="[{ required: true, message: t('rules.image') }]"
          >
            <ImageUploadField
              v-model="dialogForm.imageFile"
              :spec="ImageSpec.ICON"
            />
          </a-form-item>
        </a-form>

        <template #footer>
          <a-button @click="dialogFormVisible = false">
            {{ t('buttons.cancel') }}
          </a-button>
          <a-button
            type="primary"
            :disabled="disabledConfirm"
            @click="onDialogConfirm"
          >
            {{ t('buttons.confirm') }}
          </a-button>
        </template>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped lang="less">
.image-setting-page {
  .filter-container {
    margin-bottom: 16px;

    .wrap {
      display: flex;
      flex-wrap: wrap;
      background-color: #e7e7e7;
      padding: 10px;
      border-radius: 4px;

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

        .btn {
          margin: 10px 0;
        }
      }
    }
  }
}
</style>
