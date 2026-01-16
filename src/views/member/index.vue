<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { Dayjs } from 'dayjs';
import type { IAccountInfo, IQueryAccountParams } from '@/api/backend/adminSystem/accountSystem';
import type { IMemberVipInfo } from '@/api/backend/member/vipServer';
import type { PlayerPackItem } from '@/api/backend/treasureChestSystem';
import { message, Modal, Switch } from 'ant-design-vue';

import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import {
  createMemberAccount,
  fuzzyQueryUser,

  getMemberAccount,
  logoutAction4Platform,

  queryAccountBaseInfoByIDs,
  unbindPhoneNumber,
  updateMemberAccount,
} from '@/api/backend/adminSystem/accountSystem';

import { memberWallets } from '@/api/backend/adminSystem/cashRecordServer';
import { EPunishStatus, getPunishDetail } from '@/api/backend/adminSystem/suspension';
import { getMembersVip } from '@/api/backend/member/vipServer';
import { getPlayerPackV2 } from '@/api/backend/treasureChestSystem';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'MemberIndex',
});

// CDN Base URL（對齊 Vue2：從環境變數獲取）
const cdnBaseURL = import.meta.env.VITE_APP_CDN_BASE_URL || '';

const { t } = useI18n('routes.member.indexPage');
const userStore = useUserStore();

// ============ 查詢條件 ============
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
  accountID: string; /**
                      * 8位數字ID
                      */
  phoneNumber: string | undefined;
}

const query = ref<QueryState>({
  masterAgent: '',
  agent: '',
  memberID: '',
  memberAccount: '',
  accountID: '',
  phoneNumber: undefined,
});

const shouldClear = ref(false);

// masterAgent / agent options
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const agentOptions = ref<DefaultOptionType[]>([]);
const agentRawList = ref<any[]>([]);

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
  agentOptions.value = (list || []).map((i) => {
    const agentText = i.account.includes('.') ? i.account.split('.')[0] : i.account;
    return { label: agentText, value: i.account };
  });
};

// ============ 會員輸入即查詢（對齊 Vue2 SearchMemberID）===========
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: any }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const resetMemberSelector = () => {
  query.value.memberID = '';
  query.value.memberAccount = '';
  query.value.accountID = '';
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
  query.value.accountID = matched?.raw?.accountID || '';
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
  if (!memberLastQueryText.value) {
    return;
  }
  if (!memberLastAccountID.value) {
    return;
  }

  await fetchMemberOptions(memberLastQueryText.value, true);
};

// masterAgent / agent 變更時，清空 member
watch(
  () => query.value.masterAgent,
  () => {
    resetMemberSelector();
  },
);
watch(
  () => query.value.agent,
  () => {
    resetMemberSelector();
  },
);

const buildAgentID = (agent: string, masterAgent: string) => {
  if (!agent || !masterAgent) {
    return '';
  }
  if (agent.includes('.')) {
    return agent;
  }
  return `${agent}.${masterAgent}`;
};

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
  shouldClear.value = true;
  setTimeout(() => {
    shouldClear.value = false;
  }, 500);
};

// ============ 會員列表 ============
const list = ref<IAccountInfo[]>([]);
const listLoading = ref(false);
const total = ref(0);
const emptyMessage = ref(false);

const getAccountList = async () => {
  if (!query.value.agent) {
    message.error(t('filters.agentRequired'));
    return;
  }

  listLoading.value = true;
  emptyMessage.value = false;

  try {
    const agentID = buildAgentID(query.value.agent, query.value.masterAgent);
    const queryParams: IQueryAccountParams = {
      agentID,
      page: 1,
      limit: 1000,
      account: query.value.memberAccount || '',
      isPersonalInfo: true,
    };

    if (query.value.phoneNumber) {
      queryParams.phoneNumber = Number(query.value.phoneNumber);
    }

    // 如果有 accountID，先查詢 memberID
    if (query.value.accountID) {
      const regex = /^[0-9]{8}$/;
      if (query.value.accountID.length !== 8 || !regex.test(query.value.accountID)) {
        message.error(t('notify.idLength'));
        listLoading.value = false;
        return;
      }

      const masterAgent = query.value.masterAgent;
      const baseInfoRes = await queryAccountBaseInfoByIDs({
        masterAgent,
        IDs: [query.value.accountID],
      });

      if (!baseInfoRes.data || baseInfoRes.data.length === 0) {
        list.value = [];
        total.value = 0;
        listLoading.value = false;
        message.success(t('success'));
        return;
      }

      const memberID = `${baseInfoRes.data[0].account}@${baseInfoRes.data[0].agentID}`;
      queryParams.account = baseInfoRes.data[0].account;
    }

    const { data } = await getMemberAccount(queryParams);
    let resultList: IAccountInfo[] = data.result || [];

    // 如果有 accountID，過濾結果
    if (query.value.accountID) {
      resultList = resultList.filter(item => item.accountID === query.value.accountID);
    }

    // 獲取停權狀態
    let suspensionStatus = t('suspension.normal');
    if (resultList.length > 0) {
      try {
        const punishRes = await getPunishDetail({ masterAgent: query.value.masterAgent });
        const punishData = punishRes.data?.find((item: any) => item.accountID === resultList[0].accountID);
        if (punishData) {
          switch (punishData.punishStatus) {
            case EPunishStatus.SUSPEND:
              suspensionStatus = t('suspension.platformSuspension');
              break;
            case EPunishStatus.MUTE:
              suspensionStatus = t('suspension.chatRoomBan');
              break;
            case EPunishStatus.BAN_GIFT:
              suspensionStatus = t('suspension.giftBan');
              break;
          }
        }
      }
      catch (error) {
        console.error('Failed to get punish detail:', error);
      }
    }

    // 處理 memberID 和 accountStatusSwitch
    resultList.forEach((item, index) => {
      resultList[index].memberID = `${item.account}@${item.agentID}`;
      resultList[index].accountStatusSwitch = item.accountStatus === 1;
      resultList[index].suspension = suspensionStatus;
    });

    // 獲取 VIP 資訊
    if (resultList.length > 0) {
      const memberIDs = resultList.map(item => item.memberID!);
      try {
        const vipRes = await getMembersVip({ memberID: memberIDs });
        const vipList = vipRes.data || [];
        resultList = resultList.map((item) => {
          const vipItem = vipList.find((v: IMemberVipInfo) => v.memberID === item.memberID);
          return vipItem ? { ...item, vip: vipItem.vip, vipName: vipItem.vipName, lastMonthVip: vipItem.lastMonthVip } : item;
        });
      }
      catch (error) {
        console.error('Failed to get VIP info:', error);
      }
    }

    list.value = resultList;
    total.value = resultList.length;
    emptyMessage.value = resultList.length === 0;
  }
  catch (error: any) {
    console.error('Failed to get account list:', error);
    message.error(error?.message || t('error'));
  }
  finally {
    setTimeout(() => {
      listLoading.value = false;
      message.success(t('success'));
    }, 500);
  }
};

const handleFilter = async () => {
  // 驗證 accountID
  if (query.value.accountID) {
    const regex = /^[0-9]{8}$/;
    if (query.value.accountID.length !== 8) {
      message.error(t('notify.idLength'));
      return;
    }
    if (!regex.test(query.value.accountID)) {
      message.error(t('notify.notInt'));
      return;
    }
  }

  // 驗證 phoneNumber
  if (query.value.phoneNumber) {
    if (!String(query.value.phoneNumber).match(/^[0-9]*$/)) {
      message.error(t('notify.isNotNumber'));
      return;
    }
    if (query.value.phoneNumber.toString().length < 5) {
      message.error(t('notify.phoneNumberLength'));
      return;
    }
  }

  await getAccountList();
};

// ============ 表格列定義 ============
const columns = [
  {
    title: t('columns.authProvider'),
    dataIndex: 'authProvider',
    key: 'authProvider',
  },
  {
    title: t('columns.accountID'),
    dataIndex: 'accountID',
    key: 'accountID',
  },
  {
    title: t('columns.vipName'),
    dataIndex: 'vipName',
    key: 'vipName',
  },
  {
    title: t('columns.nickName'),
    dataIndex: 'nickName',
    key: 'nickName',
  },
  {
    title: t('columns.guildName'),
    dataIndex: 'guildName',
    key: 'guildName',
  },
  {
    title: t('columns.phoneNumber'),
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
  },
  {
    title: t('columns.unbindPhoneNumber'),
    key: 'unbindPhoneNumber',
    width: 120,
  },
  {
    title: t('columns.registDatetime'),
    dataIndex: 'registerTime',
    key: 'registerTime',
  },
  {
    title: t('columns.lastLoginDevice'),
    dataIndex: 'lastLoginDevice',
    key: 'lastLoginDevice',
  },
  {
    title: t('columns.lastLoginDatetime'),
    dataIndex: 'lastLoginTime',
    key: 'lastLoginTime',
  },
  {
    title: t('columns.lastLoginIP'),
    dataIndex: 'lastLoginIP',
    key: 'lastLoginIP',
  },
  {
    title: t('columns.suspension'),
    dataIndex: 'suspension',
    key: 'suspension',
  },
  {
    title: t('columns.status'),
    dataIndex: 'accountStatus',
    key: 'accountStatus',
    customRender: ({ text }: any) => text === 1 ? t('enable') : t('disable'),
  },
  {
    title: t('columns.kickAllGame'),
    key: 'kickAllGame',
    width: 120,
  },
  {
    title: t('columns.enableAccount'),
    dataIndex: 'accountStatusSwitch',
    key: 'accountStatusSwitch',
    width: 120,
  },
  {
    title: t('columns.viewPack'),
    key: 'viewPack',
    width: 120,
  },
  {
    title: t('columns.viewWallets'),
    key: 'viewWallets',
    width: 120,
  },
];

// ============ 對話框 ============
const DIALOG_STATUS_UPDATE = 'UPDATE';
const DIALOG_STATUS_CREATE = 'CREATE';

const dialogFormVisible = ref(false);
const dialogStatus = ref('');
const tempDialogData = ref<any>({
  accountID: '',
  account: '',
  agentID: '',
  prefix: '',
  nickName: '',
  password: '',
  activationDate: {
    startTime: undefined,
    dueTime: undefined,
  },
  registerTime: undefined,
  lastLoginTime: undefined,
  lastLoginIP: '',
  suspension: '',
  accountStatus: 0,
  tags: '',
  accountStatusSwitch: false,
});

const defaultTempDialogData = () => ({
  accountID: '',
  account: '',
  agentID: '',
  prefix: '',
  nickName: '',
  password: '',
  activationDate: {
    startTime: undefined,
    dueTime: undefined,
  },
  registerTime: undefined,
  lastLoginTime: undefined,
  lastLoginIP: '',
  suspension: '',
  accountStatus: 0,
  tags: '',
  accountStatusSwitch: false,
});

const textMap = computed(() => ({
  UPDATE: t('dialog.editMemberAccount'),
  CREATE: t('dialog.createMemberAccount'),
}));

const isMember = (payload: any) => {
  const { tags } = payload;
  if (tags) {
    const regExp = new RegExp('Streamer', 'i');
    if (tags.match(regExp)) {
      return false;
    }
    return true;
  }
  return true;
};

const openCreateDialog = () => {
  dialogStatus.value = DIALOG_STATUS_CREATE;
  tempDialogData.value = defaultTempDialogData();
  tempDialogData.value.agentID = buildAgentID(query.value.agent, query.value.masterAgent);
  dialogFormVisible.value = true;
};

const openEditDialog = (row: IAccountInfo) => {
  dialogStatus.value = DIALOG_STATUS_UPDATE;
  tempDialogData.value = { ...row };
  dialogFormVisible.value = true;
};

const onDialogConfirm = async () => {
  if (dialogStatus.value === DIALOG_STATUS_CREATE) {
    await createAccount();
  }
  else if (dialogStatus.value === DIALOG_STATUS_UPDATE) {
    await updateAccount();
  }
};

const createAccount = async () => {
  const nickName = tempDialogData.value.nickName === ''
    ? tempDialogData.value.account
    : tempDialogData.value.nickName;

  const postData = {
    account: tempDialogData.value.account,
    nickName,
    password: tempDialogData.value.password,
    agentID: buildAgentID(query.value.agent, query.value.masterAgent),
    accountActivationDate: {},
    tags: '',
    infos: undefined,
  };

  const res = await createMemberAccount(postData);

  if (!res.error) {
    await getAccountList();
    dialogFormVisible.value = false;
    message.success(t('notify.createMemberAccountSuccess', [tempDialogData.value.account]));
  }
  else {
    let errorMsg = '';
    if (res.error.code === 'ACCOUNT_ALREADY_EXISTS') {
      errorMsg = t('notify.accountAlreadyExists');
    }
    else {
      errorMsg = res.error.message || t('error');
    }
    message.error(errorMsg);
  }
};

const updateAccount = async () => {
  const tempData = { ...tempDialogData.value };
  const res = await updateMemberAccount({
    memberID: `${tempData.account}@${tempData.agentID}`,
    newPassword: tempData.password || undefined,
    newNickname: tempData.nickName,
    newAccountStatus: tempData.accountStatus,
    newActivationDate: tempData.activationDate,
    newTags: tempData.tags,
  });

  if (!tempData.accountStatus) {
    await logoutAction4Platform({ memberID: `${tempData.account}@${tempData.agentID}` });
  }

  dialogFormVisible.value = false;

  if (!res.error) {
    await getAccountList();
    message.success(t('notify.updateMemberAccountSuccess', [tempData.nickName]));
  }
  else {
    message.error(res.error.message || t('error'));
  }
};

const switchAccountStatus = async (row: IAccountInfo) => {
  const tempData = { ...row };
  tempData.accountStatus = tempData.accountStatusSwitch === false ? 0 : 1;
  delete tempData.accountStatusSwitch;

  const res = await updateMemberAccount({
    memberID: `${tempData.account}@${tempData.agentID}`,
    newAccountStatus: tempData.accountStatus,
  });

  if (!tempData.accountStatus) {
    await logoutAction4Platform({ memberID: `${tempData.account}@${tempData.agentID}` });
  }

  if (!res.error) {
    await getAccountList();
    message.success(t('success'));
  }
  else {
    message.error(res.error.message || t('error'));
  }
};

// ============ 背包對話框 ============
const isDialogForm = ref(false);
const playerPack = ref<PlayerPackItem[]>([]);
const packColumns = [
  { title: t('packColumns.treasureItemID'), dataIndex: 'treasureItemID', key: 'treasureItemID' },
  { title: t('packColumns.itemType'), dataIndex: 'itemType', key: 'itemType' },
  { title: t('packColumns.itemName'), dataIndex: 'itemNameStr', key: 'itemNameStr' },
  {
    title: t('packColumns.iconUrl'),
    dataIndex: 'iconUrl',
    key: 'iconUrl',
    customRender: ({ text }: any) => text ? `${cdnBaseURL}${text}` : '',
  },
  { title: t('packColumns.isVipExclusive'), dataIndex: 'isVipExclusive', key: 'isVipExclusive' },
  { title: t('packColumns.sourceTypeStr'), dataIndex: 'sourceTypeStr', key: 'sourceTypeStr' },
  { title: t('packColumns.noteStr'), dataIndex: 'noteStr', key: 'noteStr' },
  { title: t('packColumns.sendedAt'), dataIndex: 'sendedAt', key: 'sendedAt' },
  { title: t('packColumns.firstUseTime'), dataIndex: 'firstUseTime', key: 'firstUseTime' },
  { title: t('packColumns.validFrom'), dataIndex: 'validFrom', key: 'validFrom' },
  { title: t('packColumns.validUntil'), dataIndex: 'validUntil', key: 'validUntil' },
];

const getPlayerPack = async (memberID: string) => {
  try {
    const res = await getPlayerPackV2({ memberID });
    if (res && Array.isArray(res)) {
      playerPack.value = res.reduce((pack: PlayerPackItem[], d: any) => {
        return [...pack, ...(d.items || [])];
      }, []);

      // 過濾狀態
      playerPack.value = playerPack.value.filter((p) => {
        const state = itemState(p);
        return ['unused', 'using', 'active', 'Equip', 'notEquip'].includes(state);
      });

      // 處理顯示欄位
      playerPack.value.forEach((item: any) => {
        item.itemNameStr = item.itemName;
        item.state = itemState(item);
        item.sourceTypeStr = playerSourceType(item);
        item.noteStr = playerPackNote(item);
      });
    }
  }
  catch (error) {
    console.error('Failed to get player pack:', error);
    message.error(t('error'));
  }
};

const itemState = (item: PlayerPackItem): string => {
  const now = new Date();
  if (!item.enabled || (item.validUntil && new Date(item.validUntil) < now)) {
    return 'invalid';
  }
  if (item.validFrom && new Date(item.validFrom) > now) {
    return 'unused';
  }
  switch (item.useState) {
    case 0:
      return 'unused';
    case 1:
      return 'invalid';
    case 2:
      if (item.itemType === 'badge' || item.itemType === 'personalFrame') {
        return 'Equip';
      }
      return 'using';
    case 3:
    case 4:
      if (item.itemType === 'badge' || item.itemType === 'personalFrame') {
        return 'notEquip';
      }
      return 'active';
    default:
      return 'unknown';
  }
};

const playerSourceType = (item: PlayerPackItem) => {
  const sourceTypeMap: Record<string, string> = {
    forceBingo: t('packSourceType.forceBingo'),
    Mission: t('packSourceType.Mission'),
    userBought: t('packSourceType.userBought'),
    Event: t('packSourceType.Event'),
    LobbyGame: t('packSourceType.LobbyGame'),
    OpenMail: t('packSourceType.OpenMail'),
    Redeem: t('packSourceType.Redeem'),
    badge: t('packSourceType.badge'),
    purchase: t('packSourceType.purchase'),
    levelUp: t('packSourceType.levelUp'),
  };
  return sourceTypeMap[item.sourceType || ''] || item.sourceType || '';
};

const playerPackNote = (item: PlayerPackItem) => {
  if (item.sourceType === 'levelUp' && item.note) {
    try {
      const note = JSON.parse(item.note);
      return `level: ${note.level}`;
    }
    catch {
      return '';
    }
  }
  return '';
};

const clickPackBtn = async (row: IAccountInfo) => {
  const memberID = `${row.account}@${row.agentID}`;
  await getPlayerPack(memberID);
  isDialogForm.value = true;
};

// ============ 錢包對話框 ============
const isDialogForm2 = ref(false);
const playerWallets = ref<any[]>([]);
const walletColumns = [
  { title: t('walletColumns.currencyType'), dataIndex: 'currencyType', key: 'currencyType' },
  {
    title: t('walletColumns.balance'),
    dataIndex: 'balance',
    key: 'balance',
    customRender: ({ text }: any) => Number(text).toLocaleString(),
  },
];

const getPlayeWallets = async (memberID: string) => {
  try {
    const res = await memberWallets({ memberID });
    playerWallets.value = res.data || [];
  }
  catch (error) {
    console.error('Failed to get player wallets:', error);
    message.error(t('error'));
  }
};

const clickWalletsBtn = async (row: IAccountInfo) => {
  const memberID = `${row.account}@${row.agentID}`;
  await getPlayeWallets(memberID);
  isDialogForm2.value = true;
};

/**
 * ============ 其他操作 ============
 */
const clickKickAllGameBtn = (row: IAccountInfo) => {
  Modal.confirm({
    title: t('warning'),
    content: t('notify.clickKickAllGame'),
    async onOk() {
      try {
        await logoutAction4Platform({ memberID: `${row.account}@${row.agentID}` });
        message.success(t('postfinish'));
      }
      catch (error) {
        console.error('Failed to kick all game:', error);
        message.error(t('error'));
      }
    },
  });
};

const clickUnbindPhoneNumberBtn = async (row: IAccountInfo) => {
  try {
    await unbindPhoneNumber({ memberID: row.memberID! });
    await getAccountList();
    message.success(t('success'));
  }
  catch (error) {
    console.error('Failed to unbind phone number:', error);
    message.error(t('error'));
  }
};

// ============ VIP 記錄對話框 ============
const isShowMemberVipRecordDialog = ref(false);
const parsedMemberVipRecordsByLast12Month = ref<{ month: string; vip: number | null }[]>([]);

const getLast12MonthTexts = (): string[] => {
  const months: string[] = [];
  const monthRequired = 12;
  for (let index = 0; index < monthRequired; index++) {
    months.push(dayjs().subtract(index, 'month').format('YYYY-MM'));
  }
  return months;
};

const showVipRecordDialog = (row: IAccountInfo) => {
  // TODO: 實現 VIP 記錄查詢
  parsedMemberVipRecordsByLast12Month.value = getLast12MonthTexts().map(month => ({ month, vip: null }));
  isShowMemberVipRecordDialog.value = true;
};

// ============ 初始化 ============
onMounted(async () => {
  await fetchMasterAgents();

  if (userStore.level >= 4) {
    query.value.masterAgent = userStore.masterAgent || '';
    await fetchAgents(query.value.masterAgent);
    if (userStore.level >= 5) {
      query.value.agent = userStore.agent || '';
    }
    else if (agentRawList.value.length > 0) {
      query.value.agent = agentRawList.value[0].account;
    }
    await getAccountList();
  }
  else if (masterAgentOptions.value.length > 0) {
    query.value.masterAgent = masterAgentOptions.value[0].value as string;
    await fetchAgents(query.value.masterAgent);
    if (agentRawList.value.length > 0) {
      query.value.agent = agentRawList.value[0].account;
    }
  }
});
</script>

<template>
  <div class="app-container member">
    <div class="filter-container">
      <div class="wrap">
        <!-- AgentIDSelector 位置 -->
        <a-select
          v-if="!isMasterAgentDisabled"
          v-model:value="query.masterAgent"
          :options="masterAgentOptions"
          :placeholder="t('filters.masterAgent')"
          style="width: 200px; margin-right: 10px;"
          @change="onMasterAgentChanged"
        />
        <a-select
          v-model:value="query.agent"
          :options="agentOptions"
          :disabled="isAgentDisabled"
          :placeholder="t('filters.agent')"
          style="width: 200px; margin-right: 10px;"
          @change="onAgentChanged"
        />

        <!-- SearchMemberID 位置 -->
        <a-select
          v-if="query.agent"
          v-model:value="query.memberID"
          :options="memberOptions"
          :loading="memberLoading"
          :placeholder="t('filters.member')"
          show-search
          :filter-option="false"
          style="width: 200px; margin-right: 10px;"
          @search="onMemberSearch"
          @change="onMemberSelectChanged"
          @popup-scroll="onMemberPopupScroll"
        >
          <template #notFoundContent>
            <div style="padding: 8px; text-align: center;">
              {{ t('filters.memberHint') }}
            </div>
          </template>
        </a-select>

        <!-- 電話號碼輸入 -->
        <a-input
          v-model:value="query.phoneNumber"
          :placeholder="t('filters.phoneNumber5code')"
          style="width: 200px; margin-right: 10px;"
          @press-enter="handleFilter"
        />

        <!-- 搜索按鈕 -->
        <a-button
          type="primary"
          :disabled="!query.accountID && (!query.phoneNumber || query.phoneNumber.toString().length < 5)"
          @click="handleFilter"
        >
          {{ t('search') }}
        </a-button>
        <div class="hint-text">
          {{ t('notify.hintText2') }}
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <a-table
      :data-source="list"
      :columns="columns"
      :loading="listLoading"
      :pagination="false"
      row-key="accountID"
      :scroll="{ x: 1500 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'unbindPhoneNumber'">
          <a-button
            v-if="record.phoneNumber && record.authProvider !== 'sms'"
            type="link"
            size="small"
            @click="clickUnbindPhoneNumberBtn(record)"
          >
            {{ t('labels.unbindPhoneNumber') }}
          </a-button>
        </template>
        <template v-else-if="column.key === 'kickAllGame'">
          <a-button
            type="link"
            size="small"
            @click="clickKickAllGameBtn(record)"
          >
            {{ t('column.kickAllGame') }}
          </a-button>
        </template>
        <template v-else-if="column.key === 'accountStatusSwitch'">
          <Switch
            :checked="record.accountStatusSwitch"
            @change="() => switchAccountStatus(record)"
          />
        </template>
        <template v-else-if="column.key === 'viewPack'">
          <a-button
            type="link"
            size="small"
            @click="clickPackBtn(record)"
          >
            {{ t('column.viewPack') }}
          </a-button>
        </template>
        <template v-else-if="column.key === 'viewWallets'">
          <a-button
            type="link"
            size="small"
            @click="clickWalletsBtn(record)"
          >
            {{ t('column.viewWallets') }}
          </a-button>
        </template>
      </template>
    </a-table>

    <!-- 編輯/創建帳號對話框 -->
    <a-modal
      v-model:open="dialogFormVisible"
      :title="textMap[dialogStatus]"
      :width="500"
      @ok="onDialogConfirm"
    >
      <a-form
        :model="tempDialogData"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item :label="t('column.account')">
          <a-input
            v-model:value="tempDialogData.account"
            :readonly="dialogStatus !== DIALOG_STATUS_CREATE"
          />
        </a-form-item>
        <a-form-item
          v-if="dialogStatus === DIALOG_STATUS_CREATE"
          :label="t('labels.password')"
        >
          <a-input-password v-model:value="tempDialogData.password" />
        </a-form-item>
        <a-form-item
          v-if="dialogStatus === DIALOG_STATUS_UPDATE && !isMember(tempDialogData)"
          :label="t('datePicker.startDate')"
        >
          <a-date-picker
            v-model:value="tempDialogData.activationDate.startTime"
            show-time
            :placeholder="t('datePicker.startDate')"
          />
        </a-form-item>
        <a-form-item
          v-if="dialogStatus === DIALOG_STATUS_UPDATE && !isMember(tempDialogData)"
          :label="t('datePicker.dueDate')"
        >
          <a-date-picker
            v-model:value="tempDialogData.activationDate.dueTime"
            show-time
            :placeholder="t('datePicker.dueDate')"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="dialogFormVisible = false">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="onDialogConfirm"
        >
          {{ t('confirm') }}
        </a-button>
      </template>
    </a-modal>

    <!-- VIP 記錄對話框 -->
    <a-modal
      v-model:open="isShowMemberVipRecordDialog"
      :title="t('vip.memberVipRecord')"
      :width="600"
    >
      <a-table
        :data-source="parsedMemberVipRecordsByLast12Month"
        :columns="[
          { title: t('column.memberVipRecordMonth'), dataIndex: 'month', key: 'month' },
          { title: t('column.memberVipRecordVipLevel'), dataIndex: 'vip', key: 'vip' },
        ]"
        :pagination="false"
      />
    </a-modal>

    <!-- 背包對話框 -->
    <a-modal
      v-model:open="isDialogForm"
      :title="t('pack.title')"
      width="90%"
    >
      <a-table
        :data-source="playerPack"
        :columns="packColumns"
        :pagination="false"
      />
    </a-modal>

    <!-- 錢包對話框 -->
    <a-modal
      v-model:open="isDialogForm2"
      :title="t('wallet.title')"
      width="30%"
    >
      <a-table
        :data-source="playerWallets"
        :columns="walletColumns"
        :pagination="false"
      />
    </a-modal>
  </div>
</template>

<style scoped>
.member {
  .filter-container {
    margin-bottom: 16px;

    .wrap {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .hint-text {
      font-size: 12px;
      color: #999;
      margin-left: 10px;
    }
  }
}
</style>
