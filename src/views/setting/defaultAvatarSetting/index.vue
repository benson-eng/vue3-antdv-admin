<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { DefaultAvatarItem } from '@/api/backend/profileSystem';

import { UploadOutlined } from '@ant-design/icons-vue';
import { Button, message, Modal, Switch, Table, Tag, Upload } from 'ant-design-vue';
import { computed, h, onMounted, ref, watch } from 'vue';

import { createDefaultAvatar as createDefaultAvatarApi, getDefaultAvatar, updateDefaultAvatar as updateDefaultAvatarApi } from '@/api/backend/profileSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'DefaultAvatarSetting',
});

const i18n = useI18n('routes.setting.defaultAvatarSettingPage');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

const masterAgent = ref<string>('');
const isSelectedMasterAgent = ref(false);

// =========================
// Table data
// =========================

const listLoading = ref(false);
const list = ref<DefaultAvatarItem[]>([]);
const tableKey = ref(0);

// =========================
// Filter
// =========================

const listQuery = ref<{ masterAgent: string; isEnabled: boolean }>({
  masterAgent: '',
  isEnabled: true,
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

// 對齊 Vue2：this.assetsDomainName = cdnBaseURL;
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';
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
// Methods
// =========================

const getDefaultAvatarList = async () => {
  if (!listQuery.value.masterAgent) {
    return;
  }

  listLoading.value = true;
  try {
    const res = await getDefaultAvatar({
      masterAgent: listQuery.value.masterAgent,
      isEnabled: listQuery.value.isEnabled,
    });

    // 對齊 Vue2：const { data } = await getDefaultAvatarAction(this.listQuery);
    // Vue2 的 request interceptor 返回 response.data，所以 getDefaultAvatar 返回陣列
    // Vue3 的 request 對於 AdminSystem API 返回整個 response，所以 res.data 是陣列
    const response = res as any;
    if (Array.isArray(response)) {
      list.value = response;
    }
    else if (response && Array.isArray(response.data)) {
      list.value = response.data;
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

const handleFilter = () => {
  if (listQuery.value.masterAgent) {
    getDefaultAvatarList();
  }
  else {
    message.error(t('notify.masterAgentRequired'));
  }
};

/**
 * 對齊 Vue2：onMasterAgentChanged(changes:{masterAgent:string, agents: Array<{account:string}>})
 */
const onMasterAgentChanged = async () => {
  listQuery.value.masterAgent = masterAgent.value;

  if (!masterAgent.value || masterAgent.value === '') {
    isSelectedMasterAgent.value = false;
    list.value = [];
    return;
  }

  isSelectedMasterAgent.value = true;

  // 對齊 Vue2：if (this.getAuthLevel < 4) { this.handleFilter(); }
  if (hasPermission.value) {
    await handleFilter();
  }
};

watch(
  () => masterAgent.value,
  () => {
    onMasterAgentChanged();
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
  Modal.confirm({
    title: t('buttons.delete'),
    content: `${t('notify.deleteConfirm')} - ID: ${row.id}`,
    okText: t('buttons.confirm'),
    cancelText: t('buttons.cancel'),
    async onOk() {
      try {
        await updateDefaultAvatarApi({
          masterAgent: listQuery.value.masterAgent,
          avatarID: row.id,
          isDeleted: true,
        });
        message.success(t('notify.deleteSuccess'));
        await getDefaultAvatarList();
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

const tagType = (status: boolean) => {
  return status ? 'success' : 'default';
};

const dataFormat = (isEnabled: boolean) => {
  return isEnabled ? t('labels.enable') : t('labels.disable');
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

  try {
    const result = await createDefaultAvatarApi({
      masterAgent: listQuery.value.masterAgent,
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
      await getDefaultAvatarList();
      dialogFormVisible.value = false;
      message.success(t('notify.createSuccess'));
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
      await getDefaultAvatarList();
      dialogFormVisible.value = false;
      message.success(t('notify.createSuccess'));
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
        await getDefaultAvatarList();
        dialogFormVisible.value = false;
        message.success(t('notify.createSuccess'));
      }
    }
  }
  catch (error: any) {
    disabledConfirm.value = false;
    message.error(error?.message || t('notify.createFailed'));
  }
};

const updateDefaultAvatar = async () => {
  try {
    const params: any = {
      masterAgent: listQuery.value.masterAgent,
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
      await getDefaultAvatarList();
      message.success(t('notify.updateSuccess'));
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

const onHandleSwitchEnabled = () => {
  handleFilter();
};

onMounted(() => {
  // 對齊其他頁面：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});
</script>

<template>
  <div class="default-avatar-setting-page">
    <a-card :title="t('title')" :bordered="false">
      <a-result
        v-if="!hasPermission"
        status="403"
        :title="t('noPermission.title')"
        :sub-title="t('noPermission.subTitle')"
      />

      <template v-else>
        <!-- Filter -->
        <div class="filter-container">
          <div class="wrap">
            <div class="input_group input_group-selector">
              <div class="txt">
                <label>{{ t('filters.masterAgent') }}</label>
              </div>
              <div class="my_input">
                <AdminAccountSelector
                  v-model="masterAgent"
                  value-type="account"
                  :auto-select-first="true"
                  class="w-240"
                  :placeholder="t('filters.masterAgentPlaceholder')"
                />
              </div>
            </div>

            <div class="input_group">
              <div class="txt">
                <label>{{ t('columns.isEnabled') }}</label>
              </div>
              <div class="my_switch">
                <Switch
                  v-model:checked="listQuery.isEnabled"
                  :disabled="!hasPermission"
                  @change="onHandleSwitchEnabled"
                />
              </div>
            </div>
          </div>

          <div class="input_group input_group-button">
            <Button
              v-if="isSelectedMasterAgent"
              type="primary"
              :disabled="!hasPermission"
              @click="onHandleCreate"
            >
              {{ t('buttons.add') }}
            </Button>
          </div>
        </div>

        <!-- Table -->
        <Table
          :key="tableKey"
          :loading="listLoading"
          :data-source="list"
          :columns="[
            {
              title: t('columns.id'),
              dataIndex: 'id',
              width: 80,
              align: 'center',
            },
            {
              title: t('columns.profileUrl'),
              dataIndex: 'profileUrl',
              width: 200,
              align: 'center',
              customRender: ({ record }: { record: DefaultAvatarItem }) => {
                if (record.profileUrl) {
                  return h('img', {
                    src: toCdnUrl(record.profileUrl),
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
              title: t('columns.ebableStatus'),
              dataIndex: 'isEnabled',
              width: 100,
              align: 'center',
              customRender: ({ record }: { record: DefaultAvatarItem }) => {
                return h(Tag, {
                  color: tagType(record.isEnabled),
                }, () => dataFormat(record.isEnabled));
              },
            },
            {
              title: t('columns.createDateTime'),
              dataIndex: 'createDateTime',
              width: 175,
              align: 'center',
              customRender: ({ record }: { record: DefaultAvatarItem }) => {
                if (record.createDateTime) {
                  return new Date(record.createDateTime).toLocaleString('zh-TW');
                }
                return '-';
              },
            },
            {
              title: t('columns.actions'),
              dataIndex: 'actions',
              align: 'center',
              width: 250,
              customRender: ({ record }: { record: DefaultAvatarItem }) => {
                return h('div', { style: 'display: flex; gap: 8px; justify-content: center;' }, [
                  h(Button, {
                    type: 'primary',
                    size: 'small',
                    disabled: isChangeable(record),
                    onClick: () => onHandleEdit(record),
                  }, () => t('buttons.edit')),
                  h(Button, {
                    type: 'primary',
                    danger: true,
                    size: 'small',
                    disabled: isChangeable(record),
                    onClick: () => onHandleDelete(record),
                  }, () => t('buttons.delete')),
                ]);
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
      </template>
    </a-card>
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
