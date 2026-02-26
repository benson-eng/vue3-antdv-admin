<!--
[DEBUG MODE ENABLED]
觀測點清單：
1. watch(selectedMasterAgent) - 監聽 masterAgent 變化，記錄 newVal、stack trace，處理初始載入（immediate: true）
2. watch(contextVersion) - 監聽 Context 變化，記錄 new/old 值、stack trace（僅 debug，不觸發 reload）
3. handleFormSubmit() - 記錄觸發來源
4. loadTableData() - 記錄每次呼叫（params、masterAgent、開始/結束/耗時），節流 trace
5. loadItemTagList() - 記錄每次呼叫（masterAgent、開始/結束/耗時）
6. 重複呼叫檢測 - 10秒內計數，超過5次發出警告
-->

<script setup lang="ts">
import type { TableColumnItem, TeamBadgeItem } from './columns';
import type { ItemTag } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, inject, ref, watch } from 'vue';
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
import ImageUploadField from '@/components/system/ImageUploadField.vue';
import { useI18n } from '@/hooks/useI18n';
import { ImageSpec } from '@/system/image/imageSpec';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { getColumns } from './columns';
import { getSearchSchemas } from './formSchemas';

defineOptions({
  name: 'TeamSetting',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.teamSetting');

// ========== Context Consumer 純化重構 ==========
// 【Context 類型】：100% 純 Context Consumer
// - 完全依賴 Breadcrumb Context，無任何 page-level 邏輯
// - 所有 masterAgent 來源統一為 selectedMasterAgent
// - 單向資料流：Context → watch → reload → loadTableData
// ==================================================

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

// 使用 computed 取得 contextVersion（用於監聽變化）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ========== DEBUG INSTRUMENTATION ==========
let debugSeq = 0;
const debugLogPrefix = '[TeamSetting Debug]';

interface CallRecord {
  trigger: string;
  timestamp: number;
  masterAgent: string;
  contextVersion: number;
}

const callHistory: CallRecord[] = [];
/** 10秒時間窗口 */
const WINDOW_MS = 10000;
const WARNING_THRESHOLD = 5;

/**
 * 時間戳格式化
 */
const getTimestamp = () => {
  const now = new Date();
  return `${now.toISOString().substring(11, 23)}`;
};

/**
 * 統一格式的 debug log
 */
const debugLog = (event: string, data: Record<string, any>) => {
  debugSeq++;
  const masterAgent = selectedMasterAgent.value;
  const ctxVersion = contextVersion.value;
  console.log(
    `${debugLogPrefix} [${debugSeq}] [${getTimestamp()}] ${event}`,
    {
      masterAgent: masterAgent || '(empty)',
      contextVersion: ctxVersion,
      ...data,
    },
  );
};

/**
 * 記錄呼叫歷史（用於重複檢測）
 */
const recordCall = (trigger: string) => {
  const now = Date.now();
  callHistory.push({
    trigger,
    timestamp: now,
    masterAgent: selectedMasterAgent.value || '(empty)',
    contextVersion: contextVersion.value,
  });

  // 清理超過10秒的記錄
  const cutoff = now - WINDOW_MS;
  while (callHistory.length > 0 && callHistory[0].timestamp < cutoff) {
    callHistory.shift();
  }

  // 檢查是否超過閾值
  const recentCalls = callHistory.filter(r => r.timestamp >= cutoff);
  if (recentCalls.length > WARNING_THRESHOLD) {
    console.warn(
      `${debugLogPrefix} [WARNING] 10秒內 ${trigger} 被呼叫 ${recentCalls.length} 次！`,
      {
        recentCalls: recentCalls.slice(-5).map(r => ({
          trigger: r.trigger,
          time: new Date(r.timestamp).toISOString().substring(11, 23),
          masterAgent: r.masterAgent,
          contextVersion: r.contextVersion,
        })),
      },
    );
  }
};

/**
 * loadTableData trace 節流（同一輪只印一次）
 */
let lastLoadTableDataTrace = 0;
const TRACE_THROTTLE_MS = 100;
// ===========================================

const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
  immediate: false,
  formProps: {
    schemas: getSearchSchemas(t),
    showSubmitButton: true,
    showResetButton: true,
    showAdvancedButton: true,
    submitOnReset: false,
  },
  fetchConfig: {
    listField: 'items' as const,
    totalField: 'total' as any,
  },
});

// 表格 loading 狀態
const loading = ref(false);

// 啟用/停用操作的 loading 狀態（防止重複點擊）
const enabledChangingIds = ref<Set<string>>(new Set());

// 標籤列表
const itemTagListData = ref<ItemTag[]>([]);
const itemTagListObj = ref<Record<string, number>>({});

// CDN Base URL
const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';

// 標籤彈窗
const isTagDialog = ref(false);
const newItemTag = ref('');

// Modal 狀態
const newDialogFormVisible = ref(false);
const newDialogForm = ref<{
  treasureItemID?: string;
  itemName: string;
  tagID: number | null;
  teamIcon: File | null;
  iconFile: File | null;
}>({
  itemName: '',
  tagID: null,
  teamIcon: null,
  iconFile: null,
});
const newDialogMode = ref<'create' | 'edit' | 'view'>('create');
const newDialogConfirmLoading = ref(false);
// 編輯模式下追蹤圖片是否被修改
const newDialogIsChangeTeamIcon = ref(false);
const newDialogIsChangeIconFile = ref(false);
// 編輯模式下保存原始圖片 URL（用於顯示預覽）
const newDialogTeamIconUrl = ref<string>('');
const newDialogIconFileUrl = ref<string>('');

/**
 * 載入標籤列表（使用 Context 的 masterAgent）
 */
const loadItemTagList = async () => {
  const startTime = Date.now();
  const masterAgent = selectedMasterAgent.value;
  const ctxVersion = contextVersion.value;

  recordCall('loadItemTagList');
  debugLog('loadItemTagList START', { masterAgent: masterAgent || '(empty)', contextVersion: ctxVersion });

  if (!masterAgent) {
    itemTagListData.value = [];
    itemTagListObj.value = {};
    const duration = Date.now() - startTime;
    debugLog('loadItemTagList END (empty masterAgent)', { duration: `${duration}ms` });
    return;
  }

  try {
    const res: any = await itemTagList({ masterAgent });
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

    const duration = Date.now() - startTime;
    debugLog('loadItemTagList END', { duration: `${duration}ms`, itemCount: filteredData.length });
  }
  catch (error) {
    const duration = Date.now() - startTime;
    console.error('載入標籤列表失敗', error);
    debugLog('loadItemTagList ERROR', { duration: `${duration}ms`, error });
  }
};

/**
 * 處理表單提交（查詢按鈕）
 */
const handleFormSubmit = () => {
  recordCall('handleFormSubmit');
  debugLog('handleFormSubmit', {});
  console.trace(`${debugLogPrefix} handleFormSubmit stack trace`);
  dynamicTableInstance?.reload(true);
};

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

/**
 * 載入表格數據（純函數 Pure Function）
 * - 直接調用 API，處理資料，返回給 DynamicTable
 * - 不修改任何 reactive 狀態（除了必要的 loading 狀態）
 * - 不調用 reload()
 * - 不依賴中介資料來源
 * - 唯一資料來源：selectedMasterAgent.value
 */
const loadTableData = async (_params: LoadDataParams) => {
  const startTime = Date.now();
  const masterAgent = selectedMasterAgent.value;
  const ctxVersion = contextVersion.value;

  recordCall('loadTableData');

  // 節流 trace：同一輪（100ms內）只印一次
  const now = Date.now();
  if (now - lastLoadTableDataTrace > TRACE_THROTTLE_MS) {
    console.trace(`${debugLogPrefix} loadTableData stack trace`);
    lastLoadTableDataTrace = now;
  }

  debugLog('loadTableData START', {
    masterAgent: masterAgent || '(empty)',
    contextVersion: ctxVersion,
    params: JSON.stringify(_params).substring(0, 100),
  });

  if (!masterAgent) {
    const duration = Date.now() - startTime;
    debugLog('loadTableData END (empty masterAgent)', { duration: `${duration}ms`, items: 0, total: 0 });
    return {
      items: [],
      total: 0,
    };
  }

  loading.value = true;

  try {
    const res: any = await treasureItemList({ masterAgent });

    let rows: any[] = [];

    if (Array.isArray(res?.rows)) {
      rows = res.rows;
    }
    else if (Array.isArray(res?.data?.rows)) {
      rows = res.data.rows;
    }
    else if (Array.isArray(res?.data)) {
      rows = res.data;
    }

    const teamBadgeItems: TeamBadgeItem[] = [];

    rows.forEach((row: any) => {
      if (row.type === 'teamBadge' && row.items) {
        row.items.forEach((item: any) => {
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

    const duration = Date.now() - startTime;
    debugLog('loadTableData END', {
      duration: `${duration}ms`,
      items: teamBadgeItems.length,
      total: teamBadgeItems.length,
    });

    return {
      items: teamBadgeItems,
      total: teamBadgeItems.length,
    };
  }
  catch (error) {
    const duration = Date.now() - startTime;
    console.error('載入隊伍徽章列表失敗', error);
    message.error(t('loadFailed'));
    debugLog('loadTableData ERROR', { duration: `${duration}ms`, error });
    return {
      items: [],
      total: 0,
    };
  }
  finally {
    loading.value = false;
  }
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
const openNewFormModal = (record?: TeamBadgeItem) => {
  if (record) {
    newDialogMode.value = 'edit';
    newDialogForm.value = {
      treasureItemID: record.treasureItemID,
      itemName: record.itemName,
      tagID: getTagID(record.tag),
      teamIcon: null,
      iconFile: null,
    };
    // 載入現有圖片 URL（用於顯示預覽）
    newDialogTeamIconUrl.value = imageUrl(record.teamIcon);
    newDialogIconFileUrl.value = imageUrl(record.iconUrl);
    newDialogIsChangeTeamIcon.value = false;
    newDialogIsChangeIconFile.value = false;
  }
  else {
    newDialogMode.value = 'create';
    newDialogForm.value = {
      itemName: '',
      tagID: null,
      teamIcon: null,
      iconFile: null,
    };
    newDialogTeamIconUrl.value = '';
    newDialogIconFileUrl.value = '';
    newDialogIsChangeTeamIcon.value = false;
    newDialogIsChangeIconFile.value = false;
  }
  newDialogFormVisible.value = true;
};

/**
 * 關閉表單彈窗
 */
const closeNewFormModal = () => {
  newDialogFormVisible.value = false;
  newDialogForm.value = {
    itemName: '',
    tagID: null,
    teamIcon: null,
    iconFile: null,
  };
  newDialogTeamIconUrl.value = '';
  newDialogIconFileUrl.value = '';
  newDialogIsChangeTeamIcon.value = false;
  newDialogIsChangeIconFile.value = false;
};

/**
 * 處理表單提交
 */
const handleNewDialogFormSubmit = async () => {
  if (!newDialogForm.value.itemName) {
    message.error(t('form.itemNameRequired'));
    return;
  }

  if (newDialogMode.value === 'create') {
    if (!newDialogForm.value.teamIcon || !newDialogForm.value.iconFile) {
      message.error(t('form.imageRequired'));
      return;
    }
  }

  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('selectMasterAgent') || '請先選擇站長');
    return;
  }

  newDialogConfirmLoading.value = true;

  try {
    if (newDialogMode.value === 'create') {
      const submitData = {
        masterAgent,
        itemName: newDialogForm.value.itemName,
        teamName: newDialogForm.value.itemName,
        itemType: 'teamBadge',
        teamIcon: newDialogForm.value.teamIcon!,
        iconFile: newDialogForm.value.iconFile!,
        tagID: newDialogForm.value.tagID || null,
      };

      await addTeamBadge(submitData);
      message.success(t('createSuccess'));
    }
    else {
      // 編輯模式
      if (!newDialogForm.value.treasureItemID) {
        message.error('缺少必要參數');
        return;
      }

      // 對齊 Vue2 的邏輯：構建 submitData
      const submitData: any = {
        treasureItemID: newDialogForm.value.treasureItemID,
        masterAgent,
        itemName: newDialogForm.value.itemName,
        teamName: newDialogForm.value.itemName,
        itemType: 'teamBadge',
      };

      // 對齊 Vue2：tagID 為 null 時不包含此欄位（會先 delete）
      if (newDialogForm.value.tagID !== null && newDialogForm.value.tagID !== undefined) {
        submitData.tagID = newDialogForm.value.tagID;
      }

      // 只有當圖片被修改時才上傳新圖片
      if (newDialogIsChangeIconFile.value && newDialogForm.value.iconFile) {
        submitData.iconFile = newDialogForm.value.iconFile;
      }
      if (newDialogIsChangeTeamIcon.value && newDialogForm.value.teamIcon) {
        submitData.teamIcon = newDialogForm.value.teamIcon;
      }

      await updateTeamBadge(submitData);
      message.success(t('updateSuccess'));
    }

    closeNewFormModal();
    dynamicTableInstance?.reload();
  }
  catch (error) {
    console.error('保存失敗', error);
    message.error(t('saveFailed'));
  }
  finally {
    newDialogConfirmLoading.value = false;
  }
};

/**
 * 啟用/禁用項目（帶確認對話框、loading 狀態、防連點機制）
 */
const handleToggleEnabled = (record: TeamBadgeItem) => {
  const itemId = record.treasureItemID;

  if (enabledChangingIds.value.has(itemId)) {
    return;
  }

  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('selectMasterAgent') || '請先選擇站長');
    return;
  }

  const isEnabled = Boolean(record.enabled);
  const action = isEnabled ? t('disable') : t('enable');
  const itemName = record.itemName || '';

  Modal.confirm({
    title: t('confirm.toggleEnabled.title', { action, itemName }) || `確認要${action}「${itemName}」嗎？`,
    content: t('confirm.toggleEnabled.content', { action, itemName }) || `確定要${action}此隊伍徽章嗎？`,
    async onOk() {
      enabledChangingIds.value.add(itemId);

      try {
        if (isEnabled) {
          await disableTreasureItem({
            treasureItemID: record.treasureItemID,
            masterAgent,
          });
        }
        else {
          await updateTreasureItem({
            treasureItemID: record.treasureItemID,
            masterAgent,
            enabled: true,
          });
        }
        message.success(t('updateSuccess'));
        dynamicTableInstance?.reload();
      }
      catch (error) {
        console.error('更新失敗', error);
        message.error(t('updateFailed'));
      }
      finally {
        enabledChangingIds.value.delete(itemId);
      }
    },
  });
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

  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('selectMasterAgent') || '請先選擇站長');
    return;
  }

  try {
    await addItemTag({
      masterAgent,
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

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
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
 * 表格 locale 配置（空資料顯示）
 */
const tableLocale = computed(() => ({
  emptyText: '查無資料',
}));

/**
 * 監聽 selectedMasterAgent 變化，自動觸發表格重新載入
 * 對齊 TeamItemTags 的載入模型，確保初次進頁自動載入
 */
watch(
  () => selectedMasterAgent.value,
  async (newVal) => {
    recordCall('watch(selectedMasterAgent)');
    debugLog('watch(selectedMasterAgent) TRIGGERED', {
      newVal: newVal || '(empty)',
      contextVersion: contextVersion.value,
    });
    console.trace(`${debugLogPrefix} watch(selectedMasterAgent) stack trace`);

    if (newVal) {
      // 當 masterAgent 有值時，載入標籤列表並觸發表格重新載入
      debugLog('watch(selectedMasterAgent): calling loadItemTagList', { hasAwait: true });
      await loadItemTagList();
      debugLog('watch(selectedMasterAgent): calling reload', {});
      dynamicTableInstance?.reload(true);
    }
    else {
      // 當 masterAgent 為空時，清空標籤列表並觸發表格重新載入（顯示空資料）
      debugLog('watch(selectedMasterAgent): clearing data and reloading', {});
      itemTagListData.value = [];
      itemTagListObj.value = {};
      dynamicTableInstance?.reload(true);
    }
  },
  { immediate: true }, // 立即執行一次，確保初始載入
);

/**
 * 監聽 contextVersion 變更（僅用於 debug 追蹤）
 * 注意：已移除 reload 和 loadItemTagList 呼叫，避免與 watch(selectedMasterAgent) 雙觸發
 */
watch(
  () => contextVersion.value,
  (newVal, oldVal) => {
    const masterAgent = selectedMasterAgent.value;
    recordCall('watch(contextVersion)');
    debugLog('watch(contextVersion) TRIGGERED (no action, only debug)', {
      newVal,
      oldVal,
      masterAgent: masterAgent || '(empty)',
    });
    console.trace(`${debugLogPrefix} watch(contextVersion) stack trace`);
    // 注意：已移除 loadItemTagList() 和 reload() 呼叫，避免雙觸發
    // selectedMasterAgent 的變化會自動觸發 watch(selectedMasterAgent)
  },
);
</script>

<template>
  <div>
    <!-- Context Consumer 純化：移除所有 page-level 站長選擇器 -->
    <!-- 權限控制應交由 Breadcrumb 或路由層處理 -->
    <DynamicTable
      v-show="true"
      row-key="treasureItemID"
      :columns="columns"
      :data-request="loadTableData"
      :loading="loading"
      :pagination="false"
      :scroll="tableScroll"
      :auto-height="true"
      :locale="tableLocale"
      @search="handleFormSubmit"
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
          <a-button
            type="primary"
            @click="openNewFormModal()"
          >
            {{ t('add') }}
          </a-button>
        </a-space>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'ACTION'">
          <a-space>
            <a-button
              type="link"
              size="small"
              :danger="!!record.enabled"
              :loading="enabledChangingIds.has(record.treasureItemID)"
              :disabled="enabledChangingIds.has(record.treasureItemID)"
              @click="handleToggleEnabled(record)"
            >
              {{ record.enabled ? t('disable') : t('enable') }}
            </a-button>
            <a-button
              type="link"
              size="small"
              :disabled="enabledChangingIds.has(record.treasureItemID)"
              @click="openNewFormModal(record)"
            >
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
      v-model:open="newDialogFormVisible"
      :title="newDialogMode === 'create' ? t('formTitle.create') : t('formTitle.edit')"
      width="550"
      :confirm-loading="newDialogConfirmLoading"
      :mask-closable="false"
      :centered="true"
      @ok="handleNewDialogFormSubmit"
      @cancel="closeNewFormModal"
    >
      <a-form
        :model="newDialogForm"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item :label="t('form.itemName')" required>
          <a-input
            v-model:value="newDialogForm.itemName"
            :placeholder="t('form.itemNamePlaceholder')"
            :disabled="newDialogMode === 'view'"
          />
        </a-form-item>

        <a-form-item :label="t('form.tagID')">
          <div class="flex items-center gap-2">
            <a-select
              :value="newDialogForm.tagID !== null ? newDialogForm.tagID : undefined"
              :options="itemTagListData.filter(Boolean).map(tag => ({ label: tag.tag || '', value: tag.id })).filter((opt): opt is { label: string; value: number } => opt.value != null)"
              :placeholder="t('form.tagIDPlaceholder')"
              allow-clear
              style="width: 310px"
              :disabled="newDialogMode === 'view'"
              @change="(val: number | undefined) => { newDialogForm.tagID = val ?? null; }"
            />
            <a-button type="primary" @click="openTagDialog">
              {{ t('form.createTag') }}
            </a-button>
          </div>
        </a-form-item>

        <a-form-item :label="t('form.teamIcon')" :required="newDialogMode === 'create'">
          <div v-if="newDialogMode === 'edit' && newDialogTeamIconUrl && !newDialogIsChangeTeamIcon" class="edit-image-preview">
            <img :src="newDialogTeamIconUrl" alt="teamIcon" class="preview-image">
            <a-button type="link" size="small" @click="newDialogIsChangeTeamIcon = true">
              更換圖片
            </a-button>
          </div>
          <ImageUploadField
            v-if="newDialogMode === 'create' || newDialogIsChangeTeamIcon"
            v-model="newDialogForm.teamIcon"
            :spec="ImageSpec.TEAM_BADGE"
            @update:model-value="(val) => { newDialogForm.teamIcon = val; if (val) newDialogIsChangeTeamIcon = true; }"
          />
        </a-form-item>

        <a-form-item :label="t('form.iconFile')" :required="newDialogMode === 'create'">
          <div v-if="newDialogMode === 'edit' && newDialogIconFileUrl && !newDialogIsChangeIconFile" class="edit-image-preview">
            <img :src="newDialogIconFileUrl" alt="iconFile" class="preview-image">
            <a-button type="link" size="small" @click="newDialogIsChangeIconFile = true">
              更換圖片
            </a-button>
          </div>
          <ImageUploadField
            v-if="newDialogMode === 'create' || newDialogIsChangeIconFile"
            v-model="newDialogForm.iconFile"
            :spec="ImageSpec.TEAM_BADGE"
            @update:model-value="(val) => { newDialogForm.iconFile = val; if (val) newDialogIsChangeIconFile = true; }"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
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
