<script setup lang="ts">
import type { StationMasterItem } from '@/api/backend/agentHubManager';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { getRemoteConfig } from '@/api/backend/adminSystem/slotgameServer';
import {
  createShortUrl,
  enableAgent,
  queryAgent,
  queryShortUrls,
  queryStationMaster,
  toggleShortUrlStatus,
} from '@/api/backend/agentHubManager';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';

defineOptions({
  name: 'DistAcctFamilyList',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.distAcctFamilySetting');
const userStore = useUserStore();

const permissionsLevel = 4;

// ============ Breadcrumb 站長來源 ============
// 從 Breadcrumb 注入取得站長選單狀態
const masterAgentCtx = inject<{
  selectedMasterAgent: { value: string | undefined };
} | undefined>(MASTER_AGENT_SELECT_KEY);

// masterAgent 由 Breadcrumb 注入
const masterAgent = ref('');

// 同步 Breadcrumb 的 selectedMasterAgent 到 masterAgent
watch(
  () => masterAgentCtx?.selectedMasterAgent.value,
  (newValue) => {
    masterAgent.value = newValue || '';
  },
  { immediate: true },
);

// ============ 表格資料 ============
interface FamilyRowData extends StationMasterItem {
  pk?: string;
  enabled?: boolean;
  unions?: any[];
  commissionSettings?: any[];
  id?: number;
}

const dataTableLoading = ref(false);

// ============ 短網址 ============
const isShortURLDialog = ref(false);
const isDialogForm7 = ref(false);
const shortURLDialogTitle = ref('');
const shortURLAgent = ref('');
const ShortURLList = ref<any[]>([]);
const shortURLForm = ref({
  id: -1,
  urlId: -1,
  shortUrl: '',
  shortURLtitle: '',
  enabled: false,
  enabledBtnType: '',
  clickCount: '',
});
const ShortUrlBtn = ref(false);
const liffID = ref('');

// 使用 ref 存儲 dynamicTableInstance，避免定義順序問題
const dynamicTableInstanceRef = ref<any>(null);

/**
 * 載入族長清單（處理 liffID，不處理 table 資料）
 * table 資料由 loadTableData 直接處理
 */
const getFamilyList = async (masterAgentValue: string) => {
  liffID.value = '';

  if (!masterAgentValue) {
    return;
  }

  try {
    const res = await getRemoteConfig({ masterAgent: masterAgentValue });
    if (res && res.lingLoginConfig) {
      liffID.value = res.lingLoginConfig.liffID || '';
    }
  }
  catch (error) {
    console.error('Failed to get remote config:', error);
  }
};

/**
 * ============ 表格操作 ============
 */

const enableSwitch = async (data: FamilyRowData) => {
  try {
    dataTableLoading.value = true;
    const postData = {
      stationMasterName: masterAgent.value,
      name: data.name || '',
      enable: !data.enabled,
    };
    await enableAgent(postData);
    message.success('更新成功');
    // 觸發 table 重新載入資料
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
  catch (error) {
    console.error('Failed to enable/disable agent:', error);
    message.error('更新失敗');
  }
  finally {
    dataTableLoading.value = false;
  }
};

/**
 * ============ 短網址操作 ============
 */
/**
 * getShortUrlList 必須在 openDialogShortURL 之前定義，因為被 openDialogShortURL 調用
 */
const getShortUrlList = async (agentId: number) => {
  ShortURLList.value = [];
  shortURLForm.value = {
    id: agentId,
    urlId: -1,
    shortUrl: '',
    shortURLtitle: '',
    enabled: false,
    enabledBtnType: '',
    clickCount: '',
  };

  try {
    const postData = {
      agentId,
      includeDisabled: true,
    };
    const res = await queryShortUrls(postData);
    if (res && res.result && res.value) {
      ShortURLList.value = res.value;
      const listCopy = [...ShortURLList.value];
      listCopy.sort((a, b) => b.id - a.id);
      if (listCopy.length > 0) {
        const maxIdItem = listCopy[0];
        shortURLForm.value.urlId = maxIdItem.id;
        shortURLForm.value.shortUrl = maxIdItem.shortUrl;
        shortURLForm.value.enabled = maxIdItem.enabled;
        shortURLForm.value.shortURLtitle = maxIdItem.title;
        shortURLForm.value.enabledBtnType = maxIdItem.enabled ? 'danger' : 'success';
        shortURLForm.value.clickCount = maxIdItem.clickCount?.toString() || '0';
      }
    }
  }
  catch (error) {
    console.error('Failed to get short URL list:', error);
  }
};

const openDialogShortURL = async (row: FamilyRowData) => {
  isDialogForm7.value = true;
  shortURLDialogTitle.value = `${row.name} ${t('label.shortURLTitle')}`;
  shortURLAgent.value = row.name || '';
  await getShortUrlList(row.id || 0);
  isDialogForm7.value = false;
  isShortURLDialog.value = true;
};

const closeDialogShortURL = () => {
  isShortURLDialog.value = false;
};

const newShortUrl = async () => {
  ShortUrlBtn.value = true;
  try {
    const postData = {
      agentId: shortURLForm.value.id,
      title: `${shortURLAgent.value}短連結`,
      targetUrl: `https://liff.line.me/${liffID.value}?joinAgentID=${shortURLForm.value.id}`,
      disableOthers: true,
    };
    await createShortUrl(postData);
    message.success('建立成功');
    await getShortUrlList(shortURLForm.value.id);
  }
  catch (error) {
    console.error('建立短網址失敗', error);
    message.error('建立失敗');
  }
  finally {
    ShortUrlBtn.value = false;
  }
};

const copyShortURL = async () => {
  const text = shortURLForm.value.shortUrl;
  if (!text) {
    message.warning('沒有可複製的短網址');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    message.success('已複製到剪貼簿');
  }
  catch (err) {
    console.warn('Async clipboard failed, fallback to execCommand', err);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      message.success('已複製到剪貼簿');
    }
    catch (error) {
      message.error('複製失敗，請手動複製');
    }
    finally {
      document.body.removeChild(textarea);
    }
  }
};

const changeUrlState = async () => {
  ShortUrlBtn.value = true;
  try {
    const postData = {
      id: shortURLForm.value.urlId,
      enabled: !shortURLForm.value.enabled,
    };
    await toggleShortUrlStatus(postData);
    message.success('更新成功');
    await getShortUrlList(shortURLForm.value.id);
  }
  catch (error) {
    console.error('切換短網址狀態失敗：', error);
    message.error('更新失敗');
  }
  finally {
    ShortUrlBtn.value = false;
  }
};

// ============ 表格配置 ============
const columns = computed<TableColumn<FamilyRowData>[]>(() => {
  const cols: TableColumn<FamilyRowData>[] = [];

  // 基本欄位：族長名稱
  cols.push({
    title: t('label.family'),
    dataIndex: 'name',
    width: 200,
    align: 'left',
  });

  // 操作欄位：直接添加到 columns 中，避免重複操作列
  cols.push({
    title: '操作',
    dataIndex: 'ACTION',
    width: 300,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => {
      const actions: any[] = [];

      actions.push({
        label: record.enabled ? t('enable.disable') : t('enable.enable'),
        type: 'link',
        disabled: (record.unions && record.unions.length > 0) || false,
        onClick: () => enableSwitch(record as FamilyRowData),
      });

      actions.push({
        label: t('label.shortURL'),
        type: 'link',
        onClick: () => openDialogShortURL(record as FamilyRowData),
      });

      return actions;
    },
  });

  return cols;
});

const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
  showActionColumn: false, // 明確禁用默認操作列，因為我們在 columns 中已經添加了操作欄位
});

// 將 dynamicTableInstance 存儲到 ref 中
dynamicTableInstanceRef.value = dynamicTableInstance;

// ============ Scroll 配置（動態計算 scroll.y）============
// 類型 A（無搜尋區頁面）：依據 table container 的實際位置計算 scroll.y
const tableScrollY = ref(400);

/**
 * 更新表格高度：依據 table container 的實際位置計算
 */
function updateTableHeight() {
  if (typeof window === 'undefined') {
    return;
  }

  const tableTop = document
    .querySelector('.app-container')
    ?.getBoundingClientRect()
    .top || 0;

  tableScrollY.value = window.innerHeight - tableTop - 120;
}

/**
 * loadTableData 直接負責呼叫 queryAgent
 * 並回傳 { items: agents, meta: { totalItems: agents.length } }
 */
const loadTableData = async () => {
  console.log('=== loadTableData 開始 ===');
  console.log('userStore.level:', userStore.level);
  console.log('masterAgent.value:', masterAgent.value);

  // 如果沒有 masterAgent，返回空資料
  if (!masterAgent.value) {
    console.log('⚠️ masterAgent 為空，返回空資料');
    dataTableLoading.value = false;
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }

  // 更新 liffID
  await getFamilyList(masterAgent.value);

  dataTableLoading.value = true;

  try {
    const agents: FamilyRowData[] = [];

    // 根據 userStore.level 決定查詢方式
    if (userStore.level <= 3) {
      // level <= 3: 使用 queryStationMaster 查詢該站長下的所有族長
      const postData = { name: masterAgent.value };
      console.log('📤 呼叫 queryStationMaster, postData:', postData);
      const response = await queryStationMaster(postData) as any;
      console.log('📥 queryStationMaster 回應 (完整):', response);

      // 檢查是否有錯誤
      if (!response || response.error) {
        if (response && response.error) {
          console.error('❌ queryStationMaster error:', response.error);
        }
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 提取 agents 資料（queryStationMaster 返回 { value: { agents: [...] } }）
      const rawAgents = response.value?.agents || response.data?.value?.agents || [];
      console.log('📋 提取的 rawAgents:', rawAgents);

      // 處理 agents 資料
      if (rawAgents && Array.isArray(rawAgents)) {
        console.log('✅ 開始處理 agents 資料，共', rawAgents.length, '筆');
        rawAgents.forEach((item: any) => {
          const one: FamilyRowData = { ...item };
          // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
          one.pk = item.name || `family-${item.id || Math.random()}`;
          agents.push(one);
        });
      }
    }
    else {
      // level > 3: 查詢單一族長
      const family = userStore.account || '';
      if (!family) {
        console.log('⚠️ family 為空，返回空資料');
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      const postData = {
        stationMasterName: masterAgent.value,
        name: family,
      };
      console.log('📤 呼叫 queryAgent (查詢單一族長), postData:', postData);
      const response = await queryAgent(postData) as any;
      console.log('📥 queryAgent 回應 (完整):', response);

      // 檢查是否有錯誤
      if (!response || response.error) {
        if (response && response.error) {
          console.error('❌ queryAgent error:', response.error);
        }
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 提取 agent 資料
      const agentData = response.data?.value || response.value;
      console.log('📋 提取的 agentData:', agentData);

      // 處理 agent 資料
      if (agentData) {
        console.log('✅ 開始處理 agent 資料');
        const one: FamilyRowData = { ...agentData };
        // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
        one.pk = agentData.name || `family-${agentData.id || Math.random()}`;
        agents.push(one);
      }
    }

    console.log('📊 處理完成，agents 總數:', agents.length);

    dataTableLoading.value = false;

    const result = {
      items: agents,
      meta: { totalItems: agents.length },
    };
    console.log('📤 返回結果:', result);
    console.log('=== loadTableData 結束 ===');
    return result;
  }
  catch (error) {
    console.error('❌ Failed to load table data:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    dataTableLoading.value = false;
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }
};

// ============ 監聽 Breadcrumb 站長切換 ============
watch(masterAgent, async (newValue) => {
  // 當 masterAgent 有值時，觸發表格載入
  if (newValue) {
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
});

// ============ 初始化 ============
// 確保頁面載入時，如果 masterAgent 已經有值，自動載入資料
onMounted(async () => {
  // 初始化表格高度
  await nextTick();
  updateTableHeight();

  // 監聽視窗大小變化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateTableHeight);
  }

  await nextTick();
  // 如果 masterAgent 已經有值，觸發表格載入
  if (masterAgent.value && dynamicTableInstanceRef.value) {
    await dynamicTableInstanceRef.value.reload?.();
  }
});

// 清理視窗監聽器
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateTableHeight);
  }
});

/**
 * ============ SearchMode 狀態顯示 ============
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 本頁為 search: false（無搜尋區），所有查詢皆為後端 API
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
</script>

<template>
  <div class="app-container">
    <div v-if="userStore.level <= permissionsLevel" class="app-container">
      <!-- 表格 -->
      <DynamicTable
        row-key="pk"
        :columns="columns"
        :data-request="loadTableData"
        :loading="dataTableLoading"
        :show-action-column="false"
        :scroll="{ x: 'max-content', y: tableScrollY }"
        :immediate="false"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('label.family') }}列表</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>

      <!-- 短網址對話框 -->
      <a-modal
        v-model:open="isShortURLDialog"
        :title="shortURLDialogTitle"
        :width="560"
        @cancel="closeDialogShortURL"
      >
        <a-form
          :model="shortURLForm"
          :label-col="{ span: 8 }"
          :wrapper-col="{ span: 16 }"
        >
          <a-form-item :label="t('label.shortURL')">
            <span>{{ shortURLForm.shortUrl }}</span>
          </a-form-item>
          <a-form-item :label="t('label.clickCount')">
            <span>{{ shortURLForm.clickCount }}</span>
          </a-form-item>
        </a-form>
        <template #footer>
          <div class="dialog-footer">
            <a-button
              :disabled="!shortURLForm.shortUrl || ShortUrlBtn"
              :loading="ShortUrlBtn"
              @click="copyShortURL"
            >
              {{ t('copy') }}{{ t('label.shortURL') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn"
              @click="newShortUrl"
            >
              {{ t('label.addShortURL') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn || !shortURLForm.enabledBtnType"
              :type="shortURLForm.enabledBtnType"
              @click="changeUrlState"
            >
              {{ shortURLForm.enabled ? t('enable.enable') : t('enable.disable') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn"
              @click="closeDialogShortURL"
            >
              {{ t('cancel') }}
            </a-button>
          </div>
        </template>
      </a-modal>

      <!-- 載入中對話框 -->
      <a-modal
        v-model:open="isDialogForm7"
        title="設定讀取中"
        :width="200"
        :footer="null"
        :closable="false"
        :mask-closable="false"
      >
        Loading ...
      </a-modal>
    </div>
    <div v-else>
      <a-result status="403" title="403" sub-title="您沒有權限訪問此頁面" />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  overflow: hidden;
  min-height: 0; /* 讓 table scroll.y 成為唯一 Y 軸 */
}

.dialog-footer {
  display: flex !important;
  justify-content: center !important;
  padding: 10px 0;
}
</style>
