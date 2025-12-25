<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import { queryGrandPrizeRecord } from '@/api/backend/adminSystem/gameRecordServer';
import { fuzzyQueryUser, type FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { IGrandPrizeRecordsColumn } from '@/api/backend/adminSystem/gameRecordServer';

defineOptions({
  name: 'GrandPrizeRecordTable',
});

const { t } = useI18n('page.grandPrizeRecord');
const userStore = useUserStore();

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  memberID: string;
  memberAccount: string;
  gameID: string;
  dateRange: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  memberID: '',
  memberAccount: '',
  gameID: '',
  dateRange: [dayjs().startOf('day'), dayjs().endOf('day')],
});

// 只有按下「查詢」才套用
const appliedQuery = ref<QueryState>({ ...query.value });

// ============ 總代理選擇器 ============
const masterAgentOptions = ref<Array<{ label: string; value: string }>>([]);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);

const fetchMasterAgents = async () => {
  const list = await getMasterAgentList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));
};

const onMasterAgentChanged = async (val: string) => {
  query.value.masterAgent = val;
  query.value.memberID = '';
  query.value.memberAccount = '';
  query.value.gameID = '';
  memberOptions.value = [];
  await fetchGameList();
};

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const resetMemberSelector = () => {
  query.value.memberID = '';
  query.value.memberAccount = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!query.value.masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const res = await fuzzyQueryUser({
      masterAgent: query.value.masterAgent,
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

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);

const onMemberSelectChanged = (val: string) => {
  query.value.memberID = val;
  const matched = memberOptions.value.find(o => o.value === val);
  query.value.memberAccount = matched?.raw?.account || '';
};

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) {
    return;
  }
  if (!memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }

  await fetchMemberOptions(memberLastQueryText.value, true);
};

watch(
  () => query.value.masterAgent,
  () => resetMemberSelector(),
);

// ============ 遊戲列表 ============
const gameListOptions = ref<Array<{ label: string; value: string }>>([]);

const fetchGameList = async () => {
  gameListOptions.value = [];
  if (!query.value.masterAgent) {
    return;
  }
  try {
    const res = await gameList({ masterAgent: query.value.masterAgent });
    const rows = Array.isArray(res) ? res : [];
    const filtered = rows.filter((g: any) => {
      if (!g.extraInfo) {
        return false;
      }
      if (g.extraInfo.gameStatus) {
        return g.extraInfo.gameStatus.includes('FreeGame') || g.extraInfo.gameStatus.includes('BonusGame1');
      }
      return true;
    });

    gameListOptions.value = filtered.map((g: any) => {
      let gameName = g.gameName;
      if (g.language && g.language.tw) {
        gameName = g.language.tw;
      }
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

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

const columns = ref<TableColumn<IGrandPrizeRecordsColumn>[]>([
  {
    title: 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('column.gameID'),
    dataIndex: 'gameID',
    width: 120,
  },
  {
    title: t('column.lobbyID'),
    dataIndex: 'lobbyName',
    width: 150,
  },
  {
    title: t('column.seatID'),
    dataIndex: 'seatID',
    width: 100,
    customRender: ({ record }) => {
      const seatID = Number(record.seatID) + 1;
      return seatID.toString().padStart(3, '0');
    },
  },
  {
    title: t('column.memberID'),
    dataIndex: 'memberID',
    width: 150,
  },
  {
    title: t('column.totalBetL'),
    dataIndex: 'totalBet',
    width: 120,
    align: 'right',
    customRender: ({ record }) => {
      return Number(record.totalBet).toLocaleString();
    },
  },
  {
    title: t('column.totalWin'),
    dataIndex: 'totalWin',
    width: 120,
    align: 'right',
    customRender: ({ record }) => {
      return Number(record.totalWin).toLocaleString();
    },
  },
  {
    title: t('column.odds'),
    dataIndex: 'odds',
    width: 100,
    align: 'right',
    customRender: ({ record }) => {
      return Number(record.odds).toLocaleString();
    },
  },
  {
    title: t('column.isFavorite'),
    dataIndex: 'isFavorite',
    width: 100,
    customRender: ({ record }) => {
      return record.isFavorite ? 'True' : 'Disable';
    },
  },
  {
    title: t('column.playDateTime'),
    dataIndex: 'playDateTime',
    width: 180,
    customRender: ({ record }) => {
      return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.createdAt'),
    dataIndex: 'createdAt',
    width: 180,
    customRender: ({ record }) => {
      return record.createdAt ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

const loadTableData = async (params: any) => {
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.memberID || !appliedQuery.value.dateRange[0]) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const [start, end] = appliedQuery.value.dateRange;

  const postData: any = {
    masterAgent: appliedQuery.value.masterAgent,
    memberID: appliedQuery.value.memberAccount,
    date: [start.toDate(), end.toDate()],
    page: 1,
    limit: 1000,
  };

  if (appliedQuery.value.gameID) {
    postData.gameID = appliedQuery.value.gameID;
  }

  try {
    const res = await queryGrandPrizeRecord(postData);
    // 兼容不同的返回結構
    const items = res?.data?.items || res?.items || [];
    return {
      items,
      meta: {
        totalItems: items.length,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    return { items: [], meta: { totalItems: 0 } };
  }
};

const handleFilter = async () => {
  if (!query.value.memberID || !query.value.dateRange || !query.value.dateRange[0]) {
    message.error(t('notify.required'));
    return;
  }

  appliedQuery.value = {
    ...query.value,
    dateRange: [...query.value.dateRange] as [Dayjs, Dayjs],
  };

  await dynamicTableInstance?.reload?.(true);
};

onMounted(async () => {
  await fetchMasterAgents();

  if (userStore.level >= 4) {
    query.value.masterAgent = userStore.masterAgent;
  }
  else {
    query.value.masterAgent = masterAgentOptions.value[0]?.value || '';
  }

  if (query.value.masterAgent) {
    await fetchGameList();
  }

  query.value.dateRange = [dayjs().startOf('day'), dayjs().endOf('day')];
});
</script>

<template>
  <div class="app-container grand_prize_record">
    <div class="filter-container">
      <div class="wrap">
        <!-- 總代理選擇器 -->
        <div
          v-if="!isMasterAgentDisabled"
          class="input_group"
        >
          <div class="txt">
            <label>總代理</label>
          </div>
          <div class="my_input">
            <AdminAccountSelector
              v-model="query.masterAgent"
              value-type="account"
              :disabled="isMasterAgentDisabled"
              @update:model-value="onMasterAgentChanged"
            />
          </div>
        </div>

        <!-- 會員搜索 -->
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">{{ t('column.memberID') }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="query.memberID"
              show-search
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!query.masterAgent"
              style="width: 200px"
              allow-clear
              @search="onMemberSearch"
              @change="onMemberSelectChanged"
              @popup-scroll="onMemberPopupScroll"
            />
          </div>
        </div>

        <!-- 遊戲選擇器 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('column.gameID') }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.gameID"
              :options="gameListOptions"
              :disabled="!query.masterAgent"
              style="width: 280px"
              allow-clear
              show-search
              :filter-option="(input, option) => {
                const label = option?.label || '';
                return label.toLowerCase().includes(input.toLowerCase());
              }"
            />
          </div>
        </div>

        <!-- 日期選擇器 -->
        <div class="input_group">
          <div
            class="txt"
            style="color: #ff4949"
          >
            <label>{{ t('column.sendTime') }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.dateRange"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :allow-clear="false"
            />
          </div>
        </div>

        <!-- 查詢按鈕 -->
        <div class="input_group">
          <div class="txt">
            <a-button
              type="primary"
              @click="handleFilter"
            >
              {{ t('common.search') }}
            </a-button>
          </div>
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
.grand_prize_record {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    background-color: #e7e7e7;
    align-items: center;

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

