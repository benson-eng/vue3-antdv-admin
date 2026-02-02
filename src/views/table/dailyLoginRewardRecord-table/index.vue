<script setup lang="ts">
/**
 * ARCH-MIGRATION-01（v2）：遷移至 Breadcrumb（單頁）
 * - 移除頁面自管站長選擇器，統一改由 Breadcrumb Context 作為唯一來源
 * - 本頁正式成為 Breadcrumb Context Consumer（單頁 Consumer）
 */
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { DailySignInRewardRecordItem } from '@/api/backend/marketingEvent';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, inject, nextTick, ref, watch } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import {
  queryDailySignInActivitySetting,
  queryDailySignInRewardRecord,
} from '@/api/backend/marketingEvent';

import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({ name: 'DailyLoginRewardRecordTable' });

const { t } = useI18n('page.dailyLoginRewardRecord');

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/* =========================
 * Breadcrumb Context Consumer
 * ========================= */
// 從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（從 Breadcrumb Context）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於檢測站長切換）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/* =========================
 * 會員搜尋
 * ========================= */
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLoading = ref(false);

const fetchMember = async (text: string) => {
  if (!text || text.length < 2 || !selectedMasterAgent.value) {
    memberOptions.value = [];
    return;
  }

  memberLoading.value = true;
  try {
    const res = await fuzzyQueryUser({
      masterAgent: selectedMasterAgent.value,
      queryText: text,
      limit: 10,
    });

    memberOptions.value = (res || []).map(item => ({
      raw: item,
      value: `${item.account}@${item.agentID}`,
      label: `${item.accountID} - ${item.nickName}`,
    }));
  }
  finally {
    memberLoading.value = false;
  }
};

// 使用 debounce 延遲搜尋，與其他頁面保持一致
const onMemberSearch = debounce((text: string) => {
  if (text && text.length >= 2) {
    fetchMember(text);
  }
  else {
    memberOptions.value = [];
  }
}, 300);

/* =========================
 * 活動列表
 * ========================= */
const activityOptions = ref<{ label: string; value: number }[]>([]);
const activityLoading = ref(false);

const fetchActivityList = async () => {
  if (!selectedMasterAgent.value) {
    activityOptions.value = [];
    return;
  }

  activityLoading.value = true;
  try {
    const res = await queryDailySignInActivitySetting({
      masterAgent: selectedMasterAgent.value,
      status: 'all',
    });

    activityOptions.value = (res || [])
      .sort((a, b) => new Date(b.endDateTime).getTime() - new Date(a.endDateTime).getTime())
      .map(item => ({
        value: item.activityID,
        label: `${dayjs(item.startDateTime).format('YYYY-MM-DD')} ~ ${dayjs(item.endDateTime).format('YYYY-MM-DD')}`,
      }));
  }
  finally {
    activityLoading.value = false;
  }
};

/* =========================
 * 表格 Columns（唯一來源）
 * ========================= */
interface Row extends DailySignInRewardRecordItem {
  userName?: string;
  vipStr?: string;
  rewardDataStr?: string[];
  typeStr?: string;
}

const columns = computed<TableColumn<Row>[]>(() => [
  /* ===== 搜尋欄位 ===== */
  // 注意：masterAgent 已由 Breadcrumb Context 提供，不再作為搜尋欄位
  {
    title: t('labels.member'),
    dataIndex: '__member_search__',
    hideInTable: true,
    searchField: 'memberID',
    formItemProps: {
      component: 'Select',
      required: true,
      componentProps: () => ({
        showSearch: true,
        filterOption: false,
        options: memberOptions.value,
        loading: memberLoading.value,
        placeholder: '00001314 - 王小明',
        onSearch: onMemberSearch,
        allowClear: true,
        disabled: !selectedMasterAgent.value,
      }),
    },
  },
  {
    title: t('queryFormActivityID'),
    dataIndex: '__activity_search__',
    hideInTable: true,
    searchField: 'activityID',
    formItemProps: {
      component: 'Select',
      required: true,
      componentProps: () => ({
        options: activityOptions.value,
        loading: activityLoading.value,
        placeholder: '請選擇期別',
        allowClear: true,
        disabled: !selectedMasterAgent.value,
      }),
    },
  },

  /* ===== 表格欄位 ===== */
  {
    title: t('typeStr'),
    dataIndex: 'typeStr',
    width: 120,
    hideInSearch: true,
  },
  {
    title: t('userName'),
    dataIndex: 'userName',
    width: 200,
    hideInSearch: true,
  },
  {
    title: 'VIP',
    dataIndex: 'vipStr',
    width: 100,
    hideInSearch: true,
  },
  {
    title: t('rewardDataStr'),
    dataIndex: 'rewardDataStr',
    flexible: true, // 彈性寬度欄位
    minWidth: 300, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ record }) =>
      h('div', record.rewardDataStr?.map((r, i) => h('div', { key: i }, r))),
  },
  {
    title: t('signInDate'),
    dataIndex: 'signInDate',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }) =>
      record.signInDate ? dayjs(record.signInDate).format('YYYY-MM-DD HH:mm:ss') : '',
  },
]);

// 過濾出非搜尋欄位（用於 useTableConfig，排除 hideInTable: true 的搜尋欄位）
const tableColumns = computed(() => {
  return columns.value.filter(col => !col.hideInTable);
});

// 使用表格配置 Hook（提供列設置、欄寬自適應等功能）
const tableConfig = useTableConfig(tableColumns as any);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const finalColumns = computed<TableColumn<Row>[]>(() => {
  return columns.value.map((col) => {
    // 搜尋欄位不參與列設置
    if (col.hideInTable) {
      return col;
    }

    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<Row> = {
      ...col,
      hideInTable: !isVisible,
    };

    // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100; // 預設最小寬度 100px
    }

    // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
    // 這樣可以避免初始 render 時被壓縮為 0
    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

/* =========================
 * DynamicTable
 * ========================= */
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
watch(
  () => {
    // 嘗試從 dynamicTableInstance 獲取實際的 columns 狀態
    const innerProps = (dynamicTableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: any) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const currentKeys = tableConfig.visibleColumnKeys.value;
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true, flush: 'post' },
);

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  return 'hidden';
});

/**
 * =========================
 * Data Request
 * =========================
 */
const loadTableData = async (params: any) => {
  const { memberID, activityID } = params;
  // 站長值從 Breadcrumb Context 獲取（Single Source of Truth）
  const masterAgent = selectedMasterAgent.value;

  if (!memberID || !activityID || !masterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    const res = await queryDailySignInRewardRecord({
      masterAgent,
      memberID,
      activityID,
    });

    const items = (res || []).map((item: any) => ({
      ...item,
      userName: item.userName || '',
      vipStr: item.vipLevel ? `VIP${item.vipLevel}` : '',
      typeStr: item.id ? '登入獎勵' : '簽到獎勵',
      rewardDataStr: item.rewardData?.map((r: any) => r.name).filter(Boolean),
    }));

    return {
      items,
      meta: { totalItems: items.length },
    };
  }
  catch {
    message.error(t('notify.connectionError') || '查詢失敗');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * =========================
 * Context Consumer 行為：處理站長切換
 * =========================
 * 當站長（Breadcrumb Context）切換時：
 * - 清空會員搜尋選項
 * - 重新載入活動列表
 * - 重置搜尋表單
 * - 自動觸發 DynamicTable reload
 */
watch(
  () => contextVersion.value,
  async () => {
    // 清空會員相關狀態
    memberOptions.value = [];

    // 重新載入活動列表
    await fetchActivityList();

    // 重置搜尋表單
    const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }

    // 自動觸發 reload（Vue3 搜尋模型行為）
    await nextTick();
    (dynamicTableInstance as any)?.reload?.();
  },
);

/**
 * =========================
 * SearchMode 狀態顯示
 * =========================
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Breadcrumb Context）
 * - memberID、activityID：搜尋表單欄位，用於後端 API 查詢
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 嘗試獲取搜尋表單的值
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return 'BACKEND';
  }

  try {
    const formValues = searchFormRef.getFieldsValue();
    const hasMemberID = Boolean(formValues?.memberID?.trim());
    const hasActivityID = Boolean(formValues?.activityID);

    // 所有搜尋條件都用於後端 API 查詢
    // 因此無論是否有搜尋條件，都顯示為 BACKEND
    return 'BACKEND';
  }
  catch {
    return 'BACKEND';
  }
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
 * =========================
 * Init
 * =========================
 */
// 使用當前 Breadcrumb Context 的站長值進行初始化
watch(
  () => selectedMasterAgent.value,
  async (newVal) => {
    if (newVal) {
      await fetchActivityList();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="table-container"
    :style="{ overflowX: containerOverflowX }"
  >
    <DynamicTable
      :columns="finalColumns"
      :data-request="loadTableData"
      :scroll="{ x: tableConfig.scrollX.value }"
    >
      <template #headerTitle>
        <div style="display: flex; align-items: center; gap: 8px">
          <span>{{ t('title') || '每日登入獎勵記錄' }}</span>
          <Tag :color="searchModeConfig.color" style="margin: 0">
            SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
          </Tag>
        </div>
      </template>
    </DynamicTable>
  </div>
</template>
