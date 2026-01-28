<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  CodeState,
  RedemptionRecord,
} from '@/api/backend/redemptionOrder';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import {
  CodeState as CodeStateEnum,
  queryRedemptionRecords,
  RewardType as RewardTypeEnum,
  validateRedemptionCode,
} from '@/api/backend/redemptionOrder';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'RedemptionCodeRecordTable',
});

// SearchMode 定義（僅用於狀態顯示）
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * ARCH03-01：搜尋模型已由 Vue2 升級為 Vue3
 *
 * 本頁已從 Vue2 page-owned search logic 升級為 Vue3 DynamicTable formSchemas 主控：
 * - 移除 query / appliedQuery 雙狀態模型，改用單一搜尋 state（由 DynamicTable formSchemas 主控）
 * - 搜尋主控權完全交由 DynamicTable formSchemas
 * - Context 切換時自動觸發 reload（不再保留「清空但不查」行為）
 * - 代理商選擇器保留在頁面層（依賴 Context 狀態），但搜尋欄位移至 formSchemas
 */

/**
 * ARCH05：DynamicTable Vertical Scroll / Fixed Header 穩定化
 *
 * 【頁型判斷結果】
 * - 類型 B｜有搜尋區頁面
 * - 判定依據：useTable({ search: true })
 * - 搜尋區為查詢入口，查詢由 Form submit 觸發 dataRequest
 *
 * 【修復策略】
 * - DynamicTable 必須於初始 render 時存在（確保搜尋區顯示）
 * - scroll.y 初始值為 undefined
 * - 於 mounted + nextTick 後再補上 scroll.y
 * - 使用 ref / computed 控制 scroll.y 的給值時機
 */

const { t } = useI18n('page.redemption.redemptionCodeRecordTable');
const userStore = useUserStore();

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

// ARCH03-01：移除 query / appliedQuery 雙狀態模型
// 搜尋狀態現在由 DynamicTable formSchemas 管理
// 保留 agentID 在頁面層（依賴 Context 和代理商選擇器）
const agentID = ref<string>('');

// ============ 從 Breadcrumb Context 取得站長選單狀態 ============
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
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
// ARCH03-01：保留 sNickname 用於顯示（從 memberID 解析）
const sNickname = ref('');

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!agentID.value) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    // 使用當前 Breadcrumb Context 的站長值
    const masterAgent = selectedMasterAgent.value || getMasterAgentByAgentID(agentID.value);
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: agentID.value,
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
}, 250);

// ARCH03-01：當 agentID 改變時，清空會員選項（不再清空 memberID，由 DynamicTable formSchemas 管理）
watch(
  () => agentID.value,
  () => {
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
  },
);

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

// ============ 代理商 ============
// POST-SOP v2：移除代理商搜尋欄位，但保留 agentList 和 agentID 用於會員搜尋邏輯
const agentList = ref<{ label: string; value: string }[]>([]);

// ============ 幣別、道具列表 ============
const currencyTypeList = ref<{ name: string; value: string }[]>([]);
const treasureItemList = ref<TreasureItem[]>([]);

// ============ 表格 ============
// ARCH03-01：啟用 DynamicTable 內建搜尋表單（Submit 才觸發）
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

type ColumnsRowData = RedemptionRecord & {
  id: string;
};

/**
 * ============ 工具函數（需要在 columns 定義前） ============
 */
const getCurrencyName = (currencyType?: string): string => {
  const found = currencyTypeList.value.find(c => c.value === currencyType);
  return found ? found.name : currencyType || 'unknown';
};

const getTreasureItemName = (itemID?: string): string => {
  const foundItem = treasureItemList.value.find(t => t.treasureItemID === itemID);
  if (!foundItem) {
    return 'unknown';
  }
  let itemName = foundItem.itemName;
  if (foundItem.bet !== undefined) {
    itemName += `-${foundItem.bet.toString()}`;
  }
  return itemName;
};

const formatRewards = (rewards: any[]): string[] => {
  const rewardStrings: string[] = [];
  rewards.forEach((item) => {
    switch (item.type) {
      case RewardTypeEnum.BALANCE:
        rewardStrings.push(`${getCurrencyName(item.currencyType)} : ${item.balance}`);
        break;
      case RewardTypeEnum.TREASURE_ITEM:
        rewardStrings.push(`${getTreasureItemName(item.treasureItemID)} : ${item.amount}`);
        break;
    }
  });
  return rewardStrings;
};

const formatOrderType = (type?: number): string => {
  if (type === 1) {
    return t('type.1') || '一碼一次';
  }
  if (type === 2) {
    return t('type.2') || '一碼多次';
  }
  return 'unknown';
};

const baseColumns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('tables.id') || 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('tables.nickname') || '暱稱',
    dataIndex: 'Nickname',
    /**
     * 彈性寬度欄位
     * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
     */
    flexible: true,
    minWidth: 200,
  },
  {
    title: t('tables.type') || '類別',
    dataIndex: 'type',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatOrderType(record.order?.type);
    },
  },
  {
    title: t('tables.orderName') || '兌換名稱',
    dataIndex: 'orderName',
    /**
     * 彈性寬度欄位
     * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
     */
    flexible: true,
    minWidth: 200,
  },
  {
    title: t('tables.rewards') || '兌換品項',
    dataIndex: 'rewards',
    /**
     * 彈性寬度欄位
     * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
     */
    flexible: true,
    minWidth: 300,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      if (record.rewards && Array.isArray(record.rewards)) {
        return record.rewards.join('、');
      }
      if (record.order?.rewards) {
        const rewardStrings = formatRewards(record.order.rewards);
        return rewardStrings.join('、');
      }
      return '-';
    },
  },
  {
    title: t('tables.redemptionCode') || '兌換碼',
    dataIndex: 'redemptionCode',
    width: 200,
  },
  {
    title: t('tables.redeemedTime') || '兌換時間',
    dataIndex: 'redeemedTime',
    /**
     * 彈性寬度欄位
     * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
     */
    flexible: true,
    minWidth: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.redeemedTime ? dayjs(record.redeemedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

/**
 * 使用表格配置 Hook
 * 注意：使用類型斷言，因為 TableColumn<ColumnsRowData> 與 TableColumnItem 在基本屬性上兼容
 */
const tableConfig = useTableConfig(baseColumns as any);

/**
 * 初始化標記，確保 visibleColumnKeys 已正確初始化
 */
const isTableConfigInitialized = ref(false);

/**
 * STEP 3 定型的欄位 keys
 * 正確的顯示順序：['id', 'Nickname', 'type', 'orderName', 'rewards', 'redemptionCode', 'redeemedTime']
 */
const expectedColumnKeys = ['id', 'Nickname', 'type', 'orderName', 'rewards', 'redemptionCode', 'redeemedTime'];

/**
 * 檢查 visibleColumnKeys 是否已正確初始化
 * 必須包含 STEP 3 定型的所有欄位 keys
 */
const checkInitialization = () => {
  const currentKeys = tableConfig.visibleColumnKeys.value;
  const hasAllExpectedKeys = expectedColumnKeys.every(key => currentKeys.includes(key));

  if (hasAllExpectedKeys && currentKeys.length >= expectedColumnKeys.length) {
    isTableConfigInitialized.value = true;
  }
};

// 初始檢查
nextTick(() => {
  checkInitialization();
});

/**
 * 監聽 visibleColumnKeys 變化，確保初始化完成
 * 避免初始化階段反向覆寫 visibleColumnKeys
 */
watch(
  () => tableConfig.visibleColumnKeys.value,
  () => {
    if (!isTableConfigInitialized.value) {
      checkInitialization();
    }
  },
  { immediate: true },
);

/**
 * 根據 visibleColumnKeys 設置欄位的 hideInTable
 * Guard：僅在 visibleColumnKeys 已初始化完成時才套用 hideInTable
 * 初始化階段維持全部顯示，確保與 STEP 3 定型結果一致
 * 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
 */
const columns = computed<TableColumn<ColumnsRowData>[]>(() => {
  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // Guard：如果 visibleColumnKeys 尚未初始化完成，不套用 hideInTable（維持全部顯示）
    if (!isTableConfigInitialized.value) {
      const processedCol: TableColumn<ColumnsRowData> = {
        ...col,
        hideInTable: false, // 初始化階段維持全部顯示
      };

      // 確保 flexible 欄位有 minWidth
      if (processedCol.flexible && !processedCol.minWidth) {
        processedCol.minWidth = 100; // 預設最小寬度 100px
      }

      // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
      // 這樣可以避免初始 render 時被壓縮為 0
      if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
        processedCol.width = processedCol.minWidth;
      }

      return processedCol;
    }

    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<ColumnsRowData> = {
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

/**
 * 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
 * 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
 * Guard：僅在初始化完成後才進行同步，避免初始化階段反向覆寫
 */
watch(
  () => {
    // 嘗試從 dynamicTableInstance 獲取實際的 columns 狀態
    const innerProps = (dynamicTableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    // Guard：僅在初始化完成後才進行同步
    if (!isTableConfigInitialized.value || !newColumns || !Array.isArray(newColumns)) {
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

// ARCH03-01：配置 DynamicTable formSchemas（搜尋欄位）
// 預設：所有欄位隱藏在搜尋表單中
baseColumns.value.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

// POST-SOP v2：移除代理商搜尋欄位（Vue2 原頁面不存在此欄位）
// 搜尋欄位：會員（remote search）
const memberSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'Nickname');
if (memberSearchCol) {
  memberSearchCol.hideInSearch = false;
  memberSearchCol.searchField = 'memberID';
  memberSearchCol.formItemProps = {
    label: t('labels.member') || '會員',
    component: 'Select',
    order: 0,
    required: true,
    rules: [{ required: true, message: t('notify.needAccount') || '會員欄位不能為空' }],
    componentProps: () => ({
      options: memberOptions.value,
      loading: memberLoading.value,
      placeholder: '00001314 - 王小明',
      allowClear: true,
      showSearch: true,
      filterOption: false,
      disabled: !agentID.value,
      onSearch: onMemberSearch,
      onPopupScroll: onMemberPopupScroll,
      onChange: (value: string) => {
        // 更新 sNickname 用於顯示
        if (value) {
          const selected = memberOptions.value.find(opt => opt.value === value);
          if (selected) {
            sNickname.value = `${selected.raw.accountID} - ${selected.raw.nickName}`;
          }
        }
        else {
          sNickname.value = '';
        }
      },
    }),
  };
}

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
    // 從 Breadcrumb Context 的 masterAgentOptions 中查找對應的站長資料
    const masterAgentOptions = masterAgentCtx?.masterAgentOptions.value || [];
    const masterAgentData = masterAgentOptions.find(ma => ma.value === masterAgent);
    // 注意：Breadcrumb Context 可能不包含 currencies 資訊，需要從 API 獲取
    // 這裡保持原有邏輯，但可能需要調整為從 API 獲取
    if (masterAgentData) {
      // 如果需要 currencies，可能需要額外的 API 調用
      // 目前先保持空列表，避免錯誤
    }
  }
};

const setTreasureItemList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await fetchTreasureItemList({ masterAgent });
    if (res?.data?.rows) {
      treasureItemList.value = res.data.rows.reduce((acc: TreasureItem[], r) => {
        if (
          r.type === 'eventItem'
          || r.type === 'gachapon'
          || r.type === 'entityItem'
          || r.type === 'freeScratchCard'
          || r.type === 'coupon'
          || r.type === 'certificate'
        ) {
          return [...acc, ...r.items];
        }
        return acc;
      }, []);
    }
  }
  catch (error) {
    console.error('Failed to fetch treasure items:', error);
  }
};

// 移除 fetchMasterAgentList：站長列表現在由 Breadcrumb Context 提供

const fetchAgentList = async (masterAgent: string) => {
  if (!masterAgent) {
    agentList.value = [];
    return;
  }
  try {
    const list = await getAgentListByMasterAgent({ masterAgent });
    agentList.value = (list || []).map(item => ({
      label: item.account.includes('.') ? item.account.split('.')[0] : item.account,
      value: item.account,
    }));
  }
  catch (error) {
    console.error('Failed to fetch agent list:', error);
    agentList.value = [];
  }
};

/**
 * ARCH03-01：已移除頁面層搜尋表單相關函數
 * - onAgentChanged
 * - searchConditionValidator
 * - handleFilter
 *
 * 搜尋主控權已完全交由 DynamicTable formSchemas
 */

/**
 * ARCH03-01：loadTableData 使用 DynamicTable formSchemas 的值
 */
const loadTableData = async (params: any) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();

  /** 從 formSchemas 獲取搜尋條件 */
  // POST-SOP v2：移除代理商搜尋欄位，直接使用自動設定的 agentID
  const memberID = String((params as any)?.memberID ?? '').trim();

  // 使用自動設定的 agentID（在 handleMasterAgentChange 中已設定）
  const currentAgentID = agentID.value;

  if (!masterAgent || !currentAgentID || !memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData = {
    masterAgent,
    memberID,
  };

  try {
    const res = await queryRedemptionRecords(postData);
    const resData = res as any;

    let items: RedemptionRecord[] = [];
    let total = 0;

    if (resData?.data?.records && Array.isArray(resData.data.records)) {
      items = resData.data.records;
      total = resData.data.records.length;
    }
    else if (resData?.records && Array.isArray(resData.records)) {
      items = resData.records;
      total = resData.records.length;
    }
    else {
      items = [];
      total = 0;
    }

    // 處理數據格式
    const processedItems = items.map((item: any) => {
      const processedItem = {
        id: item.id?.toString() || '',
        orderID: item.orderID || 0,
        masterAgent: item.masterAgent || masterAgent,
        memberID: item.memberID || memberID || '',
        redemptionCode: item.redemptionCode || '',
        redeemedTime: item.redeemedTime,
        createdAt: item.createdAt,
        order: item.order || {},
        Nickname: sNickname.value,
        type: formatOrderType(item.order?.type),
        orderName: item.order?.name || '',
        rewards: item.order?.rewards ? formatRewards(item.order.rewards) : [],
      } as ColumnsRowData;

      return processedItem;
    });

    return {
      items: processedItems,
      meta: {
        totalItems: total,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.connectionError') || '連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

// ============ 兌換碼查詢對話框 ============
const isDialogShow = ref(false);
const sRedemptionCode = ref('');
const rRedemptionCode = ref<CodeState | ''>('');

const openDialog = () => {
  isDialogShow.value = true;
  sRedemptionCode.value = '';
  rRedemptionCode.value = '';
};

const closeDialog = () => {
  isDialogShow.value = false;
  sRedemptionCode.value = '';
  rRedemptionCode.value = '';
};

const checkCodeBtn = async () => {
  if (!sRedemptionCode.value || sRedemptionCode.value.trim() === '') {
    message.error('請輸入兌換碼');
    return;
  }

  rRedemptionCode.value = '';

  try {
    const res = await validateRedemptionCode({ redemptionCode: sRedemptionCode.value });
    if (res?.state) {
      rRedemptionCode.value = res.state;
    }
    else {
      rRedemptionCode.value = CodeStateEnum.UNAVAILABLE;
    }
  }
  catch (error) {
    console.error('Failed to validate redemption code:', error);
    message.error(t('notify.connectionError') || '連接錯誤');
    rRedemptionCode.value = CodeStateEnum.UNAVAILABLE;
  }
};

const rRedemptionCodeType = computed(() => {
  if (rRedemptionCode.value !== CodeStateEnum.AVAILABLE) {
    return 'error';
  }
  return 'success';
});

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
 */
const scrollY = ref<number | undefined>(undefined);

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

/**
 * ARCH05：計算並設定 scroll.y
 * - 計算視窗高度減去其他元素高度（header、filter-container、padding 等）
 * - 確保表格有固定高度，啟用 vertical scroll 和 fixed header
 */
const calculateScrollY = () => {
  nextTick(() => {
    /**
     * 計算可用高度
     * 視窗高度 - header - filter-container - padding/margin
     */
    const windowHeight = window.innerHeight;
    /** 通常的 header 高度 */
    const headerHeight = 64;
    /** filter-container 的預估高度 */
    const filterContainerHeight = 60;
    /** 上下 padding/margin */
    const padding = 40;
    const calculatedHeight = windowHeight - headerHeight - filterContainerHeight - padding;

    /**
     * 設定 scroll.y，啟用 fixed header
     * 最小高度設為 300px，避免過小
     */
    scrollY.value = Math.max(calculatedHeight, 300);
  });
};

/**
 * ARCH03-01：處理站長切換（從 Breadcrumb Context）
 * 更新 agentID 並自動觸發 reload
 */
const handleMasterAgentChange = async (masterAgent: string) => {
  agentList.value = [];

  if (!masterAgent) {
    agentID.value = '';
    // 重置搜尋表單並觸發 reload
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    dynamicTableInstance?.reload(true);
    return;
  }

  await setCurrencyTypeList(masterAgent);
  await setTreasureItemList(masterAgent);

  // 如果有選擇總代理，獲取代理商列表
  await fetchAgentList(masterAgent);

  // ARCH03-01：重置搜尋表單（清空其他搜尋條件）
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
  }

  // 如果有代理商，自動選擇第一個並更新 agentID
  if (agentList.value.length > 0 && userStore.level <= 4) {
    const firstAgent = agentList.value[0].value;
    const agentAccount = firstAgent.includes('.') ? firstAgent.split('.')[0] : firstAgent;
    agentID.value = `${agentAccount}.${masterAgent}`;
  }
  else {
    agentID.value = masterAgent;
  }

  // ARCH03-01：自動觸發 reload
  dynamicTableInstance?.reload(true);
};

/**
 * ARCH03-01：監聽站長切換（從 Breadcrumb Context）
 * 當站長切換時，同步更新相關狀態、重置搜尋表單並自動觸發 reload
 */
watch(
  () => selectedMasterAgent.value,
  async (newMasterAgent) => {
    await handleMasterAgentChange(newMasterAgent);
  },
);

/**
 * ARCH03-01：監聽 contextVersion 變更，當站長切換時重置搜尋表單並自動觸發 reload
 */
watch(
  () => contextVersion.value,
  () => {
    // 重置搜尋表單並自動觸發 reload
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    dynamicTableInstance?.reload(true);
  },
);

// ============ 初始化 ============
onMounted(async () => {
  // 從 Breadcrumb Context 獲取站長值並初始化
  const masterAgent = selectedMasterAgent.value;
  if (masterAgent) {
    await handleMasterAgentChange(masterAgent);
  }

  // ARCH05：於 mounted + nextTick 後計算並設定 scroll.y
  // 確保 DynamicTable 已 render，layout 已穩定後再啟用 fixed header
  calculateScrollY();
});

/**
 * SearchMode 狀態顯示（僅標示，不影響任何行為）
 *
 * 本頁查詢條件（masterAgent、memberID）皆直接傳給後端 API，
 * 不做前端過濾或混合模式，因此標示為 BACKEND。
 */
const searchMode = computed<SearchMode>(() => 'BACKEND');
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
  <div class="app-container redemption-code-record-table">
    <div class="redemption-code-record-page">
      <div
        class="table-container"
        :style="{ overflowX: containerOverflowX }"
      >
        <DynamicTable
          :columns="columns"
          :data-request="loadTableData"
          :scroll="tableScroll"
        >
          <!-- SearchMode 狀態顯示（僅標示，不影響任何行為） -->
          <template #headerTitle>
            <div style="display: flex; align-items: center; gap: 8px">
              <span>{{ t('title') || '兌換碼紀錄' }}</span>
              <Tag :color="searchModeConfig.color" style="margin: 0">
                SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
              </Tag>
            </div>
          </template>

          <!-- POST-SOP v2：將「兌換碼查詢」按鈕移至 Table Toolbar 左側 -->
          <template #toolbar>
            <a-button
              type="primary"
              @click="openDialog"
            >
              <template #icon>
                <SearchOutlined />
              </template>
              {{ t('labels.checkoutRedemptionCode') || '兌換碼查詢' }}
            </a-button>
          </template>
        </DynamicTable>
      </div>

      <!-- 兌換碼查詢對話框 -->
      <a-modal
        v-model:open="isDialogShow"
        :title="t('labels.checkoutRedemptionCode') || '兌換碼查詢'"
        :width="400"
        :mask-closable="false"
        @cancel="closeDialog"
      >
        <a-form
          :label-col="{ span: 6 }"
          :wrapper-col="{ span: 18 }"
        >
          <a-form-item :label="t('column.redemptionCode') || '兌換碼'">
            <a-input
              v-model:value="sRedemptionCode"
              placeholder="請輸入兌換碼"
            />
          </a-form-item>
          <a-form-item :label="t('labels.result') || '查詢結果'">
            <a-tag
              v-if="rRedemptionCode !== ''"
              :color="rRedemptionCodeType === 'success' ? 'success' : 'error'"
            >
              {{ t(`CodeState.${rRedemptionCode}`) || rRedemptionCode }}
            </a-tag>
          </a-form-item>
        </a-form>
        <template #footer>
          <a-button
            type="primary"
            @click="checkCodeBtn"
          >
            {{ t('search') || '查詢' }}
          </a-button>
          <a-button @click="closeDialog">
            {{ t('cancel') || '取消' }}
          </a-button>
        </template>
      </a-modal>
    </div>
  </div>
</template>

<style lang="less" scoped>
.redemption-code-record-table {
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
  }
}
</style>
