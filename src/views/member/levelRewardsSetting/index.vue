<script setup lang="ts">
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type { BulkCreateLevelSettingParams, LevelSettingItem, LevelSettingTreasureCardInfo } from '@/api/backend/member/levelServer';
import type { TreasureCardInfo, TreasureItem } from '@/api/backend/treasureChestSystem';
import type { ExcelData } from '@/components/basic/excel';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import { computed, h, inject, nextTick, onMounted, ref, watch } from 'vue';

import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import { bulkCreate, listByMasterAgent } from '@/api/backend/member/levelServer';
import { addTreasureCard, queryTreasureCardInfos, treasureItemList } from '@/api/backend/treasureChestSystem';

import { ImpExcel, jsonToSheetXlsx } from '@/components/basic/excel';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'LevelRewardsSetting',
});

const i18n = useI18n('routes.member.levelRewardsSettingPage');
const t = i18n.t;
const userStore = useUserStore();

const hasPermission = computed(() => userStore.level <= 2);

// 從 Layout 根元件 provide 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

const tableLoading = ref(false);
const currentList = ref<(LevelSettingItem & { awardStr: string[] })[]>([]);

// 表格 render 就緒標記（用於確保 layout 穩定後再 render，避免 fixed header 失效）
const tableReady = ref(false);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Breadcrumb Context Selector）
 * - 無搜尋表單欄位
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 本頁無搜尋表單，資料完全由後端 API 提供
  return 'BACKEND';
});

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const mode = searchMode.value;
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[mode];
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
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await listByMasterAgent({ masterAgent });
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

// 定義所有欄位
const baseColumns = computed<TableColumn<LevelSettingItem & { awardStr: string[] }>[]>(() => [
  { title: t('columns.id'), dataIndex: 'id', width: 120, hideInSearch: true },
  { title: t('columns.level'), dataIndex: 'level', width: 120, hideInSearch: true },
  {
    title: t('columns.awardStr'),
    dataIndex: 'awardStr',
    flexible: true, // 彈性寬度欄位，內容長度不固定，關閉其他欄位時自動擴展
    minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ record }) =>
      h('div', { style: 'white-space: pre-line;' }, (record?.awardStr || []).join('\n')),
  },
]);

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumns as any);

// STEP 3 定型後的欄位 keys（按順序）：['id', 'level', 'awardStr']
// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<LevelSettingItem & { awardStr: string[] }>[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），維持全部顯示
  const isVisibleKeysValid = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
    const isVisible = isVisibleKeysValid ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<LevelSettingItem & { awardStr: string[] }> = {
      ...col,
      hideInTable: !isVisible,
    };

    // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100; // 預設最小寬度 100px
    }

    // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
    // 這樣可以避免初始 render 時被壓縮為 0
    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  // 原因：當 scroll.x 為數字時，表示表格內部有固定寬度欄位，且總和超過容器寬度
  // 此時表格內部會出現滾動條，外層 container 也需要允許滾動，以確保表格內容可以完整顯示
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: any) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const currentKeys = tableConfig.visibleColumnKeys.value;
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true, flush: 'post' },
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
  const master = String(selectedMasterAgent.value || '').trim();
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
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (metaLoadedFor.value === masterAgent) {
    return;
  }
  metaLoading.value = true;
  try {
    const [treasureRes, games, infos] = await Promise.all([
      treasureItemList({ masterAgent }),
      gameList({ masterAgent }),
      queryTreasureCardInfos({ masterAgent }),
    ]);
    treasureCardAllList.value = buildTreasureCardAllList((treasureRes as any)?.rows);
    gameInfoList.value = Array.isArray(games) ? games : [];
    treasureCardInfos.value = Array.isArray(infos) ? infos : [];
    rebuildTreasureCardGameMeta();
    metaLoadedFor.value = masterAgent;
  }
  finally {
    metaLoading.value = false;
  }
};

/**
 * 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格
 */
watch(
  () => contextVersion.value,
  () => {
    metaLoadedFor.value = '';
    treasureCardAllList.value = [];
    treasureCardInfos.value = [];
    gameInfoList.value = [];
    treasureCardGameList.value = [];
    referenceDataList.value = [];
    // 站長切換時強制重新載入資料（不使用快取），行為與 agent 頁一致
    tableInstance?.reload(true);
  },
);

// 確保 layout 穩定後再 render 表格，避免 fixed header 失效
onMounted(async () => {
  await nextTick();
  // 使用 requestAnimationFrame 確保 DOM 完全渲染完成
  requestAnimationFrame(() => {
    tableReady.value = true;
  });
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
    const masterAgent = String(selectedMasterAgent.value || '').trim();
    if (!postMap.has(level)) {
      postMap.set(level, {
        masterAgent,
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
      const masterAgent = String(selectedMasterAgent.value || '').trim();
      await addTreasureCard({
        masterAgent,
        game: gameID,
        cardItem,
        bet,
        creditRate,
      });
      const refreshed = await treasureItemList({ masterAgent });
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
    const masterAgent = String(selectedMasterAgent.value || '').trim();
    if (!masterAgent) {
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
      <div
        class="table-container"
        :style="{ overflowX: containerOverflowX }"
      >
        <DynamicTable
          v-if="tableReady"
          row-key="id"
          :data-request="loadTableData"
          :columns="columns"
          :scroll="{
            x: tableConfig.scrollX.value,
            y: 'calc(100vh - 280px)',
          }"
          :pagination="false"
        >
          <template #headerTitle>
            <div style="display: flex; align-items: center; gap: 8px">
              <span>{{ t('title') }}</span>
              <Tag :color="searchModeConfig.color" style="margin: 0">
                SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
              </Tag>
            </div>
          </template>
          <template #toolbar>
            <a-space>
              <a-button type="primary" :disabled="!selectedMasterAgent || metaLoading" @click="exportExcel">
                {{ t('exportExcel') }}
              </a-button>

              <a-button type="primary" :disabled="!selectedMasterAgent || metaLoading" @click="openImport">
                {{ t('importExcel') }}
              </a-button>

              <a-button :disabled="!selectedMasterAgent || metaLoading" @click="openReference">
                {{ t('reference') }}
              </a-button>
            </a-space>
          </template>
        </DynamicTable>
      </div>

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
