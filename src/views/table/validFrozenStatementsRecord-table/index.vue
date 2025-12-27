<script setup lang="ts">
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  GetValidFrozenStatementsParams,
  ValidFrozenStatementItem,
} from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import {
  getValidFrozenStatements,
  removeValidFrozenStatement,
} from '@/api/backend/transactionSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'ValidFrozenStatementsRecordTable',
});

const { t } = useI18n('page.validFrozenStatementsRecord');
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

function formatPlatformType(source: string): string {
  return t(`PlatformType.${source}`) || source;
}

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  agentID: string;
  memberID?: string;
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
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

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = ValidFrozenStatementItem & {
  nickname: string;
  formattedFrozenBalance: string;
  formattedTargetAccumulatedBet: string;
};

const handleRemoveStatement = (record: ColumnsRowData) => {
  const content = t('notify.removeStatement') || '是否解凍';
  const title = t('title.removeStatement') || '解凍確認';

  Modal.confirm({
    title,
    content,
    okText: t('confirm') || '確認',
    cancelText: t('cancel') || '取消',
    onOk: async () => {
      try {
        await removeValidFrozenStatement({
          memberID: record.memberID,
          statementID: record.id,
        });
        message.success(t('notify.removeStatementSuccess') || '此筆已解凍');
        sMemberID.value = record.memberID;
        setTimeout(async () => {
          await dynamicTableInstance?.reload?.(true);
        }, 1000);
      }
      catch (error) {
        console.error('Failed to remove statement:', error);
        message.error(t('notify.removeStatementError') || '解凍失敗');
      }
    },
  });
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('column.id') || 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('column.memberID') || '會員ID',
    dataIndex: 'memberID',
    width: 200,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return h('span', { style: 'color: #13ce66;' }, record.memberID);
    },
  },
  {
    title: t('column.sourcePlatform') || '來源平台',
    dataIndex: 'sourcePlatform',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatPlatformType(record.source);
    },
  },
  {
    title: t('column.frozenBalance') || '凍結金額',
    dataIndex: 'frozenBalance',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.formattedFrozenBalance;
    },
  },
  {
    title: t('column.frozenAt') || '凍結時間',
    dataIndex: 'frozenAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.frozenAt ? dayjs(record.frozenAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.targetAccumulatedBet') || 'Spin解凍目標',
    dataIndex: 'targetAccumulatedBet',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.formattedTargetAccumulatedBet;
    },
  },
  {
    title: t('column.unfrozenAt') || '解凍時間',
    dataIndex: 'unfrozenAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.unfrozenAt ? dayjs(record.unfrozenAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.control') || '控制',
    dataIndex: 'control',
    width: 100,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const isDisabled = record.isEnabled === true;
      return h(
        'a-button',
        {
          type: 'link',
          danger: true,
          size: 'small',
          disabled: isDisabled,
          onClick: () => handleRemoveStatement(record),
        },
        () => t('column.unfrozen') || '解凍',
      );
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
    message.error(t('notify.masterAgentAndAgentFieldMissed') || '總代理和代理商欄位不能為空');
    throw new Error('params missed');
  }
  if (!query.value.memberID) {
    message.error(t('notify.needAccount') || '會員欄位不能為空');
    throw new Error('memberID missed');
  }
};

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    const queryParams: GetValidFrozenStatementsParams = {
      memberID: appliedQuery.value.memberID,
    };

    const res = await getValidFrozenStatements(queryParams);
    const data = res?.data || [];

    // 找到當前選擇的會員資訊
    const selectedMember = memberOptions.value.find(opt => opt.value === appliedQuery.value.memberID);
    const nickname = selectedMember ? `${selectedMember.raw.accountID} - ${selectedMember.raw.nickName}` : '';

    const processedItems: ColumnsRowData[] = data.map((item: ValidFrozenStatementItem) => ({
      ...item,
      nickname,
      formattedFrozenBalance: formatCurrency(item.frozenBalance),
      formattedTargetAccumulatedBet: item.targetAccumulatedBet ? formatCurrency(item.targetAccumulatedBet) : '',
    }));

    return {
      items: processedItems,
      meta: {
        totalItems: processedItems.length,
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
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
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
    query.value.masterAgent = agentIDOptions.value[0].value;
    await fetchAgentList(agentIDOptions.value[0].value);
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
  <div class="app-container valid-frozen-statements-record-table">
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
.valid-frozen-statements-record-table {
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
  }
}
</style>

