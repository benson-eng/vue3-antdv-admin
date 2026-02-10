<script setup lang="ts">
import type { GachaponGameRecordRow } from './columns';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { QueryVipPortalGameRecordParams } from '@/api/backend/adminSystem/lobbyGameRecordServer';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import { queryVipPortalGameRecord, SpendingType } from '@/api/backend/adminSystem/lobbyGameRecordServer';
import { listByMasterAgent } from '@/api/backend/member/vipServer';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { createGachaponGameRecordColumns } from './columns';
import { createGachaponGameRecordFormSchemas } from './formSchemas';

defineOptions({
  name: 'GachaponGameRecordTable',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.gachaponGameRecord');
const routeI18n = useI18n('routes.table');
const userStore = useUserStore();

// ARCH-MIGRATION-01：站長來源統一改為 Breadcrumb Context
// 從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
// 本頁作為 Context Consumer，僅讀取站長值，不建立、不修改 Context
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（來自 Breadcrumb，唯一來源）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於監聽站長切換）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/**
 * ============ 工具函數 ============
 */
function getMasterAgentByAgentID(agentID: string): string {
  if (!agentID) {
    return '';
  }
  const parts = agentID.split('.');
  return parts.length > 1 ? parts[1] : agentID;
}

function pickByIdentity<T extends Record<string, any>>(
  obj: T,
  excludeValues: any[],
): Partial<T> {
  const result: Partial<T> = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (!excludeValues.includes(value)) {
      result[key as keyof T] = value;
    }
  });
  return result;
}

// ARCH03-01：已移除 query / appliedQuery 雙狀態模型
// 搜尋狀態現在完全由 DynamicTable formSchemas 管理

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
const sMemberID = ref('');

// ============ Agent ID tracking（參照 cashRecord-table）============
const currentAgentID = ref<string>('');

// ============ 代理商選擇器 ============
const agentList = ref<Array<{ label: string; value: string }>>([]);
const selectedAgent = ref<string>('');
const isAgentDisabled = computed(() => userStore.level >= 5);

// ============ VIP 設定 ============
const vipSettings = ref<Array<{ vipLevel: number; name: string }>>([]);

// ============ 虛寶列表 ============
const treasureItemList = ref<TreasureItem[]>([]);

// ============ 幣別列表 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);

// ============ 代幣列表 ============
const tokenList = ref<TokenItem[]>([]);

/**
 * ARCH03-01：DynamicTable formSchemas（搜尋狀態的唯一來源）
 * 使用 formSchemas.tsx 中的工廠函數創建
 * 參照 cashRecord-table：formSchemas 為靜態定義，動態值通過 updateSchema 更新
 * ⚠️ 關鍵修正：formSchemas 必須在 useTable 的 formProps 中傳入
 * 初始化 formSchemas（在 useTable 之前初始化，確保 DynamicTable 能讀取到）
 * 注意：onAgentChanged、onSpendingTypeChanged、onGainTypeChanged 將在下方定義
 */
const formSchemas = createGachaponGameRecordFormSchemas({
  t,
  isAgentDisabled,
  onAgentChanged: () => {}, // 暫時為空函數，將在下方重新定義
  currencyTypeList,
  treasureItemList,
  tokenList,
  /** 暫時為空函數，將在下方重新定義 */
  onSpendingTypeChanged: () => {},
  /** 暫時為空函數，將在下方重新定義 */
  onGainTypeChanged: () => {},
});

/**
 * ============ 表格 ============
 * ARCH03-01：搜尋模型已由 Vue2 升級為 Vue3 DynamicTable 主控
 */
// ⚠️ 關鍵修正：formSchemas 必須在 useTable 的 formProps 中傳入，而不是在 template 中通過 prop 傳入
// 參照 cashRecord-table：在 useTable 的 formProps 中直接傳入 schemas
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true, // 啟用 DynamicTable 搜尋主控
  formProps: {
    schemas: formSchemas, // 直接在 useTable 初始化時傳入（已在上方初始化）
  },
});

// 使用 columns.tsx 中定義的類型
type ColumnsRowData = GachaponGameRecordRow;

// ============ SearchForm 初始化狀態 ============
/**
 * 修正目標：確保所有 searchFormRef 操作在 DynamicTable 初始化完成後才執行
 * 問題根因：在 SearchForm 尚未建立前即呼叫 resetFields / setFieldsValue / updateSchema
 *          導致 formSchemas 中的欄位在首次 render 時即被清除
 */
const isSearchFormReady = ref(false);

// ARCH03-01：會員搜尋函數（需要在 dynamicTableInstance 定義之後）
/**
 * 會員搜尋改為輔助輸入，不直接觸發查詢
 * 參照 cashRecord-table：只負責 API 調用和更新 memberOptions，不直接更新 schema
 */
const fetchMemberOptions = async (queryText: string, append = false, agentID?: string) => {
  memberLastQueryText.value = queryText;

  // 從參數或 DynamicTable 表單取得 agentID
  const agentIDForQuery = agentID || (dynamicTableInstance?.getSearchFormRef?.()?.getFieldsValue?.()?.agentID);
  if (!agentIDForQuery) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  try {
    const masterAgent = getMasterAgentByAgentID(agentIDForQuery);
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: agentIDForQuery,
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
  catch (error) {
    console.error('Failed to fetch member options:', error);
    memberOptions.value = [];
  }
};

/**
 * 參照 cashRecord-table：統一更新會員選項和 loading 狀態
 */
const updateMemberOptions = async () => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  await nextTick();
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  const formAgentID = searchFormRef.getFieldsValue?.()?.agentID;
  const agentIDForDisabled = formAgentID || currentAgentID.value;

  searchFormRef.updateSchema([{
    field: 'memberID',
    componentProps: {
      options: memberOptions.value,
      loading: memberLoading.value,
      disabled: !agentIDForDisabled,
    },
  }]);
};

/**
 * 會員搜尋改為輔助輸入，不直接觸發查詢
 * 參照 cashRecord-table：檢查是否有 agentID，沒有則顯示錯誤訊息
 */
const onMemberSearch = debounce(async (text: string, agentID?: string) => {
  if (!text || text.length < 2) {
    memberOptions.value = [];
    await updateMemberOptions();
    return;
  }

  // 參照 cashRecord-table：檢查是否有 agentID
  const form = dynamicTableInstance?.getSearchFormRef?.();
  const currentAgentIDForSearch = agentID || form?.getFieldsValue?.()?.agentID;
  if (!currentAgentIDForSearch) {
    message.error(t('notify.pleaseSelectAgentFirst') || '請先選擇代理');
    return;
  }

  memberLoading.value = true;
  await updateMemberOptions();

  try {
    await fetchMemberOptions(text, false, currentAgentIDForSearch);
  }
  finally {
    memberLoading.value = false;
    await updateMemberOptions();
  }
}, 300);

/**
 * 參照 cashRecord-table：更新會員欄位的 disabled 狀態
 */
const updateMemberFieldsDisabled = async () => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  await nextTick();
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  const values = searchFormRef.getFieldsValue?.();
  const formAgentID = values?.agentID || currentAgentID.value;

  // 更新 memberID 的禁用狀態（參照 cashRecord-table）
  searchFormRef.updateSchema([{
    field: 'memberID',
    componentProps: {
      disabled: !formAgentID,
    },
  }]);
};

/**
 * 會員選擇僅更新表單值，不直接觸發查詢
 * 參照 cashRecord-table：更新 sMemberID 並更新 disabled 狀態
 */
const onMemberSelectChanged = async (val: string) => {
  sMemberID.value = val || '';
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  // 更新 DynamicTable 表單值
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.setFieldsValue({ memberID: val });
  }
  // 更新會員欄位的 disabled 狀態（參照 cashRecord-table）
  await updateMemberFieldsDisabled();
};

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom || !memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }

  await fetchMemberOptions(memberLastQueryText.value, true);
};

/**
 * 初始化 memberID schema（參照 cashRecord-table）
 * 設置 onSearch、onPopupScroll、onChange handlers
 */
const initMemberSchema = async () => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  await nextTick();
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  searchFormRef.updateSchema([{
    field: 'memberID',
    component: 'Select',
    componentProps: {
      showSearch: true,
      filterOption: false,
      allowClear: true,
      options: [],
      loading: false,
      placeholder: t('labels.memberPlaceholder'),
      disabled: false,
      onSearch: (text: string) => {
        // 從表單取得當前 agentID
        const formRef = dynamicTableInstance?.getSearchFormRef?.();
        const agentID = formRef?.getFieldsValue?.()?.agentID;
        onMemberSearch(text, agentID);
      },
      onPopupScroll: onMemberPopupScroll,
      onChange: onMemberSelectChanged,
    },
  }]);
};

/**
 * ARCH03-01：onAgentChanged（需要在 formSchemas 之前定義）
 * 參照 cashRecord-table：更新 currentAgentID 並更新會員欄位的 disabled 狀態
 */
/**
 * ARCH03-01：onAgentChanged（需要在 formSchemas 之前定義）
 * 參照 cashRecord-table：更新 currentAgentID 並更新會員欄位的 disabled 狀態
 */
const onAgentChanged = async (val: string) => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  // 參照 cashRecord-table：直接使用 val，不包含 masterAgent
  currentAgentID.value = val || '';
  selectedAgent.value = val || '';
  // 清空會員選項
  memberOptions.value = [];
  sMemberID.value = '';
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    // 清空會員選擇
    searchFormRef.setFieldsValue({ memberID: undefined });
  }
  // 更新會員欄位的 disabled 狀態（參照 cashRecord-table）
  await updateMemberFieldsDisabled();
};

/**
 * ARCH03-01：處理花費種類切換
 * 當種類改變時，更新花費項目欄位的選項和 disabled 狀態，並清空相關字段
 */
const onSpendingTypeChanged = async (val: string) => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  await nextTick();
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  const isCurrency = val === 'Currency';
  const isTreasures = val === 'Treasures';
  const isToken = val === 'Token';

  // 根據種類更新花費項目欄位的選項
  let itemOptions: Array<{ label: string; value: string }> = [];
  if (isCurrency) {
    itemOptions = currencyTypeList.value.map(item => ({
      label: item.name,
      value: item.value,
    }));
  }
  else if (isTreasures) {
    itemOptions = treasureItemList.value.map(item => ({
      label: item.itemName,
      value: item.treasureItemID,
    }));
  }
  else if (isToken) {
    itemOptions = tokenList.value.map(item => ({
      label: item.name,
      value: item.id.toString(),
    }));
  }

  // 更新相關欄位的 disabled 狀態和選項
  searchFormRef.updateSchema([
    {
      field: 'spendingItem',
      componentProps: {
        disabled: !val,
        options: itemOptions,
        placeholder: isCurrency ? t('labels.currencyType') : isTreasures ? t('labels.item') : isToken ? t('labels.token') : t('labels.spendingItem'),
      },
    },
    {
      field: 'spendingAmount',
      componentProps: {
        disabled: !val,
      },
    },
  ]);

  // 清空相關字段
  const updates: any = {
    spendingItem: undefined,
    spendingAmount: undefined,
    spendingCurrencyType: undefined,
    spendingBalance: undefined,
    spendingItemID: undefined,
    spendingTokenID: undefined,
  };
  searchFormRef.setFieldsValue(updates);
};

/**
 * ARCH03-01：處理獲得種類切換
 * 當種類改變時，更新獲得項目欄位的選項和 disabled 狀態，並清空相關字段
 */
const onGainTypeChanged = async (val: string) => {
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  await nextTick();
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  const isCurrency = val === 'Currency';
  const isTreasures = val === 'Treasures';
  const isToken = val === 'Token';

  // 根據種類更新獲得項目欄位的選項
  let itemOptions: Array<{ label: string; value: string }> = [];
  if (isCurrency) {
    itemOptions = currencyTypeList.value.map(item => ({
      label: item.name,
      value: item.value,
    }));
  }
  else if (isTreasures) {
    itemOptions = treasureItemList.value.map(item => ({
      label: item.itemName,
      value: item.treasureItemID,
    }));
  }
  else if (isToken) {
    itemOptions = tokenList.value.map(item => ({
      label: item.name,
      value: item.id.toString(),
    }));
  }

  // 更新相關欄位的 disabled 狀態和選項
  searchFormRef.updateSchema([
    {
      field: 'gainItem',
      componentProps: {
        disabled: !val,
        options: itemOptions,
        placeholder: isCurrency ? t('labels.currencyType') : isTreasures ? t('labels.item') : isToken ? t('labels.token') : t('labels.gainItem'),
      },
    },
    {
      field: 'gainAmount',
      componentProps: {
        disabled: !val,
      },
    },
  ]);

  // 清空相關字段
  const updates: any = {
    gainItem: undefined,
    gainAmount: undefined,
    gainCurrencyType: undefined,
    gainBalance: undefined,
    gainItemID: undefined,
    gainTokenID: undefined,
  };
  searchFormRef.setFieldsValue(updates);
};

// 注意：formSchemas 已在 useTable 之前初始化並傳入
// onAgentChanged 傳入的是空函數，將在下方定義後通過 updateSchema 更新

// 🔍 確認步驟 3️⃣：監聽 formSchemas 確認實際使用的欄位
watch(
  () => formSchemas,
  (schemas) => {
    console.log(
      '[GachaponGameRecordTable] formSchemas fields:',
      schemas.map(s => s.field),
    );
    console.log(
      '[GachaponGameRecordTable] formSchemas details:',
      schemas.map(s => ({ field: s.field, label: s.label, component: s.component })),
    );
  },
  { immediate: true, deep: true },
);

const getVipName = (vipLevel: number): string => {
  const foundVipSetting = vipSettings.value.find(s => s.vipLevel === vipLevel);
  return foundVipSetting ? foundVipSetting.name : t('tables.unknown');
};

const getTreasureItemName = (itemID?: string): string => {
  const foundItem = treasureItemList.value.find(t => t.treasureItemID === itemID);
  return foundItem ? foundItem.itemName : t('tables.unknown');
};

const getAwardDetails = (
  type: SpendingType | string,
  currencyType?: string,
  balance?: number,
  itemID?: string,
  spendingItem?: any,
): string => {
  const tempSpendingItem = spendingItem ? JSON.parse(JSON.stringify(spendingItem)) : null;
  switch (type) {
    case SpendingType.Currency:
    case t('awardType.Currency'):
    {
      const currencyTypeName = currencyTypeList.value.find(c => c.value === currencyType)?.name;
      return `${currencyTypeName} ${balance}`;
    }
    case SpendingType.Treasures:
    case t('awardType.Treasures'):
      return getTreasureItemName(itemID);
    case SpendingType.Token:
    case t('awardType.Token'):
      if (tempSpendingItem) {
        const tokenName = tokenList.value.find(t => t.id === tempSpendingItem.tokenID)?.name;
        if (tokenName) {
          return `${tokenName} ${tempSpendingItem.amount}`;
        }
      }
      return '';
    default:
      return t('tables.unknown');
  }
};

/**
 * STEP 3 定型的欄位集合（依顯示順序）
 * 欄位 keys: ['id', 'roundID', 'eventID', 'memberID', 'accountID', 'nickName', 'vip', 'spendingType', 'spendingDetails', 'spendingAmount', 'gainType', 'gainDetails', 'gainAmount', 'playDateTime']
 * ARCH-02: 新增 accountID 和 nickName 欄位（由 queryAccountBaseInfo 批次補齊）
 * 使用 columns.tsx 中的工廠函數創建
 */
const baseColumns = ref<TableColumn<ColumnsRowData>[]>(
  createGachaponGameRecordColumns({
    t,
    getVipName,
    getTreasureItemName,
    getAwardDetails,
  }),
);

// 使用表格配置 Hook
// 注意：過濾掉 hideInTable: true 的欄位，確保它們不會出現在列設置中
const filteredColumnsForConfig = computed(() => {
  return baseColumns.value.filter(col => !col.hideInTable);
});
const tableConfig = useTableConfig(filteredColumnsForConfig as any);

// 參照 agent/index.vue：直接使用 visibleColumnKeys，不需要 isInitialized 標記
// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<ColumnsRowData>[]>(() => {
  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    // 如果原始欄位已經設置了 hideInTable: true，則保持不顯示（不受 visibleColumnKeys 影響）
    // 否則根據 visibleColumnKeys 決定是否顯示
    const shouldHide = col.hideInTable !== undefined ? col.hideInTable : !isVisible;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<ColumnsRowData> = {
      ...col,
      hideInTable: shouldHide,
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
// 重要：初始化階段不得反向覆寫 visibleColumnKeys
// 同步僅反映使用者於 column setting 中的操作，不得改變預設欄位集合與顯示順序
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
    newColumns.forEach((col: TableColumn<ColumnsRowData>) => {
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

// 參照 agent/index.vue：不需要 initializeVisibleColumns 函數
// useTableConfig 會自動初始化 visibleColumnKeys

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
 * ARCH03-01：loadTableData 使用 DynamicTable 的搜尋參數（從 params 取得）
 */
const loadTableData = async (params: any) => {
  // 從 DynamicTable 搜尋表單取得搜尋條件
  const searchValues = params || {};
  const masterAgent = selectedMasterAgent.value;
  // 參照 cashRecord-table：agentID 直接使用表單值，如果沒有則使用 currentAgentID
  const agentID = searchValues.agentID || currentAgentID.value || masterAgent;

  // 確保返回的數據格式正確
  if (!masterAgent || !agentID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: QueryVipPortalGameRecordParams = {
    masterAgent,
    agentID,
  };

  if (searchValues.memberID) {
    postData.memberID = searchValues.memberID;
  }

  if (searchValues.eventID) {
    postData.eventID = searchValues.eventID;
  }

  if (searchValues.playDateTime && Array.isArray(searchValues.playDateTime) && searchValues.playDateTime[0] && searchValues.playDateTime[1]) {
    postData.playDateTime = {
      startTime: dayjs(searchValues.playDateTime[0]).toDate(),
      endTime: dayjs(searchValues.playDateTime[1]).toDate(),
    };
  }

  // 處理花費相關欄位：從新欄位映射到 API 欄位
  if (searchValues.spendingType && searchValues.spendingItem && searchValues.spendingAmount !== undefined) {
    if (searchValues.spendingType === 'Currency') {
      postData.spendingCurrencyType = searchValues.spendingItem;
      postData.spendingBalance = searchValues.spendingAmount;
    }
    else if (searchValues.spendingType === 'Treasures') {
      postData.spendingItemID = searchValues.spendingItem;
      // Treasures 類型不需要 balance，但保留 spendingBalance 欄位以保持 API 兼容性
    }
    else if (searchValues.spendingType === 'Token') {
      postData.spendingTokenID = searchValues.spendingItem;
      postData.spendingBalance = searchValues.spendingAmount;
    }
  }

  // 處理獲得相關欄位：從新欄位映射到 API 欄位
  if (searchValues.gainType && searchValues.gainItem && searchValues.gainAmount !== undefined) {
    if (searchValues.gainType === 'Currency') {
      postData.gainCurrencyType = searchValues.gainItem;
      postData.gainBalance = searchValues.gainAmount;
    }
    else if (searchValues.gainType === 'Treasures') {
      postData.gainItemID = searchValues.gainItem;
      // Treasures 類型不需要 balance，但保留 gainBalance 欄位以保持 API 兼容性
    }
    else if (searchValues.gainType === 'Token') {
      postData.gainTokenID = searchValues.gainItem;
      postData.gainBalance = searchValues.gainAmount;
    }
  }

  const actualConditions = pickByIdentity(postData, [undefined, '']) as QueryVipPortalGameRecordParams;

  try {
    const res = await queryVipPortalGameRecord(actualConditions);
    // 處理多種可能的 API 響應結構
    const resData = res as any;

    let items: GachaponGameRecordRow[] = [];
    let total = 0;

    // 路徑 1: res.data.items (API 定義的結構)
    if (resData?.data?.items && Array.isArray(resData.data.items)) {
      items = resData.data.items;
      total = resData.data.count || resData.data.items.length;
    }
    // 路徑 2: res.items (直接返回)
    else if (Array.isArray(resData?.items)) {
      items = resData.items;
      total = resData.count || resData.items.length;
    }
    // 路徑 3: res 本身就是陣列
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }
    // 路徑 4: res.data 本身就是陣列
    else if (Array.isArray(resData?.data)) {
      items = resData.data;
      total = resData.data.length;
    }
    // 確保 items 是數組
    else {
      items = [];
      total = 0;
    }

    // 確保 items 始終是數組
    if (!Array.isArray(items)) {
      console.warn('API 返回的 items 不是數組:', items);
      items = [];
    }

    const rawItems = Array.isArray(items) ? [...items] : [];

    /**
     * ARCH-02 STEP B: 資料合併（批量優先、精準為主）
     * 使用 queryAccountBaseInfo 批量查詢會員基本資料
     */
    const masterAgentForQuery = masterAgent;
    const accounts = Array.from(
      new Set(
        rawItems
          .map((i: any) => String(i.memberID || '').split('@')[0])
          .filter(Boolean),
      ),
    );

    let accountInfoMap: Record<string, { id?: string; nickName?: string }> = {};
    let accountOnlyMap: Record<string, { id?: string; nickName?: string }> = {};
    if (accounts.length && masterAgentForQuery) {
      try {
        const baseRes = await queryAccountBaseInfo({ masterAgent: masterAgentForQuery, accounts });
        const baseListRaw = baseRes as { data?: any[] } | any[] | undefined;
        const baseList = Array.isArray(baseListRaw) ? baseListRaw : baseListRaw?.data ?? [];
        accountInfoMap = baseList.reduce((acc, cur) => {
          const key = `${cur.account}@${cur.agentID}`;
          acc[key] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);
        accountOnlyMap = baseList.reduce((acc, cur) => {
          acc[cur.account] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);
      }
      catch (error) {
        // 會員基本資料查詢失敗不影響主列表，只記錄警告
        console.warn('[GachaponGameRecord] Failed to fetch member base info', error);
      }
    }

    /**
     * ARCH-02 STEP A: 補齊顯示用欄位
     */
    const mergedItems = rawItems.map((r: any) => {
      const memberIDKey = String(r.memberID || '');
      const accountKey = memberIDKey.split('@')[0];
      const baseInfo = accountInfoMap[memberIDKey] || accountOnlyMap[accountKey] || {};

      return {
        ...r,
        accountID: baseInfo.id || '',
        nickName: baseInfo.nickName || '',
      };
    });

    const sortedItems = mergedItems.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

    // 模擬載入時間
    if (sortedItems.length > 0) {
      const delay = Math.max(500, (sortedItems.length / 65) * 50);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      items: sortedItems,
      meta: {
        totalItems: total,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.connectionError'));
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * ============ API 調用 ============
 */
const setVipSettingList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await listByMasterAgent({ masterAgent });
    if (res) {
      vipSettings.value = res.map(item => ({ vipLevel: item.vipLevel, name: item.name }));
    }
  }
  catch (error) {
    console.error('Failed to fetch VIP settings:', error);
  }
};

const setCurrencyTypeList = async (masterAgent: string): Promise<void> => {
  currencyTypeList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  else {
    // 從 API 取得站長資料以取得幣別列表
    try {
      const masterAgentList = await getMasterAgentAccountList();
      const masterAgentData = masterAgentList?.find(ma => ma.account === masterAgent);
      if (masterAgentData && masterAgentData.currencies && Array.isArray(masterAgentData.currencies)) {
        masterAgentData.currencies.forEach((currencyItem: any) => {
          if (currencyItem && typeof currencyItem === 'object' && currencyItem.currencyCode) {
            currencyTypeList.value.push({
              name: currencyItem.currencyName || currencyItem.currencyCode,
              value: currencyItem.currencyCode,
            });
          }
        });
      }
    }
    catch (error) {
      console.error('Failed to fetch master agent data for currency types:', error);
    }
  }
};

const setTreasureItemList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await fetchTreasureItemList({ masterAgent });
    if (res?.data?.rows) {
      treasureItemList.value = res.data.rows.reduce((acc: TreasureItem[], r) => {
        return acc.concat(r.items);
      }, []);
    }
  }
  catch (error) {
    console.error('Failed to fetch treasure items:', error);
  }
};

/**
 * ARCH03-01：getTokenList 使用 selectedMasterAgent
 */
const getTokenList = async () => {
  tokenList.value = [];
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    return;
  }
  try {
    const res = await queryTokens({ masterAgent });
    if (res) {
      tokenList.value = res;
    }
  }
  catch (error) {
    console.error('Failed to fetch tokens:', error);
  }
};

/**
 * 參照 cashRecord-table：載入代理列表並自動選擇第一個
 * 注意：此函數不檢查 isSearchFormReady，由調用方確保 SearchForm 已就緒
 */
const fetchAgentList = async (masterAgent: string) => {
  if (!masterAgent) {
    agentList.value = [];
    currentAgentID.value = '';
    // 更新 schema（參照 cashRecord-table：直接更新，不檢查 guard）
    await nextTick();
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.updateSchema([{
        field: 'agentID',
        componentProps: {
          options: [],
        },
      }]);
    }
    return;
  }
  try {
    const list = await getAgentListByMasterAgent({ masterAgent });
    agentList.value = (list || []).map(item => ({
      label: item.account.includes('.') ? item.account.split('.')[0] : item.account,
      value: item.account,
    }));

    console.log('[GachaponGameRecordTable] fetchAgentList - agentList.value:', agentList.value);

    // 更新 schema（參照 cashRecord-table：直接更新，不檢查 guard）
    await nextTick();
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();

    // 參照 cashRecord-table：直接調用 updateSchema，不檢查 searchFormRef 是否存在
    // 因為如果 searchFormRef 不存在，updateSchema 會失敗但不會報錯
    if (searchFormRef) {
      searchFormRef.updateSchema([{
        field: 'agentID',
        componentProps: {
          options: agentList.value,
          disabled: isAgentDisabled.value,
          placeholder: t('labels.agentPlaceholder'),
          allowClear: !isAgentDisabled.value,
          onChange: onAgentChanged,
        },
      }]);

      // 參照 cashRecord-table：如果有代理商，自動選擇第一個並設置到表單
      if (agentList.value.length > 0) {
        const firstAgentID = agentList.value[0].value;
        // 參照 cashRecord-table：直接使用 account，不包含 masterAgent
        searchFormRef.setFieldsValue({ agentID: firstAgentID });
        currentAgentID.value = firstAgentID;
        selectedAgent.value = firstAgentID;
        // 更新會員欄位的 disabled 狀態
        await updateMemberFieldsDisabled();
      }
    }
  }
  catch (error) {
    console.error('Failed to fetch agent list:', error);
    agentList.value = [];
    currentAgentID.value = '';
  }
};

/**
 * ============ 事件處理 ============
 */
/**
 * ARCH-MIGRATION-01：處理站長變更（來自 Breadcrumb Context）
 * 本頁作為 Breadcrumb Context Consumer，僅處理站長變更後的反應行為
 * 站長來源完全由 Breadcrumb Context 提供，本頁不決定或保存站長值
 */
const handleMasterAgentChange = async (masterAgent: string) => {
  if (!masterAgent) {
    return;
  }

  // 清空相關狀態
  selectedAgent.value = '';
  agentList.value = [];
  tokenList.value = [];

  // 載入站長相關資料
  await setVipSettingList(masterAgent);
  await setCurrencyTypeList(masterAgent);
  await setTreasureItemList(masterAgent);
  await getTokenList();

  // 如果有選擇總代理，獲取代理商列表
  await fetchAgentList(masterAgent);
  // 如果有代理商，自動選擇第一個
  if (agentList.value.length > 0 && userStore.level <= 4) {
    selectedAgent.value = agentList.value[0].value;
  }

  // ARCH03-01：重置 DynamicTable 搜尋條件並自動觸發 reload
  // Guard: 確保 SearchForm 已初始化完成
  if (!isSearchFormReady.value) {
    return;
  }
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
    // 如果有代理商，設置 agentID
    if (selectedAgent.value) {
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      searchFormRef.setFieldsValue({ agentID: `${agentAccount}.${masterAgent}` });
      // 更新會員欄位的 disabled 狀態（參照 cashRecord-table）
      await nextTick();
      searchFormRef.updateSchema([{
        field: 'memberID',
        componentProps: {
          disabled: false, // 有 agentID 時啟用
        },
      }]);
    }
    else {
      // 沒有代理商時，禁用會員欄位
      await nextTick();
      searchFormRef.updateSchema([{
        field: 'memberID',
        componentProps: {
          disabled: true,
        },
      }]);
    }
    // 自動觸發 reload
    await dynamicTableInstance?.reload?.(true);
  }
};

// ARCH-MIGRATION-01：監聽站長切換（來自 Breadcrumb Context）
// 本頁作為 Context Consumer，監聽 contextVersion 變化以響應站長切換
// 參照 cashRecord-table：不自動觸發 reload，只重置表單和清空會員選擇
watch(
  () => contextVersion.value,
  async () => {
    // Guard: 確保 SearchForm 已初始化完成
    if (!isSearchFormReady.value) {
      return;
    }
    // 站長切換時，重新載入相關資料（但不自動觸發 reload）
    const newMasterAgent = selectedMasterAgent.value;
    if (newMasterAgent) {
      // 清空相關狀態
      selectedAgent.value = '';
      agentList.value = [];
      tokenList.value = [];
      sMemberID.value = '';
      memberOptions.value = [];
      currentAgentID.value = '';

      // 載入站長相關資料
      await setVipSettingList(newMasterAgent);
      await setCurrencyTypeList(newMasterAgent);
      await setTreasureItemList(newMasterAgent);
      await getTokenList();

      // 參照 cashRecord-table：載入代理列表（會自動更新 schema 和設置第一個代理）
      await fetchAgentList(newMasterAgent);

      // 參照 cashRecord-table：清空會員選擇（不調用 resetFields，避免清除 fetchAgentList 設置的 agentID）
      const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
      if (searchFormRef) {
        // 清空會員選擇
        searchFormRef.setFieldsValue({
          memberID: undefined,
        });
        // fetchAgentList 已自動選擇第一個代理並設置到表單
        // 更新會員欄位的 disabled 狀態
        await updateMemberFieldsDisabled();
      }
    }
    else {
      // 如果站長被清空，重置表單並清空代理選項
      const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
      if (searchFormRef) {
        searchFormRef.resetFields();
        // 清空代理選項
        searchFormRef.updateSchema([{
          field: 'agentID',
          componentProps: {
            options: [],
          },
        }]);
        await updateMemberFieldsDisabled();
      }
    }
  },
);

/**
 * 監聽數據列表變化，更新花費項目和獲得項目的選項
 * 當 currencyTypeList、treasureItemList、tokenList 更新時，如果已選擇種類，則更新對應的選項
 */
watch(
  [currencyTypeList, treasureItemList, tokenList],
  () => {
    if (!isSearchFormReady.value) {
      return;
    }
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (!searchFormRef) {
      return;
    }

    const formValues = searchFormRef.getFieldsValue?.();
    if (!formValues) {
      return;
    }

    // 更新花費項目的選項（如果已選擇花費種類）
    if (formValues.spendingType) {
      let spendingItemOptions: Array<{ label: string; value: string }> = [];
      if (formValues.spendingType === 'Currency') {
        spendingItemOptions = currencyTypeList.value.map(item => ({
          label: item.name,
          value: item.value,
        }));
      }
      else if (formValues.spendingType === 'Treasures') {
        spendingItemOptions = treasureItemList.value.map(item => ({
          label: item.itemName,
          value: item.treasureItemID,
        }));
      }
      else if (formValues.spendingType === 'Token') {
        spendingItemOptions = tokenList.value.map(item => ({
          label: item.name,
          value: item.id.toString(),
        }));
      }

      searchFormRef.updateSchema([
        {
          field: 'spendingItem',
          componentProps: {
            options: spendingItemOptions,
          },
        },
      ]);
    }

    // 更新獲得項目的選項（如果已選擇獲得種類）
    if (formValues.gainType) {
      let gainItemOptions: Array<{ label: string; value: string }> = [];
      if (formValues.gainType === 'Currency') {
        gainItemOptions = currencyTypeList.value.map(item => ({
          label: item.name,
          value: item.value,
        }));
      }
      else if (formValues.gainType === 'Treasures') {
        gainItemOptions = treasureItemList.value.map(item => ({
          label: item.itemName,
          value: item.treasureItemID,
        }));
      }
      else if (formValues.gainType === 'Token') {
        gainItemOptions = tokenList.value.map(item => ({
          label: item.name,
          value: item.id.toString(),
        }));
      }

      searchFormRef.updateSchema([
        {
          field: 'gainItem',
          componentProps: {
            options: gainItemOptions,
          },
        },
      ]);
    }
  },
  { deep: true },
);

// 參照 cashRecord-table：監聽代理變更，檢查會員是否屬於新代理
watch(
  () => currentAgentID.value,
  async (newAgentID, oldAgentID) => {
    // Guard: 確保 SearchForm 已初始化完成
    if (!isSearchFormReady.value) {
      return;
    }

    if (!newAgentID) {
      // 代理被清空時，清空所有會員相關欄位
      sMemberID.value = '';
      memberOptions.value = [];
      const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
      if (searchFormRef) {
        searchFormRef.setFieldsValue({ memberID: undefined });
      }
      await updateMemberFieldsDisabled();
      return;
    }

    // 如果代理變更了，檢查選擇的會員是否屬於新代理
    if (oldAgentID && sMemberID.value) {
      const checkData = sMemberID.value.split('@');
      if (checkData.length === 2 && checkData[1] !== newAgentID) {
        // 會員不屬於新代理，清空會員選擇
        sMemberID.value = '';
        memberOptions.value = [];
        const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
        if (searchFormRef) {
          searchFormRef.setFieldsValue({ memberID: undefined });
        }
      }
    }

    // 更新禁用狀態
    await updateMemberFieldsDisabled();
  },
);

// ARCH03-01：已移除 onPlayDateTimeDatePickChanged
// 日期選擇器現在由 DynamicTable formSchemas 直接管理

// ARCH03-01：已移除 searchConditionValidator 和 handleFilter
// 查詢與重置行為現在完全由 DynamicTable 管理

/**
 * SearchMode 狀態顯示（僅標示，不影響任何行為）
 *
 * 本頁為 search: true（有搜尋區），所有查詢皆為後端 API（loadTableData），
 * 因此標示為 BACKEND。
 */
const searchMode = computed<SearchMode>(() => 'BACKEND');

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[searchMode.value];
});

// ARCH-MIGRATION-01：初始化邏輯（站長來源統一為 Breadcrumb Context）
// 本頁不再使用 userStore.masterAgent 作為 fallback，完全依賴 Breadcrumb Context
onMounted(async () => {
  // 🔍 確認步驟 1️⃣：確認實際 render 的 Component
  console.log('[GachaponGameRecordTable] mounted - Component is being used');
  console.log('[GachaponGameRecordTable] component name:', 'GachaponGameRecordTable');
  console.log('[GachaponGameRecordTable] isSearchFormReady guard is enabled:', true);

  // 等待 DynamicTable 與 SearchForm 完成初始化
  await nextTick();
  await nextTick();

  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    isSearchFormReady.value = true;
    console.log('[GachaponGameRecordTable] SearchForm is ready, isSearchFormReady = true');
  }
  else {
    console.warn('[GachaponGameRecordTable] SearchForm not ready after nextTick');
  }

  // 🔍 確認步驟 5️⃣：確認 SearchForm 內的實際欄位
  if (searchFormRef) {
    const formValues = searchFormRef.getFieldsValue?.();
    console.log('[GachaponGameRecordTable] SearchForm fields:', Object.keys(formValues || {}));
  }

  // ARCH-MIGRATION-01：站長來源統一改為 Breadcrumb Context
  // 從 Breadcrumb Context 取得站長值（唯一來源）
  const initialMasterAgent = selectedMasterAgent.value;

  // 如果有初始站長值，初始化相關資料
  // 如果沒有站長值，則不初始化（由 Breadcrumb 決定站長來源）
  if (initialMasterAgent) {
    await handleMasterAgentChange(initialMasterAgent);
  }

  // 初始化 memberID schema（參照 cashRecord-table）
  await initMemberSchema();

  // 更新 agentID、spendingType、gainType schema 的 onChange（確保使用正確的處理函數）
  if (isSearchFormReady.value) {
    await nextTick();
    const searchFormRefForAgent = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRefForAgent) {
      searchFormRefForAgent.updateSchema([
        {
          field: 'agentID',
          componentProps: {
            onChange: onAgentChanged,
          },
        },
        {
          field: 'spendingType',
          componentProps: {
            onChange: onSpendingTypeChanged,
          },
        },
        {
          field: 'gainType',
          componentProps: {
            onChange: onGainTypeChanged,
          },
        },
      ]);

      // 監聽 spendingItem 和 spendingAmount 的變化，同步到隱藏的 API 欄位
      watch(
        () => {
          const formValues = searchFormRefForAgent.getFieldsValue?.();
          return {
            spendingType: formValues?.spendingType,
            spendingItem: formValues?.spendingItem,
            spendingAmount: formValues?.spendingAmount,
          };
        },
        (newVal) => {
          if (!newVal) {
            return;
          }
          const updates: any = {};
          if (newVal.spendingType === 'Currency' && newVal.spendingItem) {
            updates.spendingCurrencyType = newVal.spendingItem;
          }
          if (newVal.spendingType === 'Currency' && newVal.spendingAmount !== undefined) {
            updates.spendingBalance = newVal.spendingAmount;
          }
          if (newVal.spendingType === 'Treasures' && newVal.spendingItem) {
            updates.spendingItemID = newVal.spendingItem;
          }
          if (newVal.spendingType === 'Token' && newVal.spendingItem) {
            updates.spendingTokenID = newVal.spendingItem;
          }
          if (newVal.spendingType === 'Token' && newVal.spendingAmount !== undefined) {
            updates.spendingBalance = newVal.spendingAmount;
          }
          if (Object.keys(updates).length > 0) {
            searchFormRefForAgent.setFieldsValue(updates);
          }
        },
        { deep: true },
      );

      // 監聽 gainItem 和 gainAmount 的變化，同步到隱藏的 API 欄位
      watch(
        () => {
          const formValues = searchFormRefForAgent.getFieldsValue?.();
          return {
            gainType: formValues?.gainType,
            gainItem: formValues?.gainItem,
            gainAmount: formValues?.gainAmount,
          };
        },
        (newVal) => {
          if (!newVal) {
            return;
          }
          const updates: any = {};
          if (newVal.gainType === 'Currency' && newVal.gainItem) {
            updates.gainCurrencyType = newVal.gainItem;
          }
          if (newVal.gainType === 'Currency' && newVal.gainAmount !== undefined) {
            updates.gainBalance = newVal.gainAmount;
          }
          if (newVal.gainType === 'Treasures' && newVal.gainItem) {
            updates.gainItemID = newVal.gainItem;
          }
          if (newVal.gainType === 'Token' && newVal.gainItem) {
            updates.gainTokenID = newVal.gainItem;
          }
          if (newVal.gainType === 'Token' && newVal.gainAmount !== undefined) {
            updates.gainBalance = newVal.gainAmount;
          }
          if (Object.keys(updates).length > 0) {
            searchFormRefForAgent.setFieldsValue(updates);
          }
        },
        { deep: true },
      );
    }
  }

  // 參照 agent/index.vue：不需要 initializeVisibleColumns，useTableConfig 會自動初始化
});
</script>

<template>
  <div class="app-container gachapon-table">
    <div class="gachapon-page">
      <div
        class="table-container"
        :style="{ overflowX: containerOverflowX }"
      >
        <!-- DynamicTable 搜尋區（包含所有搜尋欄位：代理商、會員、活動ID、遊玩時間、消耗、獲得） -->
        <!-- ⚠️ 注意：formSchemas 已在 useTable 的 formProps 中傳入，不需要在 template 中通過 prop 傳入 -->
        <DynamicTable
          :columns="columns"
          :data-request="loadTableData"
          :scroll="{ x: tableConfig.scrollX.value }"
        >
          <!-- SearchMode 狀態顯示（僅標示，不影響任何行為） -->
          <template #headerTitle>
            <div style="display: flex; align-items: center; gap: 8px">
              <span>{{ routeI18n.t('gachaponGameRecord') }}</span>
              <Tag :color="searchModeConfig.color" style="margin: 0">
                SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
              </Tag>
            </div>
          </template>
        </DynamicTable>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.gachapon-table {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    background-color: #e7e7e7;
    align-items: center;

    .item {
      margin-top: 10px;
    }

    .input_btn {
      margin: 10px 0;
    }
  }

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

    .my_select {
      width: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .my_jcCenter {
      display: flex;
      align-items: center;
    }

    .long-input {
      width: 400px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }
}
</style>
