<script setup lang="ts">
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type { BulkCreateLevelSettingParams, LevelSettingItem, LevelSettingTreasureCardInfo } from '@/api/backend/member/levelServer';
import type { TreasureCardInfo, TreasureItem } from '@/api/backend/treasureChestSystem';
import type { ExcelData } from '@/components/basic/excel';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message } from 'ant-design-vue';
import { computed, h, onMounted, ref, watch } from 'vue';

import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import { bulkCreate, listByMasterAgent } from '@/api/backend/member/levelServer';
import { addTreasureCard, queryTreasureCardInfos, treasureItemList } from '@/api/backend/treasureChestSystem';

import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { ImpExcel, jsonToSheetXlsx } from '@/components/basic/excel';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'LevelRewardsSetting',
});

const i18n = useI18n('routes.member.levelRewardsSettingPage');
const t = i18n.t;
const userStore = useUserStore();

const hasPermission = computed(() => userStore.level <= 2);

const masterAgent = ref<string>('');
const tableLoading = ref(false);
const currentList = ref<(LevelSettingItem & { awardStr: string[] })[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

// =========================
// Helpers
// =========================

const isEnabled = (v: unknown) => v === true || v === 1 || v === '1';

const formatAwardStr = (infos: LevelSettingTreasureCardInfo[]) => {
  const re: string[] = [];
  (infos || []).forEach((item) => {
    const startDate = Number(item.startDate);
    const startDateStr = Number.isFinite(startDate) && startDate === -1 ? '即時' : `${startDate}日後`;
    re.push(
      `${item.cardName} - ${item.bet} (${item.creditRate}) x ${item.amount}`
      + ` 啟用日: ${startDateStr}`
      + ` 過期日: ${item.endDate}日後`,
    );
  });
  return re;
};

// =========================
// Table
// =========================

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await listByMasterAgent({ masterAgent: masterAgent.value });
    const items = (Array.isArray(list) ? list : []).map(it => ({
      ...it,
      awardStr: formatAwardStr(it.treasureCardInfos || []),
    }));
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const columns = ref<TableColumn<LevelSettingItem & { awardStr: string[] }>[]>(
  [
    { title: t('columns.id'), dataIndex: 'id', width: 120, hideInSearch: true },
    { title: t('columns.level'), dataIndex: 'level', width: 120, hideInSearch: true },
    {
      title: t('columns.awardStr'),
      dataIndex: 'awardStr',
      hideInSearch: true,
      customRender: ({ record }) =>
        h('div', { style: 'white-space: pre-line;' }, (record?.awardStr || []).join('\n')),
    },
  ],
);

// =========================
// Meta cache for export/import/reference
// =========================

interface TreasureCardGameMeta {
  gameID: string;
  list: string[];
  betList: number[];
}

const metaLoading = ref(false);
const metaLoadedFor = ref<string>('');
const treasureCardAllList = ref<TreasureItem[]>([]);
const treasureCardInfos = ref<TreasureCardInfo[]>([]);
const gameInfoList = ref<GameInfo[]>([]);
const treasureCardGameList = ref<TreasureCardGameMeta[]>([]);
const referenceDataList = ref<{ gameID: string; cardTypeList: string | string[]; betList: string }[]>([]);

const buildTreasureCardAllList = (rows: any): TreasureItem[] => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const treasureRow = safeRows.find(r => String(r?.type) === 'treasureCard');
  const items = Array.isArray(treasureRow?.items) ? treasureRow.items : [];
  return items.filter(it => isEnabled((it as any).enabled));
};

const rebuildTreasureCardGameMeta = () => {
  const master = masterAgent.value;
  const gameListFiltered = (gameInfoList.value || []).filter(g => !['0007', '0035', '0038', '0049'].includes(String(g.gameID)));

  // reference table
  referenceDataList.value = gameListFiltered.map((g) => {
    let gameName = g.gameName;
    if (g.language?.tw) {
      gameName = g.language.tw;
    }

    let cardTypeList: string | string[] = '';
    if (String(g.gameID) === '0059') {
      const scratch = g.gameData?.[master]?.scratchCardInfos;
      if (Array.isArray(scratch)) {
        cardTypeList = scratch.map((s: any) => String(s?.scratchCardID ?? '')).filter(Boolean);
      }
      else {
        cardTypeList = [];
      }
    }
    else {
      const tc = g.extraInfo?.treasureCard;
      if (Array.isArray(tc)) {
        cardTypeList = tc.map((x: any) => String(x)).filter(Boolean).join(',');
      }
      else {
        cardTypeList = '';
      }
    }

    const bets = g.gameData?.[master]?.betList;
    const betList = Array.isArray(bets) ? JSON.stringify(bets) : '[]';

    return {
      gameID: `${g.gameID} - ${gameName}`,
      cardTypeList,
      betList,
    };
  });

  // game -> cardItem list, betList (from gameData)
  const byGame = new Map<string, TreasureCardGameMeta>();

  (treasureCardInfos.value || []).forEach((info) => {
    const gId = String(info.game ?? '');
    if (!gId) {
      return;
    }
    const foundGameInfo = gameListFiltered.find(g => String(g.gameID) === gId);
    if (!foundGameInfo) {
      return;
    }

    if (!byGame.has(gId)) {
      const bets = foundGameInfo.gameData?.[master]?.betList;
      const betList = (Array.isArray(bets) ? bets : []).map((b: any) => Number(b)).filter(n => Number.isFinite(n));
      byGame.set(gId, { gameID: gId, list: [], betList });
    }
    const meta = byGame.get(gId)!;
    const cardItem = String(info.cardItem ?? '');
    if (cardItem && !meta.list.includes(cardItem)) {
      meta.list.push(cardItem);
    }
  });

  treasureCardGameList.value = [...byGame.values()].sort((a, b) => (a.gameID > b.gameID ? 1 : -1));
};

const ensureMetaLoaded = async () => {
  if (!masterAgent.value) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (metaLoadedFor.value === masterAgent.value) {
    return;
  }
  metaLoading.value = true;
  try {
    const [treasureRes, games, infos] = await Promise.all([
      treasureItemList({ masterAgent: masterAgent.value }),
      gameList({ masterAgent: masterAgent.value }),
      queryTreasureCardInfos({ masterAgent: masterAgent.value }),
    ]);
    treasureCardAllList.value = buildTreasureCardAllList((treasureRes as any)?.rows);
    gameInfoList.value = Array.isArray(games) ? games : [];
    treasureCardInfos.value = Array.isArray(infos) ? infos : [];
    rebuildTreasureCardGameMeta();
    metaLoadedFor.value = masterAgent.value;
  }
  finally {
    metaLoading.value = false;
  }
};

watch(
  () => masterAgent.value,
  () => {
    metaLoadedFor.value = '';
    treasureCardAllList.value = [];
    treasureCardInfos.value = [];
    gameInfoList.value = [];
    treasureCardGameList.value = [];
    referenceDataList.value = [];
    tableInstance?.reload?.();
  },
);

onMounted(() => {
  // 對齊 Vue2：level>=4 直接鎖定總代理（但本頁本身限制 <=2）
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});

// =========================
// Reference modal
// =========================

const referenceOpen = ref(false);
const openReference = async () => {
  try {
    await ensureMetaLoaded();
    referenceOpen.value = true;
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
};
const closeReference = () => {
  referenceOpen.value = false;
};

// =========================
// Export
// =========================

const findTreasureCardItemByTreasureID = (treasureID: string) =>
  (treasureCardAllList.value || []).find(it => String(it.treasureItemID) === String(treasureID));

const exportExcel = async () => {
  try {
    await ensureMetaLoaded();
    const rows: any[] = [];

    (currentList.value || []).forEach((setting) => {
      const infos = Array.isArray(setting.treasureCardInfos) ? setting.treasureCardInfos : [];
      if (infos.length === 0) {
        rows.push({
          level: setting.level,
          gameID: '',
          cardItem: '',
          bet: '',
          creditRate: '',
          amount: '',
          startDate: '',
          endDate: '',
        });
        return;
      }
      infos.forEach((info) => {
        const found = findTreasureCardItemByTreasureID(info.treasureID);
        rows.push({
          level: setting.level,
          gameID: String((found as any)?.game ?? ''),
          cardItem: String((found as any)?.cardItem ?? ''),
          bet: String((found as any)?.bet ?? info.bet ?? ''),
          creditRate: String((found as any)?.creditRate ?? info.creditRate ?? ''),
          amount: String(info.amount ?? ''),
          startDate: String(info.startDate ?? ''),
          endDate: String(info.endDate ?? ''),
        });
      });
    });

    if (rows.length === 0) {
      // 空模板：至少給一列空白讓使用者填
      rows.push({
        level: '',
        gameID: '',
        cardItem: '',
        bet: '',
        creditRate: '',
        amount: '',
        startDate: '',
        endDate: '',
      });
    }

    jsonToSheetXlsx({
      filename: 'levelRewardsSetting.xlsx',
      header: {
        level: t('importColumns.level'),
        gameID: t('importColumns.gameID'),
        cardItem: t('importColumns.cardItem'),
        bet: t('importColumns.bet'),
        creditRate: t('importColumns.creditRate'),
        amount: t('importColumns.amount'),
        startDate: t('importColumns.startDate'),
        endDate: t('importColumns.endDate'),
      },
      data: rows,
    });
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
};

// =========================
// Import
// =========================

const importOpen = ref(false);
const importSaving = ref(false);
const importPreviewList = ref<(LevelSettingItem & { awardStr: string[]; pk: string })[]>([]);
const importErrors = ref<string[]>([]);
const errorModalOpen = ref(false);

const openImport = async () => {
  try {
    await ensureMetaLoaded();
    importPreviewList.value = [];
    importErrors.value = [];
    importOpen.value = true;
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
};

const closeImport = () => {
  importOpen.value = false;
};

const openErrors = () => {
  if (importErrors.value.length > 0) {
    errorModalOpen.value = true;
  }
};

const closeErrors = () => {
  errorModalOpen.value = false;
};

interface ImportRow {
  level: any;
  gameID: any;
  cardItem: any;
  bet: any;
  creditRate: any;
  amount: any;
  startDate: any;
  endDate: any;
  [k: string]: any;
}

const toInt = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
};
const isPositiveInt = (v: any) => Number.isInteger(toInt(v)) && toInt(v) > 0;
const isInt = (v: any) => Number.isInteger(toInt(v));

const parseImportRows = async (rows: ImportRow[]) => {
  importErrors.value = [];

  const postMap = new Map<number, LevelSettingItem>();
  const metaByGame = new Map<string, TreasureCardGameMeta>();
  treasureCardGameList.value.forEach(m => metaByGame.set(String(m.gameID), m));

  const ensureLevelItem = (level: number) => {
    if (!postMap.has(level)) {
      postMap.set(level, {
        masterAgent: masterAgent.value,
        level,
        prizeMoney: 0,
        prizeVp: 0,
        maxBet: 0,
        levelUpNeedPoint: '0',
        treasureCardInfos: [],
      });
    }
    return postMap.get(level)!;
  };

  const findTreasureCardByKey = (gameID: string, bet: number, cardItem: string, creditRate: string) =>
    (treasureCardAllList.value || []).find((it) => {
      const g = String((it as any)?.game ?? '');
      const b = Number((it as any)?.bet);
      const c = String((it as any)?.cardItem ?? '');
      const r = String((it as any)?.creditRate ?? '');
      return g === gameID && b === bet && c === cardItem && r === creditRate;
    });

  /** 逐列處理：需要 await addTreasureCard / refresh list */
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    /** header 佔第 1 行 */
    const rowNo = i + 2;
    const errs: string[] = [];

    const level = toInt(row.level);
    if (!isPositiveInt(row.level)) {
      errs.push(' level 錯誤');
    }

    const gameID = String(row.gameID ?? '').trim();
    const meta = metaByGame.get(gameID);
    if (!meta) {
      errs.push(' gameID 不對應');
    }

    const bet = toInt(row.bet);
    if (!isPositiveInt(row.bet)) {
      errs.push(' bet 錯誤');
    }
    else if (meta && !meta.betList.includes(bet)) {
      errs.push(' bet 不對應');
    }

    const cardItem = String(row.cardItem ?? '').trim();
    if (!cardItem) {
      errs.push(' cardItem 錯誤');
    }
    else if (meta && !meta.list.includes(cardItem)) {
      errs.push(' CardItem 不對應');
    }

    const creditRate = String(row.creditRate ?? '').trim();
    if (creditRate !== '1:1' && creditRate !== '1:100') {
      errs.push(' creditRate 錯誤');
    }

    if (!isPositiveInt(row.amount)) {
      errs.push(' amount 錯誤');
    }
    if (!isInt(row.startDate)) {
      errs.push(' startDate 錯誤');
    }
    if (!isPositiveInt(row.endDate)) {
      errs.push(' endDate 錯誤');
    }

    if (errs.length > 0) {
      importErrors.value.push(`第${rowNo}行${errs.join('')}`);
      continue;
    }

    const item = ensureLevelItem(level);
    let found = findTreasureCardByKey(gameID, bet, cardItem, creditRate);

    if (!found) {
      // 沒有就建一張，再刷新 treasureCardAllList 後重找
      await addTreasureCard({
        masterAgent: masterAgent.value,
        game: gameID,
        cardItem,
        bet,
        creditRate,
      });
      const refreshed = await treasureItemList({ masterAgent: masterAgent.value });
      treasureCardAllList.value = buildTreasureCardAllList((refreshed as any)?.rows);
      found = findTreasureCardByKey(gameID, bet, cardItem, creditRate);
    }

    if (!found) {
      importErrors.value.push(`第${rowNo}行 建立/查找虛寶卡失敗`);
      continue;
    }

    item.treasureCardInfos.push({
      treasureID: String(found.treasureItemID),
      cardName: String(found.itemName ?? ''),
      cardIcon: String(found.iconUrl ?? ''),
      bet,
      creditRate,
      amount: toInt(row.amount),
      startDate: toInt(row.startDate),
      endDate: toInt(row.endDate),
    });
  }

  importPreviewList.value = [...postMap.values()].map((it, idx) => ({
    ...it,
    pk: `${it.level}-${idx}`,
    awardStr: formatAwardStr(it.treasureCardInfos || []),
  }));
};

const onImportSuccess = async (excelData: ExcelData[]) => {
  const first = Array.isArray(excelData) ? excelData[0] : undefined;
  const rows = (first?.results || []) as ImportRow[];
  importPreviewList.value = [];
  await parseImportRows(rows);
  if (importErrors.value.length > 0) {
    openErrors();
  }
};

const saveImport = async () => {
  try {
    if (!masterAgent.value) {
      throw new Error(t('notify.masterAgentRequired'));
    }
    if (importPreviewList.value.length === 0) {
      closeImport();
      return;
    }
    importSaving.value = true;
    const payload: BulkCreateLevelSettingParams = {
      settings: importPreviewList.value.map((it) => {
        const { awardStr: _awardStr, pk: _pk, ...rest } = it as any;
        return rest;
      }),
    };
    await bulkCreate(payload);
    message.success(t('saveSuccess'));
    closeImport();
    tableInstance?.reload?.();
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
  finally {
    importSaving.value = false;
  }
};
</script>

<template>
  <div class="level-rewards-setting-page">
    <a-result
      v-if="!hasPermission"
      status="403"
      :title="t('noPermission.title')"
      :sub-title="t('noPermission.subTitle')"
    />

    <div v-else>
      <DynamicTable
        row-key="id"
        :header-title="t('title')"
        :data-request="loadTableData"
        :columns="columns"
        :pagination="false"
      >
        <template #toolbar>
          <a-space>
            <AdminAccountSelector
              v-model="masterAgent"
              value-type="account"
              :auto-select-first="true"
              style="width: 240px"
              :placeholder="t('filters.masterAgentPlaceholder')"
            />

            <a-button type="primary" :disabled="!masterAgent || metaLoading" @click="exportExcel">
              {{ t('exportExcel') }}
            </a-button>

            <a-button type="primary" :disabled="!masterAgent || metaLoading" @click="openImport">
              {{ t('importExcel') }}
            </a-button>

            <a-button :disabled="!masterAgent || metaLoading" @click="openReference">
              {{ t('reference') }}
            </a-button>
          </a-space>
        </template>
      </DynamicTable>

      <!-- Import -->
      <a-modal
        v-model:open="importOpen"
        :title="t('import')"
        :confirm-loading="importSaving"
        :mask-closable="false"
        :destroy-on-close="true"
        width="1000px"
        @ok="saveImport"
        @cancel="closeImport"
      >
        <a-space direction="vertical" style="width: 100%">
          <ImpExcel @success="onImportSuccess">
            <a-button type="primary">
              {{ t('importExcel') }}
            </a-button>
          </ImpExcel>

          <a-divider />

          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="font-weight: 600">
              {{ t('importPreview') }}
            </div>
            <a-button v-if="importErrors.length > 0" @click="openErrors">
              {{ t('errors.title') }} ({{ importErrors.length }})
            </a-button>
          </div>

          <a-table
            :data-source="importPreviewList"
            :pagination="false"
            row-key="pk"
            size="small"
            bordered
          >
            <a-table-column :title="t('columns.level')" data-index="level" :width="120" />
            <a-table-column :title="t('columns.awardStr')" data-index="awardStr">
              <template #default="{ record }">
                <div style="white-space: pre-line">
                  {{ (record?.awardStr || []).join('\n') }}
                </div>
              </template>
            </a-table-column>
          </a-table>
        </a-space>
      </a-modal>

      <!-- Import errors -->
      <a-modal
        v-model:open="errorModalOpen"
        :title="t('errors.title')"
        :footer="null"
        width="680px"
        @cancel="closeErrors"
      >
        <a-list :data-source="importErrors" size="small" bordered>
          <template #renderItem="{ item }">
            <a-list-item>{{ item }}</a-list-item>
          </template>
        </a-list>
      </a-modal>

      <!-- Reference -->
      <a-modal
        v-model:open="referenceOpen"
        :title="t('reference')"
        :footer="null"
        width="1000px"
        @cancel="closeReference"
      >
        <a-table :data-source="referenceDataList" :pagination="false" row-key="gameID" size="small" bordered>
          <a-table-column :title="t('referenceColumns.gameID')" data-index="gameID" />
          <a-table-column :title="t('referenceColumns.cardTypeList')" data-index="cardTypeList" />
          <a-table-column :title="t('referenceColumns.betList')" data-index="betList" />
        </a-table>
      </a-modal>
    </div>
  </div>
</template>

<style scoped>
.level-rewards-setting-page {
  width: 100%;
}
</style>


