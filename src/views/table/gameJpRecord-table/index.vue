<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { IGameRecord } from '@/api/backend/adminSystem/gameRecordServer';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { queryGameAward } from '@/api/backend/adminSystem/gameRecordServer';
import { gameList } from '@/api/backend/adminSystem/gameManagerServer';

import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'GameJpRecordTable',
});

const { t } = useI18n('page.gameJpRecord');
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

// ============ 查詢條件 ============
interface QueryState {
  agentID: string;
  account: string;
  accountID: string;
  memberID: string;
  memberIDstr: string;
  gameID: string;
  gameType: string;
  winType: string[];
  dateRange: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  agentID: '',
  account: '',
  accountID: '',
  memberID: '',
  memberIDstr: '',
  gameID: '',
  gameType: 'SlotGame',
  winType: ['GameJpWin', 'JackpotGame'],
  dateRange: [dayjs().startOf('day'), dayjs().endOf('day')],
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

// ============ 總代理選擇器 ============
const isAgentIDDisabled = computed(() => userStore.level >= 4);
const agentIDOptions = ref<Array<{ label: string; value: string }>>([]);
const masterAgentList = ref<MasterAgentItem[]>([]);

// ============ 代理商選擇器 ============
const selectedMasterAgent = ref<string>('');
const agentList = ref<Array<{ label: string; value: string }>>([]);
const selectedAgent = ref<string>('');
const isAgentDisabled = computed(() => userStore.level >= 5);

const onAgentIDChanged = async (agentID: string) => {
  if (agentID && sMemberID.value) {
    const checkData = sMemberID.value.split('@');
    if (checkData[1] !== agentID) {
      query.value.account = '';
      query.value.memberID = '';
      memberOptions.value = [];
    }
  }
  else {
    query.value.account = '';
    query.value.memberID = '';
    memberOptions.value = [];
  }
};

// ============ 遊戲列表 ============
const gameListOptions = ref<Array<{ label: string; value: string }>>([]);
const gameNameMap = ref<Map<string, string>>(new Map());

const fetchGameList = async () => {
  gameListOptions.value = [];
  gameNameMap.value.clear();
  if (!query.value.agentID) {
    return;
  }
  try {
    const masterAgent = getMasterAgentByAgentID(query.value.agentID);
    const res = await gameList({ masterAgent });
    const rows = Array.isArray(res) ? res : [];
    gameListOptions.value = rows.map((g: any) => {
      let gameName = g.gameName;
      if (g.language && g.language.tw) {
        gameName = `${g.gameName} (${g.language.tw})`;
      }
      gameNameMap.value.set(g.gameID, gameName);
      return {
        label: `${g.gameID} - ${gameName}`,
        value: g.gameID,
      };
    });
  }
  catch (error) {
    console.error('Failed to fetch game list:', error);
  }
};

const formatGameIDToName = (gameID: string): string => {
  return gameNameMap.value.get(gameID) || `not find gameID: ${gameID}`;
};

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = IGameRecord & {
  account: string;
  gameName: string;
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('column.roundID'),
    dataIndex: 'gameRecordID',
    width: 200,
  },
  {
    title: t('column.playTime'),
    dataIndex: 'playDateTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('labels.memberID'),
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('column.bet'),
    dataIndex: 'totalBet',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return Number(record.totalBet || 0).toLocaleString();
    },
  },
  {
    title: t('column.win'),
    dataIndex: 'totalWin',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const value = Number(record.totalWin || 0);
      const style = value > 0 ? { color: '#FF4949' } : {};
      return h('span', { style }, value.toLocaleString());
    },
  },
  {
    title: t('column.gameID'),
    dataIndex: 'gameID',
    width: 120,
  },
  {
    title: t('column.gameName'),
    dataIndex: 'gameName',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatGameIDToName(record.gameID);
    },
  },
]);

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.agentID || !appliedQuery.value.dateRange[0]) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const [start, end] = appliedQuery.value.dateRange;

  const postData: any = {
    agentID: appliedQuery.value.agentID,
    date: [start.toDate(), end.toDate()],
    page: 1,
    limit: 1000,
    gameType: appliedQuery.value.gameType,
    winType: appliedQuery.value.winType,
  };

  if (appliedQuery.value.gameID) {
    postData.gameID = appliedQuery.value.gameID;
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
    const res = await queryGameAward(postData);
    const resData = res as any;

    let items: IGameRecord[] = [];
    let total = 0;

    if (resData?.data?.items) {
      items = resData.data.items;
      total = resData.data.total || 0;
    }
    else if (Array.isArray(resData?.items)) {
      items = resData.items;
      total = resData.total || resData.items.length;
    }
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }

    // 處理資料
    const processedItems = items.map((item: any) => {
      // 從 gameRecord 中提取 totalBet 和 totalWin
      let totalBet = '';
      let totalWin = '';
      if (item.gameRecord) {
        totalBet = item.gameRecord.totalBet || '';
        totalWin = item.gameRecord.totalWin || '';
      }

      const account = item.memberID ? item.memberID.split('@')[0] : '';
      const gameName = formatGameIDToName(item.gameID);

      return {
        ...item,
        totalBet,
        totalWin,
        account,
        gameName,
      };
    });

    // 模擬請求時間
    await new Promise(resolve => setTimeout(resolve, 500));

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
    message.error(t('notify.emptyWarning'));
    return;
  }
  if (!query.value.dateRange || !query.value.dateRange[0]) {
    message.error(t('notify.dateRequired'));
    return;
  }

  if (query.value.account && query.value.accountID) {
    message.error(t('notify.bothAccountAndAccountIDExist'));
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

const onMasterAgentChanged = async (val: string) => {
  selectedMasterAgent.value = val;
  selectedAgent.value = '';
  agentList.value = [];

  if (val) {
    await fetchAgentList(val);
    if (agentList.value.length > 0 && userStore.level <= 4) {
      selectedAgent.value = agentList.value[0].value;
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      query.value.agentID = `${agentAccount}.${val}`;
    }
    else {
      query.value.agentID = val;
    }
  }
  else {
    query.value.agentID = '';
  }

  query.value.account = '';
  query.value.memberID = '';
  memberOptions.value = [];
  await fetchGameList();
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

  query.value.account = '';
  query.value.memberID = '';
  memberOptions.value = [];
  onAgentIDChanged(query.value.agentID);
  fetchGameList();
};

// ============ 會員ID字串輸入 ============
const memberIDstr = ref('');
const isMemberIDstrValid = ref(false);

const onMemberIDstrInput = (value: string) => {
  const regex = /^[a-zA-Z0-9]*$/;
  isMemberIDstrValid.value = !regex.test(value);
  query.value.memberIDstr = value;
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
      await fetchAgentList(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      if (agentList.value.length > 0) {
        selectedAgent.value = agentList.value[0].value;
        const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
        query.value.agentID = `${agentAccount}.${userStore.masterAgent}`;
      }
    }
  }
  else if (agentIDOptions.value.length > 0) {
    selectedMasterAgent.value = agentIDOptions.value[0].value;
    query.value.agentID = agentIDOptions.value[0].value;
    await fetchAgentList(agentIDOptions.value[0].value);
    if (agentList.value.length > 0) {
      selectedAgent.value = agentList.value[0].value;
      const agentAccount = selectedAgent.value.includes('.') ? selectedAgent.value.split('.')[0] : selectedAgent.value;
      query.value.agentID = `${agentAccount}.${agentIDOptions.value[0].value}`;
    }
  }

  await fetchGameList();
});
</script>

<template>
  <div class="app-container game_jp_record_table">
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

        <!-- 遊戲選擇器 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.gameID') }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.gameID"
              :options="gameListOptions"
              placeholder="請選擇遊戲"
              style="width: 200px"
              allow-clear
            />
          </div>
        </div>

        <!-- 日期選擇器 -->
        <div class="input_group">
          <div class="txt redText">
            <label>{{ t('labels.playTime') }}</label>
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
    </div>

    <DynamicTable
      row-key="id"
      :columns="columns"
      :data-request="loadTableData"
      :pagination="false"
    />
  </div>
</template>

<style lang="less" scoped>
.game_jp_record_table {
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

