<script setup lang="tsx">
import type { TableColumnItem, TableListItem } from './columns';
import type { AccountBaseInfoItem, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { GetValidFrozenStatementsParams } from '@/api/backend/transactionSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';

import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import {
  getValidFrozenStatements,
  removeValidFrozenStatement,
} from '@/api/backend/transactionSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { getBaseColumnsWithAction } from './columns';
import { useTableConfig } from './useTableConfig';

defineOptions({ name: 'ValidFrozenStatementsRecordTable' });

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.validFrozenStatementsRecord');
const commonT = useI18n('common').t;
// 用於獲取路由標題
const routeI18n = useI18n('routes.table');

/* ================= Context ================= */
const masterAgentCtx = inject<any>(MASTER_AGENT_SELECT_KEY);
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/**
 * ================= Utils =================
 */
const formatCurrency = (v: number | string) =>
  Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/* ================= Agent ================= */
const currentAgentID = ref('');
const agentList = ref<{ label: string; value: string }[]>([]);

/* ================= Member Search (UI only) ================= */
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const fetchMemberOptions = async (queryText: string, append = false) => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent || !currentAgentID.value || queryText.length < 2) {
    memberOptions.value = [];
    return;
  }

  memberLoading.value = true;
  try {
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: currentAgentID.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });

    const list = res || [];
    memberOptions.value = append
      ? [
          ...memberOptions.value,
          ...list.map(i => ({
            raw: i,
            value: `${i.account}@${i.agentID}`,
            label: `${i.accountID} - ${i.nickName}`,
          })),
        ]
      : list.map(i => ({
          raw: i,
          value: `${i.account}@${i.agentID}`,
          label: `${i.accountID} - ${i.nickName}`,
        }));

    memberLastAccountID.value = list.at(-1)?.accountID || '';
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => {
  memberLastQueryText.value = text;
  text.length >= 2 ? fetchMemberOptions(text) : (memberOptions.value = []);
}, 300);

const onMemberPopupScroll = (e: Event) => {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.offsetHeight === el.scrollHeight) {
    fetchMemberOptions(memberLastQueryText.value, true);
  }
};

/* ================= Table ================= */
const [DynamicTable, tableInstance] = useTable({ search: true });

/**
 * ================= Action Handlers =================
 */
const handleRemove = async (record: TableListItem) => {
  await removeValidFrozenStatement({
    memberID: record.memberID,
    statementID: record.id,
  });
  message.success(t('notify.removeStatementSuccess'));
  setTimeout(() => tableInstance?.reload?.(true), 1000);
};

/**
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料
 */
const handleFormSubmit = () => {
  tableInstance?.reload(true);
};

/* ================= Columns ================= */
// 定義所有欄位（包含操作欄）
const baseColumnsWithAction = computed<TableColumnItem[]>(() =>
  getBaseColumnsWithAction(
    t,
    commonT,
    () => memberOptions.value,
    () => memberLoading.value,
    () => currentAgentID.value,
    onMemberSearch,
    onMemberPopupScroll,
    handleRemove,
  ),
);

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumnsWithAction);

// 初始化標記：用於防止初始化階段的錯誤同步
const isInitialized = ref(false);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  const baseColumns = baseColumnsWithAction.value;
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），不套用 hideInTable
  // 維持全部顯示（除了原本就 hideInTable: true 的欄位）
  const shouldApplyVisibility = isInitialized.value && visibleKeys.length > 0;

  return baseColumns.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 如果欄位原本就設定 hideInTable: true（如搜尋欄位），保持隱藏
    if (col.hideInTable === true) {
      return col;
    }

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumnItem = {
      ...col,
      // 僅在 visibleColumnKeys 已初始化且有效時才套用 hideInTable
      hideInTable: shouldApplyVisibility ? !visibleKeys.includes(key) : false,
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

// 初始化 visibleColumnKeys：只包含應該顯示的欄位（排除 hideInTable: true 的欄位）
watch(
  () => baseColumnsWithAction.value,
  (newColumns) => {
    if (!newColumns || newColumns.length === 0) {
      return;
    }

    // 提取所有應該顯示的欄位 keys（排除 hideInTable: true 的欄位）
    const defaultVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumnItem) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      // 只包含不在表格中隱藏的欄位（hideInTable !== true）
      if (key && col.hideInTable !== true) {
        defaultVisibleKeys.push(key);
      }
    });

    // 初始化 visibleColumnKeys（僅在未初始化時執行）
    if (!isInitialized.value && defaultVisibleKeys.length > 0) {
      const currentKeys = tableConfig.visibleColumnKeys.value;
      // 如果當前 visibleColumnKeys 為空或與預設不一致，進行初始化
      if (currentKeys.length === 0 || currentKeys.length !== defaultVisibleKeys.length) {
        tableConfig.updateVisibleColumns(defaultVisibleKeys);
      }
      isInitialized.value = true;
    }
  },
  { immediate: true },
);

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
// 但僅在初始化完成後才進行同步，避免初始化階段的反向覆寫
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    // Guard: 僅在初始化完成後才進行同步
    if (!isInitialized.value || !newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumnItem) => {
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

/* ================= Vertical Scroll / Fixed Header ================= */
// CASE B：有搜尋區頁面
// - DynamicTable 必須一開始 render（確保搜尋區存在）✅
// - scroll.y 初始為 undefined
// - 於 mounted + nextTick 後「再補上 scroll.y」
const scrollY = ref<number | undefined>(undefined);

// 計算 scroll 配置（動態提供 scroll.y）
const scrollConfig = computed(() => {
  const scrollX = tableConfig.scrollX.value;
  return {
    x: scrollX,
    y: scrollY.value,
  };
});

// 在 mounted + nextTick 後設定 scroll.y，啟用 fixed header
onMounted(() => {
  nextTick(() => {
    // 設定一個合理的 scroll.y 值，啟用 vertical scroll 和 fixed header
    // 使用 window.innerHeight 減去估算的 header、搜尋區、padding 等高度
    // 約 400px 作為預設值，實際高度會由表格自動計算
    scrollY.value = 400;
  });
});

/* ================= Data ================= */
interface TableListResponse {
  items: TableListItem[];
  meta: { totalItems: number };
}

const loadTableData = async (params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  const memberID = params.memberID;
  if (!memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const res = await getValidFrozenStatements({ memberID } as GetValidFrozenStatementsParams);
  const list = Array.isArray(res) ? res : res?.data || [];

  const accounts = [...new Set(list.map(i => i.memberID.split('@')[0]))];
  const baseInfoRes = await queryAccountBaseInfo({
    masterAgent: selectedMasterAgent.value,
    accounts,
  });
  const baseInfos = Array.isArray(baseInfoRes) ? baseInfoRes : baseInfoRes?.data || [];

  const map = new Map<string, AccountBaseInfoItem>();
  baseInfos.forEach(i => map.set(`${i.account}@${i.agentID}`, i));

  return {
    items: list.map(i => ({
      ...i,
      accountID: map.get(i.memberID)?.id || '',
      nickName: map.get(i.memberID)?.nickName || '',
      formattedFrozenBalance: formatCurrency(i.frozenBalance),
      formattedTargetAccumulatedBet: formatCurrency(i.targetAccumulatedBet),
    })),
    meta: { totalItems: list.length },
  };
};

/* ================= Watch ================= */
watch(contextVersion, () => {
  memberOptions.value = [];
  tableInstance?.reload?.(true);
});

watch(
  () => selectedMasterAgent.value,
  async (val) => {
    if (!val) {
      currentAgentID.value = '';
      agentList.value = [];
      return;
    }
    const agents = await getAgentListByMasterAgent({ masterAgent: val });
    agentList.value = (agents || []).map(a => ({
      label: a.account,
      value: a.account,
    }));

    const first = agentList.value[0];
    currentAgentID.value = first
      ? `${first.value.includes('.') ? first.value.split('.')[0] : first.value}.${val}`
      : val;
  },
  { immediate: true },
);

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - memberID：搜尋表單欄位，會傳遞到後端 API（getValidFrozenStatements）
 * - 搜尋條件在 loadTableData 中直接傳遞到 API
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 嘗試獲取搜尋表單的值
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return 'BACKEND';
  }

  try {
    // 搜尋條件（memberID）會傳遞到後端 API
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
</script>

<template>
  <div class="valid-frozen-statements-record-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="scrollConfig"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
        }"
        @search="handleFormSubmit"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ routeI18n.t('validFrozenStatementsRecord') }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>

<style scoped lang="less">
.valid-frozen-statements-record-page {
  width: 100%;
}

.table-container {
  width: 100%;
}
</style>
