<script setup lang="ts">
import { message } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';
import { computed, onMounted, ref } from 'vue';
import AgentApi from '@/api/backend/adminAccount/agent';
import MasterAgentApi from '@/api/backend/adminAccount/masterAgent';
import { editProxyChannelAction, queryProxyChannelAction } from '@/api/backend/adminSystem/billboard';
import { getConfig2SettingAction, setConfig2Setting } from '@/api/backend/adminSystem/jpServer';
import { getGlobalMaintainStatus } from '@/api/backend/adminSystem/maintain';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'AdminAccountAgentSettings' });

type SettingName = 'isBillBoardEnabled' | 'isJP2Enabled';

interface SettingRow {
  name: SettingName;
  nameTitle: string;
  type: 'boolean';
  value: boolean;
  /** 遠端缺少該設定（第一次存檔需要補上） */
  missing?: boolean;
  /** UI：是否與基準值不同 / 或遠端缺少 */
  diff: boolean;
}

const userStore = useUserStore();
const canSelectMasterAgent = computed(() => userStore.level < 4);
const canSelectAgent = computed(() => userStore.level <= 4);

const loading = ref(false);
const disabledSave = ref(false);
const isGlobalMaintain = ref(true);

const masterAgentOptions = ref<{ label: string; value: string }[]>([]);
const currencyTypeByMasterAgent = ref<Record<string, string>>({});

const selectedMasterAgent = ref<string>(userStore.level >= 4 ? String(userStore.masterAgent || '') : '');
const currencyType = ref<string>('');

const agentOptions = ref<Array<{ label: string; value: string }>>([]);
/** 這裡沿用 Vue2：agent 為「不含 .masterAgent」的帳號前綴 */
const selectedAgent = ref<string>('');

const configSettingForm = ref<SettingRow[]>([]);
const checkData = ref<SettingRow[]>([]);

const agentID = computed(() => {
  const ma = String(selectedMasterAgent.value || '').trim();
  const agent = String(selectedAgent.value || '').trim();
  if (!ma || !agent) {
    return '';
  }
  return `${agent}.${ma}`;
});

const buildDefaultConfig = (): SettingRow[] => [
  {
    name: 'isBillBoardEnabled',
    nameTitle: '獨立跑馬燈',
    type: 'boolean',
    value: false,
    missing: false,
    diff: false,
  },
  {
    name: 'isJP2Enabled',
    nameTitle: '獨立JP2',
    type: 'boolean',
    value: false,
    missing: false,
    diff: false,
  },
];

const syncDiffFlags = () => {
  const baseMap: Record<string, SettingRow> = {};
  checkData.value.forEach((b) => {
    baseMap[b.name] = b;
  });
  configSettingForm.value = configSettingForm.value.map((row) => {
    const base = baseMap[row.name];
    const changed = !base || base.value !== row.value;
    return { ...row, diff: Boolean(row.missing || changed) };
  });
};

const showSaveBtn = computed(() => configSettingForm.value.some(r => r.diff));

const rowClassName = (record: SettingRow) => (record.diff ? 'diff-row' : '');

const loadGlobalMaintainStatus = async () => {
  try {
    const data = await getGlobalMaintainStatus();
    isGlobalMaintain.value = Boolean(data?.isMaintained);
  }
  catch (e) {
    console.error(e);
    // 若取不到狀態，保守起見不擋操作（避免整頁無法使用）
    isGlobalMaintain.value = true;
  }
};

const loadMasterAgents = async () => {
  const list = await MasterAgentApi.getMasterAgentAccountList({});
  const items = Array.isArray(list) ? list : [];

  masterAgentOptions.value = items
    .map((i: any) => String(i?.account ?? '').trim())
    .filter(Boolean)
    .map(account => ({ label: account, value: account }));

  const map: Record<string, string> = {};
  items.forEach((i: any) => {
    const account = String(i?.account ?? '').trim();
    const firstCurrencyCode = String(i?.currencies?.[0]?.currencyCode ?? '').trim();
    if (account) {
      map[account] = firstCurrencyCode;
    }
  });
  currencyTypeByMasterAgent.value = map;

  // Vue2 預設會自動選第一個 masterAgent
  if (canSelectMasterAgent.value && !selectedMasterAgent.value && masterAgentOptions.value.length) {
    selectedMasterAgent.value = masterAgentOptions.value[0].value;
  }
};

async function getSettingData() {
  const ma = String(selectedMasterAgent.value || '').trim();
  const agent = String(selectedAgent.value || '').trim();
  const fullAgentID = String(agentID.value || '').trim();

  if (!ma || !agent || !fullAgentID) {
    configSettingForm.value = [];
    checkData.value = [];
    return;
  }

  loading.value = true;
  try {
    const detData = buildDefaultConfig();
    // 取資料與組成
    const [proxyChannels, jpConfigRaw] = await Promise.all([
      queryProxyChannelAction({ masterAgent: ma, channelName: fullAgentID }),
      getConfig2SettingAction({
        currencyType: String(currencyType.value || '').trim(),
        masterAgent: ma,
        items: ['agentConfigs'],
      }),
    ]);

    // billboard：以 fullAgentID 比對
    const billItem = Array.isArray(proxyChannels)
      ? proxyChannels.find((x: any) => String(x?.channelName ?? '') === fullAgentID)
      : undefined;
    detData[0].value = Boolean(billItem?.isEnabled);
    detData[0].missing = !billItem;

    // jp2：資料格式為 [ "<json-string>" ]，以 agent（不含 .masterAgent）比對 channelName
    let jpAgentConfigs: any[] = [];
    try {
      const first = Array.isArray(jpConfigRaw) ? jpConfigRaw[0] : undefined;
      const raw = typeof first === 'string' ? first : '';
      const parsed = raw ? JSON.parse(raw) : [];
      jpAgentConfigs = Array.isArray(parsed) ? parsed : [];
    }
    catch (e) {
      console.error('JP2 設定 JSON 解析失敗', e);
      jpAgentConfigs = [];
    }

    const jpItem = jpAgentConfigs.find((x: any) => String(x?.channelName ?? '') === agent);
    detData[1].value = Boolean(jpItem?.isEnabled);
    detData[1].missing = !jpItem;

    configSettingForm.value = detData;
    checkData.value = cloneDeep(detData);
    syncDiffFlags();
  }
  catch (e) {
    console.error(e);
    configSettingForm.value = [];
    checkData.value = [];
  }
  finally {
    loading.value = false;
  }
}

const loadAgentsByMasterAgent = async (masterAgent: string) => {
  agentOptions.value = [];
  selectedAgent.value = '';
  configSettingForm.value = [];
  checkData.value = [];

  const ma = String(masterAgent || '').trim();
  if (!ma) {
    currencyType.value = '';
    return;
  }

  currencyType.value = String(currencyTypeByMasterAgent.value[ma] ?? '').trim();

  const listRaw = await AgentApi.getAgentListByMasterAgent({ masterAgent: ma });
  const list = Array.isArray(listRaw) ? listRaw : [];

  const ignore = `${ma}agent`.toLowerCase();
  const baseAccounts = list
    .map((a: any) => String(a?.account ?? '').trim())
    .filter(Boolean)
    .map((acc: string) => acc.split('.')[0] || '')
    .filter((acc: string) => acc && acc.toLowerCase() !== ignore);

  const seen = new Set<string>();
  agentOptions.value = baseAccounts
    .filter((acc: string) => {
      if (seen.has(acc)) {
        return false;
      }
      seen.add(acc);
      return true;
    })
    .map((acc: string) => ({ label: acc, value: acc }));

  // Vue2 預設會自動選第一個 agent
  if (agentOptions.value.length) {
    selectedAgent.value = agentOptions.value[0].value;
    await getSettingData();
  }
};

const onMasterAgentChanged = async () => {
  const ma = String(selectedMasterAgent.value || '').trim();
  await loadAgentsByMasterAgent(ma);
};

const onAgentChanged = async () => {
  await getSettingData();
};

const onToggle = () => {
  syncDiffFlags();
};

const save = async () => {
  const ma = String(selectedMasterAgent.value || '').trim();
  const agent = String(selectedAgent.value || '').trim();
  const fullAgentID = String(agentID.value || '').trim();

  if (!ma || !agent || !fullAgentID) {
    message.warning('請先選擇總代理與代理');
    return;
  }
  if (!isGlobalMaintain.value) {
    message.warning('目前非全局維護狀態，無法儲存');
    return;
  }

  const map: Record<string, boolean> = {};
  configSettingForm.value.forEach((r) => {
    map[r.name] = Boolean(r.value);
  });

  disabledSave.value = true;
  try {
    await Promise.all([
      editProxyChannelAction({
        masterAgent: ma,
        agentConfigs: [{ channelName: fullAgentID, isEnabled: Boolean(map.isBillBoardEnabled) }],
      }),
      setConfig2Setting({
        currencyType: String(currencyType.value || '').trim(),
        masterAgent: ma,
        items: [
          {
            agentConfigs: [{ channelName: agent, isEnabled: Boolean(map.isJP2Enabled) }],
          },
        ],
      }),
    ]);

    message.success('儲存成功');
    await getSettingData();
  }
  catch (e) {
    console.error(e);
    message.error('儲存失敗');
  }
  finally {
    disabledSave.value = false;
  }
};

onMounted(async () => {
  await Promise.all([loadGlobalMaintainStatus(), loadMasterAgents()]);

  // masterAgent level / 既有預設值
  if (selectedMasterAgent.value) {
    await onMasterAgentChanged();
  }
});
</script>

<template>
  <a-card title="代理功能設定">
    <a-space direction="vertical" style="width: 100%">
      <a-alert
        v-if="!isGlobalMaintain"
        type="warning"
        show-icon
        message="目前非全局維護狀態，設定僅可檢視不可儲存"
      />

      <a-row :gutter="16" align="middle">
        <a-col :span="8">
          <a-form-item label="總代理" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
            <a-select
              v-if="canSelectMasterAgent"
              v-model:value="selectedMasterAgent"
              :options="masterAgentOptions"
              allow-clear
              placeholder="請選擇總代理"
              :disabled="loading"
              @change="onMasterAgentChanged"
            />
            <a-input v-else v-model:value="selectedMasterAgent" disabled />
          </a-form-item>
        </a-col>

        <a-col :span="8">
          <a-form-item label="代理" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
            <a-select
              v-if="canSelectAgent"
              v-model:value="selectedAgent"
              :options="agentOptions"
              allow-clear
              placeholder="請選擇代理"
              :disabled="loading || !selectedMasterAgent"
              @change="onAgentChanged"
            />
            <a-input v-else v-model:value="selectedAgent" disabled />
          </a-form-item>
        </a-col>

        <a-col :span="8" style="text-align: right">
          <a-button
            type="primary"
            :disabled="!showSaveBtn || disabledSave || loading || !isGlobalMaintain || !agentID"
            @click="save"
          >
            儲存
          </a-button>
        </a-col>
      </a-row>

      <a-table
        size="middle"
        :loading="loading"
        :data-source="configSettingForm"
        :pagination="false"
        :row-class-name="rowClassName"
        row-key="name"
      >
        <a-table-column title="項目" data-index="nameTitle" />
        <a-table-column title="值" data-index="value">
          <template #default="{ record }">
            <a-space>
              <a-switch v-model:checked="record.value" :disabled="loading" @change="onToggle" />
              <a-tag v-if="record.missing" color="orange">
                未建立
              </a-tag>
            </a-space>
          </template>
        </a-table-column>
      </a-table>
    </a-space>
  </a-card>
</template>

<style scoped>
.diff-row td {
  background: #fff1f0 !important;
}
</style>



