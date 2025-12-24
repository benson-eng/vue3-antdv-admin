<script setup lang="ts">
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { VipExtraSetting, VipSetting } from '@/api/backend/member/vipServer';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { message } from 'ant-design-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import VipApi from '@/api/backend/member/vipServer';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getBaseName, isDistributionPlatform } from '@/utils/platform';

defineOptions({ name: 'MemberVipSetting2' });

const userStore = useUserStore();

const hasPermission = computed(() => userStore.level < 4);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);
const canEdit = computed(() => userStore.level < 3);
const isSuperAdmin = computed(() => userStore.level === 1);

const baseName = computed(() => getBaseName());
const isDistribution = computed(() => isDistributionPlatform());

// Vue2 vipSetting2 的站台限制清單（影響欄位顯示/label）
const restrictedBaseNameSet = new Set(['mabu77com', 'jhytw', 'luck-999com', 'ambmhcom', 'ww688bet']);
const isRestrictedBaseName = computed(() => restrictedBaseNameSet.has(baseName.value));

// Vue2: (not in list) && !distribution  || authLevel===1
const canShowLevelLimitAndBadge = computed(() => (!isRestrictedBaseName.value && !isDistribution.value) || isSuperAdmin.value);
const canShowPrivateTeamFields = computed(() => (!isRestrictedBaseName.value && !isDistribution.value) || isSuperAdmin.value);
const canShowGuildFields = computed(() => !isDistribution.value || isSuperAdmin.value);

const sendItemCountLabel = computed(() => (isRestrictedBaseName.value ? '贈禮次數' : '贈禮(道具) 次數'));

const { t } = useI18n();
const pageTitle = computed(() => t('routes.member.vipSetting'));

const masterAgent = ref<string>('');
const vipDowngradeFormula = ref<0 | 1 | 2 | 3>(0);
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const masterAgentMetaMap = ref<Record<string, any>>({});

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const DynamicTableReady = computed(() => Boolean(DynamicTable));

type VipRow = VipSetting & {
  totalBet?: string;
  levelLimit?: string;
  badgeSlotCount?: string;
  sendGiftText?: string;
  receiveGiftText?: string;
  tipText?: string;
  vipLimitText?: string;
};

const getExtraValue = (row: VipSetting, name: string) =>
  row.extraSettings?.find(e => e.name === name)?.value;

const formatSendGift = (val: unknown) => {
  const n = Number(val);
  if (Number.isNaN(n)) {
    return '';
  }
  if (n === -1) {
    return '可贈禮(無限)';
  }
  if (n === 0) {
    return '不可贈禮';
  }
  if (n > 0) {
    return String(n);
  }
  return String(n);
};
const formatReceiveGift = (val: unknown) => (String(val) === '1' ? '可收禮' : '不可收禮');
const formatTip = (val: unknown) => {
  const n = Number(val);
  if (Number.isNaN(n)) {
    return '';
  }
  if (n === -1) {
    return '功能關閉';
  }
  if (n === 0) {
    return '免手續費';
  }
  return `${n} %`;
};
const formatVipLimit = (val: unknown) => (String(val) === '1' ? '有會員期限' : '無會員期限');

const columns = ref<any[]>([]);

const rebuildColumns = () => {
  const base = [
    { title: 'ID', dataIndex: 'id', width: 90, align: 'center' },
    { title: 'VIP 等級', dataIndex: 'vipLevel', width: 110, align: 'center' },
    {
      title: '升級所需點數',
      dataIndex: 'levelUpNeedPoint',
      width: 150,
      align: 'center',
      customRender: ({ text }: any) => (Number(text) === -1 ? '-' : String(text)),
    },
    { title: '名稱', dataIndex: 'name', width: 140, align: 'center' },
  ];

  let extra: any[] = [];
  if (vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3) {
    extra = [
      { title: '累積押注', dataIndex: 'totalBet', width: 140, align: 'center' },
      { title: '等級限制', dataIndex: 'levelLimit', width: 140, align: 'center' },
      { title: '勳章欄位', dataIndex: 'badgeSlotCount', width: 120, align: 'center' },
      { title: '贈禮', dataIndex: 'sendGiftText', width: 140, align: 'center' },
      { title: '收禮', dataIndex: 'receiveGiftText', width: 140, align: 'center' },
      { title: '手續費', dataIndex: 'tipText', width: 140, align: 'center' },
      { title: '會員期限', dataIndex: 'vipLimitText', width: 140, align: 'center' },
    ];

    // Vue2: distribution 平台且非超管，列表不顯示 levelLimit / badgeSlotCount
    if (isDistribution.value && userStore.level > 1) {
      extra = extra.filter(c => c.dataIndex !== 'levelLimit' && c.dataIndex !== 'badgeSlotCount');
    }
  }

  const action = [
    {
      title: '操作',
      dataIndex: 'ACTION',
      width: 120,
      align: 'center',
      fixed: 'right',
      actions: ({ record }: any) => [
        {
          label: '編輯',
          type: 'link',
          disabled: !canEdit.value,
          onClick: () => openEdit(record as VipRow),
        },
      ],
    },
  ];

  columns.value = [...base, ...extra, ...action];
};

watch([vipDowngradeFormula, isDistribution], rebuildColumns, { immediate: true });

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const items = (await VipApi.listByMasterAgent({ masterAgent: masterAgent.value })) ?? [];
  const mapped: VipRow[] = items.map((row) => {
    const totalBet = getExtraValue(row, 'totalBet');
    const levelLimit = getExtraValue(row, 'levelLimit');
    const badgeSlotCount = getExtraValue(row, 'badgeSlotCount');
    const sendGift = getExtraValue(row, 'sendGift');
    const receiveGift = getExtraValue(row, 'receiveGift');
    const tip = getExtraValue(row, 'tip');
    const vipLimit = getExtraValue(row, 'vipLimit');

    return {
      ...row,
      totalBet: totalBet === undefined ? '' : String(totalBet),
      levelLimit: levelLimit === undefined ? '' : String(levelLimit),
      badgeSlotCount: badgeSlotCount === undefined ? '' : String(badgeSlotCount),
      sendGiftText: sendGift === undefined ? '' : formatSendGift(sendGift),
      receiveGiftText: receiveGift === undefined ? '' : formatReceiveGift(receiveGift),
      tipText: tip === undefined ? '' : formatTip(tip),
      vipLimitText: vipLimit === undefined ? '' : formatVipLimit(vipLimit),
    };
  });

  return { items: mapped, meta: { totalItems: mapped.length } };
};

const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));
  masterAgentMetaMap.value = (list || []).reduce((acc: any, cur: any) => {
    acc[cur.account] = cur;
    return acc;
  }, {});
};

const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val;
  const meta = masterAgentMetaMap.value[val] || {};
  vipDowngradeFormula.value = (meta.vipDowngradeFormula ?? 0) as 0 | 1 | 2 | 3;
  tableInstance?.reload?.();
};

onMounted(async () => {
  await fetchMasterAgents();

  // 對齊 Vue2：level>=4 固定 masterAgent
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent || '';
  }
  else {
    masterAgent.value = (masterAgentOptions.value[0]?.value as string) || '';
  }

  if (masterAgent.value) {
    await onMasterAgentChanged(masterAgent.value);
  }
});

// ===== Modal（新增/編輯）=====

type SendGiftMode = 'not' | 'quota' | 'unlimited';
type SendItemCountMode = 'unlimited' | 'limited';

interface FormState {
  vipLevel: number | undefined;
  name: string;
  levelUpNeedPoint: number | undefined;

  /**
   * extra settings
   */
  totalBet: number;
  levelLimit: number;
  badgeSlotCount: number;
  sendItemCountMode: SendItemCountMode;
  sendItemCount: number;
  sendGiftMode: SendGiftMode;
  sendGift: number;
  transactionMinLevelLimit: number | undefined;
  transactionReservedBalance: number | undefined;
  tipType: -1 | 0 | 1;
  tip: number;
  receiveGift: 0 | 1;
  privateTeamCreateCounts: number;
  privateTeamJoinCounts: number;
  seatKeepTime: number;
  vipLimit: 0 | 1;
  isCanJoinGuild: 0 | 1;
  isCanCreateGuild: 0 | 1;
}

const defaultFormState = (): FormState => ({
  vipLevel: undefined,
  name: '',
  levelUpNeedPoint: -1,

  totalBet: 0,
  levelLimit: 1,
  badgeSlotCount: 3,
  sendItemCountMode: 'unlimited',
  sendItemCount: 1,
  sendGiftMode: 'not',
  sendGift: 1,
  transactionMinLevelLimit: -1,
  transactionReservedBalance: -1,
  tipType: -1,
  tip: 1,
  receiveGift: 0,
  privateTeamCreateCounts: 0,
  privateTeamJoinCounts: 0,
  seatKeepTime: 0,
  vipLimit: 0,
  isCanJoinGuild: 1,
  isCanCreateGuild: 0,
});

const formRef = ref<FormInstance>();
const form = reactive<FormState>(defaultFormState());
const modalOpen = ref(false);
const modalSubmitting = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingRecord = ref<VipSetting | null>(null);
const existingExtraMap = ref<Record<string, VipExtraSetting>>({});

const modalTitle = computed(() => (modalMode.value === 'add' ? '新增 VIP' : '編輯 VIP'));
const isVipLevelDisabled = computed(() => userStore.level >= 3 || modalMode.value === 'edit');

const showExtraBlock = computed(() => vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3);
const showTransactionMinLevelLimit = computed(() => {
  // Vue2: (vipDowngradeFormula===2||3) && sendGift!=not && (not in list) && !distribution || superAdmin
  if (!showExtraBlock.value) {
    return false;
  }
  if (form.sendGiftMode === 'not') {
    return false;
  }
  return canShowLevelLimitAndBadge.value;
});
const showTransactionReservedBalance = computed(() => {
  // Vue2: (vipDowngradeFormula===2||3) && sendGift!=not
  if (!showExtraBlock.value) {
    return false;
  }
  return form.sendGiftMode !== 'not';
});

const isInt = (v: any) => Number.isInteger(Number(v));
const rules: Record<string, Rule[]> = {
  vipLevel: [{
    required: true,
    validator: async (_r, v) => {
      if (v === null || v === undefined) {
        throw new Error('請輸入 VIP 等級');
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  name: [{ required: true, message: '請輸入名稱', trigger: 'change' }],
  levelUpNeedPoint: [{
    validator: async (_r, v) => {
      if (v === null || v === undefined) {
        return;
      }
      if (!isInt(v) || Number(v) < -1) {
        throw new Error('請輸入大於等於 -1 的整數');
      }
    },
    trigger: 'change',
  }],
  totalBet: [{
    validator: async (_r, v) => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  levelLimit: [{
    validator: async (_r, v) => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (!isInt(v) || Number(v) < 1) {
        throw new Error('請輸入大於等於 1 的整數');
      }
    },
    trigger: 'change',
  }],
  sendGift: [{
    validator: async () => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (form.sendGiftMode === 'quota' && (!isInt(form.sendGift) || Number(form.sendGift) <= 0)) {
        throw new Error('請輸入大於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  sendItemCount: [{
    validator: async () => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (form.sendItemCountMode === 'limited' && (!isInt(form.sendItemCount) || Number(form.sendItemCount) <= 0)) {
        throw new Error('請輸入大於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  transactionMinLevelLimit: [{
    validator: async () => {
      if (!showExtraBlock.value) {
        return;
      }
      // Vue2：此欄位在特定站台 / distribution 平台會被隱藏，因此僅在顯示時才要求輸入
      if (!showTransactionMinLevelLimit.value) {
        return;
      }
      const v = form.transactionMinLevelLimit;
      if (v === undefined) {
        throw new Error('請輸入大於等於 0 的整數');
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  transactionReservedBalance: [{
    validator: async () => {
      if (!showExtraBlock.value) {
        return;
      }
      // Vue2：sendGift!=not 時必填（不受 BaseName / distribution 影響）
      if (form.sendGiftMode === 'not') {
        return;
      }
      const v = form.transactionReservedBalance;
      if (v === undefined) {
        throw new Error('請輸入大於等於 0 的整數');
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  tip: [{
    validator: async () => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (form.sendGiftMode === 'not') {
        return;
      }
      if (form.tipType === 1 && (!isInt(form.tip) || Number(form.tip) <= 0)) {
        throw new Error('請輸入大於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  privateTeamCreateCounts: [{
    validator: async (_r, v) => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  privateTeamJoinCounts: [{
    validator: async (_r, v) => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
  seatKeepTime: [{
    validator: async (_r, v) => {
      if (!(vipDowngradeFormula.value === 2 || vipDowngradeFormula.value === 3)) {
        return;
      }
      if (!isInt(v) || Number(v) < 0) {
        throw new Error('請輸入大於等於 0 的整數');
      }
    },
    trigger: 'change',
  }],
};

const syncSendGiftRelated = () => {
  if (form.sendGiftMode === 'not') {
    // 對齊 Vue2：不可贈禮時，關閉相關欄位
    form.tipType = -1;
    form.transactionMinLevelLimit = -1;
    form.transactionReservedBalance = -1;
  }
  else {
    // 對齊 Vue2：可贈禮時，若原本為 -1 則清空，讓使用者輸入（若欄位被隱藏，會在送出時依規則處理）
    if (Number(form.transactionMinLevelLimit) < 0) {
      form.transactionMinLevelLimit = undefined;
    }
    if (Number(form.transactionReservedBalance) < 0) {
      form.transactionReservedBalance = undefined;
    }
  }
  if (form.sendGiftMode === 'unlimited') {
    // 不需要額度
    form.sendGift = 1;
  }
  if (form.sendGiftMode === 'quota') {
    if (!form.sendGift || form.sendGift <= 0) {
      form.sendGift = 1;
    }
  }
};

const syncTipRelated = () => {
  if (form.tipType !== 1) {
    form.tip = 1;
  }
};

const buildExtraSettings = (vipSettingId: number, withIds = false) => {
  if (!showExtraBlock.value) {
    return [] as VipExtraSetting[];
  }

  const sendGiftValue = form.sendGiftMode === 'not'
    ? 0
    : form.sendGiftMode === 'unlimited'
      ? -1
      : Number(form.sendGift || 0);

  const tipValue = form.sendGiftMode === 'not'
    ? -1
    : form.tipType === -1
      ? -1
      : form.tipType === 0
        ? 0
        : Number(form.tip || 0);
  const sendItemCountValue = form.sendItemCountMode === 'unlimited' ? -1 : Number(form.sendItemCount || 0);

  // 對齊 Vue2：transactionMinLevelLimit 在特定 BaseName / distribution 平台會被隱藏，值可能被排除
  let transactionMinLevelLimitValue: number | undefined;
  if (form.sendGiftMode === 'not') {
    transactionMinLevelLimitValue = -1;
  }
  else if (showTransactionMinLevelLimit.value) {
    transactionMinLevelLimitValue = Number(form.transactionMinLevelLimit ?? 0);
  }
  else if (isRestrictedBaseName.value) {
    // Vue2: 特定站台若無輸入，預設 1
    transactionMinLevelLimitValue = 1;
  }
  else if (isDistribution.value && !isSuperAdmin.value) {
    // Vue2: distribution 平台(非超管)時欄位不顯示，可能不送此 extraSetting
    transactionMinLevelLimitValue = undefined;
  }
  else {
    transactionMinLevelLimitValue = Number(form.transactionMinLevelLimit ?? 0);
  }

  const transactionReservedBalanceValue = form.sendGiftMode === 'not'
    ? -1
    : Number(form.transactionReservedBalance ?? 0);

  const base: Array<{ vipSettingId: number; name: string; type: string; value: any }> = [
    { vipSettingId, name: 'totalBet', type: 'normal', value: String(Number(form.totalBet ?? 0)) },
    { vipSettingId, name: 'levelLimit', type: 'normal', value: String(Number(form.levelLimit ?? 1)) },
    { vipSettingId, name: 'badgeSlotCount', type: 'normal', value: String(Number(form.badgeSlotCount ?? 3)) },
    { vipSettingId, name: 'sendItemCount', type: 'normal', value: String(Number(sendItemCountValue)) },
    { vipSettingId, name: 'sendGift', type: 'normal', value: String(Number(sendGiftValue)) },
    { vipSettingId, name: 'transactionMinLevelLimit', type: 'normal', value: transactionMinLevelLimitValue === undefined ? undefined : String(Number(transactionMinLevelLimitValue)) },
    { vipSettingId, name: 'transactionReservedBalance', type: 'normal', value: String(Number(transactionReservedBalanceValue)) },
    { vipSettingId, name: 'tip', type: 'normal', value: String(Number(tipValue)) },
    { vipSettingId, name: 'receiveGift', type: 'normal', value: String(Number(form.receiveGift ?? 0)) },
    { vipSettingId, name: 'vipLimit', type: 'normal', value: String(Number(form.vipLimit ?? 0)) },
    { vipSettingId, name: 'privateTeamCreateCounts', type: 'normal', value: String(Number(form.privateTeamCreateCounts ?? 0)) },
    { vipSettingId, name: 'privateTeamJoinCounts', type: 'normal', value: String(Number(form.privateTeamJoinCounts ?? 0)) },
    { vipSettingId, name: 'seatKeepTime', type: 'normal', value: String(Number(form.seatKeepTime ?? 0)) },
    { vipSettingId, name: 'isCanJoinGuild', type: 'normal', value: String(Number(form.isCanJoinGuild ?? 1)) },
    { vipSettingId, name: 'isCanCreateGuild', type: 'normal', value: String(Number(form.isCanCreateGuild ?? 0)) },
  ];

  const baseFiltered = base.filter(i => i.value !== undefined && i.value !== '');

  if (!withIds) {
    return baseFiltered as VipExtraSetting[];
  }

  return baseFiltered.map((item) => {
    const exist = existingExtraMap.value[item.name];
    return exist?.id ? ({ ...item, id: exist.id } as VipExtraSetting) : (item as VipExtraSetting);
  });
};

function openCreate() {
  if (!canEdit.value) {
    message.error('權限不足');
    return;
  }
  if (!masterAgent.value) {
    message.error('請先選擇總代理');
    return;
  }
  modalMode.value = 'add';
  editingRecord.value = null;
  existingExtraMap.value = {};
  Object.assign(form, defaultFormState());
  modalOpen.value = true;
}

function openEdit(record: VipRow) {
  if (!canEdit.value) {
    message.error('權限不足');
    return;
  }
  modalMode.value = 'edit';
  editingRecord.value = record;

  existingExtraMap.value = (record.extraSettings || []).reduce((acc: any, cur: any) => {
    acc[cur.name] = cur;
    return acc;
  }, {});

  const pickNum = (name: string, fallback: number) => {
    const v = getExtraValue(record, name);
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  };

  Object.assign(form, defaultFormState());
  form.vipLevel = record.vipLevel ?? undefined;
  form.name = record.name ?? '';
  form.levelUpNeedPoint = record.levelUpNeedPoint ?? -1;

  // extra
  form.totalBet = pickNum('totalBet', 0);
  form.levelLimit = pickNum('levelLimit', 1);
  form.badgeSlotCount = pickNum('badgeSlotCount', 3);

  const sendGiftVal = pickNum('sendGift', 0);
  if (sendGiftVal === -1) {
    form.sendGiftMode = 'unlimited';
  }
  else if (sendGiftVal === 0) {
    form.sendGiftMode = 'not';
  }
  else {
    form.sendGiftMode = 'quota';
    form.sendGift = sendGiftVal;
  }

  const sendItemCountVal = pickNum('sendItemCount', -1);
  if (sendItemCountVal === -1) {
    form.sendItemCountMode = 'unlimited';
    form.sendItemCount = 1;
  }
  else {
    form.sendItemCountMode = 'limited';
    form.sendItemCount = sendItemCountVal <= 0 ? 1 : sendItemCountVal;
  }

  form.transactionMinLevelLimit = pickNum('transactionMinLevelLimit', 0);
  form.transactionReservedBalance = pickNum('transactionReservedBalance', 0);

  const tipVal = pickNum('tip', -1);
  if (tipVal === -1) {
    form.tipType = -1;
  }
  else if (tipVal === 0) {
    form.tipType = 0;
  }
  else {
    form.tipType = 1;
    form.tip = tipVal;
  }

  form.receiveGift = pickNum('receiveGift', 0) ? 1 : 0;
  form.vipLimit = pickNum('vipLimit', 0) ? 1 : 0;
  form.privateTeamCreateCounts = pickNum('privateTeamCreateCounts', 0);
  form.privateTeamJoinCounts = pickNum('privateTeamJoinCounts', 0);
  form.seatKeepTime = pickNum('seatKeepTime', 0);
  form.isCanJoinGuild = pickNum('isCanJoinGuild', 1) ? 1 : 0;
  form.isCanCreateGuild = pickNum('isCanCreateGuild', 0) ? 1 : 0;

  syncSendGiftRelated();
  syncTipRelated();
  modalOpen.value = true;
}

const handleCancel = () => {
  modalOpen.value = false;
};

const handleSubmit = async () => {
  if (!canEdit.value) {
    message.error('權限不足');
    return;
  }
  if (!masterAgent.value) {
    message.error('請先選擇總代理');
    return;
  }

  modalSubmitting.value = true;
  try {
    await formRef.value?.validate();

    const levelUpNeedPoint = form.levelUpNeedPoint === undefined ? -1 : Number(form.levelUpNeedPoint);

    if (modalMode.value === 'add') {
      const extraSettings = buildExtraSettings(-1, false);
      await VipApi.createVipSetting({
        id: -1,
        masterAgent: masterAgent.value,
        lastMonthVip: null,
        vipLevel: Number(form.vipLevel ?? 0),
        levelUpNeedPoint,
        name: form.name,
        icon: '',
        iconRaw: null,
        extraSettings,
      });
      message.success('新增成功');
      modalOpen.value = false;
      tableInstance?.reload?.();
      return;
    }

    // edit
    if (!editingRecord.value) {
      throw new Error('找不到編輯資料');
    }
    const vipSettingId = editingRecord.value.id;

    // 1) 先補齊缺少的 extra（對齊 Vue2：先 create，再 reload 拿到 id）
    const desired = buildExtraSettings(vipSettingId, false);
    for (const item of desired) {
      const exist = existingExtraMap.value[item.name];
      if (!exist?.id) {
        await VipApi.createVipExtraSetting({
          vipSettingId,
          name: item.name,
          type: item.type,
          value: item.value,
        });
      }
    }

    // 2) reload 並同步 id
    const reloaded = (await VipApi.listByMasterAgent({ masterAgent: masterAgent.value })) ?? [];
    const latest = reloaded.find(r => r.id === vipSettingId);
    existingExtraMap.value = (latest?.extraSettings || []).reduce((acc: any, cur: any) => {
      acc[cur.name] = cur;
      return acc;
    }, {});

    const extraSettings = buildExtraSettings(vipSettingId, true);

    await VipApi.updateVipSetting({
      id: vipSettingId,
      masterAgent: masterAgent.value,
      lastMonthVip: editingRecord.value.lastMonthVip ?? null,
      vipLevel: Number(form.vipLevel ?? editingRecord.value.vipLevel),
      levelUpNeedPoint,
      name: form.name,
      icon: editingRecord.value.icon ?? '',
      iconRaw: null,
      extraSettings,
    });

    message.success('更新成功');
    modalOpen.value = false;
    tableInstance?.reload?.();
  }
  catch (e: any) {
    message.error(e?.message || '操作失敗');
  }
  finally {
    modalSubmitting.value = false;
  }
};
</script>

<template>
  <a-result v-if="!hasPermission" status="403" title="權限不足" sub-title="您的帳號等級無法使用此功能" />

  <component
    :is="DynamicTable"
    v-else-if="DynamicTableReady"
    row-key="id"
    :header-title="pageTitle"
    :data-request="loadTableData"
    :columns="columns"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
          <a-col :span="8">
            <a-form-item label="總代理" class="mb-0" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
              <a-select
                v-model:value="masterAgent"
                style="width: 240px"
                :options="masterAgentOptions"
                :disabled="isMasterAgentDisabled"
                :allow-clear="false"
                @change="onMasterAgentChanged"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-typography-text type="secondary">
              vipDowngradeFormula：{{ vipDowngradeFormula }}
            </a-typography-text>
          </a-col>
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" :disabled="!masterAgent || !canEdit" @click="openCreate">
          新增
        </a-button>
      </a-space>
    </template>
  </component>

  <div v-else />

  <a-modal
    v-model:open="modalOpen"
    :title="modalTitle"
    :confirm-loading="modalSubmitting"
    width="720px"
    :mask-closable="false"
    :destroy-on-close="true"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" :label-col="{ span: 9 }" :wrapper-col="{ span: 15 }">
      <a-form-item label="VIP 等級" name="vipLevel" :rules="rules.vipLevel">
        <a-input-number v-model:value="form.vipLevel" style="width: 100%" :disabled="isVipLevelDisabled" :controls="false" />
      </a-form-item>

      <a-form-item label="名稱" name="name" :rules="rules.name">
        <a-input v-model:value="form.name" :maxlength="4" show-count />
      </a-form-item>

      <a-form-item label="升級所需點數" name="levelUpNeedPoint" :rules="rules.levelUpNeedPoint">
        <a-input-number v-model:value="form.levelUpNeedPoint" style="width: 100%" :controls="false" />
      </a-form-item>

      <template v-if="showExtraBlock">
        <a-divider>Extra Settings</a-divider>

        <a-form-item label="升級累積押注" name="totalBet" :rules="rules.totalBet">
          <a-input-number v-model:value="form.totalBet" style="width: 100%" :min="0" :controls="false" />
        </a-form-item>

        <a-form-item v-if="canShowLevelLimitAndBadge" label="升級等級限制" name="levelLimit" :rules="rules.levelLimit">
          <a-input-number v-model:value="form.levelLimit" style="width: 100%" :min="1" :controls="false" />
        </a-form-item>

        <a-form-item v-if="canShowLevelLimitAndBadge" label="勳章欄位(格)" name="badgeSlotCount">
          <a-input-number v-model:value="form.badgeSlotCount" style="width: 100%" :controls="false" disabled />
        </a-form-item>

        <a-form-item :label="sendItemCountLabel" name="sendItemCount" :rules="rules.sendItemCount">
          <a-space direction="vertical" style="width: 100%">
            <a-radio-group v-model:value="form.sendItemCountMode">
              <a-radio value="unlimited">
                無限制
              </a-radio>
              <a-radio value="limited">
                限制次數
              </a-radio>
            </a-radio-group>
            <a-input-number
              v-if="form.sendItemCountMode === 'limited'"
              v-model:value="form.sendItemCount"
              style="width: 100%"
              :min="1"
              :controls="false"
            />
          </a-space>
        </a-form-item>

        <a-form-item label="贈禮" name="sendGift" :rules="rules.sendGift">
          <a-space direction="vertical" style="width: 100%">
            <a-radio-group v-model:value="form.sendGiftMode" @change="syncSendGiftRelated">
              <a-radio value="not">
                不可贈禮
              </a-radio>
              <a-radio value="quota">
                可贈禮(額度)
              </a-radio>
              <a-radio value="unlimited">
                可贈禮(無限)
              </a-radio>
            </a-radio-group>
            <a-input-number
              v-if="form.sendGiftMode === 'quota'"
              v-model:value="form.sendGift"
              style="width: 100%"
              :min="1"
              :controls="false"
            />
          </a-space>
        </a-form-item>

        <a-form-item
          v-if="showTransactionMinLevelLimit"
          label="贈禮等級限制"
          name="transactionMinLevelLimit"
          :rules="rules.transactionMinLevelLimit"
        >
          <a-input-number
            v-model:value="form.transactionMinLevelLimit"
            style="width: 100%"
            :min="0"
            :controls="false"
          />
        </a-form-item>

        <a-form-item
          v-if="showTransactionReservedBalance"
          label="贈禮保留額度"
          name="transactionReservedBalance"
          :rules="rules.transactionReservedBalance"
        >
          <a-input-number
            v-model:value="form.transactionReservedBalance"
            style="width: 100%"
            :min="0"
            :controls="false"
          />
        </a-form-item>

        <a-form-item label="贈禮手續費" name="tip" :rules="rules.tip">
          <a-space direction="vertical" style="width: 100%">
            <a-radio-group v-model:value="form.tipType" :disabled="form.sendGiftMode === 'not'" @change="syncTipRelated">
              <a-radio :value="-1">
                功能關閉
              </a-radio>
              <a-radio :value="0">
                免手續費
              </a-radio>
              <a-radio :value="1">
                收取手續費(%)
              </a-radio>
            </a-radio-group>
            <a-input-number
              v-if="form.tipType === 1"
              v-model:value="form.tip"
              style="width: 100%"
              :min="1"
              :controls="false"
              :disabled="form.sendGiftMode === 'not'"
            />
          </a-space>
        </a-form-item>

        <a-form-item label="收禮" name="receiveGift">
          <a-radio-group v-model:value="form.receiveGift">
            <a-radio :value="0">
              不可收禮
            </a-radio>
            <a-radio :value="1">
              可收禮
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="canShowPrivateTeamFields" label="私群建立上限" name="privateTeamCreateCounts" :rules="rules.privateTeamCreateCounts">
          <a-input-number v-model:value="form.privateTeamCreateCounts" style="width: 100%" :min="0" :controls="false" />
        </a-form-item>

        <a-form-item v-if="canShowPrivateTeamFields" label="私群加入上限" name="privateTeamJoinCounts" :rules="rules.privateTeamJoinCounts">
          <a-input-number v-model:value="form.privateTeamJoinCounts" style="width: 100%" :min="0" :controls="false" />
        </a-form-item>

        <a-form-item v-if="canShowPrivateTeamFields" label="保留座時間" name="seatKeepTime" :rules="rules.seatKeepTime">
          <a-input-number v-model:value="form.seatKeepTime" style="width: 100%" :min="0" :controls="false" />
        </a-form-item>

        <a-form-item label="會員期限" name="vipLimit">
          <a-radio-group v-model:value="form.vipLimit">
            <a-radio :value="0">
              無會員期限
            </a-radio>
            <a-radio :value="1">
              有會員期限
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="canShowGuildFields" label="加入公會" name="isCanJoinGuild">
          <a-radio-group v-model:value="form.isCanJoinGuild">
            <a-radio :value="1">
              可加入
            </a-radio>
            <a-radio :value="0">
              不可加入
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="canShowGuildFields" label="創建公會" name="isCanCreateGuild">
          <a-radio-group v-model:value="form.isCanCreateGuild">
            <a-radio :value="1">
              可創建
            </a-radio>
            <a-radio :value="0">
              不可創建
            </a-radio>
          </a-radio-group>
        </a-form-item>
      </template>
    </a-form>
  </a-modal>
</template>


