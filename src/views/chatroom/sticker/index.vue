<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import type { StickerColumns } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { UploadOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import {
  addSticker,
  removeSticker,
  stickerList,
  updateSticker,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'ChatroomSticker',
});

const { t } = useI18n('page.sticker');
const userStore = useUserStore();

// ============ 狀態管理 ============
const isTableLoading = ref(false);
const masterAgent = ref('');
const masterAgentList = ref<Array<{ account: string }>>([]);
const stickerListData = ref<StickerColumns[]>([]);

// Dialog 狀態
const isDialogShow = ref(false);
const formState = ref<'create' | 'update' | 'unknown'>('unknown');
const form = reactive<Pick<StickerColumns, 'id' | 'name'>>({
  id: -1,
  name: '',
});
const icon = reactive<{ file?: File; previewUrl?: string }>({
  file: undefined,
  previewUrl: undefined,
});
const formRef = ref();

const getAuthLevel = computed(() => userStore.level);

const getI18nText = (path: string) => {
  return t(path);
};

// ============ 表格配置 ============
const columns = ref<TableColumn<StickerColumns>[]>([
  {
    title: 'ID',
    dataIndex: 'id',
    width: 100,
  },
  {
    title: getI18nText('labels.stickerName'),
    dataIndex: 'name',
    width: 200,
  },
  {
    title: getI18nText('labels.stickerIcon'),
    dataIndex: 'url',
    width: 150,
    customRender: ({ record }) => {
      if (!record.url) {
        return '-';
      }
      return h('img', {
        src: record.url,
        alt: record.name || 'sticker',
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
          cursor: 'pointer',
        },
        onError: (e: Event) => {
          console.error('Image load error for URL:', record.url);
          const img = e.target as HTMLImageElement;
          img.style.display = 'none';
          img.alt = 'Failed to load image';
        },
        onClick: () => {
          if (record.url) {
            window.open(record.url, '_blank');
          }
        },
      });
    },
  },
]);

const extraData = ref<any[]>([]);

const extraDataInit = () => {
  const control: any[] = [];
  stickerListData.value.forEach((row) => {
    const actions: any[] = [
      {
        label: t('edit'),
        onClick: () => onUpdateBtnClick(row),
      },
      {
        label: t('delete'),
        onClick: () => removeStickerHandler(row),
      },
    ];
    control.push(actions);
  });
  extraData.value = control;
};

/**
 * ============ 工具函數 ============
 */
const clearForm = () => {
  form.id = -1;
  form.name = '';
  icon.file = undefined;
  icon.previewUrl = undefined;
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
  icon.previewUrl = row.url;
  formState.value = 'update';
  controlDialogShow(true);
};

/** 阻止自動上傳 */
const beforeUpload = (_file: UploadFile) => {
  return false; // 阻止自動上傳，我們手動處理
};

/**
 * 處理文件選擇變化
 */
const handleFileChange = (info: { file: UploadFile; fileList: UploadFile[] }) => {
  // 只處理文件選擇完成的情況（status 為 'done' 或 undefined，表示新選擇的文件）
  const file = info.file;

  // 如果文件狀態是 'removed'，不處理
  if (file.status === 'removed') {
    icon.previewUrl = undefined;
    icon.file = undefined;
    return;
  }

  console.log('File selected:', file);
  console.log('File status:', file.status);

  // 獲取原始文件對象，嘗試多種方式
  let fileObj: File | undefined;

  // 方式1: 直接使用 originFileObj
  if (file.originFileObj) {
    fileObj = file.originFileObj;
  }
  // 方式2: 嘗試 originFile
  else if ((file as any).originFile) {
    fileObj = (file as any).originFile;
  }
  // 方式3: 從 fileList 中獲取最後一個文件
  else if (info.fileList && info.fileList.length > 0) {
    const lastFile = info.fileList[info.fileList.length - 1];
    if (lastFile.originFileObj) {
      fileObj = lastFile.originFileObj;
    }
    else if ((lastFile as any).originFile) {
      fileObj = (lastFile as any).originFile;
    }
  }

  if (!fileObj) {
    console.error('無法獲取文件對象', {
      file,
      fileList: info.fileList,
      hasOriginFileObj: !!file.originFileObj,
      hasOriginFile: !!(file as any).originFile,
    });
    message.error('無法讀取文件，請重試或選擇其他圖片');
    return;
  }

  console.log('File object obtained:', fileObj);

  // 驗證文件類型
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (!fileObj.type || !validImageTypes.includes(fileObj.type.toLowerCase())) {
    const formatList = validImageTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
    message.error(`不支援的圖片格式。請選擇以下格式：${formatList}`);
    icon.previewUrl = undefined;
    icon.file = undefined;
    return;
  }

  // 驗證文件大小（例如：限制 5MB）
  /**
   * 5MB
   */
  const maxSize = 5 * 1024 * 1024;
  if (fileObj.size > maxSize) {
    message.error('圖片大小不能超過 5MB');
    icon.previewUrl = undefined;
    icon.file = undefined;
    return;
  }

  // 設置文件對象
  icon.file = fileObj;

  // 使用 FileReader 讀取文件並顯示預覽
  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      icon.previewUrl = e.target.result as string;
      const previewUrlPreview = icon.previewUrl?.substring(0, 50) || '';
      console.log('Preview URL set:', `${previewUrlPreview}...`);
      message.success('圖片預覽已加載');
    }
  };
  reader.onerror = () => {
    message.error('圖片讀取失敗，請重試');
    icon.previewUrl = undefined;
    icon.file = undefined;
  };
  reader.readAsDataURL(fileObj);
};

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

const onMasterAgentChanged = async (value: string) => {
  if (!value) {
    masterAgent.value = '';
    stickerListData.value = [];
    return;
  }
  isTableLoading.value = true;
  masterAgent.value = value;
  await setStickerList();
  isTableLoading.value = false;
};

/**
 * ============ API 調用 ============
 */
const setStickerList = async () => {
  try {
    if (!masterAgent.value) {
      stickerListData.value = [];
      extraData.value = [];
      return;
    }
    const res = await stickerList({ masterAgent: masterAgent.value });
    // 處理不同的響應格式：可能是 { data: [...] } 或直接是數組
    let stickerData: StickerColumns[] = [];
    if (res) {
      // 如果直接是數組
      if (Array.isArray(res)) {
        stickerData = res;
      }
      // 如果是 { data: [...] } 格式
      else if (res.data && Array.isArray(res.data)) {
        stickerData = res.data;
      }
      // 嘗試其他可能的格式
      else if ((res as any).data && Array.isArray((res as any).data)) {
        stickerData = (res as any).data;
      }
    }

    console.log('Sticker data received:', stickerData);

    if (stickerData && stickerData.length > 0) {
      stickerListData.value = stickerData;
      extraDataInit();
    }
    else {
      stickerListData.value = [];
      extraData.value = [];
    }
  }
  catch (error) {
    console.error('Failed to get sticker list:', error);
    message.error(t('fail'));
    stickerListData.value = [];
    extraData.value = [];
  }
};

const createStickerHandler = async () => {
  try {
    if (!icon.file) {
      message.error(getI18nText('notify.required'));
      return;
    }
    if (!masterAgent.value) {
      message.error('請先選擇站長');
      return;
    }
    const res = await addSticker({
      masterAgent: masterAgent.value,
      name: form.name,
      imageFile: icon.file,
    });
    // 處理不同的響應格式
    if (res) {
      // 無論響應格式如何，只要沒有錯誤就視為成功
      await setStickerList();
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
    if (!masterAgent.value) {
      message.error('請先選擇站長');
      return;
    }
    const res = await updateSticker({
      id: form.id,
      masterAgent: masterAgent.value,
      name: form.name,
      imageFile: icon.file, // 可選，如果沒有選擇新圖片則只更新名稱
    });
    // 處理不同的響應格式
    if (res) {
      // 無論響應格式如何，只要沒有錯誤就視為成功
      await setStickerList();
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
        if (!masterAgent.value) {
          message.error('請先選擇站長');
          return;
        }
        const res = await removeSticker({
          id: row.id,
          masterAgent: masterAgent.value,
        });
        // 處理不同的響應格式
        if (res) {
          // 無論響應格式如何，只要沒有錯誤就視為成功
          await setStickerList();
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

// ============ 表格 ============
const [DynamicTable] = useTable({
  search: false,
  showActionColumn: true,
  actionColumn: {
    title: getI18nText('labels.control'),
    width: 200,
    fixed: 'right',
    actions: ({ record, index }) => {
      const actions = extraData.value[index] || [];
      return actions.map((action: any) => ({
        ...action,
        onClick: () => action.onClick(record),
      }));
    },
  },
});

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

/**
 * ============ 初始化 ============
 */
const fetchMasterAgentList = async () => {
  try {
    const list = await getMasterAgentAccountList();
    masterAgentList.value = (list || []).map((item: any) => ({ account: item.account }));
  }
  catch (error) {
    console.error('Failed to fetch master agent list:', error);
  }
};

onMounted(async () => {
  if (getAuthLevel.value < 4) {
    await fetchMasterAgentList();
  }
});
</script>

<template>
  <div class="app-container chatroom-sticker">
    <div class="filter-container">
      <div class="wrap">
        <div
          v-if="getAuthLevel < 4"
          class="input_group"
        >
          <div class="txt">
            <label>站長</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="masterAgent"
              placeholder="請選擇站長"
              style="width: 200px"
              @change="onMasterAgentChanged"
            >
              <a-select-option
                v-for="item in masterAgentList"
                :key="item.account"
                :value="item.account"
              >
                {{ item.account }}
              </a-select-option>
            </a-select>
          </div>
        </div>
        <div class="input_group">
          <a-button
            type="primary"
            @click="onCreateBtnClick"
          >
            {{ t('add') }}
          </a-button>
        </div>
      </div>
    </div>

    <DynamicTable
      :loading="isTableLoading"
      :columns="columns"
      :data-source="stickerListData"
      :scroll="{ x: 'max-content' }"
    />

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
      >
        <a-form-item
          :label="getI18nText('labels.stickerName')"
          name="name"
        >
          <a-input
            v-model:value="form.name"
            :placeholder="getI18nText('labels.stickerName')"
          />
        </a-form-item>
        <a-form-item
          :label="getI18nText('labels.stickerIcon')"
        >
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a-upload
              :before-upload="beforeUpload"
              :show-upload-list="false"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp"
              @change="handleFileChange"
            >
              <a-button>
                <template #icon>
                  <UploadOutlined />
                </template>
                選擇圖片
              </a-button>
            </a-upload>
            <div
              v-if="icon.previewUrl"
              style="position: relative; display: inline-block;"
            >
              <img
                :src="icon.previewUrl"
                style="width: 150px; height: 150px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;"
                alt="preview"
              >
              <a-button
                type="text"
                danger
                size="small"
                style="position: absolute; top: 0; right: 0;"
                @click.stop="icon.previewUrl = undefined; icon.file = undefined;"
              >
                移除
              </a-button>
            </div>
          </div>
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
</style>
