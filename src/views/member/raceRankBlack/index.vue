<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';
import type { MarketingEventBase } from '@/api/backend/marketingEvent';
import type { RaceRankBlackItem } from '@/api/backend/rankingSystem';

import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'lodash-es';
import { message, Modal } from 'ant-design-vue';

import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

import { fuzzyQueryUser, logoutAction4Platform } from '@/api/backend/adminSystem/accountSystem';
import { EEventType, queryEventList } from '@/api/backend/marketingEvent';
import { addRaceRankBlack, raceRankBlackQuery, raceRankSettlementQuery, raceRankUnBlack } from '@/api/backend/rankingSystem';
import { equipItem, getPlayerPackV2, unequipItem } from '@/api/backend/treasureChestSystem';

defineOptions({ name: 'RaceRankBlack' });

const i18n = useI18n('routes.member.raceRankBlackPage');
const t = i18n.t;
const userStore = useUserStore();

const masterAgent = ref<string>('');
const eventID = ref<string>('');
const eventList = ref<MarketingEventBase[]>([]);
const awardItemByEventID = ref<Record<string, string>>({});
const isSettlement = ref(false);

const tableLoading = ref(false);
const currentList = ref<RaceRankBlackItem[]>([]);

const [DynamicTable, tableInstance] = useTable({ search: false });

const eventOptions = computed(() =>
  eventList.value.map((e) => {
    const raceName = (e as any)?.extra?.raceName;
    const label = raceName ? `${raceName}-${e.eventName}` : e.eventName;
    return { label, value: e.eventID };
  }),
);

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

const formatEventName = (id: unknown) => {
  const key = String(id ?? '');
  const found = eventOptions.value.find(o => o.value === key);
  return found?.label ?? key;
};

const formatBlackReason = (record: RaceRankBlackItem) => {
  const note = (record as any)?.note;
  if (!note) return '';
  if (typeof note === 'string') return note;
  return String(note?.blackReason ?? '');
};

const refreshSettlement = async () => {
  if (!masterAgent.value || !eventID.value) {
    isSettlement.value = false;
    return;
  }
  try {
    const res = await raceRankSettlementQuery({ masterAgent: masterAgent.value, eventID: eventID.value });
    isSettlement.value = !!res?.result;
  }
  catch {
    isSettlement.value = false;
  }
};

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value || !eventID.value) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    await refreshSettlement();
    const list = await raceRankBlackQuery({ masterAgent: masterAgent.value, eventID: eventID.value });
    const items = Array.isArray(list) ? list : [];
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const columns = ref<TableColumn<RaceRankBlackItem>[]>([
  {
    title: t('columns.event'),
    dataIndex: 'eventID',
    width: 260,
    hideInSearch: true,
    customRender: ({ text }) => formatEventName(text),
  },
  { title: t('columns.memberID'), dataIndex: 'memberID', width: 220, hideInSearch: true },
  {
    title: t('columns.blackReason'),
    dataIndex: 'blackReason',
    hideInSearch: true,
    customRender: ({ record }) => formatBlackReason(record as RaceRankBlackItem),
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 160,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: t('delete'),
        type: 'link',
        danger: true,
        disabled: () => isSettlement.value,
        onClick: () => onDelete(record as RaceRankBlackItem),
      },
    ],
  },
]);

// =========================
// Event list
// =========================

const fetchEvents = async () => {
  if (!masterAgent.value) {
    eventList.value = [];
    awardItemByEventID.value = {};
    eventID.value = '';
    return;
  }
  const list = await queryEventList({ masterAgent: masterAgent.value, eventType: EEventType.MAHJONG_BINGO_RACE });
  const items = Array.isArray(list) ? list : [];
  eventList.value = items;
  const map: Record<string, string> = {};
  items.forEach((e) => {
    if (e?.eventID && e?.awardItem) {
      map[e.eventID] = String(e.awardItem);
    }
  });
  awardItemByEventID.value = map;
  // 如果目前選到的 eventID 不存在，清掉
  if (eventID.value && !items.some(e => e.eventID === eventID.value)) {
    eventID.value = '';
  }
};

// =========================
// Modal (Add)
// =========================

type ModalMode = 'add';
const modalOpen = ref(false);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');

const modalTitle = computed(() => t('titleAdd'));

const form = ref<{ memberID: string; eventID: string; note: string }>({
  memberID: '',
  eventID: '',
  note: '',
});

interface MemberOption { label: string; value: string; disabled?: boolean; raw?: FuzzyQueryUserItem }
const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    const disabled = unselectableSet.value.has(value) && form.value.memberID !== value;
    return {
      raw: item,
      value,
      label: `${item.accountID} - ${item.nickName}`,
      disabled,
    };
  });

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;
  if (!masterAgent.value) {
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
      masterAgent: masterAgent.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });
    const list = Array.isArray(res) ? res : [];
    const mapped = mapMemberOptions(list);
    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);
const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) return;
  if (!memberLastQueryText.value) return;
  if (!memberLastAccountID.value) return;
  await fetchMemberOptions(memberLastQueryText.value, true);
};

const openAddModal = async () => {
  if (!masterAgent.value) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  if (!eventID.value) {
    message.error(t('notify.eventRequired'));
    return;
  }
  if (isSettlement.value) {
    message.warning(t('notify.settledDisabled'));
    return;
  }

  modalMode.value = 'add';
  modalOpen.value = true;
  modalSubmitting.value = false;

  form.value = { memberID: '', eventID: eventID.value, note: '' };
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const closeModal = () => {
  modalOpen.value = false;
};

const hasAwardItem = computed(() => !!awardItemByEventID.value[form.value.eventID]);

const checkPlayerHasAwardItem = async (memberID: string, treasureItemID: string) => {
  try {
    const rows = await getPlayerPackV2({ memberID });
    const allItems = (rows || []).flatMap(r => (r?.items || []));
    return allItems.some(i => String(i?.treasureItemID ?? '') === String(treasureItemID));
  }
  catch {
    return false;
  }
};

const submitModal = async () => {
  try {
    if (!masterAgent.value) throw new Error(t('notify.masterAgentRequired'));
    if (!form.value.eventID) throw new Error(t('notify.eventRequired'));
    if (!form.value.memberID) throw new Error(t('notify.required'));
    if (!form.value.note) throw new Error(t('notify.noteRequired'));

    modalSubmitting.value = true;

    const res = await addRaceRankBlack({
      masterAgent: masterAgent.value,
      memberID: form.value.memberID,
      eventID: form.value.eventID,
      note: form.value.note,
    });

    if (!res?.result) {
      message.error(t('notify.resultRaceRankBlack'));
      return;
    }

    message.success(t('addSuccess'));

    // 對齊 Vue2：若玩家背包有該活動獎勵道具，加入黑名單後先脫掉，再強制登出
    const awardItem = awardItemByEventID.value[form.value.eventID];
    if (awardItem) {
      const ok = await checkPlayerHasAwardItem(form.value.memberID, awardItem);
      if (ok) {
        await unequipItem({ memberID: form.value.memberID, treasureItemID: awardItem });
      }
    }
    await logoutAction4Platform({ memberID: form.value.memberID });

    closeModal();
    // 同步 toolbar 的 eventID（通常一致）
    eventID.value = form.value.eventID;
    tableInstance?.reload?.();
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
  finally {
    modalSubmitting.value = false;
  }
};

async function onDelete(record: RaceRankBlackItem) {
  if (!masterAgent.value || !eventID.value) return;
  if (isSettlement.value) {
    message.warning(t('notify.settledDisabled'));
    return;
  }

  const memberID = String(record.memberID ?? '');
  const eid = String(record.eventID ?? eventID.value);
  const awardItem = awardItemByEventID.value[eid];

  Modal.confirm({
    title: t('confirmDelete'),
    content: `${t('confirmDeleteContent')} ${memberID}`,
    okText: t('delete'),
    okType: 'danger',
    cancelText: t('cancel'),
    async onOk() {
      await raceRankUnBlack({ masterAgent: masterAgent.value, memberID, eventID: eid });
      // 對齊 Vue2：解除黑名單後穿回獎勵道具（若該活動有設定 awardItem）
      if (awardItem) {
        await equipItem({ memberID, treasureItemID: awardItem });
      }
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

watch(
  () => masterAgent.value,
  async () => {
    eventID.value = '';
    currentList.value = [];
    await fetchEvents();
    tableInstance?.reload?.();
  },
);

watch(
  () => eventID.value,
  async () => {
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    await refreshSettlement();
    tableInstance?.reload?.();
  },
);

onMounted(async () => {
  // 對齊其他 member 頁：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
  await fetchEvents();
});
</script>

<template>
  <div>
    <DynamicTable
      :header-title="t('title')"
      :data-request="loadTableData"
      :columns="columns"
      :pagination="false"
      row-key="memberID"
    >
      <template #toolbar>
        <a-space>
          <template v-if="userStore.level < 4">
            <AdminAccountSelector
              v-model="masterAgent"
              value-type="account"
              :auto-select-first="true"
              style="width: 240px"
              :placeholder="t('filters.masterAgentPlaceholder')"
            />
          </template>
          <template v-else>
            <a-input :value="masterAgent" style="width: 240px" disabled />
          </template>

          <a-select
            v-model:value="eventID"
            :options="eventOptions"
            style="width: 360px"
            allow-clear
            :placeholder="t('filters.eventPlaceholder')"
          />

          <a-button type="primary" :disabled="!masterAgent || !eventID || isSettlement" @click="openAddModal">
            {{ t('add') }}
          </a-button>
        </a-space>
      </template>
    </DynamicTable>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="modalSubmitting"
      :mask-closable="false"
      :destroy-on-close="true"
      width="720px"
      @ok="submitModal"
      @cancel="closeModal"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('form.event')" required>
          <a-select
            v-model:value="form.eventID"
            :options="eventOptions"
            :disabled="true"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item :label="t('form.member')" required>
          <a-select
            v-model:value="form.memberID"
            show-search
            :filter-option="false"
            :options="memberOptions"
            :loading="memberLoading"
            :placeholder="t('form.memberPlaceholder')"
            style="width: 100%"
            allow-clear
            @search="onMemberSearch"
            @popup-scroll="onMemberPopupScroll"
          />
        </a-form-item>

        <a-form-item :label="t('form.note')" required>
          <a-textarea v-model:value="form.note" :rows="5" :placeholder="t('form.notePlaceholder')" />
        </a-form-item>

        <a-alert
          v-if="!hasAwardItem"
          type="warning"
          show-icon
          :message="t('notify.noAwardItemWarning')"
        />
      </a-form>
    </a-modal>
  </div>
</template>


