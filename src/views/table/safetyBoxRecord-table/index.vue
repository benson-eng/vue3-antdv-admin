<script setup lang="ts">
import type { SafetyBoxRow } from './columns';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { GetSafetyBoxOrderParams } from '@/api/backend/transactionSystem';

import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';
import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getSafetyBoxOrder } from '@/api/backend/transactionSystem';
import { useTable } from '@/components/core/dynamic-table';

import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { getColumns } from './columns';

defineOptions({
  name: 'SafetyBoxRecordTable',
});

const { t } = useI18n('page.safetyBoxRecordTable');

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const [DynamicTable, tableInstance] = useTable({
  search: true,
});

// 從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（來自 Breadcrumb）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於監聽站長切換）
// 本頁僅作為 Context Consumer，不建立、不修改 Context，僅讀取站長變動通知
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/**
 * ============ 工具函數 ============
 */
// 注意：此頁面沒有代理商選擇器，只使用 masterAgent
// 因此 currentAgentID 實際上就是 masterAgent
const currentAgentID = computed(() => {
  return selectedMasterAgent.value || '';
});

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
// Submit-driven validation：只有在按下查詢 Submit 時才觸發驗證
const hasSubmitted = ref(false);

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!currentAgentID.value) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    // 此頁面沒有代理商選擇器，只使用 masterAgent
    // agentID 參數不傳（傳 undefined），讓 API 查詢該 masterAgent 下的所有會員
    const res = await fuzzyQueryUser({
      masterAgent: currentAgentID.value,
      // agentID 不傳，查詢該 masterAgent 下的所有會員
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });

    const list = res || [];
    const mapped = list.map(item => ({
      raw: item,
      value: `${item.account}@${item.agentID}`,
      label: `${item.accountID} - ${item.nickName}`,
    }));

    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => {
  if (text && text.length >= 2) {
    fetchMemberOptions(text, false);
  }
  else {
    memberOptions.value = [];
  }
}, 300);

const onMemberSelectChanged = (_value: string) => {
  // 會員選擇變化，不做任何自動觸發（受控型）
};

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2) {
      fetchMemberOptions(memberLastQueryText.value, true);
    }
  }
};

// 定義所有欄位（包含搜尋欄位）
const baseColumns = computed(() => getColumns(
  t,
  () => memberOptions.value,
  () => memberLoading.value,
  onMemberSearch,
  onMemberPopupScroll,
  onMemberSelectChanged,
  () => currentAgentID.value,
  () => hasSubmitted.value,
));

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumns as any);

// 初始化標記：用於防止初始化階段的錯誤同步
const isInitialized = ref(false);

/**
 * 提取所有應該顯示的欄位 keys（排除 hideInTable: true 的搜尋欄位）
 * 這些是 STEP 3 定型後應該預設顯示的欄位
 */
function getDefaultVisibleKeys(columns: TableColumn<SafetyBoxRow>[]): string[] {
  const defaultVisibleKeys: string[] = [];
  columns.forEach((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    // 只包含不在表格中隱藏的欄位（hideInTable !== true）
    // 確保 key 不為空且有效（過濾掉空字串和無效值）
    if (key && key.trim() && col.hideInTable !== true) {
      defaultVisibleKeys.push(key);
    }
  });
  return defaultVisibleKeys;
}

// 初始化 visibleColumnKeys：只包含應該顯示的欄位（排除 hideInTable: true 的欄位）
// 使用 watch 確保在 baseColumns 準備好後立即初始化
watch(
  () => baseColumns.value,
  (newColumns) => {
    if (!newColumns || newColumns.length === 0) {
      return;
    }

    // 僅在未初始化時執行初始化
    if (!isInitialized.value) {
      const defaultVisibleKeys = getDefaultVisibleKeys(newColumns);

      // 確保有有效的預設欄位才進行初始化
      if (defaultVisibleKeys.length > 0) {
        const currentKeys = tableConfig.visibleColumnKeys.value;
        // 如果當前 visibleColumnKeys 為空或包含搜尋欄位，進行初始化
        // 檢查是否包含搜尋欄位（以 __ 開頭且以 _search__ 結尾）
        const hasSearchFields = currentKeys.some(key => key.startsWith('__') && key.endsWith('_search__'));
        if (currentKeys.length === 0 || hasSearchFields || currentKeys.length !== defaultVisibleKeys.length) {
          tableConfig.updateVisibleColumns(defaultVisibleKeys);
        }
        isInitialized.value = true;
      }
    }
  },
  { immediate: true },
);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 參考 agent/index.vue 的實現，但保持搜尋欄位隱藏
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<SafetyBoxRow>[]>(() => {
  const baseColumnsList = baseColumns.value;
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  return baseColumnsList.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 如果欄位原本就設定 hideInTable: true（如搜尋欄位），保持隱藏
    if (col.hideInTable === true) {
      return col;
    }

    // 根據 visibleColumnKeys 設置 hideInTable
    // Guard: 如果 visibleColumnKeys 尚未初始化完成，維持全部顯示
    const isVisible = isInitialized.value ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<SafetyBoxRow> = {
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
    // 只包含非搜尋欄位（排除 hideInTable: true 的欄位）
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumn<SafetyBoxRow>) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      // 只包含未隱藏的欄位（hideInTable !== true）
      // 搜尋欄位在 baseColumns 中已設置 hideInTable: true，會被自動排除
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

/**
 * 重置本頁所有查詢條件狀態和表格資料（受控型 Consumer 行為）
 * 當站長切換時，清空狀態但不觸發 API 請求
 */
const resetPageState = async () => {
  // 重置提交狀態
  hasSubmitted.value = false;
  // 重置搜尋表單狀態
  await nextTick();
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
    searchFormRef.clearValidate();
  }

  // 注意：不調用 reload，因為這是受控型 Consumer，不應自動觸發查詢
  // 表格資料會因為 loadTableData 中的 guard（必填條件不足）自動返回空資料
};

/**
 * 監聽站長切換（受控型 Consumer 行為）
 * 當檢測到站長變化時（通過 contextVersion），重置頁面狀態但不觸發 API 請求
 */
watch(
  () => contextVersion.value,
  async () => {
    // 重置頁面狀態（清空查詢條件和表格資料，但不觸發 API）
    await resetPageState();
  },
);

const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
  // Submit-driven validation：標記使用者已經按下查詢
  hasSubmitted.value = true;

  const { memberID, searchTime } = params;

  // Guard：必填條件不足，不查詢
  if (!memberID || !searchTime || !searchTime[0] || !searchTime[1]) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // memberID 格式：account@agentID（從 fuzzyQueryUser 返回的 value 格式）
  // 直接使用，不需要解析
  const postData: GetSafetyBoxOrderParams = {
    memberID: memberID as string,
    searchTime: {
      startTime: dayjs(searchTime[0]).toDate(),
      endTime: dayjs(searchTime[1]).toDate(),
    },
  };

  try {
    const res: any = await getSafetyBoxOrder(postData);
    const orders = Array.isArray(res?.data?.orders) ? res.data.orders : [];

    return {
      items: orders,
      meta: {
        totalItems: orders.length,
      },
    };
  }
  catch (err) {
    console.error(err);
    message.error(t('notify.connectionError') || '連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Breadcrumb Context）
 * - memberID、searchTime：搜尋表單欄位，全部在 loadTableData 中作為 API 參數使用
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 嘗試獲取搜尋表單的值
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return 'BACKEND';
  }

  try {
    // 所有搜尋條件（memberID、searchTime）都在 loadTableData 中作為 API 參數使用
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

// ============ 初始化 ============
onMounted(async () => {
  // 初始化時清除驗證狀態並覆寫 resetFields 方法
  await nextTick();
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.clearValidate();
    // 覆寫 resetFields 方法，在 reset 時重置提交狀態
    const originalResetFields = searchFormRef.resetFields;
    searchFormRef.resetFields = async (...args: any[]) => {
      hasSubmitted.value = false;
      return originalResetFields.apply(searchFormRef, args);
    };
  }

  // 初始化時重置提交狀態，確保進入頁面不顯示紅字
  hasSubmitted.value = false;
});
</script>

<template>
  <div class="safety-box-record-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        :columns="columns"
        :data-request="loadTableData"
        :scroll="{ x: tableConfig.scrollX.value }"
        :form-props="{
          validateTrigger: ['submit'],
        }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('title') || '保險箱記錄查詢' }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>

<style scoped>
.safety-box-record-page {
  width: 100%;
}

.table-container {
  width: 100%;
}
</style>
