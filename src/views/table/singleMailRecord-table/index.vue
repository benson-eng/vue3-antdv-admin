<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type {
  MailAction,
  MemberMailRecord,
  QueryMemberMailRecordsParams,
} from '@/api/backend/mail';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
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
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'SingleMailRecordTable',
});

const { t } = useI18n('page.mail.singleMailRecordTable');
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

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  agentID: string;
  memberID?: string;
  mailTitle?: string;
  arrivalTime?: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  mailTitle: undefined,
  arrivalTime: undefined,
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
const sNickname = ref('');

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
}, 300);

const onMemberSelectChanged = (value: string) => {
  if (!value) {
    sMemberID.value = '';
    sNickname.value = '';
    query.value.memberID = undefined;
    return;
  }

  const selected = memberOptions.value.find(opt => opt.value === value);
  if (selected) {
    // Vue2 格式：account@agentID
    sMemberID.value = `${selected.raw.account}@${selected.raw.agentID}`;
    sNickname.value = selected.raw.nickName;
    query.value.memberID = `${selected.raw.account}@${selected.raw.agentID}`;
  }
};

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2) {
      fetchMemberOptions(memberLastQueryText.value, true);
    }
  }
};

// ============ 總代理和代理商 ============
const masterAgentList = ref<MasterAgentItem[]>([]);
const agentIDOptions = ref<{ label: string; value: string }[]>([]);
const selectedMasterAgent = ref<string>('');
const agentList = ref<{ label: string; value: string }[]>([]);
const selectedAgent = ref<string>('');

const isAgentIDDisabled = computed(() => userStore.level >= 4);
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
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
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

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('tables.image') || '圖片',
    dataIndex: 'iconUrl',
    width: 100,
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
    width: 200,
  },
  {
    title: t('tables.mailContent') || '郵件內容',
    dataIndex: 'content',
    width: 300,
  },
  {
    title: t('tables.mailAction') || '郵件動作',
    dataIndex: 'mailAction',
    width: 300,
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
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.arrivalTime ? dayjs(record.arrivalTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.mailSender') || '發送者',
    dataIndex: 'sender',
    width: 150,
  },
  {
    title: t('tables.member') || '會員',
    dataIndex: 'Nickname',
    width: 200,
  },
  {
    title: t('tables.status') || '狀態',
    dataIndex: 'status',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatMailStatus(record.status);
    },
  },
]);

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
    const masterAgentData = masterAgentList.value.find(ma => ma.account === masterAgent);
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
};

const setTreasureItemList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await fetchTreasureItemList({ masterAgent });
    if (res?.rows) {
      treasureItemList.value = res.rows.reduce((acc: TreasureItem[], r) => {
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

const getTokenList = async () => {
  tokenList.value = [];
  try {
    const res = await queryTokens({ masterAgent: query.value.masterAgent });
    if (res) {
      tokenList.value = res;
    }
  }
  catch (error) {
    console.error('Failed to fetch tokens:', error);
  }
};

const getGameList = async () => {
  try {
    const res = await fetchGameList({ masterAgent: query.value.masterAgent });
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

const fetchMasterAgentList = async () => {
  try {
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
const onMasterAgentChanged = async (val: string) => {
  selectedMasterAgent.value = val;
  selectedAgent.value = '';
  agentList.value = [];
  tokenList.value = [];
  query.value.masterAgent = val;
  sMemberID.value = '';
  sNickname.value = '';
  query.value.memberID = undefined;
  memberOptions.value = [];

  if (!val) {
    return;
  }

  await setCurrencyTypeList(val);
  await setTreasureItemList(val);
  await getTokenList();
  await getGameList();

  // 如果有選擇總代理，獲取代理商列表
  await fetchAgentList(val);
  // 如果有代理商，自動選擇第一個
  if (agentList.value.length > 0 && userStore.level <= 4) {
    selectedAgent.value = agentList.value[0].value;
    const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
    query.value.agentID = `${agentAccount}.${val}`;
  }
  else {
    query.value.agentID = val;
  }
};

const onAgentChanged = (val: string) => {
  selectedAgent.value = val;
  if (selectedMasterAgent.value && val) {
    const agentAccount = val.includes('.') ? val.split('.')[0] : val;
    query.value.agentID = `${agentAccount}.${selectedMasterAgent.value}`;
  }
  else if (selectedMasterAgent.value) {
    query.value.agentID = selectedMasterAgent.value;
  }
  else {
    query.value.agentID = '';
  }

  query.value.memberID = undefined;
  sMemberID.value = '';
  sNickname.value = '';
  memberOptions.value = [];
};

const onArrivalTimeDatePickChanged = (value: [Dayjs, Dayjs] | [string, string] | null) => {
  if (value && Array.isArray(value) && value.length === 2) {
    if (typeof value[0] === 'string') {
      query.value.arrivalTime = [dayjs(value[0]), dayjs(value[1])];
    }
    else {
      query.value.arrivalTime = value as [Dayjs, Dayjs];
    }
  }
  else {
    query.value.arrivalTime = undefined;
  }
};

const searchConditionValidator = (): void => {
  if (!query.value.masterAgent || !query.value.agentID) {
    message.error(t('notify.masterAgentAndAgentFieldMissed') || '總代理和代理商欄位不能為空');
    throw new Error('params missed');
  }
  if (!query.value.memberID) {
    message.error(t('notify.needAccount') || '會員欄位不能為空');
    throw new Error('memberID missed');
  }
};

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agentID || !appliedQuery.value.memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: any = {
    masterAgent: appliedQuery.value.masterAgent,
    memberID: appliedQuery.value.memberID,
  };

  // 處理 mailTitle：如果為空字符串則不傳遞
  if (appliedQuery.value.mailTitle && appliedQuery.value.mailTitle.trim().length > 0) {
    postData.mailTitle = appliedQuery.value.mailTitle;
  }

  // 處理 arrivalTime：對齊 Vue2 的邏輯
  // Vue2 中檢查：if (this.sArrivalTime === null || this.sArrivalTime[0] === undefined)
  if (
    appliedQuery.value.arrivalTime
    && appliedQuery.value.arrivalTime[0]
    && appliedQuery.value.arrivalTime[1]
  ) {
    postData.arrivalTime = {
      startTime: appliedQuery.value.arrivalTime[0].toDate(),
      endTime: appliedQuery.value.arrivalTime[1].toDate(),
    };
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
        Nickname: sNickname.value,
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

const handleFilter = async () => {
  try {
    searchConditionValidator();
    appliedQuery.value = {
      ...query.value,
      arrivalTime: query.value.arrivalTime ? [...query.value.arrivalTime] as [Dayjs, Dayjs] : undefined,
    };
    await dynamicTableInstance?.reload?.(true);
  }
  catch (error) {
    // 驗證失敗，不執行查詢
  }
};

// ============ 初始化 ============
onMounted(async () => {
  await fetchMasterAgentList();

  if (userStore.level === 5) {
    if (userStore.masterAgent && userStore.agent) {
      selectedMasterAgent.value = userStore.masterAgent;
      selectedAgent.value = userStore.agent;
      const agentAccount = userStore.agent.includes('.') ? userStore.agent.split('.')[0] : userStore.agent;
      query.value.agentID = `${agentAccount}.${userStore.masterAgent}`;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await setTreasureItemList(userStore.masterAgent);
      await getTokenList();
      await getGameList();
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await setTreasureItemList(userStore.masterAgent);
      await getTokenList();
      await getGameList();
      if (agentList.value.length > 0) {
        selectedAgent.value = agentList.value[0].value;
        const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
        query.value.agentID = `${agentAccount}.${userStore.masterAgent}`;
      }
    }
  }
  else if (agentIDOptions.value.length > 0) {
    selectedMasterAgent.value = agentIDOptions.value[0].value;
    query.value.masterAgent = agentIDOptions.value[0].value;
    await fetchAgentList(agentIDOptions.value[0].value);
    await setCurrencyTypeList(agentIDOptions.value[0].value);
    await setTreasureItemList(agentIDOptions.value[0].value);
    await getTokenList();
    await getGameList();
    if (agentList.value.length > 0) {
      selectedAgent.value = agentList.value[0].value;
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      query.value.agentID = `${agentAccount}.${agentIDOptions.value[0].value}`;
    }
    else {
      query.value.agentID = agentIDOptions.value[0].value;
    }
  }
});
</script>

<template>
  <div class="app-container single-mail-record-table">
    <div class="filter-container">
      <div class="wrap">
        <!-- 總代理選擇器 -->
        <div
          v-if="!isAgentIDDisabled"
          class="input_group"
        >
          <div class="txt">
            <label style="color: #ff4949">{{ t('labels.masterAgent') || '總代理' }}</label>
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
            <label style="color: #ff4949">{{ t('labels.agent') || '代理商' }}</label>
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

        <!-- 會員搜索 -->
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">{{ t('labels.member') || '會員' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.memberID"
              show-search
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!query.agentID"
              style="width: 200px"
              allow-clear
              placeholder="00001314 - 王小明"
              @search="onMemberSearch"
              @change="onMemberSelectChanged"
              @popup-scroll="onMemberPopupScroll"
            />
          </div>
        </div>

        <!-- 郵件標題 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.mailTitle') || '郵件標題' }}</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="query.mailTitle"
              style="width: 200px"
              allow-clear
              placeholder="請輸入郵件標題"
            />
          </div>
        </div>

        <!-- 到達時間 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.arrivalTime') || '到達時間' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.arrivalTime"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="[t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間']"
              style="width: 400px"
              @change="onArrivalTimeDatePickChanged"
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
            {{ t('search') || '查詢' }}
          </a-button>
        </div>
      </div>
    </div>

    <DynamicTable
      :columns="columns"
      :data-request="loadTableData"
      :scroll="{ x: 'max-content' }"
    />
  </div>
</template>

<style lang="less" scoped>
.single-mail-record-table {
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
