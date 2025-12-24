<script lang="ts" setup>
import type { TableColumnType } from 'ant-design-vue';
import type { IGetStatisticsInputs } from '@/api/backend/adminSystem/gameStatistics';
import { SearchOutlined } from '@ant-design/icons-vue';
import { Button as AButton, Col as ACol, Pagination as APagination, Row as ARow, Table as ATable } from 'ant-design-vue';
// TODO: currency util not migrated from Vue2 yet
// import currency from 'currency.js';
import dayjs from 'dayjs';

import { computed, h, onMounted, ref, watch } from 'vue';
import { queryAccountsNickName } from '@/api/backend/adminSystem/accountSystem';
import { gameList, getGamePlayerLists, globalGameList } from '@/api/backend/adminSystem/gameManagerServer';
import { getStatistics } from '@/api/backend/adminSystem/gameStatistics';
// TODO: AgentIDSelector 組件需要從 Vue2 遷移到 Vue3
// import AgentIDSelector from '@/components/AgentIDSelector/AgentIDSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { CurrencySymbol } from '@/utils/currencySymbol';

defineOptions({
  name: 'DashboardMabu',
});

const { t } = useI18n();
const userStore = useUserStore();

const currencyType = ref<string>('');
const agentID = ref<string>('');
const gameList = ref<Record<string, string>>({});
const listLoading = ref(false);
const hasNickNameList = ref<Record<string, string>>({});
/**
 * 股東
 */
const selectedShareholder = ref<string>('');
const customShareholderList = ref([{ name: '無股東', value: '__NO_MATCH__' }]);
const masterAgentList = ref<any[]>([]);

// 搜尋條件
const searchConditions = ref<IGetStatisticsInputs>({
  startSearchTime: dayjs().startOf('day').toDate(),
  endSearchTime: dayjs().endOf('day').toDate(),
  optionValue: 'dayTime',
  memberID: '',
  agent: '',
  masterAgent: '',
  gameType: '',
  countType: '',
  currencyType: '',
  shareholder: '',
});

// 統計結果
interface SearchResult {
  totalBet: number;
  totalWin: number;
  onlineMember: number;
  onlineMemberList: Array<{
    account: string;
    masterAgent?: string;
    agentID?: string;
    gameID: string;
    memberID?: string;
    id?: string;
  }>;
}

const searchResult = ref<SearchResult>({
  totalBet: 0,
  totalWin: 0,
  onlineMember: 0,
  onlineMemberList: [],
});

const playerTablePage = ref(1);
const playerTableLimit = ref(10);

const getAuthLevel = computed(() => userStore.level);
const getShareholder = computed(() => userStore.shareholder);
const getMasterAgent = computed(() => userStore.masterAgent);
const getUserAgent = computed(() => userStore.agent);

// 分頁數據
const paginatedData = computed(() => {
  const start = (playerTablePage.value - 1) * playerTableLimit.value;
  const end = start + playerTableLimit.value;
  return searchResult.value.onlineMemberList.slice(start, end);
});

// 表格列定義
const columns = computed<TableColumnType[]>(() => [
  {
    title: t('page.dashboard.player'),
    width: 200,
    align: 'center',
    dataIndex: 'memberID',
    key: 'player',
    customRender: ({ record }: any) => {
      return hasNickNameList.value[record.memberID] || record.account;
    },
  },
  {
    title: t('page.dashboard.masterAgent'),
    width: 200,
    align: 'center',
    dataIndex: 'masterAgent',
    key: 'masterAgent',
  },
  {
    title: t('page.dashboard.agent'),
    width: 200,
    align: 'center',
    dataIndex: 'agentID',
    key: 'agent',
  },
  {
    title: t('page.dashboard.game'),
    width: 200,
    align: 'center',
    dataIndex: 'gameID',
    key: 'game',
    customRender: ({ record }: any) => {
      return `${record.gameID} - ${gameList.value[record.gameID] || record.gameID}`;
    },
  },
]);

const clearSearchResult = () => {
  searchResult.value = {
    totalBet: 0,
    totalWin: 0,
    onlineMember: 0,
    onlineMemberList: [],
  };
};

const getOnlineMember = async () => {
  playerTablePage.value = 1;
  playerTableLimit.value = 20;
  // 加總每個遊戲中的人數
  searchResult.value.onlineMember = 0;
  searchResult.value.onlineMemberList = [];
  listLoading.value = true;

  let postData: any = {
    masterAgents: [],
    agent: '',
  };

  if (!searchConditions.value.masterAgent) {
    postData.agent = undefined;
    let shareholder: any = '';
    if (selectedShareholder.value !== '__NO_MATCH__') {
      shareholder = searchConditions.value.shareholder;
    }
    if (getAuthLevel.value >= 3) {
      shareholder = getShareholder.value;
    }
    postData.masterAgents = masterAgentList.value
      .filter(m => m.shareholder === shareholder)
      .map(m => m.account);
  }
  else {
    postData.masterAgents = [searchConditions.value.masterAgent];
    if (!searchConditions.value.agent) {
      postData.agent = undefined;
    }
    else {
      postData.agent = searchConditions.value.agent;
    }
  }

  try {
    const result: any = await getGamePlayerLists(postData);
    let memberIDs: any[] = [];

    postData.masterAgents.forEach(async (masterAgent: string) => {
      const gamePlayerData = result.data[masterAgent];
      if (!gamePlayerData || !gamePlayerData.gamePlayerList) { return; }

      const gameIDs = Object.keys(gamePlayerData.gamePlayerList);
      gameIDs.forEach((gameID: string) => {
        const playerlist: string[] = gamePlayerData.gamePlayerList[gameID];
        searchResult.value.onlineMember += playerlist.length;
        playerlist.forEach((player: string) => {
          memberIDs.push(player);
          const masterAgentFromPlayer = player.split('@')[1]?.split('.')[1];
          searchResult.value.onlineMemberList.push({
            account: player.split('@')[0],
            masterAgent: masterAgentFromPlayer,
            agentID: player.split('@')[1]?.split('.')[0],
            gameID,
            memberID: player,
            id: player,
          });
        });
      });
    });

    hasNickNameList.value = {};
    if (memberIDs.length > 0) {
      const res2: any = await queryAccountsNickName({
        memberIDs,
      });
      if (res2.data?.result) {
        res2.data.result.forEach((item: any) => {
          const memberID = item.memberID;
          hasNickNameList.value[memberID] = `${item.accountID} - ${item.nickName}`;
        });
      }
    }
  }
  catch (error) {
    console.error('獲取在線會員失敗:', error);
  }
  finally {
    setTimeout(() => {
      listLoading.value = false;
    }, 500);
  }
};

const searchHandler = async () => {
  if (selectedShareholder.value && selectedShareholder.value !== '__NO_MATCH__') {
    // admin cg shareholder
    searchConditions.value.shareholder = selectedShareholder.value;
  }
  if (getAuthLevel.value >= 3 && getShareholder.value) {
    // masteragent agent
    searchConditions.value.shareholder = getShareholder.value;
  }
  if (searchConditions.value.agent) {
    searchConditions.value.agent = searchConditions.value.agent.split('.')[0];
  }

  // 如果沒有選擇 masterAgent，使用當前用戶的 masterAgent
  if (!searchConditions.value.masterAgent && getMasterAgent.value) {
    searchConditions.value.masterAgent = getMasterAgent.value;
  }

  try {
    const result = await getStatistics(searchConditions.value);
    const staticsResult = result.data?.items?.[0];
    await getOnlineMember();

    if (!staticsResult) {
      clearSearchResult();
      return;
    }

    searchResult.value.totalBet = staticsResult.totalBet || 0;
    searchResult.value.totalWin = staticsResult.totalWinlose || 0;
  }
  catch (error) {
    console.error('查詢統計失敗:', error);
  }
};

const onShareholderChanged = async (payload: { shareholder: string }) => {
  // console.log("onShareholderChanged", payload);
};

const onMasterAgentChanged = async (payload: any) => {
  console.log('onMasterAgentChanged', payload);
  clearSearchResult();
  if (payload?.currencyType) {
    currencyType.value = payload.currencyType;
  }
  if (payload?.masterAgent) {
    searchConditions.value.masterAgent = payload.masterAgent;
  }
  searchResult.value.onlineMemberList = [];
  await getNameList();
};

/**
 * 取得 遊戲清單 各語系名稱 dialog
 */
const getNameList = async () => {
  gameList.value = {};
  let res: any;

  try {
    if (getAuthLevel.value <= 2) {
      res = await globalGameList();
    }
    else {
      const masterAgent = searchConditions.value.masterAgent;
      if (masterAgent) {
        res = await gameList({ masterAgent });
      }
    }

    if (res?.data) {
      res.data.forEach((item: any) => {
        let gameName = item.gmaeName || item.gameName;
        if (item.language && item.language.tw) {
          gameName = item.language.tw;
        }
        gameList.value[item.gameID] = gameName;
      });
    }
  }
  catch (error) {
    console.error('獲取遊戲清單失敗:', error);
  }
};

// TODO: currency util not migrated from Vue2 yet
/**
 * 暫時使用簡單的數字格式化，待 currency.js 遷移後恢復完整功能
 */
const financial = (x: any) => {
  // const temp = currency(x, { separator: ',' }).format();
  // 暫時使用簡單格式化
  const num = Number(x) || 0;
  const temp = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const result = addSymbol(temp);
  return result;
};

const addSymbol = (src: string) => {
  const symbol = CurrencySymbol.symbol(currencyType.value as any);
  return `${symbol}${src}`;
};

const handleAllList = (list: any) => {
  // console.log("🌍 全部 masterAgent 清單", list);
  masterAgentList.value = list;
};

watch(
  () => searchConditions.value.agentID,
  async (newAgentID: string) => {
    // await this.getOnlineMember();
  },
);
</script>

<template>
  <div class="dashboard">
    <div class="displayColorBlock">
      <!-- 三個顯示色塊 -->
      <ARow v-if="currencyType" :gutter="20">
        <ACol :xs="24" :sm="8">
          <div class="todayTotalBet block">
            <div class="txt">
              <h1>{{ financial(searchResult.totalBet) }}</h1>
              <div class="title">
                {{ $t('page.dashboard.totalBet') }}
              </div>
            </div>
            <div class="icon" />
          </div>
        </ACol>
        <ACol :xs="24" :sm="8">
          <div class="todayTotalWin block">
            <div class="txt">
              <h1>{{ financial(searchResult.totalWin) }}</h1>
              <div class="title">
                {{ $t('page.dashboard.totalWin') }}
              </div>
            </div>
            <div class="icon" />
          </div>
        </ACol>
        <ACol :xs="24" :sm="8">
          <div class="currentOnlineMember block">
            <div class="txt">
              <h1>{{ searchResult.onlineMember }}</h1>
              <div class="title">
                {{ $t('page.dashboard.onlineMember') }}
              </div>
            </div>
            <div class="icon" />
          </div>
        </ACol>
      </ARow>
    </div>
    <div class="wrap">
      <!-- TODO: AgentIDSelector 組件需要從 Vue2 遷移到 Vue3 -->
      <!-- 暫時註釋，等待 AgentIDSelector 組件遷移完成後再啟用 -->
      <!--
      <AgentIDSelector
        v-show="getAuthLevel < 5"
        v-model:agent-i-d="searchConditions.agent"
        :shareholder-clearable="false"
        :is-show-shareholder="true"
        v-model:shareholder="selectedShareholder"
        :custom-shareholder-list="customShareholderList"
        @onMasterAgentChanged="onMasterAgentChanged"
        @onMasterAgentListAll="handleAllList"
        @onShareholderChanged="onShareholderChanged"
      />
      -->
      <!-- 查詢送出 -->
      <div class="input_group">
        <AButton type="primary" :icon="h(SearchOutlined)" @click="searchHandler">
          {{ $t('search') }}
        </AButton>
      </div>
    </div>
    <div class="app-container">
      <div class="filter-container">
        <div class="title">
          <h1>{{ $t('page.dashboard.livePlayer') }}</h1>
        </div>
        <ATable
          :loading="listLoading"
          :row-key="(record) => record.id || record.memberID"
          :data-source="paginatedData"
          :columns="columns"
          :pagination="false"
          bordered
          :scroll="{ x: 801 }"
        />
        <APagination
          v-if="searchResult.onlineMemberList.length > 0"
          v-model:current="playerTablePage"
          v-model:page-size="playerTableLimit"
          :total="searchResult.onlineMemberList.length"
          :show-size-changer="true"
          :show-total="(total) => `共 ${total} 條`"
          class="pagination"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  h1 {
    letter-spacing: -0.015em;
    font-size: 25px;
    font-family: inherit;
    font-weight: 400;
    line-height: 1.5;
    color: inherit;
    margin: 0 !important;
  }

  .displayColorBlock {
    background-color: #e7e7e7;
    padding: 10px 10px 0 10px;

    .todayTotalBet {
      background-color: #ffa726;
      border-color: #ffa726;
    }

    .todayTotalWin {
      background-color: #9c6a58;
      border-color: #9c6a58;
    }

    .currentOnlineMember {
      background-color: #26a69a;
      border-color: #26a69a;
    }

    :deep(.ant-col) {
      margin-bottom: 20px;
    }

    .block {
      display: flex;
      color: white;
      padding: 15px;
    }

    .wrap {
      display: flex;
      flex-wrap: wrap;
      background-color: #e7e7e7;

      .item {
        margin: 10px;
      }
    }
  }

  .title {
    width: 160px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 10px;
  }

  .wrap {
    display: flex;
    flex-wrap: wrap;
    background-color: #e7e7e7;
    padding: 10px;

    .input_group {
      margin: 10px;
    }
  }

  .app-container {
    padding: 20px;

    .filter-container {
      .title {
        margin-bottom: 20px;
      }

      .pagination {
        margin-top: 20px;
        text-align: right;
      }
    }
  }
}
</style>
