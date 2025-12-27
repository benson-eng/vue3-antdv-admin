<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  IExternalGameRecordColumn,
  IQueryExternalGameRecordParams,
} from '@/api/backend/adminSystem/gameRecordServer';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import {
  queryExternalGameRecords,
} from '@/api/backend/adminSystem/gameRecordServer';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { request } from '@/utils/request';

defineOptions({
  name: 'ExternalGameRecordsTable',
});

const { t } = useI18n('page.externalGameRecords');
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

function formatAmount2(
  val: number | string | null | undefined,
  showDecimal: boolean = true,
): string {
  if (val == null || val === '') {
    return '';
  }

  let strVal = typeof val === 'string' ? val : String(val);
  let hadPercent = false;

  if (strVal.includes('%')) {
    hadPercent = true;
    strVal = strVal.replace(/%/g, '');
  }

  const num = parseFloat(strVal);
  if (isNaN(num)) {
    return '';
  }

  let formatted: string;
  if (showDecimal) {
    const [intPart, decimalRaw = ''] = String(num).split('.');
    const decimalPart = decimalRaw.padEnd(2, '0').slice(0, 2);
    const combined = `${intPart}.${decimalPart}`;
    formatted = Number(combined).toLocaleString('zh-TW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  else {
    formatted = Math.trunc(num).toLocaleString('zh-TW');
  }

  return hadPercent ? `${formatted}%` : formatted;
}

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  agentID: string;
  memberID?: string;
  gameID?: string;
  externalPlatform?: string;
  currencyType?: string;
  date?: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  gameID: undefined,
  externalPlatform: undefined,
  currencyType: undefined,
  date: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
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
    if (query.value.agentID && sMemberID.value) {
      const checkData = sMemberID.value.split('@');
      if (checkData[1] !== query.value.agentID) {
        query.value.memberID = undefined;
        shouldClear.value = true;
        setTimeout(() => {
          shouldClear.value = false;
        }, 500);
      }
    }
    else {
      query.value.memberID = undefined;
      memberOptions.value = [];
      shouldClear.value = true;
      setTimeout(() => {
        shouldClear.value = false;
      }, 500);
    }
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

// ============ 平台列表 ============
const supportPlatforms = ref<Array<{ name: string; value: string }>>([]);

// ============ 遊戲列表 ============
const gameList = ref<Record<string, string>>({});
const gameOptions = ref<Array<{ label: string; value: string }>>([]);

// ============ 幣別列表 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = IExternalGameRecordColumn & {
  id: number;
};

const getGameName = (gameID: string): string => {
  return gameID && gameList.value[gameID] ? `${gameID} - ${gameList.value[gameID]}` : gameID;
};

const getCurrencyName = (currencyType: string): string => {
  const found = currencyTypeList.value.find(c => c.value === currencyType);
  return found ? found.name : currencyType;
};

const getBetTypeName = (betType: string): string => {
  return t(`betType.${betType}`) || betType;
};

const formatPlatform = (platform: string): string => {
  return platform === 'T9SingleWallet' ? 'T9LIVE' : platform;
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('labels.wagersID'),
    dataIndex: 'wagersID',
    width: 150,
  },
  {
    title: t('labels.externalPlatform'),
    dataIndex: 'externalPlatform',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatPlatform(record.externalPlatform);
    },
  },
  {
    title: t('labels.memberID'),
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('labels.gameID'),
    dataIndex: 'gameID',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getGameName(record.gameID);
    },
  },
  {
    title: t('labels.currencyType'),
    dataIndex: 'currencyType',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getCurrencyName(record.currencyType);
    },
  },
  {
    title: t('labels.betType'),
    dataIndex: 'betType',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.betType ? getBetTypeName(record.betType) : '';
    },
  },
  {
    title: t('labels.totalBet'),
    dataIndex: 'totalBet',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatAmount2(record.totalBet);
    },
  },
  {
    title: t('labels.totalWin'),
    dataIndex: 'totalWin',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const win = parseFloat(String(record.totalWin));
      return formatAmount2(record.totalWin);
    },
    customCell: ({ record }: { record: ColumnsRowData }) => {
      const win = parseFloat(String(record.totalWin));
      return win > 0 ? { style: { color: '#FF4949' } } : {};
    },
  },
  {
    title: t('labels.winLose'),
    dataIndex: 'winLose',
    width: 150,
    align: 'right',
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatAmount2(record.winLose);
    },
    customCell: ({ record }: { record: ColumnsRowData }) => {
      const winLose = parseFloat(String(record.winLose));
      return winLose > 0 ? { style: { color: '#FF4949' } } : { style: { color: '#3AB982' } };
    },
  },
  {
    title: t('labels.note'),
    dataIndex: 'buyFeature',
    width: 150,
  },
  {
    title: t('labels.playDateTime'),
    dataIndex: 'playDateTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.agentID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: IQueryExternalGameRecordParams = {
    agentID: appliedQuery.value.agentID,
  };

  if (appliedQuery.value.memberID) {
    postData.memberID = appliedQuery.value.memberID;
  }

  if (appliedQuery.value.gameID) {
    postData.gameID = appliedQuery.value.gameID;
  }

  if (appliedQuery.value.externalPlatform) {
    postData.externalPlatform = appliedQuery.value.externalPlatform;
  }

  if (appliedQuery.value.currencyType) {
    postData.currencyType = appliedQuery.value.currencyType;
  }

  if (appliedQuery.value.date && appliedQuery.value.date[0] && appliedQuery.value.date[1]) {
    postData.date = [
      appliedQuery.value.date[0].toDate(),
      appliedQuery.value.date[1].toDate(),
    ];
  }

  try {
    const res = await queryExternalGameRecords(postData);
    const resData = res as any;

    let items: IExternalGameRecordColumn[] = [];
    let total = 0;

    if (resData?.data?.items && Array.isArray(resData.data.items)) {
      items = resData.data.items;
      total = resData.data.total || resData.data.items.length;
    }
    else if (Array.isArray(resData?.items)) {
      items = resData.items;
      total = resData.count || resData.items.length;
    }
    else if (Array.isArray(resData)) {
      items = resData;
      total = resData.length;
    }
    else if (Array.isArray(resData?.data)) {
      items = resData.data;
      total = resData.data.length;
    }
    else {
      items = [];
      total = 0;
    }

    // 處理 buyFeature
    items.forEach((item: any) => {
      item.buyFeature = '';
      if (item.note && item.note.buyFeature) {
        item.buyFeature = item.note.buyFeature;
      }
    });

    return {
      items,
      meta: {
        totalItems: total,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.searchFinish') || '查詢完成');
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

const getSupportPlatforms = async (masterAgent: string) => {
  try {
    // 獲取遊戲列表
    const gameListRes = await request({
      url: '/AdminSystem/api/action/gameList',
      method: 'post',
      data: {
        server: 'gameManager',
        actionName: 'gameList',
        query: JSON.stringify({ masterAgent, includeExternalGame: true }),
      },
    });

    // 獲取等級額外設定
    const extraSettingRes = await request({
      url: '/AdminSystem/api/action/GetLevelExtraSetting',
      method: 'post',
      data: {
        server: 'levelServer',
        actionName: 'GetLevelExtraSetting',
        query: JSON.stringify({ masterAgent }),
      },
    });

    const gameListData = (gameListRes as any)?.data || [];
    const extraSettings = (extraSettingRes as any)?.data || [];

    const filtersPlatformOption: Array<{ name: string; value: string }> = [];

    extraSettings.forEach((item: any) => {
      const findIndex = gameListData.findIndex((fv: any) => fv.gameID === item.gameID);
      if (findIndex !== -1 && gameListData[findIndex] !== undefined) {
        const platformData = gameListData[findIndex].extraInfo?.platform;
        const existingItem = filtersPlatformOption.find(p => p.value === platformData);
        if (!existingItem && platformData) {
          filtersPlatformOption.push({ name: platformData, value: platformData });
        }
      }
    });

    supportPlatforms.value = filtersPlatformOption;

    // 更新遊戲列表
    gameListData.forEach((game: any) => {
      if (game.gameID && game.gameName) {
        gameList.value[game.gameID] = game.gameName;
        gameOptions.value.push({
          label: `${game.gameID} - ${game.gameName}`,
          value: game.gameID,
        });
      }
    });
  }
  catch (error) {
    console.error('Failed to get support platforms:', error);
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
  query.value.masterAgent = val;

  if (!val) {
    return;
  }

  await setCurrencyTypeList(val);
  await getSupportPlatforms(val);

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

const onExternalPlatformChanged = () => {
  query.value.gameID = undefined;
  gameOptions.value = [];
  gameList.value = {};
  if (selectedMasterAgent.value) {
    getSupportPlatforms(selectedMasterAgent.value);
  }
};

const onDateChanged = (value: [Dayjs, Dayjs] | null) => {
  if (value && Array.isArray(value) && value.length === 2) {
    query.value.date = value;
  }
  else {
    query.value.date = undefined;
  }
};

const handleFilter = async () => {
  if (!query.value.agentID) {
    message.error(t('notify.emptyAgentID') || '代理商不可空白');
    return;
  }

  appliedQuery.value = {
    ...query.value,
    date: query.value.date ? [...query.value.date] as [Dayjs, Dayjs] : undefined,
  };
  await dynamicTableInstance?.reload?.(true);
  message.success(t('notify.searchFinish') || '查詢完成');
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
      await getSupportPlatforms(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await getSupportPlatforms(userStore.masterAgent);
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
    await getSupportPlatforms(agentIDOptions.value[0].value);
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
  <div class="app-container external-game-records-table">
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
            <label>{{ t('labels.member') || '會員' }}</label>
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

        <!-- 平台選擇器 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.platform') || '平台' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.externalPlatform"
              :options="supportPlatforms"
              style="width: 200px"
              allow-clear
              placeholder="請選擇平台"
              @change="onExternalPlatformChanged"
            />
          </div>
        </div>

        <!-- 遊戲選擇器 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.gameID') || '遊戲ID' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.gameID"
              :options="gameOptions"
              style="width: 200px"
              allow-clear
              placeholder="請選擇遊戲"
              show-search
              :filter-option="(input, option) => {
                return (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
              }"
            />
          </div>
        </div>

        <!-- 查詢時間 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.searchTime') || '查詢時間' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.date"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="['開始時間', '結束時間']"
              style="width: 400px"
              @change="onDateChanged"
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
.external-game-records-table {
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

