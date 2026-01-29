<script setup lang="ts">
/**
 * ARCH03-01：搜尋模型已由 Vue2 升級為 Vue3
 * - 搜尋狀態完全由 DynamicTable formSchemas 控制（Single Source of Truth）
 * - Context 切換時自動重置搜尋條件並觸發 reload（Auto Reload）
 * - 搜尋主控權完全交由 DynamicTable（formSchemas）
 * - 移除所有 Vue2 搜尋模型殘留（query/appliedQuery 雙狀態、handleFilter/handleReset 等）
 *
 * ARCH04：DynamicTable 搜尋必填欄位對齊
 * - memberID（會員）欄位已設定為必填（required: true）
 * - 使用 DynamicTable 內建 Form 驗證機制
 * - 未填寫必填欄位時不會觸發 API
 *
 * ARCH05：DynamicTable Vertical Scroll / Fixed Header 穩定化
 * 頁型：類型 B（有搜尋區頁面，search: true）
 * - scroll.y 初始值為 undefined（確保搜尋區正常顯示）
 * - 於 mounted + nextTick 後再補上 scroll.y（確保 layout 已穩定）
 * - DynamicTable 必須於初始 render 時存在（不得使用 v-if）
 */
// 注意：MasterAgentItem 已移除，站長列表由 Breadcrumb Context 提供
import type {
  AccountBaseInfoItem,
  FuzzyQueryUserItem,
} from '@/api/backend/adminSystem/accountSystem';
import type {
  OrderState,
  TransactionOrderItem,
} from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
// 注意：getMasterAgentAccountList 已移除，站長列表由 Breadcrumb Context 提供
import {
  fuzzyQueryUser,
  queryAccountBaseInfo,
} from '@/api/backend/adminSystem/accountSystem';
import {
  abortTransaction,
  OrderState as EOrderState,
  getTransactionOrders,
} from '@/api/backend/transactionSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '../../adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'TransactionRecordTable',
});

const { t } = useI18n('page.transactionRecord');
// 用於獲取路由標題
const routeI18n = useI18n('routes.table');
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * ============ Context Consumer 行為 ============
 */
// 從 Layout 根元件 provide 取得站長選單狀態（系統層 Context / Breadcrumb Context）
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

function formatCurrency(value: number | string): string {
  if (value === null || value === undefined) {
    return '0';
  }
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function transVipname(accounts: string | undefined): string {
  return accounts && accounts !== '' ? `VIP${accounts}` : '';
}

// 注意：頁面自管站長相關實作已移除，站長來源統一改為 Breadcrumb Context

// ============ 會員搜索（用於 DynamicTable 搜尋表單的 remote search）===========
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
// 用於儲存選中的會員暱稱（用於表格顯示）
const selectedMemberNickname = ref('');

// 注意：currentAgentID 已移除，改為使用 Breadcrumb Context 的 selectedMasterAgent

const fetchMemberOptions = async (queryText: string, agentID: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!agentID) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const masterAgent = getMasterAgentByAgentID(agentID);
    const res = await fuzzyQueryUser({
      masterAgent,
      // agentID,
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
  const masterAgent = selectedMasterAgent.value;
  if (text && text.length >= 2 && masterAgent) {
    fetchMemberOptions(text, masterAgent, false);
  }
  else {
    memberOptions.value = [];
  }
}, 300);

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    const masterAgent = selectedMasterAgent.value;
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2 && masterAgent) {
      fetchMemberOptions(memberLastQueryText.value, masterAgent, true);
    }
  }
};

// ============ 幣別列表 ============
const currencyList = ref<{ name: string; value: string }[]>([]);

// ============ 查詢類型列表 ============
const searchTypeList = [
  { label: t('searchType.coin') || '幣別', value: 'coin' },
  { label: t('searchType.item') || '道具', value: 'item' },
];

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

type ColumnsRowData = TransactionOrderItem & {
  id: string;
  remitterNickname: string;
  receiverNickname: string;
  remitterVip: string;
  receiverVip: string;
  showType: string;
  showItemName: string;
  newCanecelAt: string | null;
};

const tagType = (state: OrderState): string => {
  switch (state) {
    case EOrderState.SUCCESS:
      return 'success';
    case EOrderState.EXPIRED:
    case EOrderState.RECOVER:
      return 'error';
    default:
      return 'warning';
  }
};

const formatState = (state: OrderState): string => {
  return t(`state.${state}`) || state;
};

const formatSearchType = (type: string): string => {
  if (type === 'coin' || type === 'token') {
    return t(`searchType.${type}`) || type;
  }
  return t(`itemType.${type}`) || type;
};

const transCurrencyName = (currencyType?: string): string => {
  if (!currencyType) {
    return 'unknown';
  }
  const found = currencyList.value.find(el => el.value === currencyType);
  return found ? found.name : currencyType;
};

const handleAbortTransaction = (record: ColumnsRowData) => {
  const content = `${t('notify.confirmStopTransaction') || '是否中止'} ${record.remitterNickname} ${t('notify.give') || '贈送'} ${record.receiverNickname} ${record.showItemName} : ${(record.remittances * 1).toString()}`;
  const title = t('notify.confirmTitle') || '確認';

  Modal.confirm({
    title,
    content,
    okText: t('confirm') || '確認',
    cancelText: t('cancel') || '取消',
    onOk: async () => {
      try {
        // 從搜尋表單獲取當前值
        const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
        const searchParams = searchFormRef?.getFieldsValue?.() || {};
        // 站長值從 Breadcrumb Context 獲取（Single Source of Truth）
        const masterAgent = selectedMasterAgent.value || searchParams.masterAgent;
        const searchType = searchParams.searchType || 'coin';

        await abortTransaction({
          masterAgent,
          orderID: record.id,
          searchType,
        });
        message.success(t('notify.abortSuccess') || '中止成功');
        await dynamicTableInstance?.reload?.(true);
      }
      catch (error) {
        console.error('Failed to abort transaction:', error);
        message.error(t('notify.abortError') || '中止失敗');
      }
    },
  });
};

// 預設所有表格欄位隱藏搜尋
const baseColumns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: '#',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('column.remitterVip') || '贈禮人VIP',
    dataIndex: 'remitterVip',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return transVipname(record.remitterVip);
    },
  },
  {
    title: t('column.remitterNickname') || '贈禮人暱稱',
    dataIndex: 'remitterNickname',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 200,
  },
  {
    title: t('column.receiverVip') || '收禮人VIP',
    dataIndex: 'receiverVip',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return transVipname(record.receiverVip);
    },
  },
  {
    title: t('column.receiverNickname') || '收禮人暱稱',
    dataIndex: 'receiverNickname',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 200,
  },
  {
    title: t('column.currencyType') || '禮物別',
    dataIndex: 'showType',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatSearchType(record.showType);
    },
  },
  {
    title: t('column.showItemName') || '禮物名',
    dataIndex: 'showItemName',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 200,
  },
  {
    title: t('column.remittances') || '贈送數量',
    dataIndex: 'remittances',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.remittances);
    },
  },
  {
    title: t('column.serviceFee') || '手續費',
    dataIndex: 'serviceFee',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.serviceFee);
    },
  },
  {
    title: t('column.state') || '狀態',
    dataIndex: 'state',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const state = record.state;
      const tag = tagType(state);
      return h('a-tag', { color: tag }, () => formatState(state));
    },
  },
  {
    title: t('column.transferAt') || '贈送時間',
    dataIndex: 'transferAt',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.transferAt ? dayjs(record.transferAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.receivedAt') || '收禮時間',
    dataIndex: 'receivedAt',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.receivedAt ? dayjs(record.receivedAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.expireTime') || '過期時間',
    dataIndex: 'expireTime',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.expireTime ? dayjs(record.expireTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.canceledAt') || '取消時間',
    dataIndex: 'newCanecelAt',
    /** 彈性寬度欄位 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.newCanecelAt ? dayjs(record.newCanecelAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('action.operation') || '操作',
    dataIndex: 'ACTION',
    width: 100,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => {
      const canAbort = record.state === EOrderState.WAIT_RECEIVER_AGREE
        || record.state === EOrderState.WAIT_REMITTER_CONFIRM;
      return [
        {
          label: t('notify.stop') || '中止',
          type: 'link',
          danger: true,
          disabled: !canAbort,
          onClick: () => handleAbortTransaction(record),
        },
      ];
    },
  },
]);

// 預設所有表格欄位隱藏搜尋
baseColumns.value.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

/**
 * ============ API 調用 ============
 */
const setCurrencyTypeList = async (_masterAgent: string): Promise<void> => {
  currencyList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  else {
    // 注意：原本使用 masterAgentList，現在需要從 API 獲取站長資訊
    // 但為了簡化，暫時保留此邏輯，如果 masterAgent 不存在則不設置幣別列表
    // 如果需要完整功能，可能需要調用 API 獲取站長資訊
    // 目前先保持簡化，因為 level 4 以下的使用者可能不需要此功能
  }
};

// 注意：fetchMasterAgentList 已移除，站長列表由 Breadcrumb Context 提供

// 搜尋專用欄位（computed，確保初始化時即可偵測）
// 注意：站長選擇器已移除，站長來源統一改為 Breadcrumb Context
const searchOnlyColumns = computed<TableColumn<ColumnsRowData>[]>(() => [
  // 搜尋欄位 0：會員（remote search，虛擬欄位，僅用於搜尋）
  // ARCH04：此欄位為 API 查詢必填條件
  {
    title: t('labels.member') || '會員',
    dataIndex: '__member_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'memberID',
    formItemProps: {
      label: t('labels.member') || '會員',
      component: 'Select',
      order: 0,
      // ARCH04：必填欄位設定
      required: true,
      rules: [{ required: true, message: t('notify.needAccount') || '會員欄位不能為空' }],
      componentProps: () => ({
        options: memberOptions.value,
        loading: memberLoading.value,
        disabled: !selectedMasterAgent.value,
        placeholder: '00001314 - 王小明',
        allowClear: true,
        showSearch: true,
        filterOption: false,
        onSearch: onMemberSearch,
        onPopupScroll: onMemberPopupScroll,
        onChange: (value: string) => {
          if (value) {
            const selected = memberOptions.value.find(opt => opt.value === value);
            if (selected) {
              selectedMemberNickname.value = selected.raw.nickName;
            }
          }
          else {
            selectedMemberNickname.value = '';
          }
        },
      }),
    },
  },
  // 搜尋欄位 1：查詢種類（虛擬欄位，僅用於搜尋）
  {
    title: t('column.searchType') || '查詢種類',
    dataIndex: '__searchType_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'searchType',
    formItemProps: {
      label: t('column.searchType') || '查詢種類',
      component: 'Select',
      order: 1,
      // ARCH03-01：初始值由 formSchemas 控制（Vue3 搜尋模型）
      defaultValue: 'coin',
      componentProps: {
        options: searchTypeList,
        placeholder: t('column.searchType') || '請選擇查詢種類',
      },
    },
  },
]);

// 使用 computed 組合 columns，確保搜尋欄位在初始化時即可偵測
const allColumns = computed<TableColumn<ColumnsRowData>[]>(() => [
  ...searchOnlyColumns.value,
  ...baseColumns.value,
]);

// 表格配置（對齊 agent 頁面的基礎架構）
const tableConfig = useTableConfig(allColumns);

/**
 * 初始化 visibleColumnKeys：只包含表格欄位（排除搜尋欄位）
 * 確保初始化時 visibleColumnKeys 包含所有 STEP 3 定型的表格欄位
 */
const initializeVisibleColumnKeys = () => {
  const tableColumnKeys = baseColumns.value
    .map(col => (col.dataIndex as string) || (col.key as string) || '')
    .filter(key => key && !key.startsWith('__') && !key.endsWith('_search__'));

  // 確保所有表格欄位都在 visibleColumnKeys 中
  const currentKeys = tableConfig.visibleColumnKeys.value;
  const allTableKeysPresent = tableColumnKeys.every(key => currentKeys.includes(key));

  if (!allTableKeysPresent || currentKeys.length === 0) {
    // 如果 visibleColumnKeys 為空或缺少表格欄位，初始化為所有表格欄位
    tableConfig.updateVisibleColumns(tableColumnKeys);
  }
};

/**
 * 根據 visibleColumnKeys 設置欄位的 hideInTable
 * 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
 * 添加初始化 guard：若 visibleColumnKeys 尚未初始化完成（空或無效），不得套用 hideInTable
 */
const columns = computed<TableColumn<ColumnsRowData>[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 若 visibleColumnKeys 為空或未初始化，維持全部顯示（但搜尋欄位保持 hideInTable: true）
  const isInitialized = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return allColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 搜尋欄位始終保持 hideInTable: true（不受 visibleColumnKeys 影響）
    if (col.hideInTable === true) {
      return col;
    }

    // 若尚未初始化，不套用 hideInTable，維持全部顯示
    if (!isInitialized) {
      const processedCol: TableColumn<ColumnsRowData> = {
        ...col,
        hideInTable: false,
      };

      // 確保 flexible 欄位有 minWidth
      if (processedCol.flexible && !processedCol.minWidth) {
        processedCol.minWidth = 100; // 預設最小寬度 100px
      }

      // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
      if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
        processedCol.width = processedCol.minWidth;
      }

      return processedCol;
    }

    // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
    const isVisible = visibleKeys.includes(key);
    const processedCol: TableColumn<ColumnsRowData> = {
      ...col,
      hideInTable: !isVisible,
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
  });
});

/**
 * 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
 * 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
 * 添加初始化 guard，避免初始化階段反向覆寫 visibleColumnKeys
 */
const isInitialized = ref(false);

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

    // Guard: 初始化階段不得反向覆寫 visibleColumnKeys
    // 僅在初始化完成後才進行同步
    if (!isInitialized.value) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumn<ColumnsRowData>) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      // 只同步表格欄位（排除搜尋欄位）
      if (key && !col.hideInTable && !key.startsWith('__') && !key.endsWith('_search__')) {
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

// 計算 container 的 overflow-x 樣式（對齊 agent 頁）
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value as any;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // 其餘情況（'100%' 或 undefined）維持 hidden，避免多餘 scrollbar
  return 'hidden';
});

/**
 * ARCH05：DynamicTable Vertical Scroll / Fixed Header 穩定化
 * 頁型：類型 B（有搜尋區頁面）
 *
 * 處理規則：
 * - scroll.y 初始值為 undefined（確保搜尋區正常顯示）
 * - 於 mounted + nextTick 後再補上 scroll.y（確保 layout 已穩定）
 * - 不得延後 DynamicTable render（不得使用 v-if）
 */
const tableScrollY = ref<number | undefined>(undefined);

/**
 * 計算表格的 scroll.y 值，用於啟用固定表頭
 * 類型 B（有搜尋區頁面）：初始值為 undefined，於 mounted + nextTick 後再補上
 */
const calculateScrollY = () => {
  if (typeof window === 'undefined') {
    return;
  }

  // 計算可用高度：視窗高度 - 表頭高度 - 搜尋區高度 - toolbar 高度 - 其他固定元素高度
  // 預留約 300px 給表頭、搜尋區、toolbar 和其他固定元素
  const availableHeight = window.innerHeight - 300;
  // 確保最小高度為 400px
  tableScrollY.value = Math.max(availableHeight, 400);
};

/**
 * 監聽視窗大小變化，更新表格高度
 */
const handleResize = () => {
  if (typeof window !== 'undefined' && tableScrollY.value !== undefined) {
    calculateScrollY();
  }
};

/**
 * 組合 scroll 物件
 */
const tableScroll = computed(() => {
  const scrollX = tableConfig.scrollX.value;
  return {
    x: scrollX,
    y: tableScrollY.value,
  };
});

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 本頁為 search: true（有搜尋區），所有查詢皆為後端 API
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

const loadTableData = async (params: any) => {
  // 從 DynamicTable 的搜尋參數中獲取查詢條件
  // 注意：DynamicTable 會將表單值直接放在 params 中，而不是 params.searchParams
  // 表單欄位名稱對應 searchField（memberID, searchType）
  const memberIDValue = params?.memberID;
  const searchType = params?.searchType || 'coin';

  // 站長值從 Breadcrumb Context 獲取（Single Source of Truth）
  const masterAgent = selectedMasterAgent.value;

  // 會員選擇器的值是 "account@agentID" 格式，需要提取 account 部分
  const memberID = memberIDValue ? (memberIDValue.includes('@') ? memberIDValue.split('@')[0] : memberIDValue) : '';

  if (!masterAgent || !memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const searchMember: string[] = [];
  const nameList: Record<string, string> = {};
  const allOrders: TransactionOrderItem[] = [];

  try {
    // 查詢作為 remitter 的訂單
    const query1 = {
      masterAgent,
      remitter: memberID,
      searchType,
    };
    const res1 = await getTransactionOrders(query1);
    if (res1?.data?.orders) {
      res1.data.orders.forEach((item: TransactionOrderItem) => {
        if (!item.remitter || !item.receiver) {
          return;
        }
        const remitter = item.remitter.split('@')[0];
        const receiver = item.receiver.split('@')[0];
        if (!searchMember.includes(remitter)) {
          searchMember.push(remitter);
        }
        if (!searchMember.includes(receiver)) {
          searchMember.push(receiver);
        }
        item.remitter = remitter;
        item.receiver = receiver;
        allOrders.push(item);
      });
    }

    // 查詢作為 receiver 的訂單
    const query2 = {
      masterAgent,
      receiver: memberID,
      searchType,
    };
    const res2 = await getTransactionOrders(query2);
    if (res2?.data?.orders) {
      res2.data.orders.forEach((item: TransactionOrderItem) => {
        if (!item.remitter || !item.receiver) {
          return;
        }
        const remitter = item.remitter.split('@')[0];
        const receiver = item.receiver.split('@')[0];
        if (!searchMember.includes(remitter)) {
          searchMember.push(remitter);
        }
        if (!searchMember.includes(receiver)) {
          searchMember.push(receiver);
        }
        item.remitter = remitter;
        item.receiver = receiver;
        allOrders.push(item);
      });
    }

    // 獲取所有會員的暱稱信息
    if (searchMember.length > 0) {
      const accountInfoRes = await queryAccountBaseInfo({
        masterAgent,
        accounts: searchMember,
      });
      if (accountInfoRes?.data) {
        accountInfoRes.data.forEach((item: AccountBaseInfoItem) => {
          nameList[item.account] = item.id;
        });
      }
    }

    // 處理數據
    allOrders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA; // 最新的在前
    });

    const processedItems = allOrders.map((item: TransactionOrderItem) => {
      const processedItem: ColumnsRowData = {
        ...item,
        id: item.id || '',
        remitterNickname: '',
        receiverNickname: '',
        remitterVip: item.remitterVip || '',
        receiverVip: item.receiverVip || '',
        showType: searchType === 'item' ? (item.itemType || '') : 'coin',
        showItemName: searchType === 'item'
          ? (item.cardName || '')
          : transCurrencyName(item.currencyType),
        newCanecelAt: item.canceledAt || item.recoveredAt || null,
        remittances: item.remittances || 0,
        serviceFee: item.serviceFee || 0,
      };

      // 處理 remitter 暱稱
      if (item.remitterNicknameWhenTransaction !== null && item.remitterNicknameWhenTransaction) {
        processedItem.remitterNickname = `${nameList[item.remitter] || ''} - ${item.remitterNicknameWhenTransaction}`;
      }
      else {
        processedItem.remitterNickname = nameList[item.remitter] || '';
        processedItem.remitterVip = '';
      }

      // 處理 receiver 暱稱
      if (item.receiverNicknameWhenTransaction !== null && item.receiverNicknameWhenTransaction) {
        processedItem.receiverNickname = `${nameList[item.receiver] || ''} - ${item.receiverNicknameWhenTransaction}`;
      }
      else {
        processedItem.receiverNickname = nameList[item.receiver] || '';
        processedItem.receiverVip = '';
      }

      return processedItem;
    });

    return {
      items: processedItems,
      meta: {
        totalItems: processedItems.length,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.connectionError') || '連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * ARCH03-01：Context 行為升級（Auto Reload）
 * 當 Context（如站長）切換時：
 * - 重置 DynamicTable 搜尋條件
 * - 自動觸發 DynamicTable reload
 */
watch(
  () => contextVersion.value,
  async () => {
    // 清空會員相關狀態
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    selectedMemberNickname.value = '';

    // 設置幣別列表（如果需要）
    const masterAgent = selectedMasterAgent.value;
    if (masterAgent) {
      await setCurrencyTypeList(masterAgent);
    }

    // 重置搜尋表單
    const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
      // 設置預設值（searchType 預設為 'coin'）
      await nextTick();
      searchFormRef.setFieldsValue({
        searchType: 'coin',
      });
    }

    // 自動觸發 reload（Vue3 搜尋模型行為）
    await nextTick();
    await dynamicTableInstance?.reload?.(true);
  },
);

/**
 * ARCH03-01：初始化
 * 搜尋狀態完全由 DynamicTable formSchemas 控制（初始值通過 defaultValue 設置）
 *
 * ARCH05：DynamicTable Vertical Scroll / Fixed Header 穩定化
 * 類型 B（有搜尋區頁面）：於 mounted + nextTick 後再補上 scroll.y
 */
onMounted(async () => {
  // 初始化 visibleColumnKeys：確保包含所有表格欄位（排除搜尋欄位）
  await nextTick();
  initializeVisibleColumnKeys();

  // 標記初始化完成（確保 visibleColumnKeys 已正確初始化後）
  await nextTick();
  isInitialized.value = true;

  // ARCH05：於 mounted + nextTick 後計算並設置 scroll.y（確保 layout 已穩定）
  await nextTick();
  calculateScrollY();

  // 監聽視窗大小變化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
});

/**
 * ARCH05：清理事件監聽器
 */
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
  }
});
</script>

<template>
  <div class="app-container transaction-record-table">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        :columns="columns"
        :data-request="loadTableData"
        :scroll="tableScroll"
        :search="true"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ routeI18n.t('transactionRecordTable') }}</span>
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
.transaction-record-table {
  // 確保搜尋條件區最後一行與操作按鈕區之間有清楚的視覺間距
  :deep(.ant-form) {
    .ant-row:last-of-type {
      margin-bottom: 16px;
    }
  }
}
</style>
