<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { Dayjs } from 'dayjs';

import type { TableColumnItem } from './columns';
import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { DateType, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';

import { fuzzyQueryUser, queryAccountPersonalInfo } from '@/api/backend/adminSystem/accountSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getColumns } from './columns';

defineOptions({
  name: 'MemberPersonalInfo',
});

const { t } = useI18n('routes.member.memberPersonalInfoPage');
const userStore = useUserStore();

// ============ Phase 1：對齊 Vue2「查詢區」結構/行為 ============
// - 總代理（masterAgent）下拉
// - 代理（agent）依總代理變動
// - 會員（member）輸入即查詢 + 下拉選單（autocomplete）
// - 日期類別（createdAt / lastLoginTime）
// - 日期區間
// - 快捷時間（昨日/今日/本週/上週/本月/上月）

const buildTodayRange = (): [Dayjs, Dayjs] => [dayjs().startOf('day'), dayjs().endOf('day')];

interface QueryState {
  masterAgent: string;
  agent: string;
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  memberAccount: string; /**
                          * 實際送 API：account
                          */
  dateType: DateType; /**
                       * createdAt | lastLoginTime（對齊 Vue2）
                       */
  dateRange: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  agent: '',
  memberID: '',
  memberAccount: '',
  dateType: 'createdAt',
  dateRange: buildTodayRange(),
});

// 只有按下「查詢」才套用（對齊 Vue2：不是邊改條件邊查）
const appliedQuery = ref<QueryState>({ ...query.value });

/**
 * 保留與 Vue2 相容的 agentID 組字規則（避免重複拼接）
 */
const buildAgentID = (agent: string, masterAgent: string) => {
  if (!agent || !masterAgent) {
    return '';
  }
  if (agent.includes('.')) {
    return agent;
  }
  return `${agent}.${masterAgent}`;
};

// masterAgent / agent options
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const agentOptions = ref<DefaultOptionType[]>([]);
const agentRawList = ref<AgentItem[]>([]);

const isMasterAgentDisabled = computed(() => userStore.level >= 4);
const isAgentDisabled = computed(() => userStore.level >= 5 || !query.value.masterAgent);

const fetchMasterAgents = async () => {
  const list = await getMasterAgentList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));
};

const fetchAgents = async (masterAgent: string) => {
  if (!masterAgent) {
    agentRawList.value = [];
    agentOptions.value = [];
    return;
  }
  const list = await getAgentListByMasterAgent({ masterAgent });
  agentRawList.value = list || [];
  // 對齊需求：若後端回傳 `代理.總代`，下拉顯示只要 `代理`
  agentOptions.value = (list || []).map((i) => {
    const agentText = i.account.includes('.') ? i.account.split('.')[0] : i.account;
    return { label: agentText, value: i.account };
  });
};

// ============ 會員輸入即查詢（對齊 Vue2 SearchMemberID remoteMethod）===========

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
    message.error(t('filters.masterAgentRequired'));
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

  // 接近底部 -> load more（對齊 Vue2 v-loadmore）
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) {
    return;
  }
  if (!memberLastQueryText.value) {
    return;
  }
  if (!memberLastAccountID.value) {
    return;
  }

  await fetchMemberOptions(memberLastQueryText.value, true);
};

// masterAgent / agent 變更時，清空 member（對齊 Vue2 Watch masterAgent/agent 行為）
watch(
  () => query.value.masterAgent,
  () => resetMemberSelector(),
);
watch(
  () => query.value.agent,
  () => resetMemberSelector(),
);

const onMasterAgentChanged = async (val: string) => {
  query.value.masterAgent = val;
  query.value.agent = '';
  resetMemberSelector();

  await fetchAgents(val);

  // 對齊 Vue2 AgentIDSelector：選完 masterAgent 會自動選第一個 agent（非 agent-level）
  if (userStore.level <= 4 && agentRawList.value.length > 0) {
    query.value.agent = agentRawList.value[0].account;
  }
};

const onAgentChanged = (val: string) => {
  query.value.agent = val;
  resetMemberSelector();
};

// ============ 快捷時間（對齊 Vue2 FastDatePicker）===========

const setQuickDate = (type: 'yesterday' | 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth') => {
  switch (type) {
    case 'yesterday':
      query.value.dateRange = [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')];
      break;
    case 'today':
      query.value.dateRange = [dayjs().startOf('day'), dayjs().endOf('day')];
      break;
    case 'thisWeek':
      query.value.dateRange = [dayjs().startOf('week'), dayjs().endOf('week')];
      break;
    case 'lastWeek':
      query.value.dateRange = [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')];
      break;
    case 'thisMonth':
      query.value.dateRange = [dayjs().startOf('month'), dayjs().endOf('month')];
      break;
    case 'lastMonth':
      query.value.dateRange = [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')];
      break;
  }
};

// ============ 表格（DynamicTable）===========

const [DynamicTable, dynamicTableInstance] = useTable({
  search: false, // 關掉內建 search，對齊 Vue2：查詢區獨立存在
});

const columns = ref<TableColumnItem[]>([
  ...getColumns(t),
  {
    title: t('columns.operation'),
    width: 240,
    dataIndex: 'ACTION',
    align: 'center',
    fixed: 'right',
    actions: (_params, _action) => [
      {
        label: t('columns.viewVipRecord'),
        onClick: () => {
          message.info(t('featureDeveloping'));
        },
      },
      {
        label: t('columns.viewPack'),
        onClick: () => {
          message.info(t('featureDeveloping'));
        },
      },
      {
        label: t('columns.viewWallet'),
        onClick: () => {
          message.info(t('featureDeveloping'));
        },
      },
    ],
  },
]);

const loadTableData = async (params: any) => {
  // 對齊 Vue2：未選 agentID 不查（直接回空，避免誤打 API）
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agent) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const [start, end] = appliedQuery.value.dateRange;
  const appliedAgentID = buildAgentID(appliedQuery.value.agent, appliedQuery.value.masterAgent);

  const res = await queryAccountPersonalInfo({
    agentID: appliedAgentID,
    account: appliedQuery.value.memberAccount || '',
    dateType: appliedQuery.value.dateType,
    page: (params as any).page,
    limit: (params as any).pageSize,
    searchTime: {
      startTime: start.toDate(),
      dueTime: end.toDate(),
    },
  });

  // DynamicTable 預設抓 listField=items / totalField=meta.totalItems
  return {
    items: res?.result || [],
    meta: {
      totalItems: res?.count || 0,
    },
  };
};

const handleQuery = async () => {
  // 對齊 Vue2：agentID 必填
  if (!query.value.masterAgent || !query.value.agent) {
    message.error(t('filters.agentRequired'));
    return;
  }

  appliedQuery.value = {
    ...query.value,
    dateRange: [...query.value.dateRange] as [Dayjs, Dayjs],
  };

  await dynamicTableInstance?.reload?.(true);
};

const handleReset = async () => {
  // 對齊 Vue2：重置查詢條件（保留登入層級預設）
  query.value.dateType = 'createdAt';
  query.value.dateRange = buildTodayRange();
  resetMemberSelector();

  // masterAgent/agent：依照登入層級恢復
  if (userStore.level >= 4) {
    query.value.masterAgent = userStore.masterAgent;
    await fetchAgents(query.value.masterAgent);
    query.value.agent = userStore.level >= 5 ? userStore.agent : agentRawList.value[0]?.account || '';
  }
  else {
    query.value.masterAgent = masterAgentOptions.value[0]?.value?.toString() || '';
    await fetchAgents(query.value.masterAgent);
    query.value.agent = agentRawList.value[0]?.account || '';
  }

  appliedQuery.value = {
    ...query.value,
    dateRange: [...query.value.dateRange] as [Dayjs, Dayjs],
  };

  await dynamicTableInstance?.reload?.(true);
};

onMounted(async () => {
  await fetchMasterAgents();

  // 對齊 Vue2 AgentIDSelector 預設選擇邏輯
  if (userStore.level >= 4) {
    query.value.masterAgent = userStore.masterAgent;
  }
  else {
    query.value.masterAgent = masterAgentOptions.value[0]?.value?.toString() || '';
  }

  await fetchAgents(query.value.masterAgent);

  if (userStore.level >= 5) {
    query.value.agent = userStore.agent;
  }
  else {
    query.value.agent = agentRawList.value[0]?.account || '';
  }

  // Vue2 created() 會先設 today
  query.value.dateRange = buildTodayRange();
});
</script>

<template>
  <div>
    <!-- 查詢區（對齊 Vue2 memberPersonalInfo.vue filter-container 結構） -->
    <div class="filter-container">
      <div class="wrap">
        <!-- 總代理 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('filters.masterAgent') }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="query.masterAgent"
              style="width: 200px"
              :options="masterAgentOptions"
              :disabled="isMasterAgentDisabled"
              :allow-clear="false"
              @change="onMasterAgentChanged"
            />
          </div>
        </div>

        <!-- 代理 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('filters.agent') }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="query.agent"
              style="width: 200px"
              :options="agentOptions"
              :disabled="isAgentDisabled"
              :allow-clear="false"
              @change="onAgentChanged"
            />
          </div>
        </div>

        <!-- 會員（輸入即查詢 + 下拉選單） -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('filters.member') }}</label>
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

        <!-- 日期類別 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('filters.dateType') }}</label>
          </div>
          <div class="my_input">
            <a-select v-model:value="query.dateType" style="width: 200px" :allow-clear="false">
              <a-select-option value="createdAt">
                {{ t('filters.dateTypeCreatedAt') }}
              </a-select-option>
              <a-select-option value="lastLoginTime">
                {{ t('filters.dateTypeLastLoginTime') }}
              </a-select-option>
            </a-select>
          </div>
        </div>

        <!-- 快捷時間按鈕（對齊 Vue2 FastDatePicker） -->
        <div class="input_group">
          <a-button type="default" @click="setQuickDate('yesterday')">
            {{ t('filters.quick.yesterday') }}
          </a-button>
          <a-button type="default" @click="setQuickDate('today')">
            {{ t('filters.quick.today') }}
          </a-button>
          <a-button type="default" @click="setQuickDate('thisWeek')">
            {{ t('filters.quick.thisWeek') }}
          </a-button>
          <a-button type="default" @click="setQuickDate('lastWeek')">
            {{ t('filters.quick.lastWeek') }}
          </a-button>
          <a-button type="default" @click="setQuickDate('thisMonth')">
            {{ t('filters.quick.thisMonth') }}
          </a-button>
          <a-button type="default" @click="setQuickDate('lastMonth')">
            {{ t('filters.quick.lastMonth') }}
          </a-button>
        </div>

        <!-- 日期區間 -->
        <div class="time_range">
          <a-range-picker v-model:value="query.dateRange" :allow-clear="false" />
        </div>

        <!-- 查詢 / 重置 -->
        <div class="input_group">
          <a-button type="primary" @click="handleQuery">
            {{ t('common.queryText') }}
          </a-button>
          <a-button @click="handleReset">
            {{ t('common.resetText') }}
          </a-button>
        </div>
      </div>
    </div>

    <DynamicTable
      row-key="account"
      :header-title="t('title')"
      :columns="columns"
      :data-request="loadTableData"
    />
  </div>
</template>

<style scoped>
.filter-container {
  margin-bottom: 16px;
}

.wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.time_range {
  margin: 0 10px 0 0;
  display: flex;
  align-items: center;
}

.input_group {
  display: flex;
  align-items: center;
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
}
</style>

