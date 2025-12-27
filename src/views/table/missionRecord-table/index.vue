<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { request } from '@/utils/request';

defineOptions({
  name: 'MissionRecordTable',
});

const { t } = useI18n('page.task.missionRecordTable');
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
  missionName?: string;
  missionCreatedTime?: [Dayjs, Dayjs];
  missionCompletedTime?: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  missionName: undefined,
  missionCreatedTime: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
  missionCompletedTime: undefined,
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

// ============ 虛寶列表 ============
const treasureItemList = ref<TreasureItem[]>([]);

// ============ 幣別列表 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);

// ============ 代幣列表 ============
const tokenList = ref<TokenItem[]>([]);

// ============ 任務記錄數據類型 ============
interface MissionRecordItem {
  id: number;
  settingID: number;
  memberID: string;
  taskId?: string;
  missionCreatedTime?: string;
  missionCompletedTime?: string;
  missionCompleted: boolean;
  missionVip?: number;
  missTypeStr?: string;
  missionName?: string;
  awardItemsArr?: string[];
  setting?: any;
  accumulatedValue?: any;
  Nickname?: string;
}

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = MissionRecordItem & {
  id: number;
};

const getAwardItemsStr = (awardItemsArr?: string[]): string => {
  if (!awardItemsArr || awardItemsArr.length === 0) {
    return '';
  }
  return awardItemsArr.join('、');
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
  return foundItem ? foundItem.itemName : 'unknown';
};

const getTokenName = (tokenID?: string | number): string => {
  const found = tokenList.value.find(t => t.id === tokenID || t.id?.toString() === tokenID?.toString());
  return found ? found.name : 'unknown';
};

const getLoyaltyPointName = (group?: string): string => {
  if (group === 'Daily' || group === 'ContinuousDaily') {
    return t('enum.LoyaltyPointDaily') || '每日活躍點';
  }
  if (group === 'Weekly' || group === 'ContinuousWeekly') {
    return t('enum.LoyaltyPointWeekly') || '每週活躍點';
  }
  return group || 'unknown';
};

// ============ 對話框 ============
const isDialogVisible = ref(false);
const dialogData = ref<any>(null);

const onView = (row: MissionRecordItem) => {
  dialogData.value = row;
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  dialogData.value = null;
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('tables.settingID') || 'ID',
    dataIndex: 'settingID',
    width: 80,
  },
  {
    title: t('tables.memberID') || '會員ID',
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('tables.taskId') || '任務ID',
    dataIndex: 'taskId',
    width: 150,
  },
  {
    title: t('tables.missionCreatedTime') || '任務建立時間',
    dataIndex: 'missionCreatedTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCreatedTime ? dayjs(record.missionCreatedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.missionCompletedTime') || '任務完成時間',
    dataIndex: 'missionCompletedTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCompletedTime ? dayjs(record.missionCompletedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.missionCompleted') || '完成狀態',
    dataIndex: 'missionCompleted',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCompleted ? '完成' : '未完成';
    },
  },
  {
    title: t('tables.missionVip') || 'VIP',
    dataIndex: 'missionVip',
    width: 100,
  },
  {
    title: t('tables.missTypeStr') || '任務類型',
    dataIndex: 'missTypeStr',
    width: 150,
  },
  {
    title: t('tables.missionName') || '任務名稱',
    dataIndex: 'missionName',
    width: 200,
  },
  {
    title: t('tables.awardItemsArr') || '獎勵項目',
    dataIndex: 'awardItemsArr',
    width: 300,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getAwardItemsStr(record.awardItemsArr);
    },
  },
  {
    title: t('tables.control') || '操作',
    dataIndex: 'control',
    width: 100,
    fixed: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return h('a-button', {
        type: 'link',
        onClick: () => onView(record),
      }, () => t('view') || '查看');
    },
  },
]);

/**
 * ============ API 調用 ============
 */
const queryMissionRecords = async (params: {
  masterAgent: string;
  memberID: string;
  missionName?: string;
  missionCreatedTime?: { startTime: Date; endTime: Date };
  missionCompletedTime?: { startTime: Date; endTime: Date };
}) => {
  return request({
    url: '/AdminSystem/api/action/queryMissionRecords',
    method: 'post',
    data: {
      server: 'gameMissionSystem',
      actionName: 'queryMissionRecords',
      query: JSON.stringify(params),
    },
  });
};

const loadTableData = async (_params: any) => {
  // 確保返回的數據格式正確
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agentID || !appliedQuery.value.memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: any = {
    masterAgent: appliedQuery.value.masterAgent,
    memberID: appliedQuery.value.memberID,
  };

  if (appliedQuery.value.missionName) {
    postData.missionName = appliedQuery.value.missionName;
  }

  if (appliedQuery.value.missionCreatedTime && appliedQuery.value.missionCreatedTime[0] && appliedQuery.value.missionCreatedTime[1]) {
    postData.missionCreatedTime = {
      startTime: appliedQuery.value.missionCreatedTime[0].toDate(),
      endTime: appliedQuery.value.missionCreatedTime[1].toDate(),
    };
  }

  if (appliedQuery.value.missionCompletedTime && appliedQuery.value.missionCompletedTime[0] && appliedQuery.value.missionCompletedTime[1]) {
    postData.missionCompletedTime = {
      startTime: appliedQuery.value.missionCompletedTime[0].toDate(),
      endTime: appliedQuery.value.missionCompletedTime[1].toDate(),
    };
  }

  const actualConditions = pickByIdentity(postData, [undefined, '']) as any;

  try {
    const res = await queryMissionRecords(actualConditions);
    // 處理多種可能的 API 響應結構
    const resData = res as any;

    let items: MissionRecordItem[] = [];
    let total = 0;

    // 路徑 1: res.data (API 定義的結構)
    if (resData?.data && Array.isArray(resData.data)) {
      items = resData.data;
      total = resData.data.length;
    }
    // 路徑 2: res 本身就是陣列
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }
    // 確保 items 是數組
    else {
      items = [];
      total = 0;
    }

    // 處理數據格式
    const processedItems = items.map((item: any) => {
      let missionCompleted = false;
      if (item.missionCompletedTime !== null && item.missionCompletedTime !== undefined) {
        missionCompleted = true;
      }

      let settingName = item.setting?.name || '';
      if (item.setting?.group !== 'FreeCoin' && settingName) {
        try {
          const parsed = JSON.parse(settingName);
          settingName = parsed.default || settingName;
        }
        catch {
          // 如果解析失敗，使用原始值
        }
      }

      const processedItem: MissionRecordItem = {
        id: item.id || item.settingID || 0,
        settingID: item.settingID || item.id || 0,
        memberID: item.memberID || '',
        taskId: item.setting?.extraInfo?.taskId || '',
        missionCreatedTime: item.missionCreatedTime || item.createdTime,
        missionCompletedTime: item.missionCompletedTime,
        missionCompleted,
        missionVip: item.setting?.vip || item.missionVip,
        missTypeStr: item.missTypeStr || '',
        missionName: settingName,
        awardItemsArr: [],
        setting: item.setting,
        accumulatedValue: item.accumulatedValue,
        Nickname: item.Nickname || '',
      };

      // 處理獎勵項目
      if (item.accumulatedValue?.targets && Array.isArray(item.accumulatedValue.targets)) {
        const awardItemsArr: string[] = [];
        const isLoyalty = item.accumulatedValue.targets.length > 1;
        const currentValue = item.accumulatedValue.currentValue || 0;

        item.accumulatedValue.targets.forEach((target: any, targetIdx: number) => {
          if (target.isReceived === true) {
            if (isLoyalty === true) {
              awardItemsArr.push(`${t('labels.loyaltyBox') || '活躍寶箱'}${targetIdx + 1} => `);
            }
            target.rewards?.forEach((reward: any) => {
              if ((currentValue >= target.targetValue && missionCompleted === false && isLoyalty === true)
                || (currentValue >= target.targetValue && missionCompleted === true && isLoyalty === false)) {
                let rewardStr = '';
                switch (reward.type) {
                  case 1: // BALANCE
                    rewardStr = `${getCurrencyName(reward.currencyType)} : ${reward.balance}`;
                    break;
                  case 2: // TREASURE_ITEM
                    rewardStr = `${getTreasureItemName(reward.treasureItemID)} : ${reward.amount}`;
                    break;
                  case 3: // LOYALTY_POINT
                    rewardStr = `${getLoyaltyPointName(reward.group)} : ${reward.point}`;
                    break;
                  case 4: // TOKEN
                    rewardStr = `${getTokenName(reward.tokenID)} : ${reward.amount}`;
                    break;
                }
                if (rewardStr) {
                  awardItemsArr.push(rewardStr);
                }
              }
            });
          }
        });
        processedItem.awardItemsArr = awardItemsArr;
      }

      return processedItem;
    });

    const sortedItems = [...processedItems].sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

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
          const inItem: TreasureItem[] = [];
          r.items.forEach((item: any) => {
            if (item.enabled === 1 || item.enabled === true) {
              let itemName = item.itemName;
              if (typeof itemName === 'object') {
                itemName = itemName.tw || itemName.default || '';
              }
              else if (typeof itemName === 'string' && itemName.includes('{"default":')) {
                try {
                  const parsed = JSON.parse(itemName);
                  itemName = parsed.tw || parsed.default || itemName;
                }
                catch {
                  // 解析失敗，使用原始值
                }
              }
              inItem.push({ ...item, itemName });
            }
          });
          return [...acc, ...inItem];
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
      query.value.missionCreatedTime = [dayjs(value[0]), dayjs(value[1])];
    }
    else {
      query.value.missionCreatedTime = value as [Dayjs, Dayjs];
    }
  }
  else {
    query.value.missionCreatedTime = undefined;
  }
};

const onCompletedDateTimeDatePickChanged = (value: [Dayjs, Dayjs] | [string, string] | null) => {
  if (value && Array.isArray(value) && value.length === 2) {
    if (typeof value[0] === 'string') {
      query.value.missionCompletedTime = [dayjs(value[0]), dayjs(value[1])];
    }
    else {
      query.value.missionCompletedTime = value as [Dayjs, Dayjs];
    }
  }
  else {
    query.value.missionCompletedTime = undefined;
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

const handleFilter = async () => {
  try {
    searchConditionValidator();
    appliedQuery.value = {
      ...query.value,
      missionCreatedTime: query.value.missionCreatedTime ? [...query.value.missionCreatedTime] as [Dayjs, Dayjs] : undefined,
      missionCompletedTime: query.value.missionCompletedTime ? [...query.value.missionCompletedTime] as [Dayjs, Dayjs] : undefined,
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
  <div class="app-container mission-record-table">
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

        <!-- 任務名稱 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.missionName') || '任務名稱' }}</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="query.missionName"
              style="width: 200px"
              allow-clear
              placeholder="請輸入任務名稱"
            />
          </div>
        </div>

        <!-- 任務建立時間 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.missionCreatedTime') || '任務建立時間' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.missionCreatedTime"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="[t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間']"
              style="width: 400px"
              @change="onPlayDateTimeDatePickChanged"
            />
          </div>
        </div>

        <!-- 任務完成時間 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.missionCompletedTime') || '任務完成時間' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.missionCompletedTime"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="[t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間']"
              style="width: 400px"
              @change="onCompletedDateTimeDatePickChanged"
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

    <!-- 任務詳情對話框 -->
    <a-modal
      v-model:open="isDialogVisible"
      :title="t('dialog.title') || '任務詳情'"
      width="800px"
      :footer="null"
      @cancel="closeDialog"
    >
      <div v-if="dialogData" class="dialog-content">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="t('tables.settingID') || 'ID'">
            {{ dialogData.settingID }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.memberID') || '會員ID'">
            {{ dialogData.memberID }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.taskId') || '任務ID'">
            {{ dialogData.taskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionVip') || 'VIP'">
            {{ dialogData.missionVip || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionName') || '任務名稱'">
            {{ dialogData.missionName || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missTypeStr') || '任務類型'">
            {{ dialogData.missTypeStr || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCreatedTime') || '任務建立時間'">
            {{ dialogData.missionCreatedTime ? dayjs(dialogData.missionCreatedTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCompletedTime') || '任務完成時間'">
            {{ dialogData.missionCompletedTime ? dayjs(dialogData.missionCompletedTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCompleted') || '完成狀態'">
            {{ dialogData.missionCompleted ? '完成' : '未完成' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.awardItemsArr') || '獎勵項目'" :span="2">
            {{ getAwardItemsStr(dialogData.awardItemsArr) || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.mission-record-table {
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

  .dialog-content {
    padding: 20px 0;
  }
}
</style>
