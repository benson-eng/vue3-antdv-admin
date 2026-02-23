// ARCH03-01：搜尋模型已由 Vue2 升級為 Vue3
<script setup lang="ts">
import type {
  IExternalGameRecordColumn,
  IQueryExternalGameRecordParams,
} from '@/api/backend/adminSystem/gameRecordServer';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import {
  queryExternalGameRecords,
} from '@/api/backend/adminSystem/gameRecordServer';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { request } from '@/utils/request';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useExternalGameRecordsColumns } from './columns';
import { createExternalGameRecordsFormSchemas } from './formSchemas';

defineOptions({
  name: 'ExternalGameRecordsTable',
});

const { t } = useI18n('page.externalGameRecords');
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

// 從 Breadcrumb Context 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（來自 Breadcrumb）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');

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

function formatAmount2(
  val: number | string | null | undefined,
  showDecimal: boolean = true,
): string {
  if (val == null || val === '') {
    return '';
  }

  let strVal = typeof val === 'string' ? val : String(val);
  let hadPercent = false;

  if (strVal.includes('%')) {
    hadPercent = true;
    strVal = strVal.replace(/%/g, '');
  }

  const num = Number.parseFloat(strVal);
  if (Number.isNaN(num)) {
    return '';
  }

  let formatted: string;
  if (showDecimal) {
    const [intPart, decimalRaw = ''] = String(num).split('.');
    const decimalPart = decimalRaw.padEnd(2, '0').slice(0, 2);
    const combined = `${intPart}.${decimalPart}`;
    formatted = Number(combined).toLocaleString('zh-TW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  else {
    formatted = Math.trunc(num).toLocaleString('zh-TW');
  }

  return hadPercent ? `${formatted}%` : formatted;
}

// ARCH03-01：已移除 query/appliedQuery 雙狀態模型
// 搜尋狀態現在完全由 DynamicTable formSchemas 管理

// ============ 會員搜尋（參照 cashRecord-table：動態將 Input 改為 Select with remote search）============
const memberOptions = ref<Array<{ label: string; value: string }>>([]);
const memberLoading = ref(false);
const sMemberID = ref('');

// ============ 代理商選擇器 ============
// 注意：站長選擇器已遷移至 Breadcrumb，本頁僅作為 Consumer

const agentList = ref<Array<{ label: string; value: string }>>([]);
const selectedAgent = ref<string>('');
const isAgentDisabled = computed(() => userStore.level >= 5);
// 代理商欄位顯示條件：權限等級 < 4 時顯示（對齊 Vue2 行為）
const showAgentField = computed(() => userStore.level < 4);

// ============ 平台列表 ============
const supportPlatforms = ref<Array<{ name: string; value: string }>>([]);

// ============ 遊戲列表 ============
const gameList = ref<Record<string, string>>({});
const gameOptions = ref<Array<{ label: string; value: string }>>([]);

// ============ 幣別列表 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);

/**
 * ARCH03-01：事件處理函數（參照 cashRecord-table：在 updateSchema 的 onChange 中處理）
 */
let onExternalPlatformChanged = () => {
  // 暫時為空函數，將在 useTable 之後重新定義
};

// ARCH03-01：formSchemas 初始化與更新（在 useTable 之前定義）
// 參照 cashRecord-table：formSchemas 為靜態定義，動態值通過 updateSchema 更新
const formSchemas = computed(() => {
  return createExternalGameRecordsFormSchemas({
    t,
    isAgentDisabled,
    showAgentField, // 代理商欄位顯示條件
    onExternalPlatformChanged,
  });
});

// ARCH03-01：搜尋主控權已轉移至 DynamicTable
// ============ 表格 ============
// ⚠️ 關鍵修正：formSchemas 必須在 useTable 的 formProps 中傳入，而不是在 template 中通過 prop 傳入
// 參照 gachaponGameRecord-table：在 useTable 的 formProps 中直接傳入 schemas
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true, // 啟用 DynamicTable 搜尋主控
  immediate: false, // 🔒 不自動查（對齊 cashRecord-table 行為）
  formProps: {
    schemas: formSchemas.value, // 使用 .value 解包 computed
  },
});

/**
 * ============ 會員搜尋函數（必須在 useTable 之後定義）============
 */
/** 更新會員選項 */
const updateMemberOptions = async () => {
  await nextTick();
  const formRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (!formRef) {
    return;
  }
  formRef.updateSchema([{
    field: 'memberID',
    componentProps: {
      options: memberOptions.value,
      loading: memberLoading.value,
    },
  }]);
};

const onMemberSearch = debounce(async (text: string) => {
  if (!text || text.length < 2) {
    memberOptions.value = [];
    await updateMemberOptions();
    return;
  }

  const form = (dynamicTableInstance as any)?.getSearchFormRef?.();
  const agentID = form?.getFieldsValue()?.agentID;
  if (!agentID) {
    message.error('請先選擇代理');
    return;
  }

  memberLoading.value = true;
  await updateMemberOptions();

  try {
    const masterAgent = getMasterAgentByAgentID(agentID);
    const res = await fuzzyQueryUser({
      masterAgent,
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

/** 初始化會員 schema（將 Input 改為 Select with remote search） */
const initMemberSchema = async () => {
  await nextTick();
  const formRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (!formRef) {
    return;
  }
  formRef.updateSchema([{
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
      },
    },
  }]);
};

/**
 * ============ formSchemas 更新函數（必須在 useTable 之後定義）============
 */
/**
 * 更新平台和遊戲選項（參照 cashRecord-table：使用 updateSchema 更新）
 */
const updatePlatformAndGameOptions = async () => {
  await nextTick();
  const formRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (!formRef) {
    console.warn('[ExternalGameRecords] formRef not available, skipping updatePlatformAndGameOptions');
    return;
  }

  // 更新平台選項（需要轉換格式：{ name, value } -> { label, value }）
  const platformOptions = supportPlatforms.value.map(p => ({
    label: p.name,
    value: p.value,
  }));

  console.log('[ExternalGameRecords] Updating platform options:', platformOptions.length, 'items:', platformOptions);
  console.log('[ExternalGameRecords] supportPlatforms.value:', supportPlatforms.value);

  formRef.updateSchema([{
    field: 'externalPlatform',
    componentProps: {
      options: platformOptions,
    },
  }]);

  // 更新遊戲選項
  console.log('[ExternalGameRecords] Updating game options:', gameOptions.value.length, 'items');
  formRef.updateSchema([{
    field: 'gameID',
    componentProps: {
      options: gameOptions.value,
    },
  }]);
};

/**
 * 載入代理商列表（參照 cashRecord-table：使用 updateSchema 更新代理選項）
 */
const loadAgents = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    return;
  }

  try {
    const list = await getAgentListByMasterAgent({ masterAgent });
    agentList.value = (list || []).map(item => ({
      label: item.account.includes('.') ? item.account.split('.')[0] : item.account,
      value: item.account,
    }));

    // 參照 cashRecord-table：使用 updateSchema 更新代理選項
    await nextTick();
    const formRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
    if (formRef) {
      formRef.updateSchema([{
        field: 'agentID',
        componentProps: {
          options: agentList.value,
          disabled: isAgentDisabled.value,
          onChange: async (val: string) => {
            selectedAgent.value = val || '';
          },
        },
      }]);

      // 如果有代理商列表，自動選擇第一個（參照 cashRecord-table）
      if (agentList.value.length > 0 && !isAgentDisabled.value) {
        const firstAgentID = agentList.value[0].value;
        formRef.setFieldsValue({
          agentID: firstAgentID,
        });
        selectedAgent.value = firstAgentID;
      }
    }
  }
  catch (error) {
    console.error('Failed to load agent list:', error);
    agentList.value = [];
  }
};
// ARCH03-02：Table Behavior 已抽離至 columns.tsx
// 使用 columns.tsx 提供的 columns 和 tableConfig
const { columns, tableConfig } = useExternalGameRecordsColumns({
  t,
  formatAmount2,
  gameList,
  currencyTypeList,
});

// ARCH03-02：欄位顯示同步機制（需要 dynamicTableInstance，因此保留在 index.vue）
// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
// Guard: 初始化階段不得反向覆寫 visibleColumnKeys
// 參考：src/views/adminAccount/agent/index.vue
let isInitialized = false;
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

    // 初始化階段：確保 visibleColumnKeys 已正確初始化（包含所有 STEP 3 定型欄位）
    // STEP 3 定型欄位：wagersID, externalPlatform, memberID, accountID, nickName, gameID, currencyType, betType, totalBet, totalWin, winLose, buyFeature, playDateTime
    // 共 13 個欄位
    if (!isInitialized) {
      const currentKeys = tableConfig.visibleColumnKeys.value;
      // 檢查 visibleColumnKeys 是否已正確初始化（應包含所有定型欄位，至少 13 個）
      const expectedMinKeys = 13;
      if (Array.isArray(currentKeys) && currentKeys.length >= expectedMinKeys) {
        // 確保 dynamicTableInstance 已準備好，且 columns 已正確設置
        // 通過檢查 newColumns 是否包含所有預期的欄位來判斷初始化是否完成
        const newColumnKeys = newColumns
          .map((col: any) => {
            const key = (col.dataIndex as string) || (col.key as string) || '';
            return key;
          })
          .filter(Boolean);

        // 如果 newColumns 包含所有 currentKeys，且數量匹配，則認為初始化完成
        // 這表示 columns 已經正確設置，且與 visibleColumnKeys 同步
        const hasAllKeys = currentKeys.every(key => newColumnKeys.includes(key));
        if (hasAllKeys && newColumnKeys.length >= expectedMinKeys) {
          isInitialized = true;
        }
        else {
          return; // 尚未初始化完成，不進行同步
        }
      }
      else {
        return; // 尚未初始化完成，不進行同步
      }
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    // 僅在初始化完成後，且為使用者操作（column setting）時才同步
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

/**
 * ARCH05：scroll.y 穩定化（類型 B：有搜尋區頁面）
 * - 使用 auto-height 自動計算 scroll.y，讓 DynamicTable 內部處理高度計算
 * - 只傳入 scroll.x，不傳入 scroll.y，讓 useScroll 根據 autoHeight 自動計算 scroll.y
 * - useScroll 會在 autoHeight 啟用時自動計算並設置 scroll.y
 */
const tableScroll = computed(() => {
  return {
    x: tableConfig.scrollX.value,
    // 不傳入 y，讓 useScroll 根據 autoHeight: true 自動計算
  };
});

/**
 * ARCH03-01：loadTableData 現在直接使用 DynamicTable 傳入的 params（對齊 cashRecord-table）
 */
const loadTableData = async (_params: LoadDataParams & Record<string, any>) => {
  // 直接使用 DynamicTable 傳入的參數（對齊 cashRecord-table 做法）
  const {
    agentID,
    memberID,
    gameID,
    externalPlatform,
    currencyType,
    date,
    page, // DynamicTable 可能傳入 page
    current, // DynamicTable 可能使用 current 作為頁碼
    pageSize, // DynamicTable 傳入的每頁筆數
    limit, // 可能直接傳入 limit
  } = _params;

  if (!agentID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 檢查 agentID 中的 masterAgent 是否與當前 Breadcrumb Context 的站長一致
  const queryMasterAgent = getMasterAgentByAgentID(agentID);
  const currentMasterAgent = selectedMasterAgent.value;
  if (currentMasterAgent && queryMasterAgent && queryMasterAgent !== currentMasterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 對齊 Vue2：page 和 limit 是必填參數
  // Vue2 預設：page: 1, limit: 1000
  // DynamicTable 可能使用 current 作為頁碼，pageSize 作為每頁筆數
  const postData: IQueryExternalGameRecordParams = {
    agentID,
    page: page || current || 1, // 優先使用 page，否則使用 current，最後預設為 1
    limit: limit || pageSize || 1000, // 優先使用 limit，否則使用 pageSize，最後預設為 1000（對齊 Vue2）
  };

  if (memberID) {
    postData.memberID = memberID;
  }

  if (gameID) {
    postData.gameID = gameID;
  }

  if (externalPlatform) {
    postData.externalPlatform = externalPlatform;
  }

  if (currencyType) {
    postData.currencyType = currencyType;
  }

  // 處理日期範圍
  if (date && Array.isArray(date) && date.length === 2) {
    const [startDate, endDate] = date;
    if (startDate && endDate) {
      const start = dayjs.isDayjs(startDate) ? startDate : dayjs(startDate);
      const end = dayjs.isDayjs(endDate) ? endDate : dayjs(endDate);
      postData.date = [start.toDate(), end.toDate()];
    }
  }

  try {
    const res = await queryExternalGameRecords(postData);
    const resData = res as any;

    let items: IExternalGameRecordColumn[] = [];
    let total = 0;

    if (resData?.data?.items && Array.isArray(resData.data.items)) {
      items = resData.data.items;
      total = resData.data.total || resData.data.items.length;
    }
    else if (Array.isArray(resData?.items)) {
      items = resData.items;
      total = resData.count || resData.items.length;
    }
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }
    else if (Array.isArray(resData?.data)) {
      items = resData.data;
      total = resData.data.length;
    }
    else {
      items = [];
      total = 0;
    }

    // 處理 buyFeature
    items.forEach((item: any) => {
      item.buyFeature = '';
      if (item.note && item.note.buyFeature) {
        item.buyFeature = item.note.buyFeature;
      }
    });

    /**
     * ARCH-02 STEP B: 資料合併（批量優先、精準為主）
     * 使用 queryAccountBaseInfo 批量查詢會員基本資料
     */
    const masterAgentForQuery = getMasterAgentByAgentID(agentID);
    const accounts = Array.from(
      new Set(
        items
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

        // 建立完整匹配 mapping（key = account@agentID）
        accountInfoMap = baseList.reduce((acc, cur) => {
          const key = `${cur.account}@${cur.agentID}`;
          acc[key] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);

        // 建立 account only mapping（fallback）
        accountOnlyMap = baseList.reduce((acc, cur) => {
          acc[cur.account] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);
      }
      catch (error) {
        // 會員基本資料查詢失敗不影響主列表，只記錄警告
        console.warn('[ExternalGameRecords] Failed to fetch member base info', error);
      }
    }

    /**
     * ARCH-02 STEP A: 補齊顯示用欄位
     */
    const mergedItems = items.map((r: any) => {
      const memberIDKey = String(r.memberID || '');
      const accountKey = memberIDKey.split('@')[0];
      const baseInfo = accountInfoMap[memberIDKey] || accountOnlyMap[accountKey] || {};

      return {
        ...r,
        accountID: baseInfo.id || '',
        nickName: baseInfo.nickName || '',
      };
    });

    return {
      items: mergedItems,
      meta: {
        totalItems: total,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.searchFinish') || '查詢完成');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * ============ API 調用 ============
 */
const setCurrencyTypeList = async (masterAgent: string): Promise<void> => {
  currencyTypeList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  else {
    // 從 masterAgentOptions 取得站長資料（來自 Breadcrumb Context）
    const masterAgentOption = masterAgentCtx?.masterAgentOptions.value.find(ma => ma.value === masterAgent);
    if (masterAgentOption) {
      // 如果需要取得站長的幣別資訊，需要透過 API 或其他方式
      // 這裡暫時保留原有邏輯，但不再使用 masterAgentList
      // 注意：如果幣別資訊需要從站長資料取得，可能需要額外的 API 調用
    }
  }
};

const getSupportPlatforms = async (masterAgent: string) => {
  try {
    // 獲取遊戲列表
    const gameListRes = await request({
      url: '/AdminSystem/api/action/gameList',
      method: 'post',
      data: {
        server: 'gameManager',
        actionName: 'gameList',
        query: JSON.stringify({ masterAgent, includeExternalGame: true }),
      },
    });

    // 獲取等級額外設定（對齊 Vue2 API 調用方式）
    const extraSettingRes = await request({
      url: '/AdminSystem/api/action/levelExtraSetting',
      method: 'post',
      data: {
        server: 'levelServer',
        actionName: 'levelExtraSetting/listByMasterAgent',
        query: JSON.stringify({ masterAgent }),
      },
    });
    console.log('gameListRes', gameListRes);
    console.log('extraSettingRes', extraSettingRes);
    const gameListData = (gameListRes as any) || [];
    const extraSettings = (extraSettingRes as any) || [];

    const filtersPlatformOption: Array<{ name: string; value: string }> = [];

    // 方法1：從 extraSettings 中提取平台（對齊 Vue2 邏輯）
    extraSettings.forEach((item: any) => {
      const findIndex = gameListData.findIndex((fv: any) => fv.gameID === item.gameID);
      if (findIndex !== -1 && gameListData[findIndex] !== undefined) {
        const platformData = gameListData[findIndex].extraInfo?.platform;
        const existingItem = filtersPlatformOption.find(p => p.value === platformData);
        if (!existingItem && platformData) {
          filtersPlatformOption.push({ name: platformData, value: platformData });
        }
      }
    });

    // 方法2：如果 extraSettings 為空或沒有找到平台，直接從 gameListData 中提取所有有 platform 的遊戲（備用方案）
    if (filtersPlatformOption.length === 0) {
      gameListData.forEach((game: any) => {
        const platformData = game.extraInfo?.platform;
        if (platformData) {
          const existingItem = filtersPlatformOption.find(p => p.value === platformData);
          if (!existingItem) {
            filtersPlatformOption.push({ name: platformData, value: platformData });
          }
        }
      });
    }

    supportPlatforms.value = filtersPlatformOption;

    // 更新遊戲列表（清空舊資料後重新填充）
    gameList.value = {};
    gameOptions.value = [];
    gameListData.forEach((game: any) => {
      if (game.gameID) {
        // 優先使用 language.tw，否則使用 gameName 或 content
        let displayName = game.gameName || game.content || '';
        if (game.language && game.language.tw) {
          displayName = game.language.tw;
        }

        if (displayName) {
          gameList.value[game.gameID] = displayName;
          gameOptions.value.push({
            label: `${game.gameID} - ${displayName}`,
            value: game.gameID,
          });
        }
      }
    });

    // 參照 cashRecord-table：使用 updateSchema 更新平台和遊戲選項
    // 確保 dynamicTableInstance 已準備好後再更新
    await nextTick();
    await updatePlatformAndGameOptions();
  }
  catch (error) {
    console.error('Failed to get support platforms:', error);
    // 即使出錯也要確保清空選項
    supportPlatforms.value = [];
    gameOptions.value = [];
    await nextTick();
    await updatePlatformAndGameOptions();
  }
};

// fetchMasterAgentList 已移除：站長列表現在由 Breadcrumb Context 提供

// 參照 cashRecord-table：會員欄位為 Input，不需要動態更新選項

/**
 * 更新遊戲選項 schema（當平台變更時）
 */
const updateGameOptionsSchema = async () => {
  await nextTick();
  const formRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (!formRef) {
    return;
  }

  formRef.updateSchema([{
    field: 'gameID',
    componentProps: {
      options: gameOptions.value,
    },
  }]);
};

/**
 * ============ 事件處理 ============
 */
// 參照 cashRecord-table：代理商變更處理在 loadAgents 的 updateSchema onChange 中處理

/**
 * ARCH03-01：平台變更處理，現在由 DynamicTable formSchemas 管理狀態
 * 注意：此函數在 formSchemas 初始化時已定義為空函數，此處重新定義實際邏輯
 */
onExternalPlatformChanged = () => {
  gameOptions.value = [];
  gameList.value = {};
  const currentMasterAgent = selectedMasterAgent.value;
  if (currentMasterAgent) {
    getSupportPlatforms(currentMasterAgent);
  }

  // ARCH03-01：清空遊戲選擇（由 DynamicTable formSchemas 管理）
  nextTick(() => {
    const formValues = (dynamicTableInstance as any)?.getFormValues?.() || {};
    (dynamicTableInstance as any)?.setFormValues?.({
      ...formValues,
      gameID: undefined,
    });
    // 更新遊戲選項 schema
    updateGameOptionsSchema();
  });
};

// ARCH03-01：已移除 handleFilter 和 onDateChanged
// 查詢和重置行為現在完全由 DynamicTable 管理

// ARCH03-01：Context 行為（受控型頁面）
// 當站長切換時，重置 DynamicTable 搜尋條件，但不自動觸發 reload
// 用戶需手動點擊查詢按鈕才會觸發查詢
let lastMasterAgent = selectedMasterAgent.value;
watch(
  () => selectedMasterAgent.value,
  async (newMasterAgent) => {
    // 檢查站長是否真的切換了
    if (newMasterAgent && newMasterAgent !== lastMasterAgent) {
      // 清空相關狀態
      selectedAgent.value = '';
      agentList.value = [];
      gameOptions.value = [];
      gameList.value = {};
      supportPlatforms.value = [];
      currencyTypeList.value = [];

      // 重新載入代理商列表和平台列表（參照 cashRecord-table：使用 loadAgents 和 updateSchema）
      await setCurrencyTypeList(newMasterAgent);
      // 只在站長切換時調用 getSupportPlatforms（對齊 Vue2 行為）
      await getSupportPlatforms(newMasterAgent);
      // 載入代理商列表（會自動更新代理選項）
      await loadAgents();
      // 更新平台和遊戲選項
      await updatePlatformAndGameOptions();

      // 重置 DynamicTable 搜尋表單（受控型：不自動觸發查詢）
      (dynamicTableInstance as any)?.reset?.();

      // 更新最後的站長值
      lastMasterAgent = newMasterAgent;
    }
    else if (!newMasterAgent) {
      // 站長被清空時也清空狀態
      lastMasterAgent = '';
      // 重置表單（受控型：不自動觸發查詢）
      (dynamicTableInstance as any)?.reset?.();
    }
  },
);

// 注意：formSchemas 已在 useTable 之前定義，此處不再重複定義

// 參照 cashRecord-table：不監聽狀態變化自動更新，改為在特定時機（站長切換、代理載入等）手動更新

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - agentID / memberID / gameID / externalPlatform / currencyType / date：查詢條件，直接傳遞給後端 API
 * - 所有查詢條件都通過 queryExternalGameRecords API 發送到後端
 * - 沒有前端過濾邏輯
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 所有查詢條件都直接傳遞給後端 API，沒有前端過濾
  // 因此無論是否有查詢條件，都顯示為 BACKEND
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

// ============ 初始化 ============
// ARCH03-01：初始化邏輯更新，使用 DynamicTable formSchemas
onMounted(async () => {
  // 初始化 lastMasterAgent（來自 Breadcrumb Context）
  lastMasterAgent = selectedMasterAgent.value;

  // 如果有站長值（來自 Breadcrumb），初始化相關資料
  const currentMasterAgent = selectedMasterAgent.value;
  if (currentMasterAgent) {
    await setCurrencyTypeList(currentMasterAgent);
    // 載入平台和遊戲列表（對齊 Vue2 行為：在 onMasterAgentChanged 中調用）
    await getSupportPlatforms(currentMasterAgent);
    // 載入代理商列表（會自動更新代理選項並設置初始值）
    await loadAgents();
    // 初始化會員 schema（將 Input 改為 Select with remote search）
    await initMemberSchema();
  }

  // ARCH05：類型 B：有搜尋區頁面 - 在 mounted + nextTick 後再補上 scroll.y
  // 使用雙重 nextTick 確保 DOM 完全渲染完成，然後啟用 autoHeight 計算 scroll.y
  await nextTick();
  await nextTick();
  // 額外延遲一小段時間，確保容器高度計算完成
  setTimeout(() => {
    // 啟用 autoHeight，讓 DynamicTable 自動計算 scroll.y
    // 由於我們已經在模板中設置了 :auto-height="true"，這裡只需要確保時機正確
  }, 100);
});
</script>

<!-- ARCH03-01：搜尋 UI 已完全由 DynamicTable formSchemas 接管 -->
<template>
  <div class="app-container external-game-records-table">
    <div class="table-container">
      <!-- ⚠️ 注意：formSchemas 已在 useTable 的 formProps 中傳入，不需要在 template 中通過 prop 傳入 -->
      <DynamicTable
        :columns="columns"
        :data-request="loadTableData"
        :scroll="tableScroll"
        :auto-height="true"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('title') }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>
    </div>
  </div>
</template>

<style lang="less" scoped>
.external-game-records-table {
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
  }
}
</style>
