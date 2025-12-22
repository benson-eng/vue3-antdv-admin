<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type { LevelExtraSettingItem, UpdateLevelExtraSettingRow } from '@/api/backend/member/levelServer';
import type { VipSetting } from '@/api/backend/member/vipServer';

import { message } from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';

import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { gameList, getGameIDList, setGameIDList } from '@/api/backend/adminSystem/gameManagerServer';
import {
  createLevelExtraSetting,
  listLevelExtraSettingByMasterAgent,
  updateLevelExtraSetting,
} from '@/api/backend/member/levelServer';
import { listByMasterAgent as listVipByMasterAgent } from '@/api/backend/member/vipServer';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getBaseName } from '@/utils/platform';

defineOptions({ name: 'LevelExtraSetting' });

type TagValue = 0 | 1 | 2;

interface Row {
  id: number;
  gameID: string;
  gameName: string;
  platform: string;
  gameType: string;
  icon: string;

  levelLock: string;
  vipLock: number;
  levelUp: 0 | 1;
  prizeItems: 0 | 1;
  tag: TagValue;
  sort: number;
  clientSwitch: boolean;
  serverOpen: boolean;

  diff: boolean;
}

const { t } = useI18n();
const userStore = useUserStore();

const canView = computed(() => userStore.level <= 3);
const canSelectMasterAgent = computed(() => userStore.level < 4);
const canEdit = computed(() => userStore.level <= 3);
const canToggleServerState = computed(() => userStore.level <= 2);

const baseName = computed(() => getBaseName());
// Vue2：BaseName 命中 xin-88net / xin-gamenet -> 隱藏部分欄位
const baseShow = computed(() => !new Set(['xin-88net', 'xin-gamenet']).has(baseName.value));

const loading = ref(false);
const tableLoading = ref(false);

const masterAgent = ref('');
const masterAgentOptions = ref<DefaultOptionType[]>([]);

const iconSize = ref<'small' | 'big'>('small');
const iconWidth = computed(() => (iconSize.value === 'small' ? 45 : 80));
const iconHeight = computed(() => (iconSize.value === 'small' ? 60 : 90));

const platformOptions = ref<DefaultOptionType[]>([]);
const gameTypeOptions = ref<DefaultOptionType[]>([]);
const filtersPlatformList = ref<string[]>([]);
const filtersGameTypeList = ref<string[]>([]);
const showNotOpen = ref(false);

const setAllType = ref<string[]>([]);
const allTypeValue = ref(false);

const vipOptions = ref<DefaultOptionType[]>([]);

const rows = ref<Row[]>([]);
const originalRowMap = ref<Record<string, Row>>({});
const originalEnabledSet = ref<Set<string>>(new Set());

const hasInvalidLevelLock = ref(false);

const normalizePlatformLabel = (p: string) => (p === 'T9_SINGLE_WALLET' ? 'T9LIVE' : p);

const gameTypeKeyMap: Record<string, string> = {
  // Vue2 EGameMangerGameType（數字 enum）對照
  1: 'slotGame',
  2: 'syncGame',
  11: 'fishingGame',
  12: 'arcadeMulti',
  13: 'arcadeSingle',
  14: 'arcade',
  15: 'poker',
  111: 'table',
  121: 'cam',
  122: 'lottery',
  201: 'lobby',
  999: 'unknown',

  SLOT_GAME: 'slotGame',
  SYNC_GAME: 'syncGame',
  FISHING_GAME: 'fishingGame',
  ARCADE_MULTI: 'arcadeMulti',
  ARCADE_SINGLE: 'arcadeSingle',
  ARCADE: 'arcade',
  POKER: 'poker',
  TABLE: 'table',
  CAM: 'cam',
  LOTTERY: 'lottery',
  LOBBY: 'lobby',
  UNKNOWN: 'unknown',
  slotGame: 'slotGame',
  syncGame: 'syncGame',
  fishingGame: 'fishingGame',
  arcadeMulti: 'arcadeMulti',
  arcadeSingle: 'arcadeSingle',
  arcade: 'arcade',
  poker: 'poker',
  table: 'table',
  cam: 'cam',
  lottery: 'lottery',
  lobby: 'lobby',
  unknown: 'unknown',
};

const getGameTypeLabel = (rawGameType: string) => {
  const raw = String(rawGameType ?? '');
  if (!raw) {
    return raw;
  }
  const key = gameTypeKeyMap[raw] || gameTypeKeyMap[raw.toUpperCase()];
  if (!key) {
    return raw;
  }
  const i18nKey = `page.gameSetting.gameType.${key}`;
  const translated = t(i18nKey);
  return translated && translated !== i18nKey ? translated : raw;
};

const buildIconUrl = (info: GameInfo) => {
  const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';
  const rawPlatform = (info as any)?.extraInfo?.platform ? String((info as any).extraInfo.platform) : 'mabu';
  const platform = rawPlatform.toLowerCase();
  const iconName = String((info as any)?.gameName || '').toLowerCase();
  const path = `mainIcon/tw/${platform}/${iconName}.webp`;
  return cdnBaseUrl ? `${cdnBaseUrl}${path}` : path;
};

const cloneRow = (r: Row): Row => JSON.parse(JSON.stringify(r));

const isValidLevelLock = (v: string) => {
  if (v === '' || v === null || v === undefined) {
    return false;
  }
  if (!/^\+?(0|[1-9]\d*)$/.test(String(v))) {
    return false;
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 999;
};

const isServerChanged = (r: Row) => {
  const original = originalEnabledSet.value.has(String(r.gameID));
  return Boolean(r.serverOpen) !== original;
};

const isExtraChanged = (r: Row) => {
  const ori = originalRowMap.value[String(r.gameID)];
  if (!ori) {
    return true;
  }
  return (
    Number(r.levelLock) !== Number(ori.levelLock)
    || Number(r.vipLock) !== Number(ori.vipLock)
    || Number(r.levelUp) !== Number(ori.levelUp)
    || Number(r.prizeItems) !== Number(ori.prizeItems)
    || Number(r.tag) !== Number(ori.tag)
    || Number(r.sort) !== Number(ori.sort)
    || Boolean(r.clientSwitch) !== Boolean(ori.clientSwitch)
  );
};

const recomputeDiff = () => {
  hasInvalidLevelLock.value = false;
  rows.value.forEach((r) => {
    // 只在欄位存在時驗證（對齊 Vue2：baseShow=false 會隱藏 levelLock 等欄位）
    if (baseShow.value && !isValidLevelLock(r.levelLock)) {
      hasInvalidLevelLock.value = true;
    }
    r.diff = isServerChanged(r) || isExtraChanged(r);
  });
};

const filteredRows = computed(() => {
  let list = rows.value;

  if (filtersPlatformList.value.length > 0) {
    const set = new Set(filtersPlatformList.value);
    list = list.filter(r => set.has(r.platform));
  }
  if (filtersGameTypeList.value.length > 0) {
    const set = new Set(filtersGameTypeList.value);
    list = list.filter(r => set.has(r.gameType));
  }

  // Vue2：未勾「顯示未開啟」時，只顯示 serverOpen=true 或 diff=true
  if (!showNotOpen.value) {
    list = list.filter(r => r.serverOpen || r.diff);
  }
  return list;
});

const hasDuplicateSort = computed(() => {
  const seen = new Set<number>();
  for (const r of rows.value) {
    if (seen.has(r.sort)) {
      return true;
    }
    seen.add(r.sort);
  }
  return false;
});

const isDataChange = computed(() => rows.value.some(r => r.diff));
const canCommit = computed(() => canEdit.value && isDataChange.value && !(baseShow.value && hasInvalidLevelLock.value));

const tagOptions = computed<DefaultOptionType[]>(() => [
  { label: t('page.gameSetting.levelExtraSetting.options.nor') || '一般', value: 0 },
  { label: t('page.gameSetting.levelExtraSetting.options.new') || '新品', value: 1 },
  { label: t('page.gameSetting.levelExtraSetting.options.hot') || '熱門', value: 2 },
]);

const batchTypeOptions = computed<DefaultOptionType[]>(() => {
  if (!baseShow.value) {
    return [
      { label: t('page.gameSetting.levelExtraSetting.columns.serverState') || '遊戲開關', value: 'serverOpen' },
      { label: t('page.gameSetting.levelExtraSetting.columns.clientSwitch') || '遊戲入口維護', value: 'clientSwitch' },
    ];
  }
  return [
    { label: t('page.gameSetting.levelExtraSetting.columns.levelUp') || '等級提升', value: 'levelUp' },
    { label: t('page.gameSetting.levelExtraSetting.columns.prizeItems') || '勳章', value: 'prizeItems' },
    { label: t('page.gameSetting.levelExtraSetting.columns.serverState') || '遊戲開關', value: 'serverOpen' },
    { label: t('page.gameSetting.levelExtraSetting.columns.clientSwitch') || '遊戲入口維護', value: 'clientSwitch' },
  ];
});

const columns = computed(() => {
  const baseCols: any[] = [
    {
      title: t('page.gameSetting.levelExtraSetting.columns.sort') || '排序',
      key: 'sort',
      dataIndex: 'sort',
      width: 90,
      align: 'center',
      fixed: 'left',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.platform') || '平台',
      key: 'platform',
      dataIndex: 'platform',
      width: 140,
      align: 'center',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.gameType') || '遊戲種類',
      key: 'gameType',
      dataIndex: 'gameType',
      width: 140,
      align: 'center',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.gameID') || '遊戲ID',
      key: 'gameID',
      dataIndex: 'gameID',
      width: 120,
      align: 'center',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.gameName') || '遊戲名稱',
      key: 'gameName',
      dataIndex: 'gameName',
      width: 220,
      align: 'left',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.icon') || '圖示',
      key: 'icon',
      dataIndex: 'icon',
      width: 110,
      align: 'center',
    },
  ];

  const extraCols: any[] = baseShow.value
    ? [
        {
          title: t('page.gameSetting.levelExtraSetting.columns.vipLock') || '開放VIP',
          key: 'vipLock',
          dataIndex: 'vipLock',
          width: 140,
          align: 'center',
        },
        {
          title: t('page.gameSetting.levelExtraSetting.columns.levelLock') || '開放等級',
          key: 'levelLock',
          dataIndex: 'levelLock',
          width: 120,
          align: 'center',
        },
        {
          title: t('page.gameSetting.levelExtraSetting.columns.levelUp') || '等級提升',
          key: 'levelUp',
          dataIndex: 'levelUp',
          width: 110,
          align: 'center',
        },
        {
          title: t('page.gameSetting.levelExtraSetting.columns.prizeItems') || '勳章',
          key: 'prizeItems',
          dataIndex: 'prizeItems',
          width: 100,
          align: 'center',
        },
        {
          title: t('page.gameSetting.levelExtraSetting.columns.tag') || '標籤',
          key: 'tag',
          dataIndex: 'tag',
          width: 120,
          align: 'center',
        },
      ]
    : [];

  const tailCols: any[] = [
    {
      title: t('page.gameSetting.levelExtraSetting.columns.serverState') || '遊戲開關',
      key: 'serverOpen',
      dataIndex: 'serverOpen',
      width: 120,
      align: 'center',
    },
    {
      title: t('page.gameSetting.levelExtraSetting.columns.clientSwitch') || '遊戲入口維護',
      key: 'clientSwitch',
      dataIndex: 'clientSwitch',
      width: 140,
      align: 'center',
    },
  ];

  return [...baseCols, ...extraCols, ...tailCols];
});

const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList();
  const data = Array.isArray(list) ? list : [];
  masterAgentOptions.value = data.map(i => ({ label: i.account, value: i.account }));
};

const fetchVipOptions = async () => {
  vipOptions.value = [{ label: '0', value: 0 }];
  if (!masterAgent.value) {
    return;
  }
  try {
    const list = await listVipByMasterAgent({ masterAgent: masterAgent.value });
    const data: VipSetting[] = Array.isArray(list) ? list : [];
    const opts = data
      .map(i => ({ label: i.name, value: i.vipLevel }))
      .sort((a, b) => Number(a.value) - Number(b.value));
    vipOptions.value = [{ label: '0', value: 0 }, ...opts];
  }
  catch {
    // ignore
  }
};

const loadAll = async () => {
  if (!masterAgent.value) {
    rows.value = [];
    originalRowMap.value = {};
    originalEnabledSet.value = new Set();
    platformOptions.value = [];
    gameTypeOptions.value = [];
    filtersPlatformList.value = [];
    filtersGameTypeList.value = [];
    showNotOpen.value = false;
    return;
  }

  loading.value = true;
  tableLoading.value = true;
  try {
    await fetchVipOptions();

    const gameRes = await gameList({ masterAgent: masterAgent.value });
    const games: GameInfo[] = Array.isArray(gameRes) ? gameRes : [];
    const numericGames = games.filter(g => /^\d+$/.test(String(g.gameID ?? '')));
    const gameMap = numericGames.reduce<Record<string, GameInfo>>((acc, g) => {
      acc[String(g.gameID)] = g;
      return acc;
    }, {});

    let settingList = await listLevelExtraSettingByMasterAgent({ masterAgent: masterAgent.value });
    const settings: LevelExtraSettingItem[] = Array.isArray(settingList) ? settingList : [];

    // 對齊 Vue2：缺少設定時先補 create
    const existingSet = new Set(settings.map(s => String(s.gameID)));
    const missing = Object.keys(gameMap).filter(id => !existingSet.has(id));
    if (missing.length > 0) {
      await createLevelExtraSetting({ masterAgent: masterAgent.value, gameIDs: missing });
      settingList = await listLevelExtraSettingByMasterAgent({ masterAgent: masterAgent.value });
    }

    const enabledListRes = await getGameIDList({ masterAgent: masterAgent.value });
    const enabledList = Array.isArray(enabledListRes) ? enabledListRes : [];
    const enabledSet = new Set(enabledList.map(String));
    originalEnabledSet.value = new Set(enabledSet);

    const finalSettings: LevelExtraSettingItem[] = Array.isArray(settingList) ? settingList : [];

    // options
    const pOpt: DefaultOptionType[] = [];
    const tOpt: DefaultOptionType[] = [];
    const pSeen = new Set<string>();
    const tSeen = new Set<string>();

    const builtRows: Row[] = finalSettings
      .map((s) => {
        const g = gameMap[String(s.gameID)];
        let gameName = g?.gameName || String((s as any).gameName || '');
        if ((g as any)?.language?.tw) {
          gameName += ` (${(g as any).language.tw})`;
        }

        const platformRaw = (g as any)?.extraInfo?.platform ? String((g as any).extraInfo.platform) : '內部';
        const platform = normalizePlatformLabel(platformRaw);
        const gameType = String((g as any)?.gameType ?? '');

        if (platform && !pSeen.has(platform)) {
          pSeen.add(platform);
          pOpt.push({ label: platform, value: platform });
        }
        if (gameType && !tSeen.has(gameType)) {
          tSeen.add(gameType);
          tOpt.push({ label: getGameTypeLabel(gameType), value: gameType });
        }

        return {
          id: Number(s.id),
          gameID: String(s.gameID),
          gameName,
          platform,
          gameType,
          icon: g ? buildIconUrl(g) : '',

          levelLock: String((s as any).levelLock ?? 0),
          vipLock: Number((s as any).vipLock ?? 0),
          levelUp: Number((s as any).levelUp ?? 0) as 0 | 1,
          prizeItems: Number((s as any).prizeItems ?? 0) as 0 | 1,
          tag: Number((s as any).tag ?? 0) as TagValue,
          sort: Number((s as any).sort ?? 0),
          clientSwitch: Boolean((s as any).clientSwitch ?? false),
          serverOpen: enabledSet.has(String(s.gameID)),

          diff: false,
        };
      })
      .sort((a, b) => a.sort - b.sort);

    platformOptions.value = pOpt.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    gameTypeOptions.value = tOpt.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    rows.value = builtRows;
    originalRowMap.value = builtRows.reduce<Record<string, Row>>((acc, r) => {
      acc[String(r.gameID)] = cloneRow(r);
      return acc;
    }, {});

    recomputeDiff();
  }
  catch (e: any) {
    message.error(e?.message || '取得遊戲大廳設定失敗');
  }
  finally {
    loading.value = false;
    tableLoading.value = false;
  }
};

const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val;
  await loadAll();
};

const applySetAll = () => {
  const types = new Set(setAllType.value);
  rows.value.forEach((r) => {
    if (types.has('serverOpen')) {
      r.serverOpen = allTypeValue.value;
    }
    if (types.has('clientSwitch')) {
      r.clientSwitch = allTypeValue.value;
    }
    if (types.has('levelUp')) {
      r.levelUp = allTypeValue.value ? 1 : 0;
    }
    if (types.has('prizeItems')) {
      r.prizeItems = allTypeValue.value ? 1 : 0;
    }
  });
  recomputeDiff();
};

const buildUpdateRows = (): UpdateLevelExtraSettingRow[] => {
  return rows.value
    .filter(r => isExtraChanged(r))
    .map((r) => {
      return {
        id: r.id,
        gameID: r.gameID,
        levelUp: r.levelUp,
        levelLock: Number(r.levelLock) || 0,
        vipLock: r.vipLock,
        prizeItems: r.prizeItems,
        tag: r.tag,
        sort: Number(r.sort) || 0,
        clientSwitch: r.clientSwitch,
      };
    });
};

const save = async () => {
  if (!masterAgent.value) {
    message.error('請先選擇總代理');
    return;
  }
  if (!canCommit.value) {
    if (baseShow.value && hasInvalidLevelLock.value) {
      message.error(t('page.gameSetting.levelExtraSetting.errors.levelLock') || '請輸入 0~999 的數字');
      return;
    }
    return;
  }

  tableLoading.value = true;
  try {
    // 1) 遊戲開關（gameManager）
    const serverChanged = rows.value.some(r => isServerChanged(r));
    if (serverChanged) {
      const enabled = rows.value.filter(r => r.serverOpen).map(r => r.gameID);
      await setGameIDList({ masterAgent: masterAgent.value, gameIDList: enabled });
    }

    // 2) 其他欄位（levelServer）
    const updates = buildUpdateRows();
    if (updates.length > 0) {
      await updateLevelExtraSetting({ masterAgent: masterAgent.value, gameIDs: updates });
    }

    message.success('提交成功');
    await loadAll();
  }
  catch (e: any) {
    message.error(e?.message || '提交失敗');
  }
  finally {
    tableLoading.value = false;
  }
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
    await loadAll();
  }
});
</script>

<template>
  <div class="levelExtraSetting">
    <template v-if="canView">
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
          <div class="txt" style="width: 90px">
            <label>{{ t('page.gameSetting.levelExtraSetting.labels.iconSize') || '圖示大小' }}</label>
          </div>
          <div class="radio">
            <a-radio-group v-model:value="iconSize" :disabled="tableLoading">
              <a-radio-button value="small">
                {{ t('page.gameSetting.levelExtraSetting.iconSize.small') || '小圖' }}
              </a-radio-button>
              <a-radio-button value="big">
                {{ t('page.gameSetting.levelExtraSetting.iconSize.big') || '大圖' }}
              </a-radio-button>
            </a-radio-group>
          </div>
        </div>

        <div class="input_group">
          <a-button v-if="isDataChange" type="primary" :disabled="tableLoading || !canCommit" @click="save">
            {{ t('page.gameSetting.buttons.commit') || '提交' }}
          </a-button>
        </div>
      </div>

      <a-alert
        v-if="baseShow && hasInvalidLevelLock"
        type="error"
        show-icon
        style="margin-bottom: 12px"
        :message="t('page.gameSetting.levelExtraSetting.errors.levelLock') || '請輸入 0~999 的數字'"
      />
      <a-alert
        v-if="hasDuplicateSort"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        :message="t('page.gameSetting.levelExtraSetting.warnings.duplicateSort') || '排序有重複，提交前請調整'"
      />

      <div class="control-container wrap" style="margin-bottom: 12px">
        <div class="input_group">
          <div class="txt" style="width: 90px">
            <label>{{ t('page.gameSetting.levelExtraSetting.labels.platformFilter') || '平台篩選' }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="filtersPlatformList"
              mode="multiple"
              style="width: 260px"
              :options="platformOptions"
              allow-clear
              :max-tag-count="1"
              :disabled="tableLoading"
            />
          </div>
        </div>
        <div class="input_group">
          <div class="txt" style="width: 90px">
            <label>{{ t('page.gameSetting.levelExtraSetting.labels.gameTypeFilter') || '種類篩選' }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="filtersGameTypeList"
              mode="multiple"
              style="width: 260px"
              :options="gameTypeOptions"
              allow-clear
              :max-tag-count="1"
              :disabled="tableLoading"
            />
          </div>
        </div>
        <div class="input_group">
          <div class="txt" style="width: 130px">
            <label>{{ t('page.gameSetting.levelExtraSetting.labels.showNotOpen') || '顯示未開啟遊戲' }}</label>
          </div>
          <div class="radio">
            <a-switch v-model:checked="showNotOpen" :disabled="tableLoading" />
          </div>
        </div>
      </div>

      <div class="control-container wrap" style="margin-bottom: 12px">
        <div class="input_group">
          <div class="txt" style="width: 60px">
            <label>{{ t('page.gameSetting.levelExtraSetting.labels.batch') || '操作' }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="setAllType"
              mode="multiple"
              style="width: 260px"
              :options="batchTypeOptions"
              allow-clear
              :max-tag-count="1"
              :disabled="tableLoading"
            />
          </div>
          <div class="radio" style="margin-left: 8px">
            <a-switch v-model:checked="allTypeValue" :disabled="tableLoading" />
          </div>
          <div class="radio" style="margin-left: 8px">
            <a-button type="primary" :disabled="setAllType.length === 0 || tableLoading" @click="applySetAll">
              {{ t('page.gameSetting.levelExtraSetting.labels.setAll') || '全選修改' }}
            </a-button>
          </div>
        </div>
      </div>

      <div class="tableRegion">
        <a-table
          :loading="tableLoading"
          :sticky="true"
          :columns="columns"
          :data-source="filteredRows"
          row-key="gameID"
          size="small"
          :pagination="false"
          :scroll="{ x: 'max-content', y: 'calc(60vh - 40px)' }"
          :row-class-name="(record: any) => (record.diff ? 'diffRow' : '')"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'platform'">
              {{ record.platform }}
            </template>
            <template v-else-if="column.key === 'gameType'">
              {{ record.gameType || '-' }}
            </template>
            <template v-else-if="column.key === 'icon'">
              <img
                v-if="record.icon"
                :src="record.icon"
                :width="iconWidth"
                :height="iconHeight"
                loading="lazy"
                style="object-fit: contain"
              >
              <span v-else>-</span>
            </template>
            <template v-else-if="column.key === 'sort'">
              <a-input-number
                v-model:value="record.sort"
                :min="0"
                :max="9999"
                :disabled="tableLoading || !canEdit"
                style="width: 80px"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'vipLock'">
              <a-select
                v-model:value="record.vipLock"
                style="width: 110px"
                :options="vipOptions"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'levelLock'">
              <a-input
                v-model:value="record.levelLock"
                style="width: 90px"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'levelUp'">
              <a-switch
                v-model:checked="record.levelUp"
                :checked-value="1"
                :un-checked-value="0"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'prizeItems'">
              <a-switch
                v-model:checked="record.prizeItems"
                :checked-value="1"
                :un-checked-value="0"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'tag'">
              <a-select
                v-model:value="record.tag"
                style="width: 90px"
                :options="tagOptions"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'serverOpen'">
              <a-switch
                v-model:checked="record.serverOpen"
                :disabled="tableLoading || !canToggleServerState"
                @change="recomputeDiff"
              />
            </template>
            <template v-else-if="column.key === 'clientSwitch'">
              <a-switch
                v-model:checked="record.clientSwitch"
                :disabled="tableLoading || !canEdit"
                @change="recomputeDiff"
              />
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <a-result
      v-else
      status="403"
      title="403"
      sub-title="沒有權限"
    />
  </div>
</template>

<style scoped>
.levelExtraSetting {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* ✅ 外層不滾動，僅 table 內滾動 */
}

.tableRegion {
  flex: 1 1 auto;
  min-height: 0; /* ✅ 讓 table scroll.y 成為唯一 Y 軸 */
}

/* 工具列：flex + gap，必要時換行 */
:deep(.control-container.wrap) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.input_group {
  display: flex;
  padding: 2px;
  align-items: center;
  gap: 8px;
  .txt {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    white-space: nowrap;
  }
  .my_input {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .radio {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

:deep(.diffRow) {
  background-color: #f8c6c6;
}

/* ✅ 給 table body 一點底部空間，避免最後一列被遮到 */
.levelExtraSetting :deep(.ant-table-body) {
  padding-bottom: 48px;
}
</style>
