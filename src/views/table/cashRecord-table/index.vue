<script setup lang="ts">
import type { TableColumnItem } from './columns';
import type { LobbyGameInfo } from '@/api/backend/adminSystem/lobbyGameServer';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';

import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getAllWebsite } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import { queryCashRecord } from '@/api/backend/adminSystem/cashRecordServer';
import { gameList as fetchGameList, getGameIDList } from '@/api/backend/adminSystem/gameManagerServer';
import { getLobbyGameList } from '@/api/backend/adminSystem/lobbyGameServer';
import { useTable } from '@/components/core/dynamic-table';
import { useCashRecordSearchRules } from '@/composables/cashRecord/useCashRecordSearchRules';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';

import { createCashRecordColumns } from './columns';
import { cashRecordSearchSchemas } from './formSchemas';
import { useTableConfig } from './useTableConfig';

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.cashRecord');
const userStore = useUserStore();

const masterAgentCtx = inject<any>(MASTER_AGENT_SELECT_KEY);
const selectedMasterAgent = computed(() => {
  return (
    masterAgentCtx?.selectedMasterAgent?.value
    || (userStore.level >= 4 ? userStore.masterAgent : '')
  )?.trim() || '';
});

const contextVersion = computed(() => masterAgentCtx?.contextVersion?.value ?? 0);

/* ========================
 * Type/SubType/Source/SourceStatus (拆解式搜尋模型)
 * ======================== */
/** 遊戲列表（用於 source 選項） */
const gameSourceList = ref<Array<{ value: string; label: string }>>([]);
/** 遊戲 ID 映射（gameName -> gameID），用於將選項中的 gameName 轉換為 gameID */
const gameIDMap = ref<Map<string, string>>(new Map());
/** 網站列表（用於 Transfer 的 source，當 authLevel <= 2 時） */
const websiteList = ref<string[]>([]);

/**
 * 載入遊戲列表（用於 source 選項）
 * 根據 Vue2 邏輯：使用 gameName 作為選項，建立 gameName -> gameID 的映射
 */
const loadGameSourceList = async () => {
  const masterAgent = selectedMasterAgent.value;
  console.log('[CashRecord] loadGameSourceList called, masterAgent:', masterAgent);

  if (!masterAgent) {
    console.warn('[CashRecord] No masterAgent, skipping loadGameSourceList');
    gameSourceList.value = [];
    gameIDMap.value.clear();
    return;
  }

  try {
    console.log('[CashRecord] Starting to load game source list...');
    const gameSourceSet = new Set<string>();
    gameIDMap.value.clear();

    // 1. 從 gameList API 獲取所有遊戲
    console.log('[CashRecord] Fetching gameList from gameManager...');
    const gameListRes = await fetchGameList({ masterAgent });
    console.log('[CashRecord] gameList response:', gameListRes);

    if (gameListRes && Array.isArray(gameListRes)) {
      console.log('[CashRecord] gameList length:', gameListRes.length);
      let gameListCount = 0;
      gameListRes.forEach((game: any) => {
        if (game.gameID && game.gameName) {
          // 使用 gameName 作為選項（與 vue2 一致）
          gameSourceSet.add(game.gameName);
          // 建立 gameName -> gameID 的映射
          gameIDMap.value.set(game.gameName, game.gameID);
          gameListCount++;
        }
      });
      console.log('[CashRecord] Added games from gameList:', gameListCount);
    }
    else {
      console.warn('[CashRecord] gameList returned invalid data:', gameListRes);
    }

    // 2. 從 getGameIDList API 獲取完整的遊戲 ID 列表
    // 注意：這個 API 只返回 gameID，沒有 gameName
    // 如果 gameID 不在 gameList 中，使用 gameID 作為 gameName
    try {
      console.log('[CashRecord] Fetching getGameIDList...');
      const gameIDListRes = await getGameIDList({ masterAgent });
      console.log('[CashRecord] getGameIDList response:', gameIDListRes);

      if (gameIDListRes && Array.isArray(gameIDListRes)) {
        console.log('[CashRecord] getGameIDList length:', gameIDListRes.length);
        let gameIDListCount = 0;
        gameIDListRes.forEach((gameID: string) => {
          if (gameID) {
            // 檢查是否已經在 gameList 中（通過檢查 gameIDMap 的 values）
            const exists = Array.from(gameIDMap.value.values()).includes(gameID);
            if (!exists) {
              // 如果不存在，使用 gameID 作為 gameName
              gameSourceSet.add(gameID);
              gameIDMap.value.set(gameID, gameID);
              gameIDListCount++;
            }
          }
        });
        console.log('[CashRecord] Added games from getGameIDList:', gameIDListCount);
      }
      else {
        console.warn('[CashRecord] getGameIDList returned invalid data:', gameIDListRes);
      }
    }
    catch (error) {
      // getGameIDList 可能不存在或失敗，不影響主要流程
      console.error('[CashRecord] Failed to load game ID list:', error);
    }

    // 3. 從 getLobbyGameList API 獲取大廳遊戲列表（lobbyGameServer01）
    try {
      console.log('[CashRecord] Loading lobby game list...');
      const lobbyGameListRes = await getLobbyGameList();
      console.log('[CashRecord] getLobbyGameList response:', lobbyGameListRes);

      // 處理 API 返回格式：可能是 { data: [...] } 或直接是數組
      const lobbyGameList = Array.isArray(lobbyGameListRes)
        ? lobbyGameListRes
        : (lobbyGameListRes?.data && Array.isArray(lobbyGameListRes.data))
            ? lobbyGameListRes.data
            : null;

      if (lobbyGameList && Array.isArray(lobbyGameList)) {
        console.log('[CashRecord] LobbyGameList data length:', lobbyGameList.length);
        let addedCount = 0;
        lobbyGameList.forEach((lobby: LobbyGameInfo) => {
          if (lobby.gameName && lobby.lobbyGameID) {
            // 檢查是否已經存在（通過檢查 gameIDMap 的 values）
            const exists = Array.from(gameIDMap.value.values()).includes(lobby.lobbyGameID);
            if (!exists) {
              // 使用 gameName 作為選項（與 vue2 一致）
              gameSourceSet.add(lobby.gameName);
              // 建立 gameName -> lobbyGameID 的映射
              gameIDMap.value.set(lobby.gameName, lobby.lobbyGameID);
              addedCount++;
              console.log('[CashRecord] Added lobby game:', { gameName: lobby.gameName, lobbyGameID: lobby.lobbyGameID });
            }
            else {
              console.log('[CashRecord] Lobby game already exists:', { gameName: lobby.gameName, lobbyGameID: lobby.lobbyGameID });
            }
          }
          else {
            console.warn('[CashRecord] Invalid lobby game data:', lobby);
          }
        });
        console.log('[CashRecord] Total lobby games added:', addedCount);
      }
      else {
        console.warn('[CashRecord] getLobbyGameList returned invalid data:', lobbyGameListRes);
      }
    }
    catch (error) {
      // getLobbyGameList 可能不存在或失敗，不影響主要流程
      console.error('[CashRecord] Failed to load lobby game list:', error);
    }

    // 轉換為選項格式（使用 gameName 作為 value 和 label）
    gameSourceList.value = Array.from(gameSourceSet).map(gameName => ({
      value: gameName, // 使用 gameName 作為 value（與 vue2 一致）
      label: gameName, // 使用 gameName 作為 label
    }));

    console.log('[CashRecord] gameSourceList length:', gameSourceList.value.length);
    console.log('[CashRecord] gameSourceList values:', gameSourceList.value.map(i => i.value));
    console.log('[CashRecord] gameIDMap size:', gameIDMap.value.size);
  }
  catch (error) {
    console.error('Failed to load game list:', error);
    gameSourceList.value = [];
    gameIDMap.value.clear();
  }
};

/**
 * 載入網站列表（用於 Transfer 的 source，當 authLevel <= 2 時）
 * 來源：admin-web/src/api/admin.ts getAllWebsite
 */
const loadWebsiteList = async () => {
  // 只有當 authLevel <= 2 時才需要載入網站列表
  if (userStore.level > 2) {
    websiteList.value = [];
    return;
  }

  try {
    websiteList.value = await getAllWebsite();
    console.log('[CashRecord] websiteList length:', websiteList.value.length);
  }
  catch (error) {
    console.error('Failed to load website list:', error);
    websiteList.value = [];
  }
};

/* ========================
 * DynamicTable
 * ======================== */
const [DynamicTable, tableInstance] = useTable({
  search: true,
  immediate: false, // 🔒 不自動查（Vue2 行為）
  formProps: {
    schemas: cashRecordSearchSchemas,
  },
});

/** 根據選擇的類型和子類型更新選項 */
const updateSubOptions = async (selectedType?: string, selectedSubType?: string) => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();

  // 獲取規則實例
  const rules = useCashRecordSearchRules({
    authLevel: userStore.level,
    gameSourceList: gameSourceList.value,
    websiteList: websiteList.value,
    t: (key: string) => t(key),
  });

  console.log('[CashRecord] rules.getSourceOptions(Bet):', rules.getSourceOptions('Bet').map(i => i.value),
  );

  if (!selectedType) {
    // 清空子選項
    formRef?.updateSchema([
      {
        field: 'subType',
        componentProps: {
          options: [],
          disabled: true,
        },
      },
      {
        field: 'source',
        componentProps: {
          options: [],
          disabled: true,
        },
      },
      {
        field: 'sourceStatus',
        componentProps: {
          options: [],
          disabled: true,
        },
      },
    ]);

    // 清空子欄位的值
    formRef?.setFieldsValue({
      subType: undefined,
      source: undefined,
      sourceStatus: undefined,
    });
    return;
  }

  // 更新 subType
  const subTypeOptions = rules.getSubTypeOptions(selectedType);
  formRef?.updateSchema([{
    field: 'subType',
    componentProps: {
      options: subTypeOptions,
      disabled: subTypeOptions.length === 0,
      onChange: async (val: string) => {
        // 當 subType 變化時，重新更新 source 選項
        await updateSubOptions(selectedType, val);
        // 清空 source 的值（因為選項可能改變了）
        const formRef = tableInstance.getSearchFormRef();
        formRef?.setFieldsValue({ source: undefined });
      },
    },
  }]);

  // 更新 source（根據 subType 動態選擇）
  const sourceOptions = rules.getSourceOptions(selectedType, selectedSubType);
  formRef?.updateSchema([{
    field: 'source',
    componentProps: {
      options: sourceOptions,
      disabled: !rules.hasSource(selectedType),
    },
  }]);

  // 更新 sourceStatus
  const sourceStatusOptions = rules.getSourceStatusOptions(selectedType);
  formRef?.updateSchema([{
    field: 'sourceStatus',
    componentProps: {
      options: sourceStatusOptions,
      disabled: !rules.hasSourceStatus(selectedType),
    },
  }]);
};

/** 更新類型選項 */
const updateTypeOptions = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();

  // 獲取規則實例
  const rules = useCashRecordSearchRules({
    authLevel: userStore.level,
    gameSourceList: gameSourceList.value,
    websiteList: websiteList.value,
    t: (key: string) => t(key),
  });

  console.log('[CashRecord] rules.getSourceOptions(Bet):', rules.getSourceOptions('Bet').map(i => i.value),
  );

  formRef?.updateSchema([{
    field: 'type',
    label: t('labels.type') || '類別',
    componentProps: {
      options: rules.getTypeOptions(),
      placeholder: '請選擇類別',
      allowClear: true,
      onChange: async (val: string) => {
        // 當類型變化時，清空所有子級選擇（與 vue2 的 ChianSelector 邏輯一致）
        const formRef = tableInstance.getSearchFormRef();
        formRef?.setFieldsValue({
          subType: undefined,
          source: undefined,
          sourceStatus: undefined,
        });
        await updateSubOptions(val);
      },
    },
  }]);
};

// 定義所有欄位
// STEP 3 定型後的欄位 keys（按順序）：
// 1. remitno, 2. transactionTime, 3. memberID (hideInTable), 4. accountID (ARCH-02),
// 5. nickName (ARCH-02), 6. balanceChange, 7. beforeBalance, 8. afterBalance,
// 9. currency, 10. type, 11. subType, 12. source, 13. sourceStatus, 14. noteTranslated
const baseColumns = computed<TableColumnItem[]>(() => createCashRecordColumns(t));

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumns);

// 初始化標記：用於防止 watch 在初始化階段反向覆寫 visibleColumnKeys
const isInitialized = ref(false);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  const baseCols = baseColumns.value;
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），
  // 不得套用 hideInTable，必須維持全部顯示
  // 這確保初始載入時欄位顯示與 STEP 3 定型結果完全一致
  const shouldApplyVisibility = isInitialized.value && visibleKeys.length > 0;

  return baseCols.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
    /**
     * 初始化階段：全部顯示
     */
    const isVisible = shouldApplyVisibility
      ? visibleKeys.includes(key)
      : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumnItem = {
      ...col,
      hideInTable: shouldApplyVisibility ? !isVisible : false, // 初始化階段：不隱藏
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
// 重要：初始化階段不得反向覆寫 visibleColumnKeys，僅反映使用者操作
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // Guard: 初始化階段不得反向覆寫 visibleColumnKeys
    // 僅在初始化完成後才同步使用者於 column setting 中的操作
    if (!isInitialized.value) {
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

// 監聽 baseColumns 和 visibleColumnKeys 的初始化完成
// 確保 visibleColumnKeys 初始化完成後才標記為已初始化
watch(
  () => {
    const baseCols = baseColumns.value;
    const visibleKeys = tableConfig.visibleColumnKeys.value;
    return { baseCols, visibleKeys };
  },
  ({ baseCols, visibleKeys }) => {
    // 當 baseColumns 有值且 visibleColumnKeys 已初始化（包含所有欄位 keys）時，標記為已初始化
    if (baseCols.length > 0 && visibleKeys.length > 0) {
      // 驗證 visibleColumnKeys 包含所有 baseColumns 的 keys
      const baseKeys = baseCols.map(col => (col.dataIndex as string) || (col.key as string) || '').filter(Boolean);
      const hasAllKeys = baseKeys.every(key => visibleKeys.includes(key));

      if (hasAllKeys && !isInitialized.value) {
        // 使用 nextTick 確保在當前渲染週期完成後才標記為已初始化
        nextTick(() => {
          isInitialized.value = true;
        });
      }
    }
  },
  { immediate: true },
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
 * ARCH05：scroll.y 穩定化（類型 B：有搜尋區頁面）
 * - scroll.y 初始值為 undefined，確保 DynamicTable 初始 render 時搜尋區正常顯示
 * - 於 mounted + nextTick 後計算並設定 scroll.y，啟用 fixed header
 * - 不得延後 DynamicTable render（不得使用 v-if）
 */
const scrollY = ref<number | undefined>(undefined);

/**
 * ARCH05：計算並設定 scroll.y
 * - 計算視窗高度減去其他元素高度（header、filter-container、padding 等）
 * - 確保表格有固定高度，啟用 vertical scroll 和 fixed header
 */
const calculateScrollY = () => {
  if (typeof window === 'undefined') {
    return;
  }

  nextTick(() => {
    /**
     * 計算可用高度
     * 視窗高度 - header - filter-container - padding/margin
     * 預留約 300px 給表頭、搜尋區、toolbar 和其他固定元素
     */
    const availableHeight = window.innerHeight - 300;
    // 確保最小高度為 400px
    scrollY.value = Math.max(availableHeight, 400);
  });
};

/**
 * ARCH05：組合 scroll 物件
 * - 初始時 scroll.y 為 undefined
 * - mounted + nextTick 後 scroll.y 會被設定，啟用 fixed header
 */
const tableScroll = computed(() => {
  const scrollX = tableConfig.scrollX.value;
  return {
    x: scrollX,
    y: scrollY.value,
  };
});

/* ========================
 * Agent ID tracking
 * ======================== */
const currentAgentID = ref<string>('');

/* ========================
 * Member (fuzzy)
 * ======================== */
const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);
const sMemberID = ref('');

/** 後續只更新 options / loading */
const updateMemberOptions = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'memberID',
    componentProps: {
      options: memberOptions.value,
      loading: memberLoading.value,
    },
  }]);
};

const onMemberSearch = debounce(async (text: string) => {
  if (!text || text.length < 2) {
    return;
  }

  const form = tableInstance.getSearchFormRef();
  const agentID = form?.getFieldsValue()?.agentID;
  if (!agentID) {
    message.error('請先選擇代理');
    return;
  }

  memberLoading.value = true;
  await updateMemberOptions();

  try {
    const res = await fuzzyQueryUser({
      masterAgent: selectedMasterAgent.value,
      agentID,
      queryText: text,
      limit: 10,
    });
    memberOptions.value = (res || []).map((i: any) => ({
      label: `${i.accountID} - ${i.nickName}`,
      value: `${i.account}@${i.agentID}`,
    }));
  }
  finally {
    memberLoading.value = false;
    await updateMemberOptions();
  }
}, 300);

/** 更新 memberID 和 memberIDstr 的互斥禁用狀態 */
const updateMemberFieldsDisabled = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  if (!formRef) {
    return;
  }

  const values = formRef.getFieldsValue();
  const hasMemberID = !!sMemberID.value || !!values.memberID;
  const hasMemberIDstr = !!values.memberIDstr;

  // 更新 memberID 的禁用狀態
  formRef.updateSchema([{
    field: 'memberID',
    componentProps: {
      disabled: hasMemberIDstr,
    },
  }]);

  // 更新 memberIDstr 的禁用狀態
  formRef.updateSchema([{
    field: 'memberIDstr',
    componentProps: {
      disabled: hasMemberID || !values.agentID,
    },
  }]);
};

/* ========================
 * Currency Type List
 * ======================== */
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);
const masterAgentCurrencyTypeMap = ref(new Map<string, string>());
const masterAgentList = ref<any[]>([]);

const loadCurrencyTypeList = async () => {
  const masterAgent = selectedMasterAgent.value;
  currencyTypeList.value = [];
  masterAgentCurrencyTypeMap.value.clear();

  if (!masterAgent) {
    return;
  }

  // 如果用戶等級是 4，使用 userStore.currencies
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({
        name: item.currencyName,
        value: item.currencyCode,
      });
      masterAgentCurrencyTypeMap.value.set(item.currencyCode, item.currencyName);
    });
  }
  else {
    // 從 masterAgentList 中獲取幣別
    if (masterAgentList.value.length === 0) {
      masterAgentList.value = await getMasterAgentList() || [];
    }

    const masterAgentData = masterAgentList.value.find((ma: any) => ma.account === masterAgent);
    if (masterAgentData && masterAgentData.currencies && Array.isArray(masterAgentData.currencies)) {
      masterAgentData.currencies.forEach((currencyItem: any) => {
        if (currencyItem && typeof currencyItem === 'object' && currencyItem.currencyCode) {
          currencyTypeList.value.push({
            name: currencyItem.currencyName || currencyItem.currencyCode,
            value: currencyItem.currencyCode,
          });
          masterAgentCurrencyTypeMap.value.set(
            currencyItem.currencyCode,
            currencyItem.currencyName || currencyItem.currencyCode,
          );
        }
      });
    }
  }

  // 更新幣別選項
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'currency',
    label: t('labels.currencyType') || '幣別',
    componentProps: {
      options: currencyTypeList.value.map(item => ({
        label: item.name,
        value: item.value,
      })),
      placeholder: '請選擇幣別',
    },
  }]);

  // 如果有幣別列表，自動選擇第一個
  if (currencyTypeList.value.length > 0) {
    formRef?.setFieldsValue({
      currency: currencyTypeList.value[0].value,
    });
  }
};

/* ========================
 * Agent Selector
 * ======================== */
const agentRawList = ref<any[]>([]);

const loadAgents = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    return;
  }

  agentRawList.value = await getAgentListByMasterAgent({ masterAgent }) || [];

  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'agentID',
    componentProps: {
      options: agentRawList.value.map((i: any) => ({
        label: i.account.includes('.') ? i.account.split('.')[0] : i.account,
        value: i.account,
      })),
      disabled: userStore.level >= 5,
      onChange: async (val: string) => {
        currentAgentID.value = val || '';
        await updateMemberFieldsDisabled();
      },
    },
  }]);

  if (agentRawList.value.length) {
    const formRef = tableInstance.getSearchFormRef();
    const firstAgentID = agentRawList.value[0].account;
    formRef?.setFieldsValue({
      agentID: firstAgentID,
    });
    currentAgentID.value = firstAgentID;
    // 更新 memberIDstr 的禁用狀態（需要代理才能輸入）
    await updateMemberFieldsDisabled();
  }
};

/** 初始化一次 member schema（只註冊 handler） */
const initMemberSchema = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'memberID',
    component: 'Select',
    componentProps: {
      showSearch: true,
      filterOption: false,
      allowClear: true,
      options: [],
      loading: false,
      placeholder: '請選擇或輸入會員',
      disabled: false,
      onSearch: onMemberSearch,
      onChange: async (val: string) => {
        sMemberID.value = val || '';
        // 當選擇 memberID 時，清空 memberIDstr
        if (val) {
          const formRef = tableInstance.getSearchFormRef();
          formRef?.setFieldsValue({ memberIDstr: undefined });
        }
        await updateMemberFieldsDisabled();
      },
    },
  }]);

  // 初始化 memberIDstr 的 onChange 和 i18n
  formRef?.updateSchema([{
    field: 'memberIDstr',
    label: t('labels.memberID') || '帳號',
    componentProps: {
      placeholder: t('notify.memberIDstr') || '帳號只可輸入英數字',
      onChange: async (val: string) => {
        // 當輸入 memberIDstr 時，清空 memberID
        if (val) {
          sMemberID.value = '';
          const formRef = tableInstance.getSearchFormRef();
          formRef?.setFieldsValue({ memberID: undefined });
        }
        await updateMemberFieldsDisabled();
      },
    },
  }]);
};

/* ========================
 * 初始化搜尋預設值（Vue2 行為）
 * ======================== */
onMounted(async () => {
  await loadGameSourceList();
  await loadWebsiteList(); // 載入網站列表（當 authLevel <= 2 時）
  await updateTypeOptions();
  await loadCurrencyTypeList();
  await loadAgents();
  await initMemberSchema();
  await updateMemberFieldsDisabled();

  // 初始化子選項為禁用狀態
  await updateSubOptions();

  const start = dayjs().subtract(30, 'day').startOf('day');
  const end = dayjs().endOf('day');

  // 這裡只做「注入」，不觸發查詢
  const searchFormRef = tableInstance.getSearchFormRef();
  searchFormRef?.setFieldsValue({
    dateRange: [start, end],
  });

  // ARCH05：於 mounted + nextTick 後計算並設定 scroll.y
  // 確保 DynamicTable 已 render，layout 已穩定後再啟用 fixed header
  calculateScrollY();
});

/* ========================
 * Watch contextVersion
 * ======================== */
watch(contextVersion, async () => {
  await loadGameSourceList();
  await loadWebsiteList(); // 載入網站列表（當 authLevel <= 2 時）
  await updateTypeOptions();
  await updateSubOptions();
  await loadCurrencyTypeList();
  await loadAgents();
  // 清空會員選擇
  sMemberID.value = '';
  currentAgentID.value = '';
  const formRef = tableInstance.getSearchFormRef();
  formRef?.setFieldsValue({
    memberID: undefined,
    memberIDstr: undefined,
  });
  await updateMemberFieldsDisabled();
});

/* ========================
 * Watch agentID - 當代理變更時檢查並清空會員選擇
 * ======================== */
watch(
  () => currentAgentID.value,
  async (newAgentID, oldAgentID) => {
    if (!newAgentID) {
      // 代理被清空時，清空所有會員相關欄位
      sMemberID.value = '';
      const formRef = tableInstance.getSearchFormRef();
      formRef?.setFieldsValue({
        memberID: undefined,
        memberIDstr: undefined,
      });
      await updateMemberFieldsDisabled();
      return;
    }

    // 如果代理變更了，檢查選擇的會員是否屬於新代理
    if (oldAgentID && sMemberID.value) {
      const checkData = sMemberID.value.split('@');
      if (checkData.length === 2 && checkData[1] !== newAgentID) {
        // 會員不屬於新代理，清空會員選擇
        sMemberID.value = '';
        const formRef = tableInstance.getSearchFormRef();
        formRef?.setFieldsValue({
          memberID: undefined,
          memberIDstr: undefined,
        });
      }
    }

    // 更新禁用狀態
    await updateMemberFieldsDisabled();
  },
);

/**
 * ========================
 * Data Request
 * ========================
 */
const loadTableData = async (params: any) => {
  console.log('[CashRecord] loadTableData called with params:', params);
  /**
   * 🔹 memberID 組合（Vue2 行為）
   * 優先使用模糊搜尋的 memberID，否則使用組合邏輯
   */
  let memberID = sMemberID.value || params.memberID;
  if (!memberID) {
    const { memberIDstr, agentID } = params;
    if (memberIDstr && agentID) {
      memberID = `${memberIDstr}@${agentID}`;
    }
  }

  const {
    agentID,
    currency,
    dateRange,
    remitno,
    type,
    subType,
    source,
    sourceStatus,
  } = params;

  console.log('[CashRecord] Required fields check:', { agentID, currency, dateRange });

  // 必填條件不足 → 不查
  if (!agentID || !currency || !dateRange?.length) {
    console.warn('[CashRecord] Missing required fields, skipping API call');
    return { items: [], meta: { totalItems: 0 } };
  }

  const [start, end] = dateRange;

  // 確保日期值正確轉換為 Date 物件
  // dateRange 可能是 dayjs 物件、Date 物件或字串
  const startDate = dayjs(start).toDate();
  const endDate = dayjs(end).toDate();

  const postData: any = {
    agentID,
    currency,
    date: [startDate, endDate],
    page: 1,
    limit: 999999,
  };

  // 移除空參數，避免傳送沒有意義的過濾條件
  if (remitno?.toString().trim()) {
    postData.remitno = remitno;
  }
  if (type !== undefined && type !== null && type !== '') {
    postData.type = type;
  }
  if (subType !== undefined && subType !== null && subType !== '') {
    postData.subType = subType;
  }
  if (source !== undefined && source !== null && source !== '') {
    // 如果 source 是 gameName，轉換為 gameID（與 vue2 的 getGameID 邏輯一致）
    if (gameIDMap.value.has(source)) {
      postData.source = gameIDMap.value.get(source);
    }
    else {
      // 如果找不到映射，直接使用原值（可能是 gameID 或網站名稱）
      postData.source = source;
    }
  }
  if (sourceStatus !== undefined && sourceStatus !== null && sourceStatus !== '') {
    postData.sourceStatus = sourceStatus;
  }
  if (memberID) {
    postData.memberID = memberID;
  }

  try {
    console.log('[CashRecord] Calling queryCashRecord API with postData:', postData);
    const res = await queryCashRecord(postData);
    console.log('[CashRecord] queryCashRecord API response:', res);
    console.log('[CashRecord] res.data:', res?.data);
    console.log('[CashRecord] res.data?.items:', res?.data?.items);

    // 處理不同的 API 返回格式
    // 格式1: { data: { items: [...], total: ... } } (標準格式)
    // 格式2: { items: [...], total: ... } (可能被包裝器處理過)
    const resAny = res as any;
    const rawItems = res?.data?.items || resAny?.items || [];
    const total = res?.data?.total ?? resAny?.total ?? rawItems.length;

    console.log('[CashRecord] Extracted rawItems:', rawItems);
    console.log('[CashRecord] Extracted total:', total);

    /**
     * ARCH-02：批次補齊會員基本資料（accountID / nickName）
     */
    const masterAgent = selectedMasterAgent.value;
    const accounts = Array.from(
      new Set(
        rawItems
          .map((i: any) => String(i.memberID || '').split('@')[0])
          .filter(Boolean),
      ),
    );

    let accountInfoMap: Record<string, { id?: string; nickName?: string }> = {};
    let accountOnlyMap: Record<string, { id?: string; nickName?: string }> = {};
    if (accounts.length && masterAgent) {
      try {
        const baseRes = await queryAccountBaseInfo({ masterAgent, accounts });
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
        console.warn('[CashRecord] Failed to fetch member base info', error);
      }
    }

    /**
     * 🔹 補齊顯示用欄位（Vue2 行為）
     */
    const items = rawItems.map((r: any) => {
      const memberIDKey = String(r.memberID || '');
      const accountKey = memberIDKey.split('@')[0];
      const baseInfo = accountInfoMap[memberIDKey] || accountOnlyMap[accountKey] || {};

      return {
        ...r,
        balanceChange:
          r.withdrawal > 0
            ? Number(r.deposit) - Number(r.withdrawal)
            : Number(r.deposit),
        noteTranslated: r.note || '',
        accountID: baseInfo.id || '',
        nickName: baseInfo.nickName || '',
      };
    });

    const result = {
      items,
      meta: { totalItems: total },
    };
    console.log('[CashRecord] Returning data to DynamicTable:', result);
    console.log('[CashRecord] Items count:', items.length);
    return result;
  }
  catch {
    message.error(t('notify.connectionError'));
    return { items: [], meta: { totalItems: 0 } };
  }
};

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
</script>

<template>
  <div class="cash-record-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="remitno"
        :columns="columns"
        :data-request="loadTableData"
        :pagination="false"
        :scroll="tableScroll"
      >
        <!-- SearchMode 狀態顯示（僅標示，不影響任何行為） -->
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>
