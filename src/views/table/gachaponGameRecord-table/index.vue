<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { QueryVipPortalGameRecordParams, VipPortalGameRecordColumns } from '@/api/backend/adminSystem/lobbyGameRecordServer';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { AwardDetails } from '@/components/GachaponGameAwardSelector/index.vue';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { queryVipPortalGameRecord, SpendingType } from '@/api/backend/adminSystem/lobbyGameRecordServer';
import { listByMasterAgent } from '@/api/backend/member/vipServer';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import GachaponGameAwardSelector from '@/components/GachaponGameAwardSelector/index.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'GachaponGameRecordTable',
});

const { t } = useI18n('page.gachaponGameRecord');
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
  eventID?: string;
  playDateTime?: [Dayjs, Dayjs];
  spendingItemID?: string;
  spendingCurrencyType?: string;
  spendingBalance?: number;
  spendingTokenID?: string;
  gainItemID?: string;
  gainCurrencyType?: string;
  gainBalance?: number;
  gainTokenID?: string;
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  eventID: undefined,
  playDateTime: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
  spendingItemID: undefined,
  spendingCurrencyType: undefined,
  spendingBalance: undefined,
  spendingTokenID: undefined,
  gainItemID: undefined,
  gainCurrencyType: undefined,
  gainBalance: undefined,
  gainTokenID: undefined,
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
const shouldClear = ref(false);

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
    query.value.memberID = undefined;
    memberOptions.value = [];
  },
);

// ============ 總代理選擇器 ============
const isAgentIDDisabled = computed(() => userStore.level >= 4);
const agentIDOptions = ref<Array<{ label: string; value: string }>>([]);
const masterAgentList = ref<MasterAgentItem[]>([]);

// ============ 代理商選擇器 ============
const selectedMasterAgent = ref<string>('');
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

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = VipPortalGameRecordColumns & {
  id: number;
};

const getVipName = (vipLevel: number): string => {
  const foundVipSetting = vipSettings.value.find(s => s.vipLevel === vipLevel);
  return foundVipSetting ? foundVipSetting.name : 'unknown';
};

const getTreasureItemName = (itemID?: string): string => {
  const foundItem = treasureItemList.value.find(t => t.treasureItemID === itemID);
  return foundItem ? foundItem.itemName : 'unknown';
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
      return 'unknown';
  }
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('tables.roundID'),
    dataIndex: 'roundID',
    width: 150,
  },
  {
    title: t('tables.eventID'),
    dataIndex: 'eventID',
    width: 150,
  },
  {
    title: t('tables.memberID'),
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('tables.vip'),
    dataIndex: 'vip',
    width: 100,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getVipName(record.vip);
    },
  },
  {
    title: t('tables.spendingType'),
    dataIndex: 'spendingType',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return t(`awardType.${record.spendingType}`) || record.spendingType;
    },
  },
  {
    title: t('tables.spendingDetails'),
    dataIndex: 'spendingDetails',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getAwardDetails(
        record.spendingType,
        record.spendingCurrencyType,
        record.spendingBalance,
        record.spendingItemID,
        record.spendingItem,
      );
    },
  },
  {
    title: t('tables.spendingAmount'),
    dataIndex: 'spendingAmount',
    width: 120,
    align: 'right',
  },
  {
    title: t('tables.gainType'),
    dataIndex: 'gainType',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return t(`awardType.${record.gainType}`) || record.gainType;
    },
  },
  {
    title: t('tables.gainDetails'),
    dataIndex: 'gainDetails',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getAwardDetails(
        record.gainType,
        record.gainCurrencyType,
        record.gainBalance,
        record.gainItemID,
        record.spendingItem,
      );
    },
  },
  {
    title: t('tables.gainAmount'),
    dataIndex: 'gainAmount',
    width: 120,
    align: 'right',
  },
  {
    title: t('tables.playDateTime'),
    dataIndex: 'playDateTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

const loadTableData = async (_params: any) => {
  // 確保返回的數據格式正確
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agentID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: QueryVipPortalGameRecordParams = {
    masterAgent: appliedQuery.value.masterAgent,
    agentID: appliedQuery.value.agentID,
  };

  if (appliedQuery.value.memberID) {
    postData.memberID = appliedQuery.value.memberID;
  }

  if (appliedQuery.value.eventID) {
    postData.eventID = appliedQuery.value.eventID;
  }

  if (appliedQuery.value.playDateTime && appliedQuery.value.playDateTime[0] && appliedQuery.value.playDateTime[1]) {
    postData.playDateTime = {
      startTime: appliedQuery.value.playDateTime[0].toDate(),
      endTime: appliedQuery.value.playDateTime[1].toDate(),
    };
  }

  if (appliedQuery.value.spendingItemID) {
    postData.spendingItemID = appliedQuery.value.spendingItemID;
  }

  if (appliedQuery.value.spendingCurrencyType) {
    postData.spendingCurrencyType = appliedQuery.value.spendingCurrencyType;
  }

  if (appliedQuery.value.spendingBalance !== undefined) {
    postData.spendingBalance = appliedQuery.value.spendingBalance;
  }

  if (appliedQuery.value.spendingTokenID) {
    postData.spendingTokenID = appliedQuery.value.spendingTokenID;
  }

  if (appliedQuery.value.gainItemID) {
    postData.gainItemID = appliedQuery.value.gainItemID;
  }

  if (appliedQuery.value.gainCurrencyType) {
    postData.gainCurrencyType = appliedQuery.value.gainCurrencyType;
  }

  if (appliedQuery.value.gainBalance !== undefined) {
    postData.gainBalance = appliedQuery.value.gainBalance;
  }

  if (appliedQuery.value.gainTokenID) {
    postData.gainTokenID = appliedQuery.value.gainTokenID;
  }

  const actualConditions = pickByIdentity(postData, [undefined, '']) as QueryVipPortalGameRecordParams;

  try {
    const res = await queryVipPortalGameRecord(actualConditions);
    // 處理多種可能的 API 響應結構
    const resData = res as any;

    let items: VipPortalGameRecordColumns[] = [];
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

    const sortedItems = Array.isArray(items) ? [...items].sort((a: any, b: any) => (b.id || 0) - (a.id || 0)) : [];

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
    message.error(t('notify.connectionError') || '連接錯誤');
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
        return acc.concat(r.items);
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

  if (!val) {
    return;
  }

  await setVipSettingList(val);
  await setCurrencyTypeList(val);
  await setTreasureItemList(val);
  await getTokenList();

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

const _onAgentIDChanged = async (agentID: string) => {
  query.value.agentID = agentID;
  if (agentID && sMemberID.value) {
    const checkData = sMemberID.value.split('@');
    if (checkData[1] !== agentID) {
      query.value.memberID = undefined;
      shouldClear.value = true;
      await new Promise(resolve => setTimeout(resolve, 0));
      setTimeout(() => {
        shouldClear.value = false;
      }, 500);
    }
  }
  else {
    shouldClear.value = true;
    await new Promise(resolve => setTimeout(resolve, 0));
    setTimeout(() => {
      shouldClear.value = false;
    }, 500);
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
  memberOptions.value = [];
};

const onPlayDateTimeDatePickChanged = (value: [Dayjs, Dayjs] | [string, string] | null) => {
  if (value && Array.isArray(value) && value.length === 2) {
    // 如果是 Dayjs 數組，直接使用；如果是字符串數組，轉換為 Dayjs
    if (typeof value[0] === 'string') {
      query.value.playDateTime = [dayjs(value[0]), dayjs(value[1])];
    }
    else {
      query.value.playDateTime = value as [Dayjs, Dayjs];
    }
  }
  else {
    query.value.playDateTime = undefined;
  }
};

const onInputChanged = (details: AwardDetails) => {
  // 清空所有 spending 相關字段，然後只設置有值的字段
  query.value.spendingItemID = undefined;
  query.value.spendingBalance = undefined;
  query.value.spendingCurrencyType = undefined;
  query.value.spendingTokenID = undefined;

  // 根據 details 設置對應的字段
  if (details.itemID) {
    query.value.spendingItemID = details.itemID;
  }
  if (details.balance !== undefined) {
    query.value.spendingBalance = details.balance;
  }
  if (details.currencyType) {
    query.value.spendingCurrencyType = details.currencyType;
  }
  if (details.tokenID !== undefined) {
    query.value.spendingTokenID = details.tokenID.toString();
  }
};

const onOutputChanged = (details: AwardDetails) => {
  // 清空所有 gain 相關字段，然後只設置有值的字段
  query.value.gainItemID = undefined;
  query.value.gainBalance = undefined;
  query.value.gainCurrencyType = undefined;
  query.value.gainTokenID = undefined;

  // 根據 details 設置對應的字段
  if (details.itemID) {
    query.value.gainItemID = details.itemID;
  }
  if (details.balance !== undefined) {
    query.value.gainBalance = details.balance;
  }
  if (details.currencyType) {
    query.value.gainCurrencyType = details.currencyType;
  }
  if (details.tokenID !== undefined) {
    query.value.gainTokenID = details.tokenID.toString();
  }
};

const searchConditionValidator = (): void => {
  if (!query.value.masterAgent || !query.value.agentID) {
    message.error(t('notify.masterAgentAndAgentFieldMissed') || '總代理和代理商欄位不能為空');
    throw new Error('params missed');
  }
};

const handleFilter = async () => {
  searchConditionValidator();
  appliedQuery.value = {
    ...query.value,
    playDateTime: query.value.playDateTime ? [...query.value.playDateTime] as [Dayjs, Dayjs] : undefined,
  };
  await dynamicTableInstance?.reload?.(true);
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
      await setVipSettingList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await setTreasureItemList(userStore.masterAgent);
      await getTokenList();
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setVipSettingList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await setTreasureItemList(userStore.masterAgent);
      await getTokenList();
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
    await setVipSettingList(agentIDOptions.value[0].value);
    await setCurrencyTypeList(agentIDOptions.value[0].value);
    await setTreasureItemList(agentIDOptions.value[0].value);
    await getTokenList();
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
  <div class="app-container gachapon-table">
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

        <!-- 會員搜索 -->
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

        <!-- 活動ID -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.eventID') }}</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="query.eventID"
              style="width: 200px"
              allow-clear
            />
          </div>
        </div>

        <!-- 遊玩時間 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.playDateTime') }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.playDateTime"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="[t('datePicker.startDate'), t('datePicker.dueDate')]"
              style="width: 400px"
              @change="onPlayDateTimeDatePickChanged"
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

      <div class="wrap">
        <!-- 消耗 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.spending') }}</label>
          </div>
          <div class="long-input">
            <GachaponGameAwardSelector
              :currency-type-list="currencyTypeList"
              :treasure-item-list="treasureItemList"
              :token-type-list="tokenList"
              @on-award-detail-changed="onInputChanged"
            />
          </div>
        </div>

        <!-- 獲得 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.gain') }}</label>
          </div>
          <div class="long-input">
            <GachaponGameAwardSelector
              :currency-type-list="currencyTypeList"
              :treasure-item-list="treasureItemList"
              :token-type-list="tokenList"
              @on-award-detail-changed="onOutputChanged"
            />
          </div>
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
