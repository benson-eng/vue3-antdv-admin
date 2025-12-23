<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';

import { message } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { gameList } from '@/api/backend/adminSystem/gameManagerServer';
import { getRemoteConfig, getRemoteConfigDetail, uploadRemoteConfig } from '@/api/backend/adminSystem/slotgameServer';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'ConfigSetting' });

type SettingType = 'string' | 'number' | 'boolean' | 'json';
interface SettingRow {
  name: string;
  nameTitle: string;
  type: SettingType;
  value: any;
  index: number;
  canDel?: boolean;
  diff?: boolean;
}

interface GameSettingRow {
  gameID: string;
  name: string;
  value: boolean;
  type?: any;
}

const userStore = useUserStore();

const canSelectMasterAgent = computed(() => userStore.level < 4);
const canEdit = computed(() => userStore.level < 3);

const loading = ref(false);
const disabledSave = ref(false);

const masterAgent = ref<string>(userStore.level >= 4 ? String(userStore.masterAgent || '') : '');
const currencyType = ref<string>('');

const masterAgentOptions = ref<DefaultOptionType[]>([]);
const masterAgentMetaMap = ref<Record<string, MasterAgentItem>>({});

const showSaveBtn = ref(false);
const configUrl = ref('');
const hasConfig = ref(false);

const gameListOptions = ref<Array<{ name: string; value: string; type?: any }>>([]);
const gameSettingForm = ref<GameSettingRow[]>([]);
const originalGameSettingForm = ref<Array<{ gameID: string; value: boolean }>>([]);

const configSettingForm = ref<SettingRow[]>([]);
const checkData = ref<SettingRow[]>([]);
/**
 * 【新增】單一、穩定的 diff baseline（最後一次成功儲存後快照）
 */
const baselineConfig = ref<SettingRow[]>([]);

const cdnBaseUrl = computed(() => import.meta.env.VITE_APP_CDN_BASE_URL || '');
/**
 * 組合 CDN 取檔 URL（對齊 Vue2：VITE_APP_CDN_BASE_URL + remoteConfig 路徑）
 * - 避免 base 已含 /asset 時造成 /asset/asset 重複
 * - 避免 // 雙斜線
 */
const buildCdnUrl = (path: string) => {
  const p = String(path || '').trim();
  if (!p) {
    return '';
  }
  if (/^https?:\/\//i.test(p)) {
    return p;
  }

  const base = String(cdnBaseUrl.value || '').trim();
  if (!base) {
    return p;
  }

  try {
    const baseNormalized = base.endsWith('/') ? base : `${base}/`;
    return new URL(p, baseNormalized).toString();
  }
  catch {
    // fallback：維持原本拼接邏輯
    const left = base.endsWith('/') ? base : `${base}/`;
    const right = p.startsWith('/') ? p.slice(1) : p;
    return `${left}${right}`;
  }
};

const defaultConfig = (): SettingRow[] => [
  { name: 'isFastCollect', nameTitle: '是否開啟快速取分', type: 'boolean', value: false, index: 0, canDel: false, diff: false },
  { name: 'isDecimalPoint', nameTitle: '是否開啟小數點', type: 'boolean', value: false, index: 1, canDel: false, diff: false },
  { name: 'isOpenHistory', nameTitle: '是否開啟遊戲歷史紀錄', type: 'boolean', value: false, index: 2, canDel: false, diff: false },
  { name: 'isOpenMarquee', nameTitle: '是否開啟跑馬燈', type: 'boolean', value: false, index: 3, canDel: false, diff: false },
  { name: 'loadingControl', nameTitle: '下載介面控制', type: 'number', value: 0, index: 4, canDel: false, diff: false },
  { name: 'isOpenGameSeatLobby', nameTitle: '選座大廳開關', type: 'json', value: [], index: 5, canDel: false, diff: false },
];

const updateCurrencyTypeByMasterAgent = (ma: string) => {
  const meta = masterAgentMetaMap.value[ma];
  currencyType.value = meta?.currencies?.[0]?.currencyCode || '';
};

const fetchMasterAgents = async () => {
  const list = await getMasterAgentAccountList({});
  const rows = Array.isArray(list) ? list : [];
  masterAgentOptions.value = rows.map(i => ({ label: i.account, value: i.account }));
  masterAgentMetaMap.value = rows.reduce((acc: any, cur: any) => {
    acc[cur.account] = cur;
    return acc;
  }, {});
  if (canSelectMasterAgent.value && !masterAgent.value && masterAgentOptions.value.length) {
    masterAgent.value = String(masterAgentOptions.value[0].value);
  }
  if (masterAgent.value) {
    updateCurrencyTypeByMasterAgent(masterAgent.value);
  }
};

const getGameList = async () => {
  gameListOptions.value = [];
  const ma = String(masterAgent.value || '').trim();
  if (!ma) {
    return;
  }
  const res = await gameList({ masterAgent: ma });
  const rows = Array.isArray(res) ? res : [];
  const filtered = rows
    .filter((g: any) => String(g?.gameID ?? '').match(/^\d+$/))
    .filter((g: any) => Number(g?.gameType) === 1);

  gameListOptions.value = filtered.map((g: any) => ({
    name: String(g?.language?.tw ?? g?.content ?? g?.gameName ?? '').trim() || String(g?.gameID ?? ''),
    value: String(g?.gameID ?? ''),
    type: g?.gameType,
  }));
};

const buildGameSetting = () =>
  gameListOptions.value.map((item) => {
    return {
      name: item.name,
      gameID: item.value,
      type: item.type,
      value: false,
    } as GameSettingRow;
  });

const onReloadList2 = (ori: GameSettingRow[]) => {
  const valueMap: Record<string, boolean> = {};
  (ori || []).forEach((item: any) => {
    const id = String(item?.gameID ?? '');
    valueMap[id] = Boolean(item?.value);
  });
  return gameListOptions.value.map(item => ({
    name: item.name,
    gameID: item.value,
    type: item.type,
    value: valueMap[item.value] ?? false,
  })) as GameSettingRow[];
};

/**
 * 只用 baselineConfig 做 diff（baselineConfig 代表「最後一次成功載入 / 儲存後」的狀態）
 * 比對欄位：name/nameTitle/type/value/index（index 以畫面順序為準）
 */
const syncDiffFlags = () => {
  const baseMap: Record<string, SettingRow> = {};
  baselineConfig.value.forEach((b) => {
    baseMap[b.name] = b;
  });

  let diffCount = 0;
  const curNameSet = new Set<string>();
  configSettingForm.value = configSettingForm.value.map((row, idx) => {
    /** 【修改】index 以畫面順序為準（對齊 Vue2） */
    const nextRow: SettingRow = { ...row, index: idx };
    curNameSet.add(nextRow.name);
    const base = baseMap[nextRow.name];

    let diff = false;
    if (!base) {
      diff = true;
    }
    else {
      const sameValue = nextRow.type === 'number'
        ? Number(nextRow.value) === Number(base.value)
        : nextRow.type === 'json'
          ? JSON.stringify(nextRow.value) === JSON.stringify(base.value)
          : nextRow.value === base.value;

      if (
        !sameValue
        || nextRow.nameTitle !== base.nameTitle
        || nextRow.type !== base.type
        || nextRow.index !== base.index
      ) {
        diff = true;
      }
    }

    if (diff) {
      diffCount++;
    }
    return { ...nextRow, diff };
  });

  // Vue2 行為：baseline 有但目前沒有（刪除列）也要視為有異動 -> 允許儲存
  baselineConfig.value.forEach((b) => {
    if (!curNameSet.has(b.name)) {
      diffCount++;
    }
  });

  showSaveBtn.value = diffCount > 0;
};

const buildFormData = (data: any, hasRemote: boolean) => {
  loading.value = true;
  configSettingForm.value = [];
  checkData.value = [];
  showSaveBtn.value = false;
  hasConfig.value = hasRemote;

  const defData = defaultConfig();
  let sortIndex = 0;

  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    const bg = Array.isArray((data as any).bgInfo) ? (data as any).bgInfo : [];
    bg.forEach((item: any) => {
      if (!item) {
        return;
      }
      configSettingForm.value.push({
        ...item,
        index: sortIndex,
        canDel: true,
        diff: false,
      });
      checkData.value.push(cloneDeep({
        ...item,
        index: sortIndex,
        canDel: true,
        diff: false,
      }));
      sortIndex++;
    });
  }

  // 補齊預設欄位（缺少時標 diff）
  defData.forEach((item) => {
    const find = configSettingForm.value.findIndex(v => v.name === item.name);
    if (find === -1) {
      const add = cloneDeep(item);
      add.index = sortIndex;
      add.canDel = false;
      add.diff = true;
      if (add.name === 'isOpenGameSeatLobby') {
        add.value = buildGameSetting();
      }
      configSettingForm.value.push(add);
      sortIndex++;
    }
    else {
      configSettingForm.value[find].canDel = false;
    }
  });

  const gameSettingItem = configSettingForm.value.find(i => i.name === 'isOpenGameSeatLobby');
  if (gameSettingItem) {
    // Vue2：這個欄位需做資料檢查與補齊（避免 value 非陣列造成流程中斷）
    gameSettingForm.value = cloneDeep(Array.isArray(gameSettingItem.value) ? gameSettingItem.value : []);
    gameSettingItem.nameTitle = '選座大廳開關';
    gameSettingItem.value = onReloadList2(gameSettingForm.value);
  }

  /**
   * 初次載入 / 重新載入完成後：
   * - 所有 diff 需為 false
   * - baselineConfig = cloneDeep(configSettingForm)
   * - 儲存按鈕 disabled（showSaveBtn=false）
   */
  configSettingForm.value = configSettingForm.value.map((r, i) => ({ ...r, index: i, diff: false }));
  baselineConfig.value = cloneDeep(configSettingForm.value).map((r, i) => ({ ...r, index: i, diff: false }));
  showSaveBtn.value = false;
  loading.value = false;
};

const setRemoteConfig = async () => {
  const ma = String(masterAgent.value || '').trim();
  if (!ma) {
    return;
  }

  const res = await getRemoteConfig({ masterAgent: ma });
  const isEmpty = !res || (typeof res === 'object' && Object.keys(res).length === 0);

  if (isEmpty) {
    configUrl.value = '';
    buildFormData({}, false);
    return;
  }

  const remotePath = String((res as any).remoteConfig ?? '').trim();
  if (!remotePath) {
    configUrl.value = '';
    buildFormData({}, false);
    return;
  }

  configUrl.value = buildCdnUrl(remotePath);
  const detail = await getRemoteConfigDetail<any>(configUrl.value);

  if (!detail || typeof detail !== 'object' || !Array.isArray(detail.bgInfo)) {
    message.error('遠端配置檔格式錯誤');
    buildFormData({}, false);
    return;
  }

  buildFormData(detail, true);
};

const onMasterAgentChanged = async (val: string) => {
  masterAgent.value = val;
  updateCurrencyTypeByMasterAgent(val);
  configSettingForm.value = [];
  checkData.value = [];
  showSaveBtn.value = false;
  configUrl.value = '';
  hasConfig.value = false;
  gameListOptions.value = [];
  gameSettingForm.value = [];
  originalGameSettingForm.value = [];

  loading.value = true;
  try {
    await getGameList();
    await setRemoteConfig();
  }
  finally {
    loading.value = false;
  }
};

watch(
  () => masterAgent.value,
  async (val) => {
    if (!val) {
      configSettingForm.value = [];
      checkData.value = [];
      return;
    }
    // 使用者手動切換總代理時觸發
    if (canSelectMasterAgent.value) {
      await onMasterAgentChanged(val);
    }
  },
);

/**
 * 新增項目 Dialog
 */
const addOpen = ref(false);
const dialogForm = ref<{ name: string; nameTitle: string; type: Exclude<SettingType, 'json'>; value: any }>({
  name: '',
  nameTitle: '',
  type: 'string',
  value: '',
});

const openAddDialog = () => {
  dialogForm.value = { name: '', nameTitle: '', type: 'string', value: '' };
  addOpen.value = true;
};
const onChangeDialogType = () => {
  if (dialogForm.value.type === 'string') {
    dialogForm.value.value = '';
  }
  if (dialogForm.value.type === 'number') {
    dialogForm.value.value = 0;
  }
  if (dialogForm.value.type === 'boolean') {
    dialogForm.value.value = false;
  }
};
const addItem = () => {
  const name = String(dialogForm.value.name || '').trim();
  const nameTitle = String(dialogForm.value.nameTitle || '').trim();
  if (!name || !nameTitle) {
    message.warning('請輸入名稱與代碼');
    return;
  }
  if (configSettingForm.value.some(i => i.name === name)) {
    message.warning('代碼已存在');
    return;
  }
  const one: SettingRow = {
    name,
    nameTitle,
    type: dialogForm.value.type,
    value: dialogForm.value.value,
    index: configSettingForm.value.length,
    canDel: true,
    diff: true,
  };
  configSettingForm.value.push(one);
  addOpen.value = false;
  syncDiffFlags();
};

/**
 * 刪除
 */
const removeRow = (row: any) => {
  const r = row as SettingRow;
  if (!r.canDel) {
    return;
  }
  const idx = configSettingForm.value.findIndex(i => i.name === r.name);
  if (idx >= 0) {
    configSettingForm.value.splice(idx, 1);
    // 重設 index（對齊 Vue2：用視覺順序當 index）
    configSettingForm.value = configSettingForm.value.map((r, i) => ({ ...r, index: i }));
    syncDiffFlags();
  }
};

/**
 * JSON（選座大廳）Dialog
 */
const jsonOpen = ref(false);
const openJsonDialog = async (row: any) => {
  const r = row as SettingRow;
  const current = cloneDeep(Array.isArray(r.value) ? r.value : []);
  gameSettingForm.value = cloneDeep(current);
  /* 【修改】JSON baseline：用 gameID 當 key（對齊 Vue2 行為） */
  originalGameSettingForm.value = cloneDeep(gameSettingForm.value).map(i => ({ gameID: String(i.gameID), value: Boolean(i.value) }));
  // Vue2：開啟 Dialog 前會重新抓一次遊戲清單，再做補齊與保留值（以 gameID 為準）
  await getGameList();
  gameSettingForm.value = onReloadList2(current);
  // Vue2：即使不按確認，也會把對齊後的清單回寫到 configSettingForm（不主動觸發 diff 計算）
  const target = configSettingForm.value.find(i => i.name === 'isOpenGameSeatLobby');
  if (target) {
    target.value = cloneDeep(gameSettingForm.value);
  }
  jsonOpen.value = true;
};
const toggleAllGameSetting = (state: boolean) => {
  gameSettingForm.value = gameSettingForm.value.map(i => ({ ...i, value: state }));
};
/**
 * 【修改】JSON diff：比對必須用 gameID，不可用 index
 */
const gameSeatRowClassName = (record: any) => {
  const cur = record as GameSettingRow;
  const base = originalGameSettingForm.value.find(
    b => String(b.gameID) === String(cur.gameID),
  );
  // Vue2：原本不存在（新補齊的 gameID）也視為差異
  if (!base) {
    return 'diff-row';
  }
  return base.value !== Boolean(cur.value) ? 'diff-row' : '';
};
const confirmJsonDialog = () => {
  const target = configSettingForm.value.find(i => i.name === 'isOpenGameSeatLobby');
  if (target) {
    target.value = cloneDeep(gameSettingForm.value);
    syncDiffFlags();
  }
  jsonOpen.value = false;
};

/**
 * 匯入 / 匯出
 */
const exportConfig = () => {
  try {
    const exportData = { bgInfo: configSettingForm.value };
    const file = new File([JSON.stringify(exportData, null, 2)], 'exportConfig.json', { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(file);
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('匯出成功');
  }
  catch (e) {
    console.error(e);
    message.error('匯出失敗');
  }
};

const compareDiff = (oldConfig: SettingRow[], newConfig: any) => {
  const importData = Array.isArray(newConfig?.bgInfo) ? newConfig.bgInfo : [];
  configSettingForm.value = [];
  importData.forEach((item: any, idx: number) => {
    const oldItem = oldConfig.find(o => o.name === item.name);
    let diff = false;
    if (!oldItem) {
      diff = true;
    }
    else {
      const same = item.type === 'number'
        ? Number(item.value) === Number(oldItem.value)
        : item.type === 'json'
          ? JSON.stringify(item.value) === JSON.stringify(oldItem.value)
          : item.value === oldItem.value;
      if (!same || item.type !== oldItem.type || item.nameTitle !== oldItem.nameTitle) {
        diff = true;
      }
    }
    configSettingForm.value.push({
      ...item,
      index: idx,
      diff,
    });
  });
};

const beforeImport = async (file: File) => {
  try {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    // 【修改】匯入比對來源：以 baselineConfig 為準（穩定）
    const oldConfig = cloneDeep(baselineConfig.value);
    compareDiff(oldConfig, jsonData);
    const gameSettingItem = configSettingForm.value.find(i => i.name === 'isOpenGameSeatLobby');
    if (gameSettingItem) {
      gameSettingItem.value = onReloadList2(Array.isArray(gameSettingItem.value) ? gameSettingItem.value : []);
    }
    syncDiffFlags();
    message.success('匯入成功');
  }
  catch (e) {
    console.error(e);
    message.error('匯入失敗，請確認檔案格式正確');
  }
  return false;
};

/**
 * 儲存
 */
const save = async () => {
  const ma = String(masterAgent.value || '').trim();
  if (!ma) {
    message.warning('請先選擇總代理');
    return;
  }
  if (!canEdit.value) {
    message.warning('目前帳號權限不足，無法儲存');
    return;
  }

  disabledSave.value = true;
  try {
    const jsonObj: any = {};
    let gameSetArray: any[] = [];
    let isErr = false;
    const rules = /^\d+$/;

    configSettingForm.value.forEach((i) => {
      switch (i.type) {
        case 'boolean':
        case 'string':
          jsonObj[i.name] = i.value;
          break;
        case 'number':
          if (!rules.test(String(i.value ?? ''))) {
            isErr = true;
            message.error(`${i.name} 數字格式錯誤`);
          }
          else {
            jsonObj[i.name] = Number(i.value);
          }
          break;
        case 'json':
          gameSetArray = [];
          (Array.isArray(i.value) ? i.value : []).forEach((item: any) => {
            const gid = Number(String(item.gameID ?? ''));
            if (!Number.isNaN(gid)) {
              // Vue2：gameID 以 number 上傳
              gameSetArray.push({ gameID: gid, value: item.value });
            }
          });
          jsonObj[i.name] = gameSetArray;
          break;
      }
    });
    if (isErr) {
      return;
    }

    jsonObj.bgInfo = configSettingForm.value.slice();
    const file = new File([JSON.stringify(jsonObj)], 'remoteConfig.json', { type: 'application/json' });
    const data = await uploadRemoteConfig({ masterAgent: ma, imageFile: file, name: 'remoteConfig' });
    if ((data as any)?.remoteConfig) {
      message.success(hasConfig.value ? '儲存成功' : '已自動建立配置檔');
      await setRemoteConfig();
    }
    else {
      message.success('儲存成功');
      await setRemoteConfig();
    }

    /* 【修改】儲存成功且 setRemoteConfig 完成後，重置 baseline + 清空 diff（關鍵） */
    baselineConfig.value = cloneDeep(configSettingForm.value).map((r, i) => ({
      ...r,
      index: i,
      diff: false,
    }));
    configSettingForm.value = configSettingForm.value.map((r, i) => ({ ...r, index: i, diff: false }));
    showSaveBtn.value = false;
  }
  catch (e) {
    console.error(e);
    message.error('儲存失敗');
  }
  finally {
    disabledSave.value = false;
  }
};

/**
 * Table columns
 */
const columns = computed(() => ([
  { title: '名稱', dataIndex: 'nameTitle', key: 'nameTitle' },
  { title: '代碼', dataIndex: 'name', key: 'name' },
  { title: '類型', dataIndex: 'type', key: 'type' },
  { title: '值', dataIndex: 'value', key: 'value' },
  { title: '操作', dataIndex: 'actions', key: 'actions', width: 120 },
] as any[]));

const rowClassName = (record: SettingRow) => (record.diff ? 'diff-row' : '');

onMounted(async () => {
  await fetchMasterAgents();
  if (masterAgent.value) {
    await onMasterAgentChanged(masterAgent.value);
  }
});
</script>

<template>
  <a-card title="客端配置檔">
    <a-space direction="vertical" style="width: 100%">
      <a-row :gutter="16" align="middle">
        <a-col :span="8">
          <a-form-item label="總代理" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
            <a-select
              v-if="canSelectMasterAgent"
              v-model:value="masterAgent"
              :options="masterAgentOptions"
              allow-clear
              placeholder="請選擇總代理"
              :disabled="loading"
            />
            <a-input v-else v-model:value="masterAgent" disabled />
          </a-form-item>
        </a-col>

        <a-col :span="16" style="text-align: right">
          <a-space>
            <a-button type="primary" :disabled="loading || !canEdit" @click="openAddDialog">
              新增
            </a-button>
            <a-button
              type="primary"
              :disabled="!showSaveBtn || disabledSave || loading || !canEdit"
              @click="save"
            >
              儲存
            </a-button>
            <a-upload
              :show-upload-list="false"
              :before-upload="beforeImport"
              accept=".json"
            >
              <a-button :disabled="loading || !canEdit">
                匯入
              </a-button>
            </a-upload>
            <a-button :disabled="loading" @click="exportConfig">
              匯出
            </a-button>
          </a-space>
        </a-col>
      </a-row>

      <a-table
        size="middle"
        :loading="loading"
        :data-source="configSettingForm"
        :columns="columns"
        :pagination="false"
        :row-class-name="rowClassName"
        row-key="name"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            {{ record.type }}
          </template>

          <template v-else-if="column.key === 'value'">
            <a-switch
              v-if="record.type === 'boolean'"
              v-model:checked="record.value"
              :disabled="loading || !canEdit"
              @change="syncDiffFlags"
            />
            <a-input
              v-else-if="record.type === 'number'"
              v-model:value="record.value"
              :disabled="loading || !canEdit"
              style="width: 220px"
              @input="syncDiffFlags"
              @change="syncDiffFlags"
            />
            <a-input
              v-else-if="record.type === 'string'"
              v-model:value="record.value"
              :disabled="loading || !canEdit"
              style="width: 220px"
              @input="syncDiffFlags"
              @change="syncDiffFlags"
            />
            <a-button
              v-else-if="record.type === 'json' && record.name === 'isOpenGameSeatLobby'"
              :disabled="loading || !canEdit"
              @click="openJsonDialog(record)"
            >
              設定
            </a-button>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-button danger :disabled="!record.canDel || loading || !canEdit" @click="removeRow(record)">
              刪除
            </a-button>
          </template>
        </template>
      </a-table>
    </a-space>
  </a-card>

  <!-- 新增項目 -->
  <a-modal v-model:open="addOpen" title="新增項目" ok-text="新增" cancel-text="取消" @ok="addItem">
    <a-form layout="vertical">
      <a-form-item label="名稱">
        <a-input v-model:value="dialogForm.nameTitle" />
      </a-form-item>
      <a-form-item label="代碼">
        <a-input v-model:value="dialogForm.name" />
      </a-form-item>
      <a-form-item label="類型">
        <a-radio-group v-model:value="dialogForm.type" @change="onChangeDialogType">
          <a-radio-button value="string">
            文字
          </a-radio-button>
          <a-radio-button value="number">
            數字
          </a-radio-button>
          <a-radio-button value="boolean">
            布林
          </a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="值">
        <a-input v-if="dialogForm.type === 'string'" v-model:value="dialogForm.value" />
        <a-input v-else-if="dialogForm.type === 'number'" v-model:value="dialogForm.value" />
        <a-switch v-else v-model:checked="dialogForm.value" />
      </a-form-item>
    </a-form>
  </a-modal>

  <!-- 選座大廳開關 -->
  <a-modal
    v-model:open="jsonOpen"
    title="選座大廳開關"
    width="760px"
    ok-text="確認"
    cancel-text="取消"
    @ok="confirmJsonDialog"
  >
    <div style="text-align: right; margin-bottom: 12px;">
      <a-space>
        <a-button type="primary" @click="toggleAllGameSetting(true)">
          全開
        </a-button>
        <a-button danger @click="toggleAllGameSetting(false)">
          全關
        </a-button>
      </a-space>
    </div>

    <a-table
      size="small"
      :data-source="gameSettingForm"
      :pagination="false"
      row-key="gameID"
      :row-class-name="gameSeatRowClassName"
      :scroll="{ y: 520 }"
    >
      <a-table-column title="遊戲ID" data-index="gameID" />
      <a-table-column title="遊戲名稱" data-index="name" />
      <a-table-column title="開關" data-index="value">
        <template #default="{ record }">
          <a-switch v-model:checked="record.value" />
        </template>
      </a-table-column>
    </a-table>
  </a-modal>
</template>

<style scoped>
:deep(.diff-row) td {
  background: #fff1f0 !important;
}
</style>
