<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { ICashRecord } from '@/api/backend/adminSystem/cashRecordServer';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import currency from 'currency.js';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { queryCashRecord } from '@/api/backend/adminSystem/cashRecordServer';
import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import ChainSelector from '@/components/ChainSelector/index.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'CashRecordTable',
});

const { t } = useI18n('page.cashRecord');
const userStore = useUserStore();

/**
 * ============ 工具函數 ============
 */
function precisionCalculation(num1: number, symbol: string, num2: number): number {
  switch (symbol) {
    case '+':
      return Number(currency(num1, { precision: 4 }).add(num2));
    case '-':
      return Number(currency(num1, { precision: 4 }).subtract(num2));
    default:
      return Number.NaN;
  }
}

function getMasterAgentByAgentID(agentID: string): string {
  if (!agentID) {
    return '';
  }
  const parts = agentID.split('.');
  // 如果格式是 agent.masterAgent，返回 masterAgent (parts[1])
  // 如果沒有點號，說明 agentID 本身就是 masterAgent，直接返回
  return parts.length > 1 ? parts[1] : agentID;
}

// ============ 查詢條件 ============
interface QueryState {
  agentID: string;
  account: string;
  accountID: string;
  memberID: string;
  memberIDstr: string;
  currency: string;
  dateRange: [Dayjs, Dayjs];
  type: string;
  subType: string;
  source: string;
  sourceStatus: string;
  remitno: string;
}

const query = ref<QueryState>({
  agentID: '',
  account: '',
  accountID: '',
  memberID: '',
  memberIDstr: '',
  currency: '',
  dateRange: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
  type: '',
  subType: '',
  source: '',
  sourceStatus: '',
  remitno: '',
});

// 只有按下「查詢」才套用
const appliedQuery = ref<QueryState>({ ...query.value });

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
const sMemberID = ref('');

// ============ 總代理選擇器 ============
const isAgentIDDisabled = computed(() => userStore.level >= 4);
const agentIDOptions = ref<Array<{ label: string; value: string }>>([]);
const masterAgentList = ref<MasterAgentItem[]>([]);

// ============ 代理商選擇器 ============
const selectedMasterAgent = ref<string>('');
const agentList = ref<Array<{ label: string; value: string }>>([]);
const selectedAgent = ref<string>('');
const isAgentDisabled = computed(() => userStore.level >= 5);

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!query.value.agentID) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const masterAgent = getMasterAgentByAgentID(query.value.agentID);
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: query.value.agentID,
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

const onMemberSelectChanged = (val: string) => {
  query.value.memberID = val;
  const matched = memberOptions.value.find(o => o.value === val);
  query.value.account = matched?.raw?.account || '';
  sMemberID.value = val;
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

watch(
  () => query.value.agentID,
  () => {
    query.value.account = '';
    query.value.memberID = '';
    memberOptions.value = [];
  },
);

// ============ 會員ID字串輸入 ============
const memberIDstr = ref('');
const isMemberIDstrValid = ref(false);

const onMemberIDstrInput = (value: string) => {
  const regex = /^[a-zA-Z0-9]*$/;
  isMemberIDstrValid.value = !regex.test(value);
};

// ============ 幣別 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);
const masterAgentCurrencyTypeMap = ref<Map<string, string>>(new Map());

const fetchCurrencyTypeList = async (masterAgentAccount?: string) => {
  currencyTypeList.value = [];
  masterAgentCurrencyTypeMap.value.clear();

  // Level 4 用戶使用自己的 currencies
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({ name: item.currencyName, value: item.currencyCode });
      masterAgentCurrencyTypeMap.value.set(item.currencyCode, item.currencyName);
    });
  }
  else if (masterAgentAccount) {
    // 從 masterAgent 資料中獲取幣別列表
    const masterAgent = masterAgentList.value.find(ma => ma.account === masterAgentAccount);
    if (masterAgent && masterAgent.currencies && Array.isArray(masterAgent.currencies)) {
      masterAgent.currencies.forEach((currencyItem: any) => {
        if (currencyItem && typeof currencyItem === 'object' && currencyItem.currencyCode) {
          currencyTypeList.value.push({
            name: currencyItem.currencyName || currencyItem.currencyCode,
            value: currencyItem.currencyCode,
          });
          masterAgentCurrencyTypeMap.value.set(currencyItem.currencyCode, currencyItem.currencyName || currencyItem.currencyCode);
        }
      });
    }
  }

  if (currencyTypeList.value.length > 0) {
    query.value.currency = currencyTypeList.value[0].value;
  }
};

const getCurrencyName = (currencyType: string): string => {
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    const found = currencies.find((item: any) => item && typeof item === 'object' && item.currencyCode === currencyType) as any;
    return (found?.currencyName) || 'unknown';
  }
  else {
    return masterAgentCurrencyTypeMap.value.get(currencyType) || 'unknown';
  }
};

// ============ ChainSelector 相關 ============
const filterSchema = ref<any>({});
const chainSelectorKeyI18nMap = ref<Map<string, string>>(new Map());
const gameIDList = ref<Map<string, { gameID: string; gameName: string }>>(new Map());

const buildMabuSchema = async (gameSource: Array<string>) => {
  const authLevel = userStore.level;
  let transferSourceSchema: any = {};

  // source website 權限設定
  const websiteSource: Array<string> = [];
  if (authLevel <= 2) {
    // TODO: 需要實現 getAllWebsite API
    // websiteSource = await getAllWebsite();
    transferSourceSchema = {
      source: {
        value: websiteSource,
        label: t('labels.source'),
      },
    };
  }

  // set chain selector i18n key map
  const chainSelectorKeys = [
    'Bet',
    'Win',
    'Transfer',
    'Promote',
    'Mission',
    'MailAttachment',
    'RedemptionCode',
    'Transaction',
    'transfer',
    'DailyRewardPass',
    'SafetyBox',
    'singleWallet',
    'Purchase',
    'Manual',
    'GameWinLose',
    'Bonus',
    'ServiceFee',
  ];
  chainSelectorKeys.forEach((k) => {
    chainSelectorKeyI18nMap.value.set(k, t(`record.types.${k}`) || k);
  });

  const re: any = {
    type: {
      label: t('labels.type'),
      value: {
        Bet: {
          subType: {
            values: ['General'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
          source: {
            values: gameSource.map(s => ({ value: s, label: s })),
            label: t('labels.source'),
          },
          sourceStatus: {
            values: ['NormalGame', 'DoubleGame'].map(g => ({ value: g, label: g })),
            label: t('labels.sourceStatus'),
          },
        },
        Win: {
          subType: {
            values: ['General', 'ForceSettle', 'Award'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
          source: {
            values: gameSource.map(s => ({ value: s, label: s })),
            label: t('labels.source'),
          },
          sourceStatus: {
            values: ['NormalGame', 'FreeGame', 'DoubleGame', 'JackpotGame'].map(s => ({
              value: s,
              label: s,
            })),
            label: t('labels.sourceStatus'),
          },
        },
        Transfer: {
          subType: {
            values: ['KeyIn', 'KeyOut'].map(s => ({ value: s, label: s })),
            label: t('labels.subType'),
          },
          ...transferSourceSchema,
        },
        Promote: {
          subType: {
            values: ['Award', 'General', 'Activity'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
          source: {
            values: gameSource.map(s => ({ value: s, label: s })),
            label: t('labels.source'),
          },
          sourceStatus: {
            values: ['LobbyGame', 'NormalGame', 'FreeGame', 'DoubleGame', 'JackpotGame'].map(s => ({
              value: s,
              label: s,
            })),
            label: t('labels.sourceStatus'),
          },
        },
        Mission: {
          subType: {
            values: ['Reward', 'Mission'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        MailAttachment: {
          subType: {
            values: ['Transaction'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        RedemptionCode: {
          subType: {
            values: ['Redeem'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        Transaction: {
          subType: {
            values: ['Withhold', 'ServiceFee', 'Recover', 'Receive'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        transfer: {
          subType: {
            values: ['carryIn', 'carryOut'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        DailyRewardPass: {
          subType: {
            values: ['Reward', 'Deduct'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        SafetyBox: {
          subType: {
            values: ['Withdrawal', 'Deposit', 'ServiceFee'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        singleWallet: {
          subType: {
            values: ['gameBet', 'gamePlay', 'gameWin'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        Purchase: {
          subType: {
            values: ['FreeBalance'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        Manual: {
          subType: {
            values: ['add', 'sub'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        GameWinLose: {
          subType: {
            values: ['GamePlay', 'BuyGift'].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
        Bonus: {
          subType: {
            values: [
              'Activity',
              'Mail',
              'DailySignIn',
              'NoviceMission',
              'DailyMission',
              'GuildMission',
              'ContinuousDailyMission',
              'ContinuousWeeklyMission',
              'Other',
            ].map((subType) => {
              let i18t = subType;
              if (subType === 'Activity') {
                i18t = 'BonusActivity';
              }
              return {
                value: subType,
                label: t(`record.subTypes.${i18t}`) || subType,
              };
            }),
            label: t('labels.subType'),
          },
        },
        ServiceFee: {
          subType: {
            values: [
              'CreateGuildServiceFee',
              'RefundGuildServiceFee',
              'TransactionServiceFee',
              'SafetyBoxServiceFee',
            ].map(subType => ({
              value: subType,
              label: t(`record.subTypes.${subType}`) || subType,
            })),
            label: t('labels.subType'),
          },
        },
      },
    },
  };

  // TODO: 根據平台判斷是否刪除某些類型
  // if (isVnappPlatform()) {
  //   delete re.type.value.Transfer;
  // } else {
  //   delete re.type.value.transfer;
  // }

  return re;
};

const getGameID = (gameName: string): string => {
  let gameID = '';
  gameIDList.value.forEach((value) => {
    if (value.gameName === gameName) {
      gameID = value.gameID;
      return true;
    }
  });
  return gameID || gameName;
};

const handleSelectedValue = (selectedValue: { type: string; subType: string; source: string; sourceStatus: string }) => {
  const { type, subType, source, sourceStatus } = selectedValue;
  query.value.type = type;
  query.value.subType = subType;
  query.value.source = getGameID(source);
  query.value.sourceStatus = sourceStatus;
};

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumsRowData = ICashRecord & {
  balanceChange: number;
  currencyTypeStr: string;
  noteTranslated: string;
};

const noteTranslator = (type: string, note: string): string => {
  if (!note) {
    return '';
  }

  // 嘗試解析 JSON，如果失敗則返回原始 note
  try {
    const parsed = JSON.parse(note);

    // 如果有 gameName，優先顯示 gameName
    if (parsed && typeof parsed === 'object' && 'gameName' in parsed) {
      return parsed.gameName || note;
    }

    // 根據不同類型處理
    switch (type) {
      case 'Store':
        if (parsed.treasureItemName) {
          return parsed.treasureItemName;
        }
        break;
      case 'Promote':
        if (parsed.missionName) {
          return parsed.missionName;
        }
        break;
      case 'Donate':
        if (parsed.giftName) {
          return parsed.giftName;
        }
        break;
      default:
        // 對於其他類型，如果有 gameName 則顯示，否則返回原始 note
        break;
    }

    return note;
  }
  catch (error) {
    // JSON 解析失敗，返回原始 note
    return note;
  }
};

const appendBalanceChangeColumn = (cashRecords: ICashRecord[]): (ICashRecord & { balanceChange: number })[] => {
  return cashRecords.map((r) => {
    const balanceChange = r.withdrawal > 0
      ? precisionCalculation(Number(r.deposit), '-', Number(r.withdrawal))
      : Number(r.deposit);
    return {
      ...r,
      balanceChange,
    };
  });
};

const gameListProcessor = (gameList: any): Array<string> => {
  const list = Object.values(gameList);
  const gameNameList: Array<string> = [];
  list.forEach((gameInfo: any) => {
    gameIDList.value.set(gameInfo.gameID, { gameID: gameInfo.gameID, gameName: gameInfo.gameName });
    gameNameList.push(gameInfo.gameName);
  });
  return gameNameList;
};

const columns = ref<TableColumn<ColumsRowData>[]>([
  {
    title: t('labels.remitno'),
    dataIndex: 'remitno',
    width: 150,
  },
  {
    title: t('labels.transactionTime'),
    dataIndex: 'transactionTime',
    width: 180,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return record.transactionTime ? dayjs(record.transactionTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('labels.memberID'),
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('labels.balanceChange'),
    dataIndex: 'balanceChange',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumsRowData }) => {
      const value = record.balanceChange || 0;
      const style = record.balanceChange < 0 ? { color: '#FF4949' } : {};
      return h('span', { style }, value.toLocaleString());
    },
  },
  {
    title: t('labels.beforeBalance'),
    dataIndex: 'beforeBalance',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumsRowData }) => {
      return Number(record.beforeBalance || 0).toLocaleString();
    },
  },
  {
    title: t('labels.afterBalance'),
    dataIndex: 'afterBalance',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumsRowData }) => {
      return Number(record.afterBalance || 0).toLocaleString();
    },
  },
  {
    title: t('labels.currencyType'),
    dataIndex: 'currency',
    width: 120,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return getCurrencyName(record.currency);
    },
  },
  {
    title: t('labels.type'),
    dataIndex: 'type',
    width: 150,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return t(`record.types.${record.type}`) || record.type;
    },
  },
  {
    title: t('labels.subType'),
    dataIndex: 'subType',
    width: 150,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return t(`record.subTypes.${record.subType}`) || record.subType;
    },
  },
  {
    title: t('labels.source'),
    dataIndex: 'source',
    width: 150,
  },
  {
    title: t('labels.sourceStatus'),
    dataIndex: 'sourceStatus',
    width: 150,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return record.sourceStatus === 'T9_SINGLE_WALLET' ? 'T9LIVE' : record.sourceStatus;
    },
  },
  {
    title: t('labels.note'),
    dataIndex: 'note',
    width: 200,
    customRender: ({ record }: { record: ColumsRowData }) => {
      return noteTranslator(record.type, record.note);
    },
  },
]);

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.agentID || !appliedQuery.value.dateRange[0] || !appliedQuery.value.currency) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const [start, end] = appliedQuery.value.dateRange;

  const postData: any = {
    agentID: appliedQuery.value.agentID,
    date: [start.toDate(), end.toDate()],
    currency: appliedQuery.value.currency,
    page: 1,
    limit: 999999,
  };

  if (appliedQuery.value.remitno) {
    postData.remitno = appliedQuery.value.remitno;
  }

  if (appliedQuery.value.type) {
    postData.type = appliedQuery.value.type;
  }

  if (appliedQuery.value.subType) {
    postData.subType = appliedQuery.value.subType;
  }

  if (appliedQuery.value.source) {
    postData.source = appliedQuery.value.source;
  }

  if (appliedQuery.value.sourceStatus) {
    postData.sourceStatus = appliedQuery.value.sourceStatus;
  }

  // 處理會員ID
  if (appliedQuery.value.memberID) {
    postData.memberID = appliedQuery.value.memberID;
  }
  else if (appliedQuery.value.memberIDstr && appliedQuery.value.agentID) {
    postData.memberID = `${appliedQuery.value.memberIDstr}@${appliedQuery.value.agentID}`;
  }
  else if (appliedQuery.value.account && appliedQuery.value.agentID) {
    postData.memberID = `${appliedQuery.value.account}@${appliedQuery.value.agentID}`;
  }

  try {
    const res = await queryCashRecord(postData);
    // 調試：輸出實際 API 回傳結構
    console.log('API 回傳資料:', res);

    // 使用類型斷言處理實際 API 回傳結構
    const resData = res as any;

    // 嘗試多種可能的資料路徑
    let items: ICashRecord[] = [];
    let total = 0;

    // 路徑 1: res.data.data.items (用戶指定的結構)
    if (resData?.data?.data?.items) {
      items = resData.data.data.items;
      total = resData.data.data.total || 0;
    }
    // 路徑 2: res.data.items (API 定義的結構)
    else if (resData?.data?.items) {
      items = resData.data.items;
      total = resData.data.total || 0;
    }
    // 路徑 3: res.items (直接返回)
    else if (Array.isArray(resData?.items)) {
      items = resData.items;
      total = resData.total || resData.items.length;
    }
    // 路徑 4: res 本身就是陣列
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }

    console.log('解析後的 items 數量:', items.length, 'total:', total);

    const processedItems = appendBalanceChangeColumn(items);

    let st = 3.5;
    if (items.length / 4500 > 3.5) {
      st = items.length / 4500;
    }

    // 模擬請求時間
    await new Promise(resolve => setTimeout(resolve, st * 1000));

    return {
      items: processedItems,
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
 * ============ 日期選擇器 ============
 */
const disabledDate = (current: Dayjs) => {
  const today = dayjs();
  const threeMonthsAgo = today.subtract(3, 'month');
  return current && current.isBefore(threeMonthsAgo);
};

/**
 * ============ 查詢處理 ============
 */
const handleFilter = async () => {
  if (!query.value.agentID) {
    message.error(t('notify.agentIDRequired'));
    return;
  }
  if (!query.value.dateRange || !query.value.dateRange[0]) {
    message.error(t('notify.dateRequired'));
    return;
  }
  if (!query.value.currency) {
    message.error(t('notify.currencyRequired'));
    return;
  }
  if (isMemberIDstrValid.value) {
    message.error(t('notify.memberIDstrInvalid'));
    return;
  }

  appliedQuery.value = {
    ...query.value,
    dateRange: [...query.value.dateRange] as [Dayjs, Dayjs],
  };

  await dynamicTableInstance?.reload?.(true);
};

const fetchMasterAgentList = async () => {
  try {
    // 獲取完整的 masterAgent 資料（包含 currencies）
    const list = await getMasterAgentAccountList();
    masterAgentList.value = list || [];
    agentIDOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));
  }
  catch (error) {
    console.error('Failed to fetch master agent list:', error);
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
      // 顯示時只顯示點號前的部分
      label: item.account.includes('.') ? item.account.split('.')[0] : item.account,
      value: item.account,
    }));
  }
  catch (error) {
    console.error('Failed to fetch agent list:', error);
    agentList.value = [];
  }
};

const onMasterAgentChanged = async (val: string) => {
  selectedMasterAgent.value = val;
  selectedAgent.value = '';
  agentList.value = [];

  // 如果有選擇總代理，獲取代理商列表
  if (val) {
    await fetchAgentList(val);
    // 如果有代理商，自動選擇第一個
    if (agentList.value.length > 0 && userStore.level <= 4) {
      selectedAgent.value = agentList.value[0].value;
      // 確保 selectedAgent.value 不包含 masterAgent，如果包含則只取 agent 部分
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      query.value.agentID = `${agentAccount}.${val}`;
    }
    else {
      // 如果沒有代理商，直接使用總代理作為 agentID
      query.value.agentID = val;
    }
  }
  else {
    query.value.agentID = '';
  }

  query.value.account = '';
  query.value.memberID = '';
  query.value.memberIDstr = '';
  memberOptions.value = [];
  await fetchCurrencyTypeList(val);
};

const onAgentChanged = (val: string) => {
  selectedAgent.value = val;
  if (selectedMasterAgent.value && val) {
    // 確保 val 不包含 masterAgent，如果包含則只取 agent 部分
    const agentAccount = val.includes('.') ? val.split('.')[0] : val;
    query.value.agentID = `${agentAccount}.${selectedMasterAgent.value}`;
  }
  else if (selectedMasterAgent.value) {
    query.value.agentID = selectedMasterAgent.value;
  }
  else {
    query.value.agentID = '';
  }

  query.value.account = '';
  query.value.memberID = '';
  query.value.memberIDstr = '';
  memberOptions.value = [];
};

// ============ 初始化 ============
onMounted(async () => {
  await fetchMasterAgentList();

  if (userStore.level === 5) {
    // Level 5 用戶（代理商級別）使用自己的 agent 和 masterAgent
    if (userStore.masterAgent && userStore.agent) {
      selectedMasterAgent.value = userStore.masterAgent;
      selectedAgent.value = userStore.agent;
      // 確保 userStore.agent 不包含 masterAgent，如果包含則只取 agent 部分
      const agentAccount = userStore.agent.includes('.') ? userStore.agent.split('.')[0] : userStore.agent;
      query.value.agentID = `${agentAccount}.${userStore.masterAgent}`;
      // 獲取該總代理下的代理商列表（用於顯示）
      await fetchAgentList(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    // Level 4 用戶（總代理級別）使用自己的 masterAgent
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      // 獲取該總代理下的代理商列表
      await fetchAgentList(userStore.masterAgent);
      if (agentList.value.length > 0) {
        selectedAgent.value = agentList.value[0].value;
        // 確保 selectedAgent.value 不包含 masterAgent，如果包含則只取 agent 部分
        const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
        query.value.agentID = `${agentAccount}.${userStore.masterAgent}`;
      }
    }
  }
  else if (agentIDOptions.value.length > 0) {
    // Level 1-3 用戶可以選擇總代理
    selectedMasterAgent.value = agentIDOptions.value[0].value;
    query.value.agentID = agentIDOptions.value[0].value;
    // 獲取該總代理下的代理商列表
    await fetchAgentList(agentIDOptions.value[0].value);
    if (agentList.value.length > 0) {
      selectedAgent.value = agentList.value[0].value;
      // 確保 selectedAgent.value 不包含 masterAgent，如果包含則只取 agent 部分
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      query.value.agentID = `${agentAccount}.${agentIDOptions.value[0].value}`;
    }
  }

  // 初始化幣別列表
  await fetchCurrencyTypeList(selectedMasterAgent.value);

  // 初始化遊戲列表和 schema
  let gameSource: Array<string> = [];
  try {
    const masterAgent = getMasterAgentByAgentID(query.value.agentID);
    if (masterAgent) {
      const response = await gameList({ masterAgent });
      const gameListData = (response || []).reduce((acc: any, gameInfo: any) => {
        const gameID = gameInfo.gameID;
        const obj: any = {};
        obj[gameID] = gameInfo;
        if (gameInfo.language && gameInfo.language.tw) {
          obj[gameID].gameName += ` (${gameInfo.language.tw})`;
        }
        return Object.assign(acc, obj);
      }, {});

      if (gameListData) {
        gameSource = gameListProcessor(gameListData);
      }
    }
  }
  catch (error) {
    console.error('Failed to fetch game list:', error);
  }

  if (gameSource.length > 0) {
    filterSchema.value = await buildMabuSchema(gameSource);
  }
});
</script>

<template>
  <div class="app-container cash_record_table">
    <div class="filter-container">
      <div class="wrap">
        <!-- 總代理選擇器 -->
        <div
          v-if="!isAgentIDDisabled"
          class="input_group"
        >
          <div class="txt">
            <label style="color: #ff4949">{{ t('labels.masterAgent') }}</label>
          </div>
          <div class="my_input">
            <AdminAccountSelector
              v-model="selectedMasterAgent"
              value-type="account"
              :disabled="isAgentIDDisabled"
              @update:model-value="onMasterAgentChanged"
            />
          </div>
        </div>

        <!-- 代理商選擇器 -->
        <div
          v-if="selectedMasterAgent"
          class="input_group"
        >
          <div class="txt">
            <label style="color: #ff4949">{{ t('labels.agent') }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="selectedAgent"
              :options="agentList"
              :disabled="isAgentDisabled"
              placeholder="請選擇代理商"
              style="width: 200px"
              :allow-clear="!isAgentDisabled"
              @change="onAgentChanged"
            />
          </div>
        </div>

        <!-- 會員搜索 (SearchMemberID 組件位置) -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.member') }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.memberID"
              show-search
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!query.agentID || !!memberIDstr"
              style="width: 200px; margin-top: 7px"
              allow-clear
              placeholder="00001314 - 王小明"
              @search="onMemberSearch"
              @change="onMemberSelectChanged"
              @popup-scroll="onMemberPopupScroll"
            />
            <div class="hint-text">
              {{ t('notify.memberIDstrHint') }}
            </div>
          </div>
        </div>

        <!-- 會員ID字串輸入 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.memberID') }}</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="memberIDstr"
              :disabled="!query.agentID || !!query.account"
              style="width: 200px; margin-top: 13px"
              allow-clear
              @update:value="onMemberIDstrInput"
            />
            <div
              class="hint-text"
              :class="{ 'error-text': isMemberIDstrValid, 'normal-text': !isMemberIDstrValid }"
            >
              {{ t('notify.memberIDstr') }}
            </div>
          </div>
        </div>

        <!-- 幣別 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.currencyType') }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.currency"
              :options="currencyTypeList.map(c => ({ label: c.name, value: c.value }))"
              placeholder="請選擇"
              style="width: 200px"
            />
          </div>
        </div>

        <!-- 日期選擇器 -->
        <div class="input_group">
          <div class="txt redText">
            <label>{{ t('labels.transactionTime') }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.dateRange"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :allow-clear="false"
              :disabled-date="disabledDate"
              range-separator="～"
              :placeholder="['START TIME', 'END TIME']"
              :default-time="[dayjs('00:00:00', 'HH:mm:ss'), dayjs('23:59:59', 'HH:mm:ss')]"
              class="timeText item"
            />
          </div>
        </div>

        <!-- 查詢按鈕 -->
        <div class="input_group">
          <a-button
            type="primary"
            class="input_btn"
            @click="handleFilter"
          >
            <template #icon>
              <SearchOutlined />
            </template>
            {{ t('common.search') }}
          </a-button>
        </div>
      </div>

      <!-- 額外filter -->
      <div
        class="wrap"
        style="height: auto"
      >
        <!-- remitno -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.remitno') }}</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="query.remitno"
              :placeholder="t('labels.input')"
              style="width: 200px"
              allow-clear
              @press-enter="handleFilter"
            />
          </div>
        </div>

        <!-- ChainSelector -->
        <ChainSelector
          v-if="Object.keys(filterSchema).length > 0"
          :schema="filterSchema"
          :key-label-i18n-map="chainSelectorKeyI18nMap"
          @handle-selected-value="handleSelectedValue"
        />
      </div>
    </div>

    <DynamicTable
      row-key="remitno"
      :columns="columns"
      :data-request="loadTableData"
      :pagination="false"
    />
  </div>
</template>

<style lang="less" scoped>
.cash_record_table {
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

.timeText {
  width: 400px;
}

.redText {
  color: red;
}

.hint-text {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.error-text {
  color: red;
}

.normal-text {
  color: #999;
}
</style>
