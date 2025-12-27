<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  GetSafetyBoxOrderParams,
  SafetyBoxOrderItem,
} from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getSafetyBoxOrder } from '@/api/backend/transactionSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'SafetyBoxRecordTable',
});

const { t } = useI18n('page.safetyBoxRecordTable');
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

function formatNumber(value: number | string): string {
  if (value === null || value === undefined) {
    return '0.00';
  }
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return '0.00';
  }
  return Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============ 查詢條件 ============
interface QueryState {
  memberID?: string;
  searchTime?: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  memberID: undefined,
  searchTime: undefined,
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
      //   agentID: agentID.value,
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
    // Vue2 格式：account@agentID
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

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

const handleReload = () => {
  dynamicTableInstance?.reload?.(true);
};

interface ColumnsRowData extends SafetyBoxOrderItem {
  nickName?: string;
}

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: '#',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('label.nickName') || '會員',
    dataIndex: 'nickName',
    width: 200,
  },
  {
    title: t('label.currencyType') || '幣別',
    dataIndex: 'currencyType',
    width: 120,
  },
  {
    title: t('label.remittances') || '提 / 存',
    dataIndex: 'remittances',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const prefix = record.remittances >= 0 ? '存 ' : '提 ';
      return prefix + formatNumber(record.remittances);
    },
  },
  {
    title: t('label.serviceFee') || '手續費',
    dataIndex: 'serviceFee',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatNumber(record.serviceFee);
    },
  },
  {
    title: t('label.state') || '狀態',
    dataIndex: 'state',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const state = record.state;
      const stateText = state === 'Success' ? t('state.Success') : t('state.Fail');
      const tagColor = state === 'Success' ? 'success' : 'error';
      return h('a-tag', { color: tagColor }, () => stateText);
    },
  },
  {
    title: t('label.transferAt') || '時間',
    dataIndex: 'transferAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.transferAt ? dayjs(record.transferAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

/**
 * ============ 事件處理 ============
 */
const onMasterAgentChanged = (val: string) => {
  masterAgent.value = val || '';
  agentID.value = val || '';
  sMemberID.value = '';
  sNickname.value = '';
  query.value.memberID = undefined;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const onSearchTimeDatePickChanged = (value: [Dayjs, Dayjs] | [string, string] | null) => {
  if (value && Array.isArray(value) && value.length === 2) {
    if (typeof value[0] === 'string') {
      query.value.searchTime = [dayjs(value[0]), dayjs(value[1])];
    }
    else {
      query.value.searchTime = value as [Dayjs, Dayjs];
    }
  }
  else {
    query.value.searchTime = undefined;
  }
};

const searchConditionValidator = (): void => {
  if (!query.value.memberID) {
    message.error(t('notify.required') || '會員與查詢時間為必要數值');
    throw new Error('memberID missed');
  }
  if (!query.value.searchTime || !query.value.searchTime[0] || !query.value.searchTime[1]) {
    message.error(t('notify.required') || '會員與查詢時間為必要數值');
    throw new Error('searchTime missed');
  }
};

const loadTableData = async (_params: any) => {
  if (!appliedQuery.value.memberID || !appliedQuery.value.searchTime) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: GetSafetyBoxOrderParams = {
    memberID: sMemberID.value,
    searchTime: {
      startTime: appliedQuery.value.searchTime[0].toDate(),
      endTime: appliedQuery.value.searchTime[1].toDate(),
    },
  };

  try {
    const res = await getSafetyBoxOrder(postData);
    const resData = res as any;

    let items: SafetyBoxOrderItem[] = [];
    let total = 0;

    if (resData?.data?.orders && Array.isArray(resData.data.orders)) {
      items = resData.data.orders.map((item: any) => ({
        ...item,
        nickName: sNickname.value,
      }));
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
      searchTime: query.value.searchTime ? [...query.value.searchTime] as [Dayjs, Dayjs] : undefined,
    };
    handleReload();
  }
  catch (error) {
    // 驗證失敗，不執行查詢
  }
};

// ============ 初始化 ============
onMounted(() => {
  if (userStore.level === 5) {
    if (userStore.masterAgent && userStore.agent) {
      masterAgent.value = userStore.masterAgent;
      agentID.value = userStore.agent;
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      masterAgent.value = userStore.masterAgent;
      agentID.value = userStore.masterAgent;
    }
  }
});
</script>

<template>
  <div class="app-container safety-box-record-table">
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

        <!-- 查詢時間 -->
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">{{ t('label.searchTime') || '查詢時間' }}</label>
          </div>
          <div class="my_jcCenter">
            <a-range-picker
              v-model:value="query.searchTime"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              style="width: 400px"
              :placeholder="['開始時間', '結束時間']"
              @change="onSearchTimeDatePickChanged"
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

    <!-- 表格 -->
    <DynamicTable
      :columns="columns"
      :data-request="loadTableData"
      :scroll="{ x: 'max-content' }"
    />
  </div>
</template>

<style lang="less" scoped>
.safety-box-record-table {
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
