<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  DailySignInRewardRecordItem,
  EAwardType,
} from '@/api/backend/marketingEvent';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import {
  queryDailySignInActivitySetting,
  queryDailySignInRewardRecord,
} from '@/api/backend/marketingEvent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { treasureItemList as queryTreasureItemList } from '@/api/backend/treasureChestSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'DailyLoginRewardRecordTable',
});

const { t } = useI18n('page.dailyLoginRewardRecord');
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

function dateTranNameStr(date: string | undefined): string {
  if (!date) {
    return '';
  }
  const nDay = new Date(date);
  return `${nDay.getFullYear()}-${nDay.getMonth() + 1}-${nDay.getDate()}`;
}

// ============ 查詢條件 ============
interface QueryState {
  memberID?: string;
  activityID?: number | null;
}

const query = ref<QueryState>({
  memberID: undefined,
  activityID: undefined,
});

// 只有按下「查詢」才套用
const appliedQuery = ref<QueryState>({ ...query.value });

// ============ 總代理選擇 ============
const masterAgent = ref('');
const agentID = ref('');

const isAgentIDDisabled = computed(() => userStore.level === 4 || userStore.level === 5);

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
    const masterAgentValue = getMasterAgentByAgentID(agentID.value);
    const res = await fuzzyQueryUser({
      masterAgent: masterAgentValue,
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
    sMemberID.value = `${selected.raw.account}@${selected.raw.agentID}`;
    sNickname.value = `${selected.raw.accountID} - ${selected.raw.nickName}`;
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

// ============ 活動列表 ============
const activityList = ref<Array<{ name: string; value: number }>>([]);
const activityLoading = ref(false);

const getDailySignInActivity = async (masterAgentValue: string) => {
  if (!masterAgentValue) {
    activityList.value = [];
    return;
  }

  activityLoading.value = true;
  try {
    const res = await queryDailySignInActivitySetting({
      masterAgent: masterAgentValue,
      status: 'all',
    });

    if (res && Array.isArray(res)) {
      const sorted = [...res].sort((a, b) => {
        return new Date(b.endDateTime).getTime() - new Date(a.startDateTime).getTime();
      });

      activityList.value = sorted.map(item => {
        const sDay = dateTranNameStr(item.startDateTime);
        const eDay = dateTranNameStr(item.endDateTime);
        const name = `${sDay} ~ ${eDay}`;
        return {
          name,
          value: item.activityID,
        };
      });
    }
    else {
      activityList.value = [];
    }
  }
  catch (error) {
    console.error('Failed to load activity list:', error);
    activityList.value = [];
  }
  finally {
    activityLoading.value = false;
  }
};

// ============ 總代理列表 ============
const masterAgentList = ref<Array<{ account: string; currencies?: Array<{ currencyName?: string; currencyCode?: string }> }>>([]);

// ============ 幣別列表 ============
const currencyList = ref<Array<{ name: string; value: string }>>([]);

const setCurrencyTypeList = async (masterAgentValue: string): Promise<void> => {
  currencyList.value = [];
  if (userStore.level === 4 || userStore.level === 5) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  else {
    const masterAgentData = masterAgentList.value.find(ma => ma.account === masterAgentValue);
    if (masterAgentData && masterAgentData.currencies && Array.isArray(masterAgentData.currencies)) {
      masterAgentData.currencies.forEach((currencyItem: any) => {
        if (currencyItem && typeof currencyItem === 'object' && currencyItem.currencyCode) {
          currencyList.value.push({
            name: currencyItem.currencyName || currencyItem.currencyCode,
            value: currencyItem.currencyCode,
          });
        }
      });
    }
  }
};

const fetchMasterAgentList = async () => {
  try {
    const list = await getMasterAgentAccountList();
    masterAgentList.value = list || [];
  }
  catch (error) {
    console.error('Failed to fetch master agent list:', error);
  }
};

// ============ 代幣列表 ============
const tokenList = ref<TokenItem[]>([]);

const getTokenList = async () => {
  if (!masterAgent.value) {
    tokenList.value = [];
    return;
  }

  try {
    const res = await queryTokens({ masterAgent: masterAgent.value });
    if (res && Array.isArray(res)) {
      tokenList.value = res;
    }
    else {
      tokenList.value = [];
    }
  }
  catch (error) {
    console.error('Failed to load token list:', error);
    tokenList.value = [];
  }
};

// ============ 道具列表 ============
const treasureItemList = ref<TreasureItem[]>([]);

const getTreasureItemList = async (masterAgentValue: string) => {
  if (!masterAgentValue) {
    treasureItemList.value = [];
    return;
  }

  try {
    const res = await queryTreasureItemList({ masterAgent: masterAgentValue });
    if (res?.rows) {
      treasureItemList.value = res.rows.reduce((acc: TreasureItem[], r) => {
        if (
          r.type === 'eventItem'
          || r.type === 'certificate'
          || r.type === 'entityItem'
          || r.type === 'freeScratchCard'
          || r.type === 'coupon'
          || r.type === 'dailyRewardPass'
        ) {
          const inItem: TreasureItem[] = [];
          r.items.forEach((item) => {
            if (item.enabled === 1 || item.enabled === true) {
              const itemName = getItemNameStr(item.itemName);
              inItem.push({
                ...item,
                itemName,
              });
            }
          });
          return [...acc, ...inItem];
        }
        else {
          return acc;
        }
      }, []);
    }
    else {
      treasureItemList.value = [];
    }
  }
  catch (error) {
    console.error('Failed to load treasure item list:', error);
    treasureItemList.value = [];
  }
};

function getItemNameStr(data: any): string {
  let re = data;
  if (typeof data === 'object') {
    re = data.tw || data.default || '';
  }
  else if (typeof data === 'string' && re.includes('{"default":')) {
    try {
      const parsed = JSON.parse(re);
      re = parsed.tw || parsed.default || '';
    }
    catch {
      re = data;
    }
  }
  return re || '';
}

// ============ 獎勵格式化 ============
function formatRewardData(data: DailySignInRewardRecordItem['rewardData'][0]): string {
  let result = '';

  switch (data.type) {
    case EAwardType.Currency: {
      const currency = currencyList.value.find(item => item.value === data.currencyType);
      if (currency) {
        result = `${currency.name} * ${data.balance || 0}`;
      }
      break;
    }
    case EAwardType.Treasures: {
      const treasure = treasureItemList.value.find(
        obj => obj.treasureItemID === data.treasureItemID,
      );
      if (treasure) {
        result = treasure.itemName || '';
      }
      break;
    }
    case EAwardType.Token: {
      const token = tokenList.value.find(obj => obj.id === data.tokenID);
      if (token) {
        result = `${token.name} * ${data.amount || 0}`;
      }
      break;
    }
    default:
      break;
  }

  return result;
}

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

const handleReload = () => {
  dynamicTableInstance?.reload?.(true);
};

interface ColumnsRowData extends DailySignInRewardRecordItem {
  userName?: string;
  name?: string;
  vipStr?: string;
  rewardDataStr?: string[];
  typeStr?: string;
}

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: '#',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('typeStr') || '種類',
    dataIndex: 'typeStr',
    width: 120,
  },
  {
    title: t('queryFormActivityID') || '期別',
    dataIndex: 'name',
    width: 200,
  },
  {
    title: t('userName') || '會員',
    dataIndex: 'userName',
    width: 200,
  },
  {
    title: 'VIP',
    dataIndex: 'vipStr',
    width: 100,
  },
  {
    title: t('rewardDataStr') || '獎項',
    dataIndex: 'rewardDataStr',
    width: 300,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      if (!record.rewardDataStr || !Array.isArray(record.rewardDataStr)) {
        return '';
      }
      return h('div', record.rewardDataStr.map((item, idx) => {
        return h('div', { key: idx }, item);
      }));
    },
  },
  {
    title: t('signInDate') || '領取時間',
    dataIndex: 'signInDate',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.signInDate ? dayjs(record.signInDate).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

/**
 * ============ 事件處理 ============
 */
const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val || '';
  agentID.value = val || '';
  sMemberID.value = '';
  sNickname.value = '';
  query.value.memberID = undefined;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  // 更新幣別列表
  await setCurrencyTypeList(masterAgent.value);

  // 重新載入活動列表、代幣列表、道具列表
  getDailySignInActivity(masterAgent.value);
  getTokenList();
  getTreasureItemList(masterAgent.value);
};

const searchConditionValidator = (): void => {
  if (!query.value.memberID) {
    message.error(t('notify.requiredMemberID') || '會員為必要數值');
    throw new Error('memberID missed');
  }
  if (!query.value.activityID) {
    message.error(t('notify.requiredActivityID') || '期別為必要數值');
    throw new Error('activityID missed');
  }
};

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.memberID || !appliedQuery.value.activityID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData = {
    masterAgent: masterAgent.value,
    activityID: Number(appliedQuery.value.activityID),
    memberID: appliedQuery.value.memberID,
  };

  try {
    const res = await queryDailySignInRewardRecord(postData);
    const resData = res as any;

    let items: ColumnsRowData[] = [];
    let total = 0;

    if (resData && Array.isArray(resData)) {
      items = resData.map((item: DailySignInRewardRecordItem) => {
        let rewardData: string[] = [];
        let typeStr = '登入獎勵';
        if (!item.id) {
          typeStr = '簽到獎勵';
        }

        const sDay = dateTranNameStr(item.startDate);
        const eDay = dateTranNameStr(item.endDate);
        const name = item.startDate ? `${sDay} ~ ${eDay}` : '';

        if (item.rewardData && Array.isArray(item.rewardData)) {
          rewardData = item.rewardData.map(obj => formatRewardData(obj)).filter(Boolean);
        }

        return {
          ...item,
          userName: sNickname.value,
          name,
          vipStr: item.vipLevel ? `VIP${item.vipLevel}` : '',
          rewardDataStr: rewardData,
          typeStr,
        };
      });
      total = items.length;
    }
    else {
      items = [];
      total = 0;
    }

    return {
      items,
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
    };
    handleReload();
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
      masterAgent.value = userStore.masterAgent;
      agentID.value = userStore.agent;
      await onMasterAgentChanged(masterAgent.value);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      masterAgent.value = userStore.masterAgent;
      agentID.value = userStore.masterAgent;
      await onMasterAgentChanged(masterAgent.value);
    }
  }
});
</script>

<template>
  <div class="app-container daily-login-reward-record-table">
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
              v-model="masterAgent"
              value-type="account"
              :disabled="isAgentIDDisabled"
              @update:model-value="onMasterAgentChanged"
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
              :disabled="!agentID"
              style="width: 200px"
              allow-clear
              placeholder="00001314 - 王小明"
              @search="onMemberSearch"
              @change="onMemberSelectChanged"
              @popup-scroll="onMemberPopupScroll"
            />
          </div>
        </div>

        <!-- 期別選擇 -->
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">{{ t('queryFormActivityID') || '期別' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-select
              v-model:value="query.activityID"
              :loading="activityLoading"
              :disabled="!masterAgent"
              style="width: 300px"
              allow-clear
              placeholder="請選擇期別"
            >
              <a-select-option
                v-for="item in activityList"
                :key="item.value"
                :value="item.value"
              >
                {{ item.name }}
              </a-select-option>
            </a-select>
          </div>
        </div>

        <!-- 查詢按鈕 -->
        <div class="input_group">
          <a-button
            type="primary"
            class="input_btn"
            :disabled="!query.activityID || !query.memberID"
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

    <!-- 表格 -->
    <DynamicTable
      :columns="columns"
      :data-request="loadTableData"
      :scroll="{ x: 'max-content' }"
    />
  </div>
</template>

<style lang="less" scoped>
.daily-login-reward-record-table {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    background-color: #e7e7e7;
    .item {
      margin-top: 10px;
    }
    .input_btn {
      margin: 10px 0;
    }
  }
  .date_picker {
    display: flex;
    align-items: center;
  }
  .input_group {
    display: flex;
    padding: 10px;
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
      width: 280px;
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

