<script setup lang="ts">
import type { IconItem } from '@/api/backend/treasureChestSystem';
import { ImageType, addIcon, queryIcon, removeIcon } from '@/api/backend/treasureChestSystem';

import { UploadOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { computed, h, onMounted, ref } from 'vue';
import { Upload, Button } from 'ant-design-vue';
import type { UploadFile } from 'ant-design-vue';

import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'ImageSetting',
});

const i18n = useI18n('page.imageSetting');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

const masterAgent = ref<string>('');
const isSelectedMasterAgent = ref(false);

// =========================
// Table data
// =========================

const listLoading = ref(false);
const list = ref<IconItem[]>([]);
const tableKey = ref(0);

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
}>({
  masterAgent: '',
  name: '',
  url: '',
  type: ImageType.MAIL,
  gameID: '',
});

const limitMinWidth = ref(130);
const limitMinHeight = ref(130);

const uploadFile = ref<{
  previewAvatarImageUrl: string;
  profilePictureFile?: File;
}>({
  previewAvatarImageUrl: '',
  profilePictureFile: undefined,
});

const imageTypeList = computed(() => [
  { name: t('type.mail'), value: ImageType.MAIL },
]);

// 對齊 Vue2：this.assetsDomainName = cdnBaseURL;
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';
const toCdnUrl = (url?: string) => {
  if (!url) {
    return '';
  }
  // 對齊 Vue2：assetsDomainName + row.url (直接拼接)
  // 如果已經是完整 URL，直接返回
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  // 否則拼接 CDN base URL
  return cdnBaseUrl ? `${cdnBaseUrl}${url}` : url;
};

// =========================
// Methods
// =========================

const getDefaultAvatarList = async () => {
  if (!masterAgent.value) {
    return;
  }

  listLoading.value = true;
  try {
    // 對齊 Vue2：const { data } = await queryIcon(this.listQuery);
    // Vue2 的 request interceptor 返回 response.data，所以 queryIcon 返回 { result: [...] }
    // Vue3 的 request 對於 AdminSystem API 返回整個 response，所以 res.data 是 { result: [...] }
    const res = await queryIcon({ masterAgent: masterAgent.value });
    
    // 根據實際 API 回傳格式：{ result: [...] }
    // Vue2: response.data = { result: [...] }，所以 data.result 是陣列
    // Vue3: response.data = { result: [...] }，所以 res.data.result 是陣列
    if (res && res.data && res.data.result && Array.isArray(res.data.result)) {
      list.value = res.data.result;
    }
    // 如果 res.data 直接是 { result: [...] }（某些情況下可能已經解包）
    else if (res && res.data && res.data.result) {
      list.value = Array.isArray(res.data.result) ? res.data.result : [];
    }
    // 如果 res 直接是 { result: [...] }（Vue2 風格，request 已解包）
    else if (res && res.result && Array.isArray(res.result)) {
      list.value = res.result;
    }
    else {
      list.value = [];
    }
  }
  catch (error: any) {
    message.error(error?.message || t('notify.queryFailed'));
    list.value = [];
  }
  finally {
    // 對齊 Vue2：setTimeout(() => { this.listLoading = false; }, 0.5 * 1000);
    setTimeout(() => {
      listLoading.value = false;
    }, 500);
  }
};

// 對齊 Vue2：onMasterAgentChanged(changes:{masterAgent:string, agents: Array<{account:string}>})
const onMasterAgentChanged = async () => {
  // 對齊 Vue2：this.listQuery.masterAgent = changes.masterAgent;
  if (!masterAgent.value || masterAgent.value === '') {
    isSelectedMasterAgent.value = false;
    list.value = [];
    return;
  }

  // 對齊 Vue2：this.isSelectedMasterAgent = true;
  isSelectedMasterAgent.value = true;

  // 對齊 Vue2：if (this.getAuthLevel < 4) { this.handleFilter(); }
  if (hasPermission.value) {
    await getDefaultAvatarList();
  }
};

const defaultDialogForm = () => ({
  masterAgent: '',
  name: '',
  url: '',
  type: ImageType.MAIL,
  gameID: '',
});

const onHandleCreate = () => {
  disabledConfirm.value = false;
  uploadFile.value.profilePictureFile = undefined;
  uploadFile.value.previewAvatarImageUrl = '';
  dialogForm.value = defaultDialogForm();
  dialogStatus.value = 'CREATE';
  dialogFormVisible.value = true;
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
        await removeIcon({ masterAgent: masterAgent.value, id: [row.id] });
        message.success(t('notify.deleteSuccess'));
        await getDefaultAvatarList();
      }
      catch (error: any) {
        message.error(error?.message || t('notify.deleteFailed'));
      }
    },
  });
};

const handleAvatarImageImport = (params: { raw: File; previewUrl: string }) => {
  uploadFile.value.previewAvatarImageUrl = params.previewUrl;
  uploadFile.value.profilePictureFile = params.raw;
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
    message.error('無法讀取文件，請重試或選擇其他圖片');
    return false;
  }

  // 驗證文件類型
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (!fileObj.type || !validImageTypes.includes(fileObj.type.toLowerCase())) {
    const formatList = validImageTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
    message.error(`不支援的圖片格式。請選擇以下格式：${formatList}`);
    return false;
  }

  // 驗證文件大小（限制 5MB）
  const maxSize = 5 * 1024 * 1024;
  if (fileObj.size > maxSize) {
    message.error('圖片大小不能超過 5MB');
    return false;
  }

  // 使用 FileReader 讀取文件並顯示預覽
  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      uploadFile.value.previewAvatarImageUrl = e.target.result as string;
      uploadFile.value.profilePictureFile = fileObj;
      message.success('圖片預覽已加載');
    }
  };
  reader.onerror = () => {
    message.error('圖片讀取失敗，請重試');
    uploadFile.value.previewAvatarImageUrl = '';
    uploadFile.value.profilePictureFile = undefined;
  };
  reader.readAsDataURL(fileObj);
  
  return false; // 阻止自動上傳
};

const onDialogConfirm = async () => {
  if (!uploadFile.value.profilePictureFile) {
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

const createDefaultAvatar = async () => {
  if (!uploadFile.value.profilePictureFile) {
    return;
  }

  try {
    // 對齊 Vue2：gameID 為 undefined，而不是空字串
    const postData = {
      masterAgent: masterAgent.value,
      name: dialogForm.value.name,
      imageFile: uploadFile.value.profilePictureFile,
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
      await getDefaultAvatarList();
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
      await getDefaultAvatarList();
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

const isChangeable = (row: IconItem) => {
  // 根據業務邏輯判斷是否可變更
  return false;
};

// =========================
// Lifecycle
// =========================

onMounted(() => {
  // 對齊其他頁面：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
    onMasterAgentChanged();
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

    <a-card v-else :title="t('title')" :bordered="false">
      <!-- Filter -->
      <!-- 對齊 Vue2：filter-container 結構 -->
      <div class="filter-container">
        <div class="wrap">
          <div class="input_group">
            <div class="txt">{{ t('labels.masterAgent') }}</div>
            <div class="my_input">
              <AdminAccountSelector
                v-model="masterAgent"
                value-type="account"
                :auto-select-first="true"
                @update:model-value="onMasterAgentChanged"
              />
            </div>
          </div>
          <div class="input_group">
            <a-button
              v-if="isSelectedMasterAgent"
              type="primary"
              :disabled="!hasPermission"
              @click="onHandleCreate"
            >
              {{ t('buttons.add') }}
            </a-button>
          </div>
        </div>
      </div>

      <!-- Table -->
      <!-- 對齊 Vue2：el-table 結構 -->
      <a-table
        :key="tableKey"
        :loading="listLoading"
        :data-source="list"
        :columns="[
          {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
            align: 'center',
          },
          {
            title: t('labels.type'),
            dataIndex: 'type',
            width: 80,
            align: 'center',
            customRender: ({ record }: { record: IconItem }) => t(`type.${record.type}`),
          },
          {
            title: t('labels.name'),
            dataIndex: 'name',
            width: 200,
            align: 'center',
          },
          {
            title: t('labels.image'),
            dataIndex: 'url',
            width: 200,
            align: 'center',
            customRender: ({ record }: { record: IconItem }) => {
              if (record.url) {
                return h('img', {
                  src: toCdnUrl(record.url),
                  width: 50,
                  height: 50,
                  loading: 'lazy',
                  style: { objectFit: 'cover' },
                });
              }
              return null;
            },
          },
          {
            title: t('labels.actions'),
            dataIndex: 'actions',
            align: 'center',
            width: 250,
            customRender: ({ record }: { record: IconItem }) => {
              return h(Button, {
                type: 'primary',
                danger: true,
                size: 'small',
                disabled: isChangeable(record),
                onClick: () => onHandleDelete(record),
              }, () => t('buttons.delete'));
            },
          },
        ]"
        :pagination="false"
        bordered
        style="width: 100%;"
      />

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
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="white-space: nowrap;">{{ t('labels.limitMinWidth') }}</span>
                <a-input-number
                  v-model:value="limitMinWidth"
                  style="width: 150px"
                />
                <span style="white-space: nowrap;">{{ t('labels.limitMinHeight') }}</span>
                <a-input-number
                  v-model:value="limitMinHeight"
                  style="width: 150px"
                />
              </div>
              <div class="uploader-container">
                <Upload
                  :before-upload="handleBeforeUpload"
                  :show-upload-list="false"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp"
                >
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    選擇圖片
                  </a-button>
                </Upload>
                <div
                  v-if="uploadFile.previewAvatarImageUrl"
                  style="position: relative; display: inline-block; margin-top: 10px;"
                >
                  <img
                    :src="uploadFile.previewAvatarImageUrl"
                    style="width: 150px; height: 150px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;"
                    alt="preview"
                  >
                  <a-button
                    type="text"
                    danger
                    size="small"
                    style="position: absolute; top: 0; right: 0;"
                    @click.stop="uploadFile.previewAvatarImageUrl = ''; uploadFile.profilePictureFile = undefined;"
                  >
                    移除
                  </a-button>
                </div>
              </div>
            </div>
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

  .uploader-container {
    margin: 30px 0;
    position: relative;

    .preview-image,
    .upload-placeholder {
      border-radius: 4px;
    }
  }
}
</style>

