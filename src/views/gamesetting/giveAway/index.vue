<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type { ForceBingoPayload, GameSettingItem } from '@/api/backend/adminSystem/slotgameServer';

import { message } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import { forceBingo, getConfigItem } from '@/api/backend/adminSystem/slotgameServer';

import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'GiveAway' });

const { t } = useI18n();
const userStore = useUserStore();

const buildAgentID = (agent: string, masterAgent: string) => {
  if (!agent || !masterAgent) {
    return '';
  }
  if (agent.includes('.')) {
    return agent;
  }
  return `${agent}.${masterAgent}`;
};

const form = ref({
  masterAgent: '',
  agent: '',
  accountID: '', // 對齊 Vue2 giveAway：送 API 的 memberID 直接用 accountID（sMemberID）
  gameID: '',
  forceType: '',
  debugStrips: '',
});

const hasPermission = computed(() => userStore.level < 4);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);
const isAgentDisabled = computed(() => userStore.level >= 5 || !form.value.masterAgent);
const canSubmit = computed(() => userStore.level < 3);

const masterAgentOptions = ref<DefaultOptionType[]>([]);
const masterAgentMetaMap = ref<Record<string, MasterAgentItem>>({});

const agentOptions = ref<DefaultOptionType[]>([]);
const agentRawList = ref<AgentItem[]>([]);

const gameOptions = ref<DefaultOptionType[]>([]);

const currencyType = ref<string>('');

/**
 * Member selector（對齊 Vue2 SearchMemberID 的 remoteMethod）
 */
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const resetMemberSelector = () => {
  form.value.accountID = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;
  if (!form.value.masterAgent) {
    message.error('請先選擇總代理');
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
      masterAgent: form.value.masterAgent,
      agentID: form.value.agent ? buildAgentID(form.value.agent, form.value.masterAgent) : undefined,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });
    const list = Array.isArray(res) ? res : [];
    const mapped = list.map(item => ({
      raw: item,
      value: item.accountID,
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

/**
 * masterAgent / agent
 */
const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList();
  const rows = Array.isArray(list) ? list : [];
  masterAgentOptions.value = rows.map(i => ({ label: i.account, value: i.account }));
  masterAgentMetaMap.value = rows.reduce((acc: any, cur: any) => {
    acc[cur.account] = cur;
    return acc;
  }, {});
};

const fetchAgents = async (masterAgent: string) => {
  if (!masterAgent) {
    agentRawList.value = [];
    agentOptions.value = [];
    return;
  }
  const list = await getAgentListByMasterAgent({ masterAgent });
  agentRawList.value = Array.isArray(list) ? list : [];
  agentOptions.value = agentRawList.value.map((i) => {
    const agentText = i.account.includes('.') ? i.account.split('.')[0] : i.account;
    return { label: agentText, value: i.account };
  });
};

const fetchGames = async () => {
  if (!form.value.masterAgent) { return; }
  if (!form.value.agent) { return; }

  const list = await gameList({
    masterAgent: form.value.masterAgent,
    agent: form.value.agent,
  });

  const rows: GameInfo[] = Array.isArray(list) ? list : [];

  // 僅保留 gameID 全為數字的項目
  const numericOnly = rows.filter(g => /^\d+$/.test(String(g.gameID ?? '')));

  gameOptions.value = numericOnly.map((g) => {
    const displayName
      = g.language?.tw?.trim()
        ? g.language.tw
        : g.gameName;

    return {
      label: `${g.gameID} - ${displayName}`,
      value: g.gameID,
    };
  });
};

const onMasterAgentChanged = async (val: string) => {
  form.value.masterAgent = val;
  form.value.agent = '';
  form.value.gameID = '';
  form.value.forceType = '';
  form.value.debugStrips = '';
  resetMemberSelector();

  const meta = masterAgentMetaMap.value[val];
  currencyType.value = meta?.currencies?.[0]?.currencyCode || '';

  await fetchAgents(val);
  if (userStore.level < 5 && agentRawList.value.length > 0) {
    form.value.agent = agentRawList.value[0].account;
  }
  await fetchGames();
};

const onAgentChanged = async (val: string) => {
  form.value.agent = val;
  form.value.gameID = '';
  form.value.forceType = '';
  form.value.debugStrips = '';
  resetMemberSelector();
  await fetchGames();
};

watch(
  () => form.value.masterAgent,
  () => {
    // masterAgent 變更，清空 member options
    memberOptions.value = [];
  },
);
watch(
  () => form.value.agent,
  () => {
    memberOptions.value = [];
  },
);

/**
 * forceBingoList
 */
const forceBingoList = ref<string[]>([]);
const forceBingoLoading = ref(false);

watch(
  () => form.value.gameID,
  async (newGameID) => {
    form.value.forceType = '';
    forceBingoList.value = [];
    if (!newGameID) {
      return;
    }
    if (!currencyType.value) {
      return;
    }

    forceBingoLoading.value = true;
    try {
      const items = (await getConfigItem(newGameID, currencyType.value, 'forceBingoList')) as GameSettingItem[];
      const [forceBingoItem, jpItem] = Array.isArray(items) ? items : [];

      const base = Array.isArray(forceBingoItem?.value) ? forceBingoItem.value : [];
      const jp = Array.isArray(jpItem?.value) ? jpItem.value : [];
      const merged = [...base, ...jp].map(v => String(v)).filter(Boolean);
      // 去重（保持順序）
      const seen = new Set<string>();
      forceBingoList.value = merged.filter((x) => {
        if (seen.has(x)) {
          return false;
        }
        seen.add(x);
        return true;
      });
    }
    catch (e: any) {
      message.error(e?.message || '取得送獎類型失敗');
    }
    finally {
      forceBingoLoading.value = false;
    }
  },
);

const parseDebugStrips = (str: string): Array<number | string> => {
  const reg = /(^\[)|(\]$)/g;
  if (typeof str !== 'string') {
    throw new TypeError('debugStrips 格式錯誤');
  }
  if (!reg.test(str)) {
    throw new Error('轉輪帶格式需為陣列字串，例如：[1,2,3]');
  }
  const arr = str.replace(reg, '').split(',');
  return arr.map(element => (Number.isNaN(Number(element)) ? element : Number(element)));
};

const handleSubmit = async () => {
  try {
    if (!canSubmit.value) {
      message.error('權限不足');
      return;
    }
    if (!form.value.masterAgent) {
      throw new Error('請選擇總代理');
    }
    if (!form.value.agent) {
      throw new Error('請選擇代理');
    }
    if (!form.value.gameID) {
      throw new Error('請選擇遊戲');
    }
    if (!form.value.accountID) {
      throw new Error('請輸入/選擇會員帳戶ID');
    }

    const debugStripArr = form.value.debugStrips ? parseDebugStrips(form.value.debugStrips) : [];
    debugStripArr.forEach((x) => {
      if (typeof x !== 'number') {
        throw new TypeError('轉輪帶內容需為數字，例如：[1,2,3]');
      }
    });

    const payload: ForceBingoPayload = {
      forceType: form.value.forceType || undefined,
      debugStrip: (debugStripArr as number[]).length > 0 ? (debugStripArr as number[]) : undefined,
    };

    await forceBingo(form.value.gameID, form.value.accountID, payload);
    message.success('送出成功');
  }
  catch (e: any) {
    message.error(e?.message || '送出失敗');
  }
};

onMounted(async () => {
  await fetchMasterAgents();

  // 對齊 Vue2 AgentIDSelector 預設選擇邏輯
  if (userStore.level >= 4) {
    form.value.masterAgent = userStore.masterAgent || '';
  }
  else {
    form.value.masterAgent = (masterAgentOptions.value[0]?.value as string) || '';
  }

  if (form.value.masterAgent) {
    const meta = masterAgentMetaMap.value[form.value.masterAgent];
    currencyType.value = meta?.currencies?.[0]?.currencyCode || '';
    await fetchAgents(form.value.masterAgent);
  }

  if (userStore.level >= 5) {
    form.value.agent = userStore.agent || '';
  }
  else {
    form.value.agent = agentRawList.value[0]?.account || '';
  }

  await fetchGames();
});
</script>

<template>
  <div>
    <a-alert
      v-if="!hasPermission"
      type="error"
      show-icon
      :message="t('common.noPermission') || '權限不足'"
      style="margin-bottom: 16px"
    />

    <div class="filter-container">
      <div class="wrap">
        <!-- masterAgent -->
        <div class="input_group">
          <div class="txt">
            <label>總代理</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="form.masterAgent"
              style="width: 200px"
              :options="masterAgentOptions"
              :disabled="isMasterAgentDisabled"
              :allow-clear="false"
              @change="onMasterAgentChanged"
            />
          </div>
        </div>

        <!-- agent -->
        <div class="input_group">
          <div class="txt">
            <label class="fontred">代理</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="form.agent"
              style="width: 200px"
              :options="agentOptions"
              :disabled="isAgentDisabled"
              :allow-clear="false"
              @change="onAgentChanged"
            />
          </div>
        </div>

        <!-- accountID (sMemberID) -->
        <div class="input_group">
          <div class="txt">
            <label class="fontred">帳戶ID</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="form.accountID"
              show-search
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!form.masterAgent"
              style="width: 200px"
              allow-clear
              @search="onMemberSearch"
              @popup-scroll="onMemberPopupScroll"
            />
          </div>
        </div>

        <!-- gameID -->
        <div class="input_group">
          <div class="txt">
            <label class="fontred">遊戲</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="form.gameID"
              style="width: 260px"
              :options="gameOptions"
              :disabled="!form.masterAgent || !form.agent"
              show-search
              :filter-option="(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())"
              allow-clear
            />
          </div>
        </div>

        <!-- forceType -->
        <div class="input_group">
          <div class="txt">
            <label>送獎類型</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="form.forceType"
              style="width: 200px"
              :options="forceBingoList.map(x => ({ label: x, value: x }))"
              :loading="forceBingoLoading"
              allow-clear
            />
          </div>
        </div>

        <!-- debugStrips -->
        <div class="input_group">
          <div class="txt">
            <label>轉輪帶</label>
          </div>
          <div class="my_input">
            <a-input
              v-model:value="form.debugStrips"
              style="width: 200px"
              placeholder="[1,2,3]"
            />
          </div>
        </div>

        <!-- submit -->
        <div class="input_group">
          <a-button type="primary" :disabled="!canSubmit" @click="handleSubmit">
            送出
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-container {
  margin-bottom: 16px;
}

.wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.input_group {
  display: flex;
  align-items: center;
  padding: 10px;
}

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

.fontred {
  color: #ff4949;
}
</style>

