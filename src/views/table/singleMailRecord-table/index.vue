<script setup lang="ts">
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type {
  MailAction,
  MemberMailRecord,
  QueryMemberMailRecordsParams,
} from '@/api/backend/mail';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, inject, nextTick, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { gameList as fetchGameList } from '@/api/backend/adminSystem/gameManagerServer';
import {
  EMailActionTypes,
  EMailExchangeContentTypes,
  EMailStatus,
  queryMemberMailRecords,
} from '@/api/backend/mail';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '../../adminAccount/agent/constants';
import { useTableConfig } from '../../adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'SingleMailRecordTable',
});

const { t } = useI18n('page.mail.singleMailRecordTable');
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

// 從 Layout 根元件 provide 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
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

// ARCH03-01：COMPLETED - 搜尋模型已升級（Vue2 → Vue3）
// 已轉換為 DynamicTable formSchemas 模式
// - 移除 query/appliedQuery 雙狀態模型
// - 搜尋主控權完全由 DynamicTable 接管
// - Context 切換時自動觸發 reload（Vue3 行為）

// ============ 會員搜索（用於 DynamicTable 搜尋表單的 remote search）===========
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
// 用於儲存選中的會員暱稱（用於表格顯示）
const selectedMemberNickname = ref('');

// 當前選中的 agentID（用於會員搜尋）
const currentAgentID = ref('');

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
      agentID,
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
  if (text && text.length >= 2 && currentAgentID.value) {
    fetchMemberOptions(text, currentAgentID.value, false);
  }
  else {
    memberOptions.value = [];
  }
}, 300);

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2 && currentAgentID.value) {
      fetchMemberOptions(memberLastQueryText.value, currentAgentID.value, true);
    }
  }
};

// ============ 總代理和代理商 ============
const agentList = ref<{ label: string; value: string }[]>([]);

const isAgentDisabled = computed(() => userStore.level >= 5);

// ============ 幣別、道具、代幣、遊戲列表 ============
const currencyTypeList = ref<{ name: string; value: string }[]>([]);
const treasureItemList = ref<TreasureItem[]>([]);
const tokenList = ref<TokenItem[]>([]);
const gameListAll = ref<GameInfo[]>([]);

// ============ 郵件狀態列表 ============
const mailStatusList = [
  { name: t('enum.ENABLED') || '啟用', value: EMailStatus.ENABLED },
  { name: t('enum.READ') || '已讀(已領取)', value: EMailStatus.READ },
  { name: t('enum.REMOVE') || '刪除', value: EMailStatus.REMOVE },
  { name: t('enum.EXPIRED') || '過期', value: EMailStatus.EXPIRED },
  { name: t('enum.EXCEEDED_QUOTA') || '超過配額', value: EMailStatus.EXCEEDED_QUOTA },
];

// ============ 表格 ============
// ARCH03-01：COMPLETED - 搜尋模型已升級（Vue2 → Vue3）
// 啟用 DynamicTable 內建搜尋表單，搜尋主控權完全由 DynamicTable 接管
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

type ColumnsRowData = MemberMailRecord & {
  id: string;
};

const cdnBaseUrl = computed(() => (import.meta.env.VITE_APP_CDN_BASE_URL as string) || '');

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

const getTokenName = (tokenID?: string | number): string => {
  const found = tokenList.value.find(t => t.id === tokenID || t.id?.toString() === tokenID?.toString());
  return found ? found.name : 'unknown';
};

const getGameName = (gameID?: string): string => {
  const found = gameListAll.value.find(g => g.gameID === gameID);
  return found ? `${gameID} - ${found.gameName}` : gameID || 'unknown';
};

const formatMailStatus = (status: EMailStatus): string => {
  const found = mailStatusList.find(item => item.value === status);
  return found ? found.name : 'unknown';
};

const formatMailAction = (mailAction: MailAction | string[]): string[] => {
  if (Array.isArray(mailAction)) {
    return mailAction;
  }

  const newMailAction: string[] = [];
  const action = mailAction as MailAction;

  switch (action.type) {
    case EMailActionTypes.DO_NOTHING:
      newMailAction.push(t('labels.notAction') || '無動作');
      break;
    case EMailActionTypes.EXCHANGE:
      if (action.contents && Array.isArray(action.contents)) {
        action.contents.forEach((content) => {
          let awardName = '';
          if (content.contentType === EMailExchangeContentTypes.BALANCE) {
            awardName = getCurrencyName(content.currency);
            if (awardName && awardName !== 'unknown') {
              newMailAction.push(`${awardName} : ${content.balance}`);
            }
            else {
              newMailAction.push('award item lost');
            }
          }
          else if (content.contentType === EMailExchangeContentTypes.ITEM) {
            awardName = getTreasureItemName(content.treasureItemID);
            if (awardName && awardName !== 'unknown') {
              newMailAction.push(`${awardName} : ${content.amount}`);
            }
            else {
              newMailAction.push('award item lost');
            }
          }
          else if (content.contentType === EMailExchangeContentTypes.TOKEN) {
            awardName = getTokenName(content.tokenID);
            if (awardName && awardName !== 'unknown') {
              newMailAction.push(`${awardName} : ${content.amount}`);
            }
            else {
              newMailAction.push('award item lost');
            }
          }
        });
      }
      break;
    case EMailActionTypes.OPEN_INTERNAL_WINDOW:
      // 無需顯示
      break;
    case EMailActionTypes.REDIRECT:
      if (action.location === 'store') {
        newMailAction.push(`${t('labels.redirect') || '導向'} : ${t('labels.store') || '商城'}`);
      }
      else {
        const gameName = getGameName(action.location);
        newMailAction.push(`${t('labels.redirect') || '導向'} : ${gameName}`);
      }
      break;
  }

  return newMailAction;
};

const baseColumns: TableColumn<ColumnsRowData>[] = [
  {
    title: t('tables.image') || '圖片',
    dataIndex: 'iconUrl',
    width: 100,
    hideInSearch: true,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      if (!record.iconUrl) {
        return '';
      }
      const imageUrl = record.iconUrl.startsWith('http') ? record.iconUrl : `${cdnBaseUrl.value}${record.iconUrl}`;
      return h('img', {
        src: imageUrl,
        style: { height: '50px', width: '50px', objectFit: 'cover' },
        alt: 'mail icon',
      });
    },
  },
  {
    title: t('tables.mailTitle') || '郵件標題',
    dataIndex: 'title',
    flexible: true,
    minWidth: 200,
    hideInSearch: true,
  },
  {
    title: t('tables.mailContent') || '郵件內容',
    dataIndex: 'content',
    flexible: true,
    minWidth: 300,
    hideInSearch: true,
  },
  {
    title: t('tables.mailAction') || '郵件動作',
    dataIndex: 'mailAction',
    flexible: true,
    minWidth: 300,
    hideInSearch: true,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const actions = formatMailAction(record.mailAction);
      if (actions.length === 0) {
        return '-';
      }
      return actions.join('、');
    },
  },
  {
    title: t('tables.arrivalTime') || '到達時間',
    dataIndex: 'arrivalTime',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.arrivalTime ? dayjs(record.arrivalTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.mailSender') || '發送者',
    dataIndex: 'sender',
    width: 150,
    hideInSearch: true,
  },
  {
    title: t('tables.member') || '會員',
    dataIndex: 'Nickname',
    width: 200,
    hideInSearch: true,
  },
  {
    title: t('tables.status') || '狀態',
    dataIndex: 'status',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatMailStatus(record.status);
    },
  },
];

// ARCH03-01：SEARCH UI FIXED - 搜尋欄位獨立定義，確保 DynamicTable 初始化時可偵測到
// 預設所有表格欄位隱藏搜尋
baseColumns.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

// 搜尋專用欄位（computed，確保初始化時即可偵測）
const searchOnlyColumns = computed<TableColumn<ColumnsRowData>[]>(() => [
  // 搜尋欄位 0：代理商（虛擬欄位，僅用於搜尋）
  {
    title: t('labels.agent') || '代理商',
    dataIndex: '__agent_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'agent',
    formItemProps: {
      label: t('labels.agent') || '代理商',
      component: 'Select',
      order: 0,
      componentProps: () => ({
        options: agentList.value,
        disabled: isAgentDisabled.value,
        placeholder: t('labels.agent') || '請選擇代理商',
        allowClear: !isAgentDisabled.value,
        onChange: (val: string) => {
          // ARCH03-01：代理商變更時清空會員選擇（搜尋輔助元件調整）
          const masterAgent = selectedMasterAgent.value;
          if (masterAgent && val) {
            const agentAccount = val.includes('.') ? val.split('.')[0] : val;
            currentAgentID.value = `${agentAccount}.${masterAgent}`;
          }
          else if (masterAgent) {
            currentAgentID.value = masterAgent;
          }
          else {
            currentAgentID.value = '';
          }
          // 清空會員相關狀態（remote search 僅作為欄位輔助，不得直接觸發 reload）
          memberOptions.value = [];
          memberLastQueryText.value = '';
          memberLastAccountID.value = '';
          selectedMemberNickname.value = '';
          // 清空搜尋表單中的會員欄位
          const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
          if (searchFormRef) {
            searchFormRef.setFieldsValue({ memberID: undefined });
          }
        },
      }),
    },
  },
  // 搜尋欄位 1：會員（remote search，虛擬欄位，僅用於搜尋）
  {
    title: t('labels.member') || '會員',
    dataIndex: '__member_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'memberID',
    formItemProps: {
      label: t('labels.member') || '會員',
      component: 'Select',
      order: 1,
      componentProps: () => ({
        options: memberOptions.value,
        loading: memberLoading.value,
        disabled: !currentAgentID.value,
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
  // 搜尋欄位 2：郵件標題（虛擬欄位，僅用於搜尋）
  {
    title: t('labels.mailTitle') || '郵件標題',
    dataIndex: '__mailTitle_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'mailTitle',
    formItemProps: {
      label: t('labels.mailTitle') || '郵件標題',
      component: 'Input',
      order: 2,
      componentProps: {
        allowClear: true,
        placeholder: t('labels.mailTitle') || '請輸入郵件標題',
      },
    },
  },
  // 搜尋欄位 3：到達時間（虛擬欄位，僅用於搜尋）
  {
    title: t('labels.arrivalTime') || '到達時間',
    dataIndex: '__arrivalTime_search__',
    hideInTable: true,
    hideInSearch: false,
    searchField: 'arrivalTime',
    formItemProps: {
      label: t('labels.arrivalTime') || '到達時間',
      component: 'RangePicker',
      order: 3,
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: [t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間'],
      },
    },
  },
]);

// ARCH03-01：SEARCH UI FIXED - 使用 computed 組合 columns，確保搜尋欄位在初始化時即可偵測
const columns = computed<TableColumn<ColumnsRowData>[]>(() => [
  ...searchOnlyColumns.value,
  ...baseColumns,
]);

// 表格配置（對齊 agent 頁面的基礎架構）
const tableConfig = useTableConfig(columns as any);

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
 * ============ API 調用 ============
 */
const setCurrencyTypeList = async (_masterAgent: string): Promise<void> => {
  currencyTypeList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  // Level < 4 時，幣別列表由其他 API 或系統提供，這裡暫時保留空陣列
  // 若未來需要從 masterAgent 資料取得幣別，可透過其他 API 取得
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

const getTokenList = async (masterAgent: string) => {
  tokenList.value = [];
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

const getGameList = async (masterAgent: string) => {
  try {
    const res = await fetchGameList({ masterAgent });
    if (res) {
      gameListAll.value = res.map(item => ({
        gameID: item.gameID,
        gameName: item.gameName,
        gameType: item.gameType,
      }));
    }
  }
  catch (error) {
    console.error('Failed to fetch game list:', error);
  }
};

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
 * ============ 事件處理 ============
 */
/**
 * ARCH03-01：COMPLETED - 搜尋模型已升級（Vue2 → Vue3）
 * 處理站長切換（從 Breadcrumb Context）
 * - 重置搜尋表單條件
 * - 自動觸發 DynamicTable reload（Vue3 行為：Context 切換時自動查詢）
 */
const handleMasterAgentChange = async (masterAgent: string) => {
  agentList.value = [];
  tokenList.value = [];
  currentAgentID.value = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
  selectedMemberNickname.value = '';

  if (!masterAgent) {
    // 清空表格資料並觸發 reload（自動查詢）
    await dynamicTableInstance?.reload?.(true);
    return;
  }

  await setCurrencyTypeList(masterAgent);
  await setTreasureItemList(masterAgent);
  await getTokenList(masterAgent);
  await getGameList(masterAgent);

  // 如果有選擇總代理，獲取代理商列表
  await fetchAgentList(masterAgent);

  // 如果有代理商，自動選擇第一個並更新 currentAgentID
  if (agentList.value.length > 0 && userStore.level <= 4) {
    const firstAgent = agentList.value[0].value;
    const agentAccount = firstAgent.includes('.') ? firstAgent.split('.')[0] : firstAgent;
    currentAgentID.value = `${agentAccount}.${masterAgent}`;
  }
  else {
    currentAgentID.value = masterAgent;
  }

  // 重置搜尋表單（清空所有搜尋條件）
  await nextTick();
  const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
    // 如果有預設 agent，重新設置
    if (agentList.value.length > 0 && userStore.level <= 4) {
      searchFormRef.setFieldsValue({ agent: agentList.value[0].value });
    }
  }

  // ARCH03-01：自動觸發 reload（Vue3 行為：Context 切換時自動查詢）
  // 注意：如果必填欄位（agent、memberID）未填寫，loadTableData 會返回空結果
  await dynamicTableInstance?.reload?.(true);
};

// ARCH03-01：COMPLETED - 監聽 contextVersion 變更，當站長切換時重置搜尋條件並自動觸發查詢
watch(
  () => contextVersion.value,
  () => {
    const masterAgent = selectedMasterAgent.value;
    handleMasterAgentChange(masterAgent);
  },
);

/**
 * ARCH03-01：COMPLETED - 搜尋模型已升級（Vue2 → Vue3）
 * DynamicTable dataRequest（Submit 才觸發）
 * - 直接使用 DynamicTable 傳入的搜尋參數
 * - 已移除 query/appliedQuery 雙狀態模型
 * - 搜尋主控權完全由 DynamicTable formSchemas 接管
 */
const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 從搜尋表單取得參數
  const agent = String((params as any)?.agent ?? '').trim();
  const memberID = String((params as any)?.memberID ?? '').trim();
  const mailTitle = String((params as any)?.mailTitle ?? '').trim();
  const arrivalTime = (params as any)?.arrivalTime;

  // 驗證必填欄位
  if (!agent || !memberID) {
    if (!agent) {
      message.error(t('notify.masterAgentAndAgentFieldMissed') || '總代理和代理商欄位不能為空');
    }
    if (!memberID) {
      message.error(t('notify.needAccount') || '會員欄位不能為空');
    }
    return { items: [], meta: { totalItems: 0 } };
  }

  // 構建 agentID
  const agentAccount = agent.includes('.') ? agent.split('.')[0] : agent;
  const agentID = `${agentAccount}.${masterAgent}`;

  // 更新 currentAgentID（用於會員搜尋）
  currentAgentID.value = agentID;

  const postData: any = {
    masterAgent,
    memberID,
  };

  // 處理 mailTitle：如果為空字符串則不傳遞
  if (mailTitle && mailTitle.trim().length > 0) {
    postData.mailTitle = mailTitle;
  }

  // 處理 arrivalTime
  if (arrivalTime && Array.isArray(arrivalTime) && arrivalTime.length === 2) {
    const startTime = dayjs.isDayjs(arrivalTime[0]) ? arrivalTime[0] : dayjs(arrivalTime[0]);
    const endTime = dayjs.isDayjs(arrivalTime[1]) ? arrivalTime[1] : dayjs(arrivalTime[1]);
    if (startTime.isValid() && endTime.isValid()) {
      postData.arrivalTime = {
        startTime: startTime.toDate(),
        endTime: endTime.toDate(),
      };
    }
  }

  // 移除 undefined 和空字符串的欄位
  const actualConditions = pickByIdentity(postData, [undefined, '']) as QueryMemberMailRecordsParams;

  try {
    const res = await queryMemberMailRecords(actualConditions);
    const resData = res as any;

    let items: MemberMailRecord[] = [];
    let total = 0;

    if (resData && Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }
    else if (resData?.data && Array.isArray(resData.data)) {
      items = resData.data;
      total = resData.data.length;
    }
    else {
      items = [];
      total = 0;
    }

    // 處理數據格式
    const processedItems = items.map((item: any) => {
      const processedItem: MemberMailRecord & { id: string } = {
        id: item.id || item.mailID || '',
        iconUrl: item.iconUrl || '',
        title: item.title || '',
        content: item.content || '',
        mailAction: item.mailAction || { type: EMailActionTypes.DO_NOTHING },
        arrivalTime: item.arrivalTime,
        sender: item.sender || '',
        Nickname: selectedMemberNickname.value,
        status: item.status ?? EMailStatus.ENABLED,
      };

      // 處理 mailAction
      if (typeof processedItem.mailAction === 'object' && !Array.isArray(processedItem.mailAction)) {
        const action = processedItem.mailAction as MailAction;
        const formattedActions = formatMailAction(action);
        processedItem.mailAction = formattedActions;
      }

      return processedItem;
    });

    // 反轉順序（最新的在前）
    const sortedItems = [...processedItems].reverse();

    return {
      items: sortedItems,
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

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent / agent：頁面級選擇器，用於構建查詢參數
 * - memberID / mailTitle / arrivalTime：查詢條件，直接傳遞給後端 API
 * - 所有查詢條件都通過 queryMemberMailRecords API 發送到後端
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
onMounted(async () => {
  // 使用 Breadcrumb Context 的站長值進行初始化
  const masterAgent = selectedMasterAgent.value;
  if (masterAgent) {
    await handleMasterAgentChange(masterAgent);
  }
});

// ARCH03-01：COMPLETED - 搜尋模型已升級
// 移除不必要的 watcher：agent 變化已在 formItemProps onChange 中處理
// currentAgentID 的更新由搜尋表單的 onChange 事件驅動，無需額外監聽
</script>

<template>
  <div class="app-container single-mail-record-table">
    <!-- ARCH03-01：SEARCH UI FIXED - 搜尋模型已升級，搜尋區正確顯示 -->
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :columns="columns"
        :data-request="loadTableData"
        :scroll="{ x: tableConfig.scrollX.value }"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: true,
        }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('title') || '單一會員郵件記錄' }}</span>
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
.single-mail-record-table {
  .table-container {
    width: 100%;
  }
}
</style>
