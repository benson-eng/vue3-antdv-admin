<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { onMounted, ref } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getPlatformAccount } from '@/api/backend/cashierManager';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'GetPlatformAccount' });

const { t } = useI18n('routes.member.getPlatformAccountPage');
const userStore = useUserStore();

const masterAgent = ref<string>('');
const memberID = ref<string>('');
const memberLabel = ref<string>('');

interface MemberOption {
  label: string;
  value: string;
  raw?: FuzzyQueryUserItem;
}

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

interface Row {
  key: string;
  member: string;
  platform: string;
  account: string;
}

const columns = ref<TableColumn<Row>[]>([
  { title: t('columns.member'), dataIndex: 'member', width: 260, hideInSearch: true },
  { title: t('columns.platform'), dataIndex: 'platform', width: 200, hideInSearch: true },
  { title: t('columns.account'), dataIndex: 'account', hideInSearch: true },
]);

const [DynamicTable, tableInstance] = useTable({ search: false });

const pendingToast = ref(false);

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    return { raw: item, value, label: `${item.accountID} - ${item.nickName}` };
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

const onMemberChange = (_value: string, option: any) => {
  memberLabel.value = String(option?.label ?? '');
};

const doSearch = async () => {
  if (userStore.level < 4 && !masterAgent.value) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  if (!memberID.value) {
    message.error(t('notify.memberRequired'));
    return;
  }
  pendingToast.value = true;
  tableInstance?.reload?.();
};

const reset = () => {
  memberID.value = '';
  memberLabel.value = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
  tableInstance?.reload?.();
};

const loadTableData = async (_params: LoadDataParams) => {
  if (!memberID.value) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const list = await getPlatformAccount({ memberID: memberID.value });
  const items = (Array.isArray(list) ? list : []).map((i: any) => {
    const platform = String(i?.platform ?? '');
    const account = String(i?.account ?? '');
    return {
      key: `${platform}:${account}`,
      member: memberLabel.value || memberID.value,
      platform,
      account,
    } as Row;
  });

  if (pendingToast.value) {
    message.success(t('notify.searchFinish'));
    pendingToast.value = false;
  }

  return { items, meta: { totalItems: items.length } };
};

onMounted(() => {
  // 對齊其他 member 頁：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});
</script>

<template>
  <DynamicTable
    :header-title="t('title')"
    :data-request="loadTableData"
    :columns="columns"
    :pagination="false"
    row-key="key"
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
          v-model:value="memberID"
          show-search
          allow-clear
          :filter-option="false"
          :options="memberOptions"
          :loading="memberLoading"
          style="width: 360px"
          :placeholder="t('filters.memberPlaceholder')"
          @search="onMemberSearch"
          @popup-scroll="onMemberPopupScroll"
          @change="onMemberChange"
        />

        <a-button type="primary" :disabled="!memberID" @click="doSearch">
          {{ t('search') }}
        </a-button>
        <a-button @click="reset">
          {{ t('reset') }}
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>

