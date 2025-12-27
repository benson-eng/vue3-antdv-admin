<script setup lang="ts">
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type {
  AccountBaseInfoItem,
  FuzzyQueryUserItem,
} from '@/api/backend/adminSystem/accountSystem';
import type {
  OrderState,
  TransactionOrderItem,
} from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import {
  fuzzyQueryUser,
  queryAccountBaseInfo,
} from '@/api/backend/adminSystem/accountSystem';
import {
  abortTransaction,
  OrderState as EOrderState,
  getTransactionOrders,
} from '@/api/backend/transactionSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'TransactionRecordTable',
});

const { t } = useI18n('page.transactionRecord');
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

function transVipname(accounts: string | undefined): string {
  return accounts && accounts !== '' ? `VIP${accounts}` : '';
}

// ============ 查詢條件 ============
interface QueryState {
  masterAgent: string;
  agentID: string;
  memberID?: string;
  searchType: 'coin' | 'item';
}

const query = ref<QueryState>({
  masterAgent: '',
  agentID: '',
  memberID: undefined,
  searchType: 'coin',
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

// ============ 幣別列表 ============
const currencyList = ref<{ name: string; value: string }[]>([]);

// ============ 查詢類型列表 ============
const searchTypeList = [
  { label: t('searchType.coin') || '幣別', value: 'coin' },
  { label: t('searchType.item') || '道具', value: 'item' },
];

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = TransactionOrderItem & {
  id: string;
  remitterNickname: string;
  receiverNickname: string;
  remitterVip: string;
  receiverVip: string;
  showType: string;
  showItemName: string;
  newCanecelAt: string | null;
};

const tagType = (state: OrderState): string => {
  switch (state) {
    case EOrderState.SUCCESS:
      return 'success';
    case EOrderState.EXPIRED:
    case EOrderState.RECOVER:
      return 'error';
    default:
      return 'warning';
  }
};

const formatState = (state: OrderState): string => {
  return t(`state.${state}`) || state;
};

const formatSearchType = (type: string): string => {
  if (type === 'coin' || type === 'token') {
    return t(`searchType.${type}`) || type;
  }
  return t(`itemType.${type}`) || type;
};

const transCurrencyName = (currencyType?: string): string => {
  if (!currencyType) {
    return 'unknown';
  }
  const found = currencyList.value.find(el => el.value === currencyType);
  return found ? found.name : currencyType;
};

const handleAbortTransaction = (record: ColumnsRowData) => {
  const content = `${t('notify.confirmStopTransaction') || '是否中止'} ${record.remitterNickname} ${t('notify.give') || '贈送'} ${record.receiverNickname} ${record.showItemName} : ${(record.remittances * 1).toString()}`;
  const title = t('notify.confirmTitle') || '確認';

  Modal.confirm({
    title,
    content,
    okText: t('confirm') || '確認',
    cancelText: t('cancel') || '取消',
    onOk: async () => {
      try {
        await abortTransaction({
          masterAgent: appliedQuery.value.masterAgent,
          orderID: record.id,
          searchType: appliedQuery.value.searchType,
        });
        message.success(t('notify.abortSuccess') || '中止成功');
        await dynamicTableInstance?.reload?.(true);
      }
      catch (error) {
        console.error('Failed to abort transaction:', error);
        message.error(t('notify.abortError') || '中止失敗');
      }
    },
  });
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: '#',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('column.remitterVip') || '贈禮人VIP',
    dataIndex: 'remitterVip',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return transVipname(record.remitterVip);
    },
  },
  {
    title: t('column.remitterNickname') || '贈禮人暱稱',
    dataIndex: 'remitterNickname',
    width: 200,
  },
  {
    title: t('column.receiverVip') || '收禮人VIP',
    dataIndex: 'receiverVip',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return transVipname(record.receiverVip);
    },
  },
  {
    title: t('column.receiverNickname') || '收禮人暱稱',
    dataIndex: 'receiverNickname',
    width: 200,
  },
  {
    title: t('column.currencyType') || '禮物別',
    dataIndex: 'showType',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatSearchType(record.showType);
    },
  },
  {
    title: t('column.showItemName') || '禮物名',
    dataIndex: 'showItemName',
    width: 200,
  },
  {
    title: t('column.remittances') || '贈送數量',
    dataIndex: 'remittances',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.remittances);
    },
  },
  {
    title: t('column.serviceFee') || '手續費',
    dataIndex: 'serviceFee',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatCurrency(record.serviceFee);
    },
  },
  {
    title: t('column.state') || '狀態',
    dataIndex: 'state',
    width: 150,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const state = record.state;
      const tag = tagType(state);
      return h('a-tag', { color: tag }, () => formatState(state));
    },
  },
  {
    title: t('column.transferAt') || '贈送時間',
    dataIndex: 'transferAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.transferAt ? dayjs(record.transferAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.receivedAt') || '收禮時間',
    dataIndex: 'receivedAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.receivedAt ? dayjs(record.receivedAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.expireTime') || '過期時間',
    dataIndex: 'expireTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.expireTime ? dayjs(record.expireTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.canceledAt') || '取消時間',
    dataIndex: 'newCanecelAt',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.newCanecelAt ? dayjs(record.newCanecelAt).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('column.control') || '控制',
    dataIndex: 'control',
    width: 100,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      const canAbort = record.state === EOrderState.WAIT_RECEIVER_AGREE
        || record.state === EOrderState.WAIT_REMITTER_CONFIRM;
      return h(
        'a-button',
        {
          type: 'link',
          danger: true,
          size: 'small',
          disabled: !canAbort,
          onClick: () => handleAbortTransaction(record),
        },
        () => t('notify.stop') || '中止',
      );
    },
  },
]);

/**
 * ============ API 調用 ============
 */
const setCurrencyTypeList = async (masterAgent: string): Promise<void> => {
  currencyList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  else {
    const masterAgentData = masterAgentList.value.find(ma => ma.account === masterAgent);
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

  await setCurrencyTypeList(val);

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
  if (!appliedQuery.value.masterAgent || !appliedQuery.value.agentID || !appliedQuery.value.memberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const searchMember: string[] = [];
  const nameList: Record<string, string> = {};
  const allOrders: TransactionOrderItem[] = [];

  try {
    // 查詢作為 remitter 的訂單
    const query1 = {
      masterAgent: appliedQuery.value.masterAgent,
      remitter: appliedQuery.value.memberID,
      searchType: appliedQuery.value.searchType,
    };
    const res1 = await getTransactionOrders(query1);
    if (res1?.data?.orders) {
      res1.data.orders.forEach((item: TransactionOrderItem) => {
        const remitter = item.remitter.split('@')[0];
        const receiver = item.receiver.split('@')[0];
        if (!searchMember.includes(remitter)) {
          searchMember.push(remitter);
        }
        if (!searchMember.includes(receiver)) {
          searchMember.push(receiver);
        }
        item.remitter = remitter;
        item.receiver = receiver;
        allOrders.push(item);
      });
    }

    // 查詢作為 receiver 的訂單
    const query2 = {
      masterAgent: appliedQuery.value.masterAgent,
      receiver: appliedQuery.value.memberID,
      searchType: appliedQuery.value.searchType,
    };
    const res2 = await getTransactionOrders(query2);
    if (res2?.data?.orders) {
      res2.data.orders.forEach((item: TransactionOrderItem) => {
        const remitter = item.remitter.split('@')[0];
        const receiver = item.receiver.split('@')[0];
        if (!searchMember.includes(remitter)) {
          searchMember.push(remitter);
        }
        if (!searchMember.includes(receiver)) {
          searchMember.push(receiver);
        }
        item.remitter = remitter;
        item.receiver = receiver;
        allOrders.push(item);
      });
    }

    // 獲取所有會員的暱稱信息
    if (searchMember.length > 0) {
      const accountInfoRes = await queryAccountBaseInfo({
        masterAgent: appliedQuery.value.masterAgent,
        accounts: searchMember,
      });
      if (accountInfoRes?.data) {
        accountInfoRes.data.forEach((item: AccountBaseInfoItem) => {
          nameList[item.account] = item.id;
        });
      }
    }

    // 處理數據
    allOrders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA; // 最新的在前
    });

    const processedItems = allOrders.map((item: TransactionOrderItem) => {
      const processedItem: ColumnsRowData = {
        ...item,
        id: item.id || '',
        remitterNickname: '',
        receiverNickname: '',
        remitterVip: item.remitterVip || '',
        receiverVip: item.receiverVip || '',
        showType: appliedQuery.value.searchType === 'item' ? (item.itemType || '') : 'coin',
        showItemName: appliedQuery.value.searchType === 'item'
          ? (item.cardName || '')
          : transCurrencyName(item.currencyType),
        newCanecelAt: item.canceledAt || item.recoveredAt || null,
        remittances: item.remittances || 0,
        serviceFee: item.serviceFee || 0,
      };

      // 處理 remitter 暱稱
      if (item.remitterNicknameWhenTransaction !== null && item.remitterNicknameWhenTransaction) {
        processedItem.remitterNickname = `${nameList[item.remitter] || ''} - ${item.remitterNicknameWhenTransaction}`;
      }
      else {
        processedItem.remitterNickname = nameList[item.remitter] || '';
        processedItem.remitterVip = '';
      }

      // 處理 receiver 暱稱
      if (item.receiverNicknameWhenTransaction !== null && item.receiverNicknameWhenTransaction) {
        processedItem.receiverNickname = `${nameList[item.receiver] || ''} - ${item.receiverNicknameWhenTransaction}`;
      }
      else {
        processedItem.receiverNickname = nameList[item.receiver] || '';
        processedItem.receiverVip = '';
      }

      return processedItem;
    });

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
      await setCurrencyTypeList(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
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
  <div class="app-container transaction-record-table">
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

        <!-- 查詢種類 -->
        <div class="input_group">
          <div class="txt">
            <label>{{ t('column.searchType') || '查詢種類' }}</label>
          </div>
          <div class="my_select">
            <a-select
              v-model:value="query.searchType"
              :options="searchTypeList"
              style="width: 200px"
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
.transaction-record-table {
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
