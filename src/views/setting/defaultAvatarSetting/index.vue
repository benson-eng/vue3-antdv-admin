<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { TableColumnItem } from './columns';
import type { DefaultAvatarItem } from '@/api/backend/profileSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { Button, Divider, message, Modal, Switch, Upload } from 'ant-design-vue';
import { computed, inject, ref, watch } from 'vue';

import { createDefaultAvatar as createDefaultAvatarApi, getDefaultAvatar, updateDefaultAvatar as updateDefaultAvatarApi } from '@/api/backend/profileSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { getColumns } from './columns';

defineOptions({
  name: 'DefaultAvatarSetting',
});

const i18n = useI18n('routes.setting.defaultAvatarSettingPage');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

// =========================
// Context Integration
// =========================

/**
 * 【Context 類型】：Context Reader（Page Type B）
 * - 依賴 Breadcrumb 站長
 * - 切換站長需重新載入資料
 * - 監聽 userStore.masterAgent 變化，自動 reset() + reload(true)
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
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// 計算是否已選擇 masterAgent（用於控制表格和新增按鈕顯示）
const isSelectedMasterAgent = computed(() => {
  return Boolean(selectedMasterAgent.value);
});

// 顯示禁用項目控制
const showDisabled = ref(false);

// =========================
// DynamicTable Setup
// =========================

/**
 * 【搜尋模型】無搜尋區模式
 * - search: false - 移除搜尋表單
 * - immediate: false - 不自動查詢
 *
 * 【資料來源】
 * - masterAgent：Context（selectedMasterAgent.value）
 * - showDisabled：本地狀態（控制是否顯示禁用項目）
 */
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false, // 🔒 移除搜尋區
  immediate: false,
  fetchConfig: {
    listField: 'items' as const,
    totalField: 'total' as any,
  },
});

// CDN Base URL
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';

// 列配置
const baseColumns = computed<TableColumnItem[]>(() => {
  const cols = getColumns(t, cdnBaseUrl);
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
// Dialog
// =========================

const dialogFormVisible = ref(false);
const dialogStatus = ref<'CREATE' | 'UPDATE'>('CREATE');
const disabledConfirm = ref(false);

const tempDialogData = ref<{
  masterAgent: string;
  avatarID?: number;
  isEnabled: boolean;
}>({
  masterAgent: '',
  isEnabled: true,
});

const uploadFile = ref<{
  previewAvatarImageUrl: string;
  profilePictureFile?: File;
}>({
  previewAvatarImageUrl: '',
  profilePictureFile: undefined,
});

// =========================
// Helper Functions
// =========================

const toCdnUrl = (url?: string) => {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return cdnBaseUrl ? `${cdnBaseUrl}${url}` : url;
};

// =========================
// Table Data Loading
// =========================

/**
 * 載入表格數據（純函數 Pure Function）
 * - 直接調用 API，處理資料，返回給 DynamicTable
 * - 不修改任何 reactive 狀態（除了必要的 loading 狀態）
 * - 不調用 reload()
 * - 不依賴中介資料來源
 *
 * 【資料來源】
 * - masterAgent：Context（selectedMasterAgent.value）
 * - showDisabled：本地狀態（控制是否顯示禁用項目）
 *
 * 【過濾邏輯】
 * - 若 showDisabled 為 false：僅顯示啟用項目（isEnabled === true）
 * - 若 showDisabled 為 true：顯示全部項目
 */
const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
  // 從 Context 取得 masterAgent（必要條件）
  const masterAgent = selectedMasterAgent.value;

  // 必要欄位檢查：masterAgent 為必要條件
  if (!masterAgent) {
    return {
      items: [],
      total: 0,
    };
  }

  try {
    // 根據 showDisabled 決定 API 參數
    // 若 showDisabled 為 false：僅取得啟用項目
    // 若 showDisabled 為 true：取得全部（不傳 isEnabled 或傳 undefined）
    const apiParams: any = {
      masterAgent,
    };

    if (!showDisabled.value) {
      // 僅顯示啟用項目
      apiParams.isEnabled = true;
    }
    // 若 showDisabled 為 true，不傳 isEnabled，讓 API 返回全部

    const res = await getDefaultAvatar(apiParams);

    // 處理多種響應格式
    const response = res as any;
    let dataArray: DefaultAvatarItem[] = [];

    if (Array.isArray(response)) {
      dataArray = response;
    }
    else if (response && Array.isArray(response.data)) {
      dataArray = response.data;
    }
    else {
      dataArray = [];
    }

    return {
      items: dataArray,
      total: dataArray.length,
    };
  }
  catch (error: any) {
    message.error(error?.message || t('notify.queryFailed'));
    return {
      items: [],
      total: 0,
    };
  }
};

/**
 * 監聽站長變化（Page Type B：Context Reader）
 * - 監聽 selectedMasterAgent（Context）和 userStore.masterAgent
 * - 切換站長時：reset() + reload(true)
 * - 不得使用 DOM 監聽
 * - 不得修改 Layout
 */
watch(
  () => selectedMasterAgent.value,
  () => {
    // Context 站長變化時，重置表格並重新載入資料
    if (selectedMasterAgent.value) {
      dynamicTableInstance?.reset();
      dynamicTableInstance?.reload(true);
    }
  },
);

// 對於 Level 4 用戶，同時監聽 userStore.masterAgent 變化
// 這是既有系統機制（userStore 是系統層狀態管理）
if (userStore.level === 4) {
  watch(
    () => userStore.masterAgent,
    () => {
      // 當 userStore.masterAgent 變化時，重置表格並重新載入資料
      dynamicTableInstance?.reset();
      dynamicTableInstance?.reload(true);
    },
  );
}

/**
 * 監聽 showDisabled 變化
 * - 切換時重新載入資料
 */
watch(
  () => showDisabled.value,
  () => {
    dynamicTableInstance?.reload();
  },
);

const defaultTempDialogData = () => {
  uploadFile.value = {
    previewAvatarImageUrl: '',
    profilePictureFile: undefined,
  };

  return {
    masterAgent: '',
    isEnabled: true,
  };
};

const onHandleCreate = () => {
  tempDialogData.value = defaultTempDialogData();
  dialogStatus.value = 'CREATE';
  dialogFormVisible.value = true;
};

const onHandleEdit = (row: DefaultAvatarItem) => {
  tempDialogData.value = defaultTempDialogData();
  dialogStatus.value = 'UPDATE';
  tempDialogData.value.avatarID = row.id;
  tempDialogData.value.isEnabled = row.isEnabled;
  uploadFile.value.previewAvatarImageUrl = toCdnUrl(row.profileUrl);
  dialogFormVisible.value = true;
};

const onHandleDelete = (row: DefaultAvatarItem) => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }

  Modal.confirm({
    title: t('buttons.delete'),
    content: `${t('notify.deleteConfirm')} - ID: ${row.id}`,
    okText: t('buttons.confirm'),
    cancelText: t('buttons.cancel'),
    async onOk() {
      try {
        await updateDefaultAvatarApi({
          masterAgent,
          avatarID: row.id,
          isDeleted: true,
        });
        message.success(t('notify.deleteSuccess'));
        dynamicTableInstance?.reload();
      }
      catch (error: any) {
        message.error(error?.message || t('notify.deleteFailed'));
      }
    },
  });
};

const isChangeable = (_row: DefaultAvatarItem) => {
  // 對齊 Vue2：isChangeable 方法（目前為空，保留擴展性）
  return false;
};

const handleBeforeUpload = (file: UploadFile) => {
  // 獲取原始文件對象
  let fileObj: File | undefined;

  if (file.originFileObj) {
    fileObj = file.originFileObj;
  }
  else if ((file as any).originFile) {
    fileObj = (file as any).originFile;
  }
  else if ((file as any) instanceof File) {
    fileObj = file as any;
  }

  if (!fileObj) {
    message.error(t('notify.uploadFailed'));
    return false;
  }

  // 驗證文件類型
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!fileObj.type || !validImageTypes.includes(fileObj.type.toLowerCase())) {
    message.error(t('notify.imageFormatError'));
    return false;
  }

  // 驗證文件大小（限制 2MB）
  const maxSize = 2 * 1024 * 1024;
  if (fileObj.size > maxSize) {
    message.error(t('notify.imageSizeError'));
    return false;
  }

  // 使用 FileReader 讀取文件並顯示預覽
  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      uploadFile.value.previewAvatarImageUrl = e.target.result as string;
      uploadFile.value.profilePictureFile = fileObj;
    }
  };
  reader.onerror = () => {
    message.error(t('notify.uploadFailed'));
    uploadFile.value.previewAvatarImageUrl = '';
    uploadFile.value.profilePictureFile = undefined;
  };
  reader.readAsDataURL(fileObj);

  return false; // 阻止自動上傳
};

const createDefaultAvatar = async () => {
  if (!uploadFile.value.profilePictureFile) {
    return;
  }

  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }

  try {
    const result = await createDefaultAvatarApi({
      masterAgent,
      profilePictureFile: uploadFile.value.profilePictureFile,
      isEnabled: tempDialogData.value.isEnabled,
    });

    // 對齊 Vue2：檢查 result.error === undefined 來判斷成功
    // Vue2 的響應格式：{ error?: { code, message }, data?: any, result?: any }
    // Vue3 的 request 工具可能已經解包，需要檢查多種格式
    const response = result as any;

    if (response && response.error === undefined) {
      // 成功：沒有 error 屬性
      disabledConfirm.value = false;
      dialogFormVisible.value = false;
      message.success(t('notify.createSuccess'));
      dynamicTableInstance?.reload();
    }
    else if (response && response.error) {
      // 有錯誤
      const errorMsg = response.error.message || t('notify.createFailed');
      disabledConfirm.value = false;
      message.error(errorMsg);
    }
    else if (response && response.data && !response.data.error) {
      // Vue3 格式：{ data: { ... } }，且 data 中沒有 error
      disabledConfirm.value = false;
      dialogFormVisible.value = false;
      message.success(t('notify.createSuccess'));
      dynamicTableInstance?.reload();
    }
    else {
      // 其他情況：可能是成功（Vue3 request 工具已解包）或失敗
      // 如果沒有明確的 error，視為成功
      const errorData = response?.data?.error || response?.error;
      if (errorData && errorData.message) {
        disabledConfirm.value = false;
        message.error(errorData.message);
      }
      else {
        // 沒有錯誤，視為成功
        disabledConfirm.value = false;
        dialogFormVisible.value = false;
        message.success(t('notify.createSuccess'));
        dynamicTableInstance?.reload();
      }
    }
  }
  catch (error: any) {
    disabledConfirm.value = false;
    message.error(error?.message || t('notify.createFailed'));
  }
};

const updateDefaultAvatar = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }

  try {
    const params: any = {
      masterAgent,
      avatarID: tempDialogData.value.avatarID,
      isEnabled: tempDialogData.value.isEnabled,
    };

    if (uploadFile.value.profilePictureFile) {
      params.profilePictureFile = uploadFile.value.profilePictureFile;
    }

    const res = await updateDefaultAvatarApi(params);
    const response = res as any;

    disabledConfirm.value = false;
    dialogFormVisible.value = false;

    if (!response?.error) {
      message.success(t('notify.updateSuccess'));
      dynamicTableInstance?.reload();
    }
    else {
      message.error(response.error?.message || t('notify.updateFailed'));
    }
  }
  catch (error: any) {
    disabledConfirm.value = false;
    message.error(error?.message || t('notify.updateFailed'));
  }
};

const onDialogConfirm = async () => {
  if (dialogStatus.value === 'CREATE' && !uploadFile.value.profilePictureFile) {
    message.error(t('rules.image'));
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
</script>

<template>
  <div class="default-avatar-setting-page">
    <!-- 權限檢查 -->
    <a-result
      v-if="!hasPermission"
      status="403"
      :title="t('noPermission.title')"
      :sub-title="t('noPermission.subTitle')"
    />

    <!-- DynamicTable -->
    <DynamicTable
      v-else
      v-show="isSelectedMasterAgent"
      row-key="id"
      :columns="columns"
      :data-request="loadTableData"
      :pagination="false"
      :scroll="tableScroll"
      :auto-height="true"
    >
      <template #headerTitle>
        <span>{{ t('title') }}</span>
      </template>
      <template #toolbar>
        <a-space>
          <Button
            v-if="isSelectedMasterAgent"
            type="primary"
            :disabled="!hasPermission"
            @click="onHandleCreate"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            {{ t('buttons.add') }}
          </Button>
          <Divider type="vertical" />
          <span>{{ t('columns.showDisabled') }}</span>
          <Switch v-model:checked="showDisabled" />
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'ACTION'">
          <a-space>
            <a-button
              type="link"
              size="small"
              :disabled="isChangeable(record)"
              @click="onHandleEdit(record)"
            >
              <template #icon>
                <EditOutlined />
              </template>
              {{ t('buttons.edit') }}
            </a-button>
            <a-button
              type="link"
              size="small"
              danger
              :disabled="isChangeable(record)"
              @click="onHandleDelete(record)"
            >
              <template #icon>
                <DeleteOutlined />
              </template>
              {{ t('buttons.delete') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </DynamicTable>

    <!-- Dialog -->
    <a-modal
      v-if="hasPermission"
      v-model:open="dialogFormVisible"
      :title="dialogStatus === 'CREATE' ? t('buttons.create') : t('buttons.edit')"
      :confirm-loading="disabledConfirm"
      :mask-closable="false"
      :width="700"
      @ok="onDialogConfirm"
      @cancel="dialogFormVisible = false"
    >
      <a-form
        :model="tempDialogData"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item
          :label="t('form.image')"
          :rules="[{ required: dialogStatus === 'CREATE', message: t('rules.image') }]"
        >
          <div class="uploader-container">
            <Upload
              :before-upload="handleBeforeUpload"
              :show-upload-list="false"
              accept="image/jpeg,image/jpg,image/png"
            >
              <a-button>
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ t('buttons.selectImage') }}
              </a-button>
            </Upload>
            <div
              v-if="uploadFile.previewAvatarImageUrl"
              style="position: relative; display: inline-block; margin-top: 10px;"
            >
              <img
                :src="uploadFile.previewAvatarImageUrl"
                style="width: 128px; height: 128px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;"
                alt="preview"
              >
              <a-button
                type="text"
                danger
                size="small"
                style="position: absolute; top: 0; right: 0;"
                @click.stop="uploadFile.previewAvatarImageUrl = ''; uploadFile.profilePictureFile = undefined;"
              >
                {{ t('buttons.remove') }}
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item
          :label="t('form.isEnabled')"
        >
          <a-checkbox v-model:checked="tempDialogData.isEnabled" />
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
  </div>
</template>

<style scoped lang="less">
.default-avatar-setting-page {
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

        &.input_group-selector {
          min-width: 240px;
          flex-shrink: 0;
        }

        .txt {
          width: 100px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .my_switch {
          background: #e7e7e7;
          width: 60px;
          height: 36px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .btn {
          margin: 10px 0;
        }
      }
    }

    .input_group-button {
      margin-top: 10px;
      padding: 0;
    }
  }

  .uploader-container {
    margin: 30px 0;
    position: relative;
  }

  .w-240 {
    width: 240px;
    min-width: 240px;
  }
}
</style>
