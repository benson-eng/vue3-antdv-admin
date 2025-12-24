<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue';
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';

import { message } from 'ant-design-vue';
import { saveAs } from 'file-saver';
import { cloneDeep, isEqual, omit } from 'lodash-es';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import * as XLSX from 'xlsx';

import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { gameList, getGameIDList, isExternalGame, setGameIDList } from '@/api/backend/adminSystem/gameManagerServer';

import { getConfigItem, getConfigSetting, setConfigSetting } from '@/api/backend/adminSystem/slotgameServer';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'GameRestrictionsGlobalSetting' });

type ConfigItemType = 'checkBox' | 'range' | 'list';
interface ConfigItem { name: string; type: ConfigItemType; value: Array<number | string> }

type RowValue = string | number | boolean | null | undefined | Array<string | number> | Record<string, any>;

interface GameSettingRow extends Record<string, RowValue> {
  masterAgent: string;
  currencyType: string;
  gameID: string;
  gameName: string;
  isEnabled: boolean;
  isExternalGame: boolean;
  updatedAt?: string;
}

const { t } = useI18n();
const userStore = useUserStore();
const route = useRoute();

const canSelectMasterAgent = computed(() => userStore.level < 4);
const canEdit = computed(() => userStore.level < 3);

/**
 * 對齊 Vue2：admin-web/src/views/gamesetting/gameRestrictionsGlobalSetting.vue
 * - 以 route 判斷目前模式（同一個 component 對應兩個 route）
 * - checkName === 'gameRestrictionsGlobalSetting' -> isGlobalSettingPage = true
 * - 否則（例如 gameRestrictionsFullSetting）-> isGlobalSettingPage = false，並套用 filterHeard 過濾
 */
const isGlobalSettingPage = ref(false);
const filterHeard = ['isEnabled', 'controlRTP', 'controlNewbie', 'gameRegulation'] as const;
const controllerShow = ref(false);

const applyRouteConfig = () => {
  // Vue2：window.location.hash.split('/') 最後一段
  // Vue3：優先用 route.name（等價），找不到再退回 path 最後一段
  const checkName = (route.name ? String(route.name) : '') || String(route.path.split('/').pop() || '');
  isGlobalSettingPage.value = checkName === 'gameRestrictionsGlobalSetting' || checkName === 'GameRestrictionsGlobalSetting';
};

const masterAgent = ref('');
const currencyType = ref('');

const masterAgentOptions = ref<DefaultOptionType[]>([]);
const masterAgentMetaMap = ref<Record<string, MasterAgentItem>>({});

const loading = ref(false);
const tableLoading = ref(false);

const configItems = ref<ConfigItem[]>([]);
const tableHeaders = ref<string[]>([]);

const rows = ref<GameSettingRow[]>([]);
const originalRows = ref<GameSettingRow[]>([]);
const changedRowIndex = ref<number[]>([]);
const isDataChange = ref(false);
const isImportExcel = ref(false);

const importOpen = ref(false);

const updateCurrencyTypeByMasterAgent = (ma: string) => {
  const meta = masterAgentMetaMap.value[ma];
  currencyType.value = meta?.currencies?.[0]?.currencyCode || '';
};

const clearAll = () => {
  configItems.value = [];
  tableHeaders.value = [];
  rows.value = [];
  originalRows.value = [];
  changedRowIndex.value = [];
  isDataChange.value = false;
  isImportExcel.value = false;
};

const recomputeDiff = () => {
  const diff: number[] = [];
  const cur = rows.value;
  const old = originalRows.value;
  const len = Math.min(cur.length, old.length);
  for (let i = 0; i < len; i++) {
    if (!isEqual(cur[i], old[i])) {
      diff.push(i);
    }
  }
  changedRowIndex.value = diff;
  isDataChange.value = diff.length > 0;
};

const formatCellValue = (key: string, value: any) => {
  if (value === null || value === undefined) {
    return '-';
  }
  // 常見金額欄位簡單格式化（對齊 Vue2 的展示需求）
  const currencyLike = ['totalWinLimit', 'betLimit', 'maxBet', 'maxSingleBet', 'gameRegulation'];
  if (currencyLike.includes(key) && (typeof value === 'number' || typeof value === 'string')) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return n.toLocaleString();
    }
  }
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    }
    catch {
      return String(value);
    }
  }
  return String(value);
};

const getColumnKey = (column: any): string => {
  // Antdv column.key 可能是 Key | undefined，因此統一轉成 string
  return String(column?.key ?? column?.dataIndex ?? '');
};

const desiredOrder = [
  'masterAgent',
  'updatedAt',
  'gameID',
  'gameName',
  'isEnabled',
  'currencyType',
  'isExternalGame',
  'rtp',
  'rtpMasterAgent',
  'totalWinLimit',
  'betList',
  'betLimit',
  'reelBet',
  'maxBet',
  'isOpenBuyFeature',
  'buyFeatureBetMax',
  'maxSingleBet',
  'probVer',
] as const;

const buildHeaders = (items: ConfigItem[]) => {
  const fixed = ['isEnabled', 'currencyType', 'gameID', 'gameName', 'isExternalGame'];
  const itemNames = items.map(i => i.name);
  const orderMap = new Map<string, number>(desiredOrder.map((k, i) => [k, i]));
  const sortedItems = [...new Set(itemNames)].sort((a, b) => (orderMap.get(a) ?? Number.POSITIVE_INFINITY) - (orderMap.get(b) ?? Number.POSITIVE_INFINITY));
  tableHeaders.value = [...fixed, ...sortedItems];
  if (!isGlobalSettingPage.value) {
    tableHeaders.value = tableHeaders.value.filter(h => !filterHeard.includes(h as any));
  }
};

const columns = computed(() => {
  const headers = tableHeaders.value;
  const rest = headers.filter(h => h !== 'gameID' && h !== 'gameName');
  const displayHeaders = [
    ...(headers.includes('gameID') ? ['gameID'] : []),
    ...(headers.includes('gameName') ? ['gameName'] : []),
    ...rest,
  ];

  return displayHeaders.map((h) => {
    const titleMap: Record<string, string> = {
      currencyType: t('page.gameSetting.labels.currencyType') || '幣別',
      gameID: t('page.gameSetting.labels.gameID') || '遊戲ID',
      gameName: t('page.gameSetting.labels.gameName') || '遊戲名稱',
    };
    return {
      title: titleMap[h] || h,
      dataIndex: h,
      key: h,
      align: 'center',
      fixed: h === 'gameID' || h === 'gameName' ? 'left' : undefined,
      width: h === 'gameName' ? 420 : (h === 'betList' ? 700 : 140),
    } as any;
  });
});

const rowClassName = (_record: any, index: number) => {
  return changedRowIndex.value.includes(index) ? 'changed-row' : '';
};

const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList();
  const data = Array.isArray(list) ? list : [];

  masterAgentOptions.value = data.map(i => ({ label: i.account, value: i.account }));
  masterAgentMetaMap.value = data.reduce((acc: any, cur: any) => {
    acc[cur.account] = cur;
    return acc;
  }, {});
};

const getConfigItemsByGame = async (gameID: string): Promise<ConfigItem[]> => {
  const res = await getConfigItem(gameID, currencyType.value, 'gameSettingList');
  return Array.isArray(res) ? (res as any) : [];
};

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  handler: (item: T, idx: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((it, bi) => handler(it, i + bi)));
    results.push(...settled);
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

const loadAll = async () => {
  if (!masterAgent.value) {
    clearAll();
    return;
  }
  if (!currencyType.value) {
    clearAll();
    message.error('此總代理未設定幣別');
    return;
  }

  loading.value = true;
  tableLoading.value = true;
  try {
    clearAll();

    const list = await gameList({ masterAgent: masterAgent.value });
    const rawGames: GameInfo[] = Array.isArray(list) ? list : [];

    // 對齊 Vue2：可透過 route.meta.gameType 指定過濾
    const gameType = (route.meta as any)?.gameType;
    const games: GameInfo[] = gameType ? rawGames.filter(g => g.gameType === gameType) : rawGames;

    // 對齊 Vue2：僅保留 gameID 全為數字的項目
    const numericOnly = games.filter(g => /^\d+$/.test(String(g.gameID ?? '')));

    const gameMap = numericOnly.reduce<Record<string, GameInfo>>((acc, g) => {
      const id = String(g.gameID);
      acc[id] = g;
      return acc;
    }, {});

    const gameIDs = Object.keys(gameMap);
    const internalGameIDs = gameIDs.filter(id => !isExternalGame(id));
    const externalGameIDs = gameIDs.filter(id => isExternalGame(id));

    const enabledListRes = await getGameIDList({ masterAgent: masterAgent.value });
    const enabledList = Array.isArray(enabledListRes) ? enabledListRes : [];
    const enabledSet = new Set(enabledList.map(String));

    const builtRows: GameSettingRow[] = [];
    const configNameSet = new Set<string>();

    // 內部遊戲：讀取設定
    const settled = await processInBatches(
      internalGameIDs,
      20,
      200,
      async (gameID) => {
        const info = gameMap[gameID];
        let gameName = info?.gameName || '';
        if (info?.language?.tw) {
          gameName += ` (${info.language.tw})`;
        }
        const enabled = enabledSet.has(gameID);

        // ✅ 對齊 Vue2：每個遊戲都要各自取得自己的設定項目（getConfigItem）
        const gameConfigItems = await getConfigItemsByGame(gameID);
        const itemNames = gameConfigItems.map(i => i.name);

        const setting = await getConfigSetting(gameID, masterAgent.value, currencyType.value, itemNames);
        const items = Array.isArray(setting?.items) ? setting.items : [];

        const row: GameSettingRow = {
          masterAgent: masterAgent.value,
          currencyType: currencyType.value,
          gameID,
          gameName,
          isEnabled: enabled,
          isExternalGame: false,
          updatedAt: setting?.updatedAt,
        };

        gameConfigItems.forEach((ci, idx) => {
          row[ci.name] = items[idx] ?? null;
        });

        return { row, gameConfigItems };
      },
    );

    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        builtRows.push(s.value.row);
        s.value.gameConfigItems.forEach(ci => configNameSet.add(ci.name));
      }
      else {
        const gameID = internalGameIDs[idx];
        message.open({ type: 'error', content: `gameID: ${gameID} 取得設定失敗`, duration: 0 });
      }
    });

    // ✅ 以所有遊戲的設定項目做 union 來生成表頭（對齊 Vue2 會累積 configHeader 的行為）
    if (internalGameIDs.length > 0) {
      configItems.value = Array.from(configNameSet).map((name) => {
        return { name, type: 'list', value: [] } as any;
      });
      buildHeaders(configItems.value);
    }
    else {
      // 沒有內部遊戲仍要顯示固定欄位（但沒有動態設定欄）
      configItems.value = [];
      buildHeaders([]);
    }

    // 外部遊戲：只做開關控制
    externalGameIDs.forEach((gameID) => {
      const info = gameMap[gameID];
      let gameName = info?.gameName || '';
      if (info?.language?.tw) {
        gameName += ` (${info.language.tw})`;
      }
      builtRows.push({
        masterAgent: masterAgent.value,
        currencyType: currencyType.value,
        gameID,
        gameName,
        isEnabled: enabledSet.has(gameID),
        isExternalGame: true,
      });
    });

    builtRows.sort((a, b) => {
      const ai = Number(a.gameID);
      const bi = Number(b.gameID);
      if (!Number.isNaN(ai) && !Number.isNaN(bi)) {
        return ai - bi;
      }
      return a.gameID < b.gameID ? -1 : 1;
    });

    rows.value = builtRows;
    originalRows.value = cloneDeep(builtRows);

    // 對齊 Vue2：fullSetting 模式要把某些欄位從資料/表頭移除
    if (!isGlobalSettingPage.value) {
      rows.value = rows.value.map(r => omit(r, filterHeard as unknown as string[]) as any);
      originalRows.value = originalRows.value.map(r => omit(r, filterHeard as unknown as string[]) as any);
    }

    recomputeDiff();
  }
  catch (e: any) {
    message.error(e?.message || '取得遊戲規格設定(完整)失敗');
  }
  finally {
    loading.value = false;
    tableLoading.value = false;
  }
};

const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val;
  updateCurrencyTypeByMasterAgent(val);
  await loadAll();
};

const exportExcel = async () => {
  if (!rows.value.length) {
    message.warning('沒有資料可匯出');
    return;
  }

  const desired = [
    'masterAgent',
    'gameName',
    'gameID',
    'isEnabled',
    'isExternalGame',
    'currencyType',
    'updatedAt',
  ];
  const itemNames = configItems.value.map(i => i.name);
  let headers = [...desired, ...itemNames];
  if (!isGlobalSettingPage.value) {
    headers = headers.filter(h => !filterHeard.includes(h as any));
  }

  const data = rows.value.map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((k) => {
      const v: any = (r as any)[k];
      obj[k] = (Array.isArray(v) || (v && typeof v === 'object')) ? JSON.stringify(v) : v;
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GameSetting');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  saveAs(blob, `gameSetting_${Date.now()}.xlsx`);
};

const parseMaybeJson = (v: any) => {
  if (typeof v !== 'string') {
    return v;
  }
  const s = v.trim();
  if (!s) {
    return v;
  }
  try {
    return JSON.parse(s);
  }
  catch {
    return v;
  }
};

const applyImportData = (list: Record<string, any>[]) => {
  if (!list.length) {
    message.error('Excel 內容為空');
    return;
  }
  // masterAgent 檢查（若 excel 有欄位）
  const excelMA = list.find(r => r.masterAgent)?.masterAgent;
  if (excelMA && String(excelMA) !== masterAgent.value) {
    message.error(`Excel 的 masterAgent(${excelMA}) 與目前頁面(${masterAgent.value}) 不一致`);
    return;
  }

  const map = rows.value.reduce<Record<string, GameSettingRow>>((acc, r) => {
    acc[String(r.gameID)] = r;
    return acc;
  }, {});

  list.forEach((r) => {
    const gameID = String(r.gameID ?? '');
    if (!gameID || !map[gameID]) {
      return;
    }
    const target = map[gameID];
    Object.keys(r).forEach((k) => {
      if (!(k in target)) {
        // 只允許更新既有欄位（避免把未知欄位塞進 row 影響 diff）
        return;
      }
      if (k === 'gameID' || k === 'gameName' || k === 'currencyType' || k === 'masterAgent') {
        return;
      }
      if (k === 'isEnabled') {
        const v = r[k];
        const b = (v === true || v === 1 || String(v).toLowerCase() === 'true');
        target.isEnabled = b;
        return;
      }
      (target as any)[k] = parseMaybeJson(r[k]);
    });
  });

  isImportExcel.value = true;
  recomputeDiff();
};

const beforeUpload = async (file: UploadFile) => {
  try {
    const raw = (file as any).originFileObj as File | undefined;
    const f = raw || (file as any);
    const buf = await (f as File).arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const name = wb.SheetNames[0];
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
    applyImportData(json);
    importOpen.value = false;
    message.success('匯入成功（尚未提交）');
  }
  catch (e: any) {
    message.error(e?.message || '匯入失敗');
  }
  return false;
};

const commit = async () => {
  if (!isDataChange.value) {
    return;
  }
  if (!rows.value.length) {
    return;
  }
  if (!canEdit.value) {
    message.error('權限不足');
    return;
  }

  tableLoading.value = true;
  try {
    const diff = changedRowIndex.value;
    const jobs: Promise<any>[] = [];

    diff.forEach((idx) => {
      const newItem = rows.value[idx];
      const oldItem = originalRows.value[idx];
      if (!newItem || !oldItem) {
        return;
      }

      const changedKeys = Object.keys(newItem).filter(k => !isEqual((newItem as any)[k], (oldItem as any)[k]));
      const hasNonSwitchChange = changedKeys.some(k => k !== 'isEnabled');

      // 非外部遊戲才送 setConfigSetting（且必須有非 isEnabled 的異動）
      if (hasNonSwitchChange && !newItem.isExternalGame) {
        const filterKey = new Set(['gameName', 'gameID', 'masterAgent', 'currencyType', 'updatedAt', 'isEnabled', 'isExternalGame']);
        const items = changedKeys.filter(k => !filterKey.has(k));
        if (items.length) {
          const data = items.map(k => (newItem as any)[k]);
          jobs.push(setConfigSetting(newItem.gameID, newItem.masterAgent, newItem.currencyType, items, data, newItem.updatedAt));
        }
      }
    });

    // 開關同步（對齊 Vue2：匯入時不自動送開關）
    if (!isImportExcel.value) {
      const gameIDList = rows.value.filter(r => r.isEnabled).map(r => String(r.gameID));
      jobs.push(setGameIDList({ masterAgent: rows.value[0].masterAgent, gameIDList }));
    }

    const settled = await Promise.allSettled(jobs);
    const ok = settled.every(s => s.status === 'fulfilled');
    if (ok) {
      message.success('提交成功');
    }
    else {
      message.error('提交完成但有部分失敗，請查看錯誤訊息');
    }

    isImportExcel.value = false;
    await loadAll();
  }
  catch (e: any) {
    message.error(e?.message || '提交失敗');
  }
  finally {
    tableLoading.value = false;
  }
};

const onAnyCellChanged = () => {
  recomputeDiff();
};

onMounted(async () => {
  applyRouteConfig();
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
    await loadAll();
  }
});

// 對齊 Vue2：同 component 對應多 route，切換 route 時需要重新套用模式與資料
watch(
  () => route.name,
  async () => {
    applyRouteConfig();
    if (masterAgent.value) {
      await loadAll();
    }
  },
);
</script>

<template>
  <div class="gameRestrictionsGlobalSetting">
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

      <div class="input_group">
        <a-button type="primary" :disabled="tableLoading" @click="exportExcel">
          {{ t('page.gameSetting.buttons.exportExcel') || '匯出 Excel' }}
        </a-button>
      </div>
      <div class="input_group">
        <a-button type="primary" :disabled="tableLoading" @click="importOpen = true">
          {{ t('page.gameSetting.buttons.importExcel') || '匯入 Excel' }}
        </a-button>
      </div>
      <div class="input_group">
        <a-button v-if="isDataChange" type="primary" danger :disabled="tableLoading || !canEdit" @click="commit">
          {{ t('page.gameSetting.buttons.commit') || '提交' }}
        </a-button>
      </div>
    </div>

    <div class="gameRestrictionList">
      <h3 style="margin: 0 0 12px 0">
        {{ t('page.gameSetting.title.gameRestrictionsGlobalSetting') || '遊戲規格設定(完整)' }}
      </h3>

      <div v-if="isGlobalSettingPage" style="margin: 0 0 12px 0">
        遊戲開關
        <a-switch v-model:checked="controllerShow" :disabled="!canEdit" />
      </div>

      <div
        v-if="isGlobalSettingPage && controllerShow"
        class="gameSwitchGrid"
      >
        <div
          v-for="item in rows"
          :key="item.gameID"
          class="gameSwitchCard"
        >
          <div class="cardTitle">
            <div>{{ item.gameID }}</div>
            <div>{{ item.gameName }}</div>
          </div>
          <div class="cardBody">
            <a-switch v-model:checked="item.isEnabled" :disabled="!canEdit" @change="onAnyCellChanged" />
          </div>
        </div>
      </div>

      <a-table
        bordered
        :sticky="true"
        :columns="columns"
        :data-source="rows"
        :loading="tableLoading"
        row-key="gameID"
        :row-class-name="rowClassName"
        :pagination="{ pageSize: 50, showSizeChanger: true }"
        :scroll="{ x: 1300, y: '60vh' }"
      >
        <template #bodyCell="{ column, record }">
          <!-- ✅ 本次僅最小幅度補齊 Vue2 原本可編輯的 4 個欄位 -->
          <template v-if="getColumnKey(column) === 'isDramaMode' && record.isDramaMode !== undefined">
            <a-switch v-model:checked="record.isDramaMode" :disabled="!canEdit" @change="onAnyCellChanged" />
          </template>
          <template v-else-if="getColumnKey(column) === 'controlRTP' && record.controlRTP !== undefined">
            <a-switch v-model:checked="record.controlRTP" :disabled="!canEdit" @change="onAnyCellChanged" />
          </template>
          <template v-else-if="getColumnKey(column) === 'controlNewbie' && record.controlNewbie !== undefined">
            <a-switch v-model:checked="record.controlNewbie" :disabled="!canEdit" @change="onAnyCellChanged" />
          </template>
          <template v-else-if="getColumnKey(column) === 'probVer' && record.probVer !== undefined">
            <!-- 對齊 Vue2：el-input type="number" -->
            <a-input
              v-model:value="record.probVer"
              type="number"
              :disabled="!canEdit"
              style="width: 120px"
              @change="onAnyCellChanged"
            />
          </template>
          <template v-else>
            {{
              formatCellValue(
                getColumnKey(column),
                record[getColumnKey(column)],
              )
            }}
          </template>
        </template>
      </a-table>
    </div>

    <a-modal v-model:open="importOpen" title="Import" :mask-closable="false">
      <div>
        <a-upload :before-upload="beforeUpload" :show-upload-list="false" accept=".xlsx,.xls">
          <a-button type="primary">
            選擇 Excel 檔
          </a-button>
        </a-upload>
        <div style="margin-top: 8px; color: rgba(0, 0, 0, 0.65)">
          匯入後會先套用到表格，請再按「提交」才會寫入後端。
        </div>
      </div>
      <template #footer>
        <a-button @click="importOpen = false">
          關閉
        </a-button>
      </template>
    </a-modal>
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

:deep(.changed-row td) {
  background: #ffccc7 !important;
}

.gameSwitchGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 12px 0;
}

.gameSwitchCard {
  width: 220px;
  border: 2px solid #d9d9d9;
  border-radius: 6px;
  padding: 10px;
}

.cardTitle {
  font-weight: 600;
  margin-bottom: 8px;
}

.cardBody {
  display: flex;
  justify-content: center;
}
</style>


