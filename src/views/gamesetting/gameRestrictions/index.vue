<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';

import { message } from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';

import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { gameList, isExternalGame } from '@/api/backend/adminSystem/gameManagerServer';
import { getConfigSetting } from '@/api/backend/adminSystem/slotgameServer';

import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'GameRestrictions' });

interface GameSettingRow {
  currencyType: string;
  gameID: string;
  gameName: string;
  rtp: number | null;
  maxBet: number | null;
  betLimit: number | null;
}

const { t } = useI18n();
const userStore = useUserStore();

const canSelectMasterAgent = computed(() => userStore.level < 4);

const masterAgent = ref('');
const currencyType = ref('');

const masterAgentOptions = ref<DefaultOptionType[]>([]);
const masterAgentMetaMap = ref<Record<string, MasterAgentItem>>({});

const loading = ref(false);
const rows = ref<GameSettingRow[]>([]);

const formatAmount = (v: number | null) => {
  if (v === null || v === undefined) {
    return '-';
  }
  const n = Number(v);
  if (Number.isNaN(n)) {
    return '-';
  }
  return n.toLocaleString();
};

const columns = [
  {
    title: t('page.gameSetting.labels.currencyType') || '幣別',
    dataIndex: 'currencyType',
    key: 'currencyType',
    align: 'center',
  },
  {
    title: t('page.gameSetting.labels.gameID') || '遊戲ID',
    dataIndex: 'gameID',
    key: 'gameID',
    align: 'center',
  },
  {
    title: t('page.gameSetting.labels.gameName') || '遊戲名稱',
    dataIndex: 'gameName',
    key: 'gameName',
    align: 'center',
    width: 400,
  },
  {
    title: t('page.gameSetting.labels.rtp') || 'RTP',
    dataIndex: 'rtp',
    key: 'rtp',
    align: 'center',
  },
  {
    title: t('page.gameSetting.labels.maxBet') || '最大押注',
    dataIndex: 'maxBet',
    key: 'maxBet',
    align: 'center',
    customRender: ({ text }: any) => formatAmount(text as any),
  },
  {
    title: t('page.gameSetting.labels.betLimit') || '押注上限',
    dataIndex: 'betLimit',
    key: 'betLimit',
    align: 'center',
    customRender: ({ text }: any) => formatAmount(text as any),
  },
] as any[];

const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList();
  const data = Array.isArray(list) ? list : [];

  masterAgentOptions.value = data.map(i => ({ label: i.account, value: i.account }));
  masterAgentMetaMap.value = data.reduce((acc: any, cur: any) => {
    acc[cur.account] = cur;
    return acc;
  }, {});
};

const updateCurrencyTypeByMasterAgent = (ma: string) => {
  const meta = masterAgentMetaMap.value[ma];
  currencyType.value = meta?.currencies?.[0]?.currencyCode || '';
};

const clearTable = () => {
  rows.value = [];
};

const loadGameRestrictions = async () => {
  if (!masterAgent.value) {
    clearTable();
    return;
  }
  if (!currencyType.value) {
    clearTable();
    message.error('此總代理未設定幣別');
    return;
  }

  loading.value = true;
  rows.value = [];
  try {
    const list = await gameList({ masterAgent: masterAgent.value });
    const games: GameInfo[] = Array.isArray(list) ? list : [];

    // 僅保留 gameID 全為數字的項目（對齊 Vue2）
    const numericOnly = games.filter(g => /^\d+$/.test(String(g.gameID ?? '')));

    const gameMap = numericOnly.reduce<Record<string, GameInfo>>((acc, g) => {
      const id = String(g.gameID);
      acc[id] = g;
      return acc;
    }, {});

    const gameIDs = Object.keys(gameMap);
    const internalGameIDs = gameIDs.filter(id => !isExternalGame(id));
    const externalGameIDs = gameIDs.filter(id => isExternalGame(id));

    const settled = await Promise.allSettled(
      internalGameIDs.map(async (gameID) => {
        const info = gameMap[gameID];
        let gameName = info?.gameName || '';
        if (info?.language?.tw) {
          gameName += ` (${info.language.tw})`;
        }

        const setting = await getConfigSetting(gameID, masterAgent.value, currencyType.value, ['rtp', 'maxBet', 'betLimit']);
        const items = Array.isArray(setting?.items) ? setting.items : [];
        const rtp = typeof items[0] === 'number' ? (items[0] as number) : null;
        const maxBet = typeof items[1] === 'number' ? (items[1] as number) : null;
        const betLimit = typeof items[2] === 'number' ? (items[2] as number) : null;

        const row: GameSettingRow = {
          currencyType: currencyType.value,
          gameID,
          gameName,
          rtp,
          maxBet,
          betLimit,
        } as any;
        return row;
      }),
    );

    const internalRows: GameSettingRow[] = [];
    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        internalRows.push(s.value);
        return;
      }
      const gameID = internalGameIDs[idx];
      message.open({ type: 'error', content: `gameID: ${gameID} 取得設定失敗`, duration: 0 });
    });

    const externalRows: GameSettingRow[] = externalGameIDs.map((gameID) => {
      const info = gameMap[gameID];
      let gameName = info?.gameName || '';
      if (info?.language?.tw) {
        gameName += ` (${info.language.tw})`;
      }
      return {
        currencyType: currencyType.value,
        gameID,
        gameName,
        rtp: null,
        maxBet: null,
        betLimit: null,
      };
    });

    const all = [...internalRows, ...externalRows].sort((a, b) => {
      const ai = Number(a.gameID);
      const bi = Number(b.gameID);
      if (!Number.isNaN(ai) && !Number.isNaN(bi)) {
        return ai - bi;
      }
      return a.gameID < b.gameID ? -1 : 1;
    });

    rows.value = all;
  }
  catch (e: any) {
    message.error(e?.message || '取得遊戲規格設定失敗');
  }
  finally {
    loading.value = false;
  }
};

const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val;
  updateCurrencyTypeByMasterAgent(val);
  await loadGameRestrictions();
};

onMounted(async () => {
  await fetchMasterAgents();

  // 對齊 Vue2：level >= 4 固定使用自身 masterAgent
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent || '';
  }
  else {
    masterAgent.value = (masterAgentOptions.value[0]?.value as string) || '';
  }

  if (masterAgent.value) {
    updateCurrencyTypeByMasterAgent(masterAgent.value);
    await loadGameRestrictions();
  }
});
</script>

<template>
  <div class="gameRestrictions">
    <div class="control-container wrap" style="margin-bottom: 12px">
      <div v-if="canSelectMasterAgent" class="input_group">
        <div class="txt">
          <label>總代理</label>
        </div>
        <div class="my_input">
          <a-select
            v-model:value="masterAgent"
            style="width: 220px"
            :options="masterAgentOptions"
            :disabled="loading"
            :allow-clear="false"
            @change="onMasterAgentChanged"
          />
        </div>
      </div>

      <div v-else class="input_group">
        <div class="txt">
          <label>總代理</label>
        </div>
        <div class="my_input">
          <a-input :value="masterAgent" disabled style="width: 220px" />
        </div>
      </div>
    </div>

    <div class="gameRestrictionList">
      <h3 style="margin: 0 0 12px 0">
        {{ t('page.gameSetting.title.gameRestrictions') || '遊戲規格設定(閱讀)' }}
      </h3>

      <a-table
        bordered
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="gameID"
        :pagination="{ pageSize: 50, showSizeChanger: true }"
      />
    </div>
  </div>
</template>

<style scoped>
.gameRestrictionList {
  margin: 20px;
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
  width: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>



