<script setup lang="ts">
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import type {
  CodeState,
  RedemptionRecord,
  RewardType,
} from '@/api/backend/redemptionOrder';

import { SearchOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, onMounted, ref } from 'vue';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import {
  CodeState as CodeStateEnum,
  queryRedemptionRecords,
  RewardType as RewardTypeEnum,
  validateRedemptionCode,
} from '@/api/backend/redemptionOrder';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'RedemptionCodeRecordTable',
});

const { t } = useI18n('page.redemption.redemptionCodeRecordTable');
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
}, 250);

const onMemberSelectChanged = (value: string) => {
  if (!value) {
    query.value.memberID = undefined;
    sMemberID.value = '';
    sNickname.value = '';
    return;
  }

  const selected = memberOptions.value.find(opt => opt.value === value);
  if (selected) {
    sMemberID.value = `${selected.raw.account}@${selected.raw.agentID}`;
    sNickname.value = `${selected.raw.accountID} - ${selected.raw.nickName}`;
    query.value.memberID = `${selected.raw.account}@${selected.raw.agentID}`;
  }
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

// ============ 總代理和代理商 ============
const masterAgentList = ref<MasterAgentItem[]>([]);
const agentIDOptions = ref<{ label: string; value: string }[]>([]);
const selectedMasterAgent = ref<string>('');
const agentList = ref<{ label: string; value: string }[]>([]);
const selectedAgent = ref<string>('');

const isAgentIDDisabled = computed(() => userStore.level >= 4);
const isAgentDisabled = computed(() => userStore.level >= 5);

// ============ 幣別、道具列表 ============
const currencyTypeList = ref<{ name: string; value: string }[]>([]);
const treasureItemList = ref<TreasureItem[]>([]);

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
});

type ColumnsRowData = RedemptionRecord & {
  id: string;
};

/**
 * ============ 工具函數（需要在 columns 定義前） ============
 */
const getCurrencyName = (currencyType?: string): string => {
  const found = currencyTypeList.value.find(c => c.value === currencyType);
  return found ? found.name : currencyType || 'unknown';
};

const getTreasureItemName = (itemID?: string): string => {
  const foundItem = treasureItemList.value.find(t => t.treasureItemID === itemID);
  if (!foundItem) {
    return 'unknown';
  }
  let itemName = foundItem.itemName;
  if (foundItem.bet !== undefined) {
    itemName += `-${foundItem.bet.toString()}`;
  }
  return itemName;
};

const formatRewards = (rewards: any[]): string[] => {
  const rewardStrings: string[] = [];
  rewards.forEach((item) => {
    switch (item.type) {
      case RewardTypeEnum.BALANCE:
        rewardStrings.push(`${getCurrencyName(item.currencyType)} : ${item.balance}`);
        break;
      case RewardTypeEnum.TREASURE_ITEM:
        rewardStrings.push(`${getTreasureItemName(item.treasureItemID)} : ${item.amount}`);
        break;
    }
  });
  return rewardStrings;
};

const formatOrderType = (type?: number): string => {
  if (type === 1) {
    return t('type.1') || '一碼一次';
  }
  if (type === 2) {
    return t('type.2') || '一碼多次';
  }
  return 'unknown';
};

const columns = ref<TableColumn<ColumnsRowData>[]>([
  {
    title: t('tables.id') || 'ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: t('tables.nickname') || '暱稱',
    dataIndex: 'Nickname',
    width: 200,
  },
  {
    title: t('tables.type') || '類別',
    dataIndex: 'type',
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return formatOrderType(record.order?.type);
    },
  },
  {
    title: t('tables.orderName') || '兌換名稱',
    dataIndex: 'orderName',
    width: 200,
  },
  {
    title: t('tables.rewards') || '兌換品項',
    dataIndex: 'rewards',
    width: 300,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      if (record.rewards && Array.isArray(record.rewards)) {
        return record.rewards.join('、');
      }
      if (record.order?.rewards) {
        const rewardStrings = formatRewards(record.order.rewards);
        return rewardStrings.join('、');
      }
      return '-';
    },
  },
  {
    title: t('tables.redemptionCode') || '兌換碼',
    dataIndex: 'redemptionCode',
    width: 200,
  },
  {
    title: t('tables.redeemedTime') || '兌換時間',
    dataIndex: 'redeemedTime',
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.redeemedTime ? dayjs(record.redeemedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
]);

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

const setTreasureItemList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await fetchTreasureItemList({ masterAgent });
    if (res?.rows) {
      treasureItemList.value = res.rows.reduce((acc: TreasureItem[], r) => {
        if (
          r.type === 'eventItem'
          || r.type === 'gachapon'
          || r.type === 'entityItem'
          || r.type === 'freeScratchCard'
          || r.type === 'coupon'
          || r.type === 'certificate'
        ) {
          return [...acc, ...r.items];
        }
        return acc;
      }, []);
    }
  }
  catch (error) {
    console.error('Failed to fetch treasure items:', error);
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
  await setTreasureItemList(val);

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

  const postData = {
    masterAgent: appliedQuery.value.masterAgent,
    memberID: appliedQuery.value.memberID,
  };

  try {
    const res = await queryRedemptionRecords(postData);
    const resData = res as any;

    let items: RedemptionRecord[] = [];
    let total = 0;

    if (resData?.data?.records && Array.isArray(resData.data.records)) {
      items = resData.data.records;
      total = resData.data.records.length;
    }
    else if (resData?.records && Array.isArray(resData.records)) {
      items = resData.records;
      total = resData.records.length;
    }
    else {
      items = [];
      total = 0;
    }

    // 處理數據格式
    const processedItems = items.map((item: any) => {
      const processedItem: RedemptionRecord & { id: string } = {
        id: item.id?.toString() || '',
        orderID: item.orderID || 0,
        masterAgent: item.masterAgent || appliedQuery.value.masterAgent,
        memberID: item.memberID || appliedQuery.value.memberID || '',
        redemptionCode: item.redemptionCode || '',
        redeemedTime: item.redeemedTime,
        createdAt: item.createdAt,
        order: item.order || {},
        Nickname: sNickname.value,
        type: formatOrderType(item.order?.type),
        orderName: item.order?.name || '',
        rewards: item.order?.rewards ? formatRewards(item.order.rewards) : [],
      };

      return processedItem;
    });

    return {
      items: processedItems,
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
    appliedQuery.value = { ...query.value };
    await dynamicTableInstance?.reload?.(true);
  }
  catch (error) {
    // 驗證失敗，不執行查詢
  }
};

// ============ 兌換碼查詢對話框 ============
const isDialogShow = ref(false);
const sRedemptionCode = ref('');
const rRedemptionCode = ref<CodeState | ''>('');

const openDialog = () => {
  isDialogShow.value = true;
  sRedemptionCode.value = '';
  rRedemptionCode.value = '';
};

const closeDialog = () => {
  isDialogShow.value = false;
  sRedemptionCode.value = '';
  rRedemptionCode.value = '';
};

const checkCodeBtn = async () => {
  if (!sRedemptionCode.value || sRedemptionCode.value.trim() === '') {
    message.error('請輸入兌換碼');
    return;
  }

  rRedemptionCode.value = '';

  try {
    const res = await validateRedemptionCode({ redemptionCode: sRedemptionCode.value });
    if (res?.data?.state) {
      rRedemptionCode.value = res.data.state;
    }
    else {
      rRedemptionCode.value = CodeStateEnum.UNAVAILABLE;
    }
  }
  catch (error) {
    console.error('Failed to validate redemption code:', error);
    message.error(t('notify.connectionError') || '連接錯誤');
    rRedemptionCode.value = CodeStateEnum.UNAVAILABLE;
  }
};

const rRedemptionCodeType = computed(() => {
  if (rRedemptionCode.value !== CodeStateEnum.AVAILABLE) {
    return 'error';
  }
  return 'success';
});

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
      await setTreasureItemList(userStore.masterAgent);
    }
  }
  else if (userStore.level === 4) {
    if (userStore.masterAgent) {
      selectedMasterAgent.value = userStore.masterAgent;
      query.value.agentID = userStore.masterAgent;
      query.value.masterAgent = userStore.masterAgent;
      await fetchAgentList(userStore.masterAgent);
      await setCurrencyTypeList(userStore.masterAgent);
      await setTreasureItemList(userStore.masterAgent);
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
    await setTreasureItemList(agentIDOptions.value[0].value);
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
  <div class="app-container redemption-code-record-table">
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

        <!-- 兌換碼查詢按鈕 -->
        <div class="input_group">
          <a-button
            type="primary"
            class="input_btn"
            @click="openDialog"
          >
            <template #icon>
              <SearchOutlined />
            </template>
            {{ t('labels.checkoutRedemptionCode') || '兌換碼查詢' }}
          </a-button>
        </div>
      </div>
    </div>

    <DynamicTable
      :columns="columns"
      :data-request="loadTableData"
      :scroll="{ x: 'max-content' }"
    />

    <!-- 兌換碼查詢對話框 -->
    <a-modal
      v-model:open="isDialogShow"
      :title="t('labels.checkoutRedemptionCode') || '兌換碼查詢'"
      :width="400"
      :mask-closable="false"
      @cancel="closeDialog"
    >
      <a-form
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item :label="t('column.redemptionCode') || '兌換碼'">
          <a-input
            v-model:value="sRedemptionCode"
            placeholder="請輸入兌換碼"
          />
        </a-form-item>
        <a-form-item :label="t('labels.result') || '查詢結果'">
          <a-tag
            v-if="rRedemptionCode !== ''"
            :color="rRedemptionCodeType === 'success' ? 'success' : 'error'"
          >
            {{ t(`CodeState.${rRedemptionCode}`) || rRedemptionCode }}
          </a-tag>
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button
          type="primary"
          @click="checkCodeBtn"
        >
          {{ t('search') || '查詢' }}
        </a-button>
        <a-button @click="closeDialog">
          {{ t('cancel') || '取消' }}
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.redemption-code-record-table {
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

