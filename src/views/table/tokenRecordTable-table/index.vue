<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type {
  QueryTokenRecordsParams,
  TokenItem,
  TokenRecordItem,
} from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import {
  queryTokenRecords,
  queryTokens,
} from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { baseApiUrl } from '@/utils/request';

defineOptions({
  name: 'TokenRecordTable',
});

const { t } = useI18n('page.tokenRecordTable');
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

function formatCurrency(value: number | string): string {
  if (value === null || value === undefined) {
    return '0';
  }
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getTokenIconUrl(path: string): string {
  if (!path) {
    return '';
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const cdnBaseUrl = (import.meta as any)?.env?.VITE_APP_CDN_BASE_URL || '';
  const prefix = cdnBaseUrl || baseApiUrl || '';
  return `${prefix}${path}`;
}

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  agentID: string;
  memberID?: string;
  type?: string;
  tokenID?: number;
  date?: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  type: undefined,
  tokenID: undefined,
  date: [
    dayjs().subtract(30, 'day'),
    dayjs(),
  ],
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

// ============ 代幣列表 ============
const tokenList = ref<TokenItem[]>([]);
const tokenObjList = ref<Record<number, string>>({});

// ============ 類型列表 ============
const typeList = [
  { label: t('type.Promote') || '活動', value: 'Promote' },
  { label: t('type.MailAttachment') || '信件附件', value: 'MailAttachment' },
  { label: t('type.Mission') || '任務', value: 'Mission' },
];

const typeObjList: Record<string, string> = {
  Promote: t('type.Promote') || '活動',
  MailAttachment: t('type.MailAttachment') || '信件附件',
  Mission: t('type.Mission') || '任務',
};

const subTypeObjList: Record<string, string> = {
  General: t('subType.General') || '一般',
  Award: t('subType.Award') || '獎勵',
  Transaction: t('subType.Transaction') || '交易',
  Reward: t('subType.Reward') || '任務獎勵',
};

const sourceObjList: Record<string, string> = {
  'L007': 'gachpon',
  'mail-system': 'mail',
  'game-mission-system': 'mission',
  'L010': 'dailydraw',
  'marketing-event-system': 'event',
  'token-server': 'token',
};

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = TokenRecordItem;

const getTokenNameStr = (id: number): string => {
  return tokenObjList.value[id] || '';
};

const getTypeStr = (type: string): string => {
  return typeObjList[type] || type;
};

const getSubTypeStr = (subType: string): string => {
  return subTypeObjList[subType] || subType;
};

const getSourceStr = (source: string): string => {
  const mapped = sourceObjList[source];
  if (mapped) {
    return t(`source.${mapped}`) || source;
  }
  return source;
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('column.id') || 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('column.remitno') || '交易編號',
    dataIndex: 'remitno',
    width: 150,
  },
  {
    title: t('column.memberID') || '會員',
    dataIndex: 'memberID',
    width: 200,
  },
  {
    title: t('column.source') || '來源',
    dataIndex: 'source',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getSourceStr(record.source);
    },
  },
  {
    title: t('column.type') || '交易類型',
    dataIndex: 'type',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getTypeStr(record.type);
    },
  },
  {
    title: t('column.subType') || '子交易類型',
    dataIndex: 'subType',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getSubTypeStr(record.subType);
    },
  },
  {
    title: t('column.tokenID') || '代幣',
    dataIndex: 'tokenID',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getTokenNameStr(record.tokenID);
    },
  },
  {
    title: t('column.beforeAmount') || '異動前',
    dataIndex: 'beforeAmount',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.beforeAmount);
    },
  },
  {
    title: t('column.deposit') || '增加量',
    dataIndex: 'deposit',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.deposit);
    },
  },
  {
    title: t('column.withdrawal') || '減少量',
    dataIndex: 'withdrawal',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.withdrawal);
    },
  },
  {
    title: t('column.afterAmount') || '異動後',
    dataIndex: 'afterAmount',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.afterAmount);
    },
  },
  {
    title: t('column.transactionTime') || '異動時間',
    dataIndex: 'transactionTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.transactionTime ? dayjs(record.transactionTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.note') || '備註',
    dataIndex: 'note',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      if (record.note && typeof record.note === 'object') {
        return JSON.stringify(record.note);
      }
      return record.note || '';
    },
  },
]);

/**
 * ============ API 調用 ============
 */
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

const getTokenList = async (masterAgent: string) => {
  tokenList.value = [];
  tokenObjList.value = {};
  try {
    const res = await queryTokens({ masterAgent });
    if (res && Array.isArray(res)) {
      res.forEach((item) => {
        tokenList.value.push(item);
        tokenObjList.value[item.id] = item.name;
      });
    }
  }
  catch (error) {
    console.error('Failed to fetch token list:', error);
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
  sMemberID.value = '';
  sNickname.value = '';
  query.value.memberID = undefined;
  memberOptions.value = [];

  if (!val) {
    return;
  }

  await getTokenList(val);

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

const searchConditionValidator = (): void => {
  if (!query.value.masterAgent || !query.value.agentID) {
    message.error(t('notify.emptyAgentID') || '代理商不可空白');
    throw new Error('params missed');
  }
  if (!query.value.date || !query.value.date[0] || !query.value.date[1]) {
    message.error(t('notify.emptyDate') || '時間不可空白');
    throw new Error('date missed');
  }
};

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agentID || !appliedQuery.value.date) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    const params: QueryTokenRecordsParams = {
      agentID: appliedQuery.value.agentID,
      memberID: appliedQuery.value.memberID,
      type: appliedQuery.value.type,
      tokenID: appliedQuery.value.tokenID,
      date: appliedQuery.value.date
        ? [
            appliedQuery.value.date[0].format('YYYY-MM-DD HH:mm:ss'),
            appliedQuery.value.date[1].format('YYYY-MM-DD HH:mm:ss'),
          ]
        : undefined,
      page: 1,
      limit: 1000,
    };

    const res = await queryTokenRecords(params);
    const records = res?.records || [];

    message.success(t('notify.searchFinish') || '查詢完成');

    return {
      items: records,
      meta: {
        totalItems: records.length,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error('連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

const handleFilter = async () => {
  try {
    searchConditionValidator();
    appliedQuery.value = { ...query.value };
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
      await getTokenList(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await getTokenList(userStore.masterAgent);
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
    await getTokenList(agentIDOptions.value[0].value);
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
  <div class="app-container token-record-table">
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

        <!-- 來源 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.source') || '來源' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.type"
              :options="typeList"
              style="width: 200px"
              allow-clear
              placeholder="請選擇來源"
            />
          </div>
        </div>

        <!-- 代幣類型 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('labels.tokenType') || '代幣' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.tokenID"
              style="width: 200px"
              allow-clear
              placeholder="請選擇代幣"
              @change="() => {}"
            >
              <template
                v-for="item in tokenList"
                :key="item.id"
              >
                <a-select-option :value="item.id">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img
                      v-if="item.iconUrl"
                      :src="getTokenIconUrl(item.iconUrl)"
                      style="width: 24px; height: 24px; object-fit: contain;"
                      alt=""
                    >
                    <span>{{ item.name }}</span>
                  </div>
                </a-select-option>
              </template>
            </a-select>
          </div>
        </div>

        <!-- 查詢時間 -->
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">{{ t('labels.searchTime') || '查詢時間' }}</label>
          </div>
          <a-range-picker
            v-model:value="query.date"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 400px"
            :default-time="[dayjs('00:00:00', 'HH:mm:ss'), dayjs('23:59:59', 'HH:mm:ss')]"
          />
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
.token-record-table {
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
