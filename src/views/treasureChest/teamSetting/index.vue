<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { TeamBadgeItem } from './columns';
import type { ItemTag } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { UploadOutlined } from '@ant-design/icons-vue';
import { message, Switch, Upload } from 'ant-design-vue';
import { computed, nextTick, onMounted, ref } from 'vue';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import {
  addItemTag,
  addTeamBadge,
  disableTreasureItem,

  itemTagList,
  treasureItemList,
  updateTeamBadge,
  updateTreasureItem,
} from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getColumns } from './columns';

defineOptions({
  name: 'TeamSetting',
});

const { t } = useI18n('page.teamSetting');
const userStore = useUserStore();

const [DynamicTable, dynamicTableInstance] = useTable({
  formProps: { autoSubmitOnEnter: true },
});

// 總代理選擇
const masterAgent = ref<string>('');
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);

// 表格數據
const tableData = ref<TeamBadgeItem[]>([]);
const loading = ref(false);
// 追蹤當前載入數據的 masterAgent，用於判斷是否需要重新載入
const loadedMasterAgent = ref<string>('');

// 標籤列表
const itemTagListData = ref<ItemTag[]>([]);
const itemTagListObj = ref<Record<string, number>>({});

// CDN Base URL
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';

// 表單相關
const dialogFormVisible = ref(false);
const dialogForm = ref<{
  treasureItemID?: string;
  itemName: string;
  tagID: number | null;
}>({
  itemName: '',
  tagID: null,
});

const teamIconUrl = ref<string>('');
const teamIconFile = ref<File | undefined>(undefined);
const isChangeTeamIcon = ref(false);

const iconFileUrl = ref<string>('');
const iconFile = ref<File | undefined>(undefined);
const isChangeIconFile = ref(false);

const mode = ref<'create' | 'edit' | 'view'>('create');
const disabledConfirm = ref(false);

// 標籤彈窗
const isTagDialog = ref(false);
const newItemTag = ref('');

/**
 * 載入隊伍徽章列表（不觸發表格重新載入，避免無限迴圈）
 */
const loadData = async (skipReload = false) => {
  if (!masterAgent.value) {
    tableData.value = [];
    if (!skipReload) {
      dynamicTableInstance?.reload();
    }
    return;
  }

  loading.value = true;
  try {
    const res = await treasureItemList({ masterAgent: masterAgent.value });

    console.log('treasureItemList API 回傳:', res);
    console.log('res.data:', res.data);
    console.log('res.rows:', (res as any).rows);

    // 對齊 Vue2 邏輯：過濾出 teamBadge 類型的項目
    // Vue2: res.data.rows.reduce((acc: any[], r) => { if (r.type === "teamBadge") { ... } })
    // 根據實際 API 回傳格式，可能是 res.data.rows 或 res.rows
    // 從控制台日誌看，res 可能是 { rows: Array(2) } 或 { data: { rows: Array(2) } }
    let rows: any[] = [];
    if ((res as any).rows && Array.isArray((res as any).rows)) {
      // 如果 res 直接有 rows 屬性（如 { rows: [...] }）
      rows = (res as any).rows;
    }
    else if (res.data?.rows && Array.isArray(res.data.rows)) {
      // 如果 res 有 data.rows（如 { data: { rows: [...] } }）
      rows = res.data.rows;
    }
    else if (res.data && Array.isArray(res.data)) {
      // 如果 res.data 直接是陣列
      rows = res.data;
    }
    console.log('解析後的 rows:', rows);

    const teamBadgeItems: TeamBadgeItem[] = [];

    rows.forEach((row: any) => {
      if (row.type === 'teamBadge' && row.items) {
        console.log('找到 teamBadge 類型的 row:', row);
        row.items.forEach((item: any) => {
          // 對齊 Vue2 邏輯：只顯示 enabled === 1 的項目
          // Vue2: if (item.enabled === 1) { inItem.push(item); }
          if (item.enabled === 1) {
            teamBadgeItems.push({
              treasureItemID: item.treasureItemID,
              itemName: item.itemName,
              itemType: item.itemType || 'teamBadge',
              tag: item.tag || null,
              teamIcon: item.teamIcon || '',
              iconUrl: item.iconUrl || '',
              enabled: item.enabled,
              creationDate: item.creationDate,
              updatedOn: item.updatedOn,
            });
          }
        });
      }
    });

    console.log('過濾後的 teamBadge 項目:', teamBadgeItems);
    tableData.value = teamBadgeItems;
    // 只有在明確需要時才觸發重新載入，避免在 loadTableData 中造成無限迴圈
    if (!skipReload) {
      dynamicTableInstance?.reload();
    }
  }
  catch (error) {
    console.error('載入隊伍徽章列表失敗', error);
    message.error(t('loadFailed'));
    tableData.value = [];
  }
  finally {
    loading.value = false;
  }
};

/**
 * 載入標籤列表
 */
const loadItemTagList = async () => {
  if (!masterAgent.value) {
    itemTagListData.value = [];
    itemTagListObj.value = {};
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

    // 對齊 Vue2 邏輯：只顯示 teamBadge 類型的標籤
    const filteredData = dataArray.filter(item => item.itemType === 'teamBadge' && item.enabled);
    itemTagListData.value = filteredData;

    // 建立標籤名稱到 ID 的映射
    itemTagListObj.value = {};
    filteredData.forEach((item) => {
      itemTagListObj.value[item.tag] = item.id;
    });
  }
  catch (error) {
    console.error('載入標籤列表失敗', error);
  }
};

/**
 * 獲取總代理列表
 */
const fetchMasterAgents = async () => {
  const list = await getMasterAgentList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));

  // 如果用戶等級 >= 4，自動選擇第一個總代理
  // 對齊 Vue2：AgentIDSelector 會自動觸發 onMasterAgentChanged
  if (userStore.level >= 4 && list && list.length > 0) {
    masterAgent.value = list[0].account;
    // 初始化時需要載入標籤列表和資料
    await Promise.all([loadData(true), loadItemTagList()]);
    // 等待表格組件初始化後再觸發一次 reload，確保表格顯示數據
    // 使用 nextTick 確保 DOM 更新完成
    await nextTick();
    dynamicTableInstance?.reload();
  }
};

// 總代理變更處理
/**
 * 對齊 Vue2：onMasterAgentChanged 中調用 getTreasureItemList 和 getItemTagList
 */
const handleMasterAgentChange = async (value: string) => {
  masterAgent.value = value;
  // 清空現有數據和載入標記，強制重新載入
  tableData.value = [];
  loadedMasterAgent.value = '';
  // 載入標籤列表
  await loadItemTagList();
  // 手動觸發一次表格重新載入，loadTableData 會檢查 masterAgent 變更並重新載入數據
  // 對齊 Vue2：DataTable 綁定 :data，數據更新時自動更新
  dynamicTableInstance?.reload();
};

// 載入表格數據
// 對齊 Vue2：DataTable 直接綁定 :data="treasureItemList"，當數據更新時表格自動更新
/**
 * Vue3：DynamicTable 使用 :data-request，需要返回數據
 */
const loadTableData = async (params: LoadDataParams) => {
  console.log('loadTableData 被調用, masterAgent:', masterAgent.value, 'loadedMasterAgent:', loadedMasterAgent.value, 'tableData.length:', tableData.value.length);

  if (!masterAgent.value) {
    console.log('沒有 masterAgent，返回空數據');
    loadedMasterAgent.value = '';
    tableData.value = [];
    return {
      ...params,
      items: [],
      total: 0,
    };
  }

  // 對齊 Vue2 邏輯：當 masterAgent 變更時，總是重新載入數據
  // 如果 masterAgent 變更了，或者數據為空，需要重新載入
  if (loadedMasterAgent.value !== masterAgent.value || tableData.value.length === 0) {
    console.log('masterAgent 變更或數據為空，開始載入數據');
    // 載入數據但不觸發表格重新載入（skipReload = true），避免無限迴圈
    // 因為表格組件會自動處理返回的數據
    await loadData(true);
    loadedMasterAgent.value = masterAgent.value;
    console.log('數據載入完成，tableData.length:', tableData.value.length, 'items:', tableData.value);
  }

  // 返回當前數據
  return {
    ...params,
    items: tableData.value,
    total: tableData.value.length,
  };
};

/**
 * 獲取標籤 ID
 */
const getTagID = (tag: string | null): number | null => {
  if (!tag) {
    return null;
  }
  return itemTagListObj.value[tag] || null;
};

/**
 * 圖片 URL 處理
 */
const imageUrl = (url: string): string => {
  if (!url) {
    return '';
  }
  return `${cdnBaseUrl}${url}`;
};

/**
 * 打開新增/編輯表單彈窗
 */
const openFormModal = (record?: TeamBadgeItem) => {
  if (record) {
    // 編輯模式
    mode.value = 'edit';
    dialogForm.value = {
      treasureItemID: record.treasureItemID,
      itemName: record.itemName,
      tagID: getTagID(record.tag),
    };
    teamIconUrl.value = imageUrl(record.teamIcon);
    iconFileUrl.value = imageUrl(record.iconUrl);
    isChangeTeamIcon.value = false;
    isChangeIconFile.value = false;
  }
  else {
    // 新增模式
    mode.value = 'create';
    dialogForm.value = {
      itemName: '',
      tagID: null,
    };
    teamIconUrl.value = '';
    iconFileUrl.value = '';
    teamIconFile.value = undefined;
    iconFile.value = undefined;
    isChangeTeamIcon.value = false;
    isChangeIconFile.value = false;
  }
  dialogFormVisible.value = true;
};

/**
 * 關閉表單彈窗
 */
const closeFormModal = () => {
  dialogFormVisible.value = false;
  dialogForm.value = {
    itemName: '',
    tagID: null,
  };
  teamIconUrl.value = '';
  iconFileUrl.value = '';
  teamIconFile.value = undefined;
  iconFile.value = undefined;
  isChangeTeamIcon.value = false;
  isChangeIconFile.value = false;
};

/**
 * 處理圖片上傳
 */
const handleBeforeUpload = (file: UploadFile, type: 'teamIcon' | 'iconFile') => {
  const fileObj = file.originFileObj || (file as any).originFile || file;

  if (!fileObj) {
    message.error('無法讀取文件，請重試或選擇其他圖片');
    return false;
  }

  // 驗證文件類型
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!fileObj.type || !validImageTypes.includes(fileObj.type.toLowerCase())) {
    message.error('不支援的圖片格式。請選擇 JPG、PNG、GIF 或 WEBP 格式');
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
      if (type === 'teamIcon') {
        teamIconUrl.value = e.target.result as string;
        teamIconFile.value = fileObj;
        isChangeTeamIcon.value = true;
      }
      else {
        iconFileUrl.value = e.target.result as string;
        iconFile.value = fileObj;
        isChangeIconFile.value = true;
      }
      message.success('圖片預覽已加載');
    }
  };
  reader.onerror = () => {
    message.error('圖片讀取失敗，請重試');
  };
  reader.readAsDataURL(fileObj);

  return false; // 阻止自動上傳
};

/**
 * 處理表單提交
 */
const handleFormSubmit = async () => {
  if (!dialogForm.value.itemName) {
    message.error(t('form.itemNameRequired'));
    return;
  }

  if (mode.value === 'create') {
    if (!teamIconFile.value || !iconFile.value) {
      message.error(t('form.imageRequired'));
      return;
    }
  }

  disabledConfirm.value = true;

  try {
    if (mode.value === 'create') {
      const submitData = {
        masterAgent: masterAgent.value,
        itemName: dialogForm.value.itemName,
        teamName: dialogForm.value.itemName,
        itemType: 'teamBadge',
        teamIcon: teamIconFile.value!,
        iconFile: iconFile.value!,
        tagID: dialogForm.value.tagID || null,
      };

      await addTeamBadge(submitData);
      message.success(t('createSuccess'));
    }
    else {
      const submitData: any = {
        treasureItemID: dialogForm.value.treasureItemID,
        masterAgent: masterAgent.value,
        itemName: dialogForm.value.itemName,
        teamName: dialogForm.value.itemName,
        itemType: 'teamBadge',
        tagID: dialogForm.value.tagID === null || dialogForm.value.tagID === undefined ? null : dialogForm.value.tagID,
      };

      if (isChangeIconFile.value && iconFile.value) {
        submitData.iconFile = iconFile.value;
      }
      if (isChangeTeamIcon.value && teamIconFile.value) {
        submitData.teamIcon = teamIconFile.value;
      }

      await updateTeamBadge(submitData);
      message.success(t('updateSuccess'));
    }

    closeFormModal();
    // 清空現有數據，強制重新載入
    tableData.value = [];
    // 重新載入數據（不觸發 reload，因為下面會手動觸發）
    await loadData(true);
    // 手動觸發表格重新載入
    dynamicTableInstance?.reload();
  }
  catch (error) {
    console.error('保存失敗', error);
    message.error(t('saveFailed'));
  }
  finally {
    setTimeout(() => {
      disabledConfirm.value = false;
    }, 1000);
  }
};

/**
 * 啟用/禁用項目
 */
const handleEnabledChange = async (record: TeamBadgeItem, enabled: boolean) => {
  try {
    if (enabled) {
      await updateTreasureItem({
        treasureItemID: record.treasureItemID,
        masterAgent: masterAgent.value,
        enabled: true,
      });
    }
    else {
      await disableTreasureItem({
        treasureItemID: record.treasureItemID,
        masterAgent: masterAgent.value,
      });
    }
    message.success(t('updateSuccess'));
    // 清空現有數據，強制重新載入
    tableData.value = [];
    // 重新載入數據（不觸發 reload，因為下面會手動觸發）
    await loadData(true);
    // 手動觸發表格重新載入
    dynamicTableInstance?.reload();
  }
  catch (error) {
    console.error('更新失敗', error);
    message.error(t('updateFailed'));
  }
};

/**
 * 打開標籤彈窗
 */
const openTagDialog = async () => {
  isTagDialog.value = true;
  newItemTag.value = '';
};

/**
 * 關閉標籤彈窗
 */
const closeTagDialog = () => {
  isTagDialog.value = false;
  newItemTag.value = '';
};

/**
 * 提交標籤
 */
const handleTagSubmit = async () => {
  if (!newItemTag.value.trim()) {
    message.error(t('form.tagRequired'));
    return;
  }

  try {
    await addItemTag({
      masterAgent: masterAgent.value,
      tag: newItemTag.value,
      itemType: 'teamBadge',
    });
    message.success(t('tagCreateSuccess'));
    await loadItemTagList();
    closeTagDialog();
  }
  catch (error) {
    console.error('創建標籤失敗', error);
    message.error(t('tagCreateFailed'));
  }
};

// 列配置
const columns = computed(() => getColumns(t, cdnBaseUrl));

onMounted(() => {
  fetchMasterAgents();
});
</script>

<template>
  <div>
    <div v-if="userStore.level < 4" class="mb-4">
      <div class="mb-4 flex items-center gap-4">
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
      </div>
    </div>
    <div v-else class="mb-4">
      <a-alert :message="t('noPermission')" type="warning" show-icon />
    </div>

    <DynamicTable
      v-if="userStore.level < 4"
      row-key="treasureItemID"
      :header-title="t('title')"
      :columns="columns"
      :data-request="loadTableData"
      :loading="loading"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'enabled'">
          <Switch
            :checked="!!record.enabled"
            @change="(checked: boolean) => handleEnabledChange(record, checked)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'ACTION'">
          <a-space>
            <a-button type="link" size="small" @click="openFormModal(record)">
              {{ t('edit') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </DynamicTable>

    <!-- 標籤彈窗 -->
    <a-modal
      v-model:open="isTagDialog"
      :title="t('tagDialog.title')"
      @cancel="closeTagDialog"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-form-item :label="t('tagDialog.tag')">
          <a-input v-model:value="newItemTag" :placeholder="t('tagDialog.tagPlaceholder')" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeTagDialog">
          {{ t('cancel') }}
        </a-button>
        <a-button type="primary" @click="handleTagSubmit">
          {{ t('submit') }}
        </a-button>
      </template>
    </a-modal>

    <!-- 表單彈窗 -->
    <a-modal
      v-model:open="dialogFormVisible"
      :title="mode === 'create' ? t('formTitle.create') : t('formTitle.edit')"
      width="700"
      :confirm-loading="disabledConfirm"
      :mask-closable="false"
      @ok="handleFormSubmit"
      @cancel="closeFormModal"
    >
      <a-form
        :model="dialogForm"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item :label="t('form.itemName')" required>
          <a-input
            v-model:value="dialogForm.itemName"
            :placeholder="t('form.itemNamePlaceholder')"
            :disabled="mode === 'view'"
          />
        </a-form-item>

        <a-form-item :label="t('form.tagID')">
          <div class="flex items-center gap-2">
            <a-select
              v-model:value="dialogForm.tagID"
              :options="itemTagListData.map(tag => ({ label: tag.tag, value: tag.id }))"
              :placeholder="t('form.tagIDPlaceholder')"
              allow-clear
              style="width: 310px"
              :disabled="mode === 'view'"
            />
            <a-button type="primary" @click="openTagDialog">
              {{ t('form.createTag') }}
            </a-button>
          </div>
        </a-form-item>

        <a-form-item :label="t('form.teamIcon')" required>
          <div class="uploader-container">
            <Upload
              :before-upload="(file) => handleBeforeUpload(file, 'teamIcon')"
              :show-upload-list="false"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            >
              <a-button :disabled="mode === 'view'">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ t('form.upload') }}
              </a-button>
            </Upload>
            <div v-if="teamIconUrl" class="preview-image">
              <img :src="teamIconUrl" alt="teamIcon" style="width: 240px; height: 240px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;">
              <a-button
                v-if="mode !== 'view'"
                type="text"
                danger
                size="small"
                @click="teamIconUrl = ''; teamIconFile = undefined; isChangeTeamIcon = false;"
              >
                {{ t('form.remove') }}
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item :label="t('form.iconFile')" required>
          <div class="uploader-container">
            <Upload
              :before-upload="(file) => handleBeforeUpload(file, 'iconFile')"
              :show-upload-list="false"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            >
              <a-button :disabled="mode === 'view'">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ t('form.upload') }}
              </a-button>
            </Upload>
            <div v-if="iconFileUrl" class="preview-image">
              <img :src="iconFileUrl" alt="iconFile" style="width: 240px; height: 240px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;">
              <a-button
                v-if="mode !== 'view'"
                type="text"
                danger
                size="small"
                @click="iconFileUrl = ''; iconFile = undefined; isChangeIconFile = false;"
              >
                {{ t('form.remove') }}
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
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

.uploader-container {
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .preview-image {
    position: relative;
    display: inline-block;
    margin-top: 10px;
  }
}
</style>
