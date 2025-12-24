<template>
  <DynamicTable
    row-key="id"
    header-title="股東座位設定"
    :data-request="loadTableData"
    :columns="columns"
    :pagination="false"
  >
    <template #toolbar>
      <a-space>
        <a-select
          v-model:value="shareholder"
          style="width: 240px"
          :options="shareholderOptions"
          placeholder="請選擇股東"
          allow-clear
          @change="onShareholderChange"
        />
        <a-button type="primary" :disabled="!shareholder || loading" @click="openModal('add')">
          新增
        </a-button>
        <a-button :disabled="!shareholder || loading" @click="openModal('all')">全遊戲設定</a-button>
      </a-space>
    </template>
  </DynamicTable>

  <a-modal
    v-model:open="modalOpen"
    :title="modalTitle"
    :confirm-loading="modalSubmitting"
    :mask-closable="false"
    :destroy-on-close="true"
    width="980px"
    @ok="submitModal"
    @cancel="closeModal"
  >
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="股東">
            <a-input :value="shareholder" disabled />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="遊戲">
            <a-select
              v-if="modalMode !== 'all'"
              v-model:value="form.gameID"
              show-search
              option-filter-prop="label"
              :disabled="modalMode === 'edit'"
              :options="gameOptions"
              placeholder="請選擇遊戲"
              allow-clear
            />
            <a-input v-else value="全部遊戲" disabled />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="廳數">
        <a-radio-group v-model:value="form.lobbyCount" @change="syncLobbyCount">
          <a-radio-button v-for="n in [1, 2, 3, 4]" :key="n" :value="n">{{ n }}</a-radio-button>
        </a-radio-group>
        <a-button style="margin-left: 12px" @click="applyDefaultTemplate">套用預設模板</a-button>
      </a-form-item>

      <a-divider />

      <a-row :gutter="[16, 16]">
        <a-col v-for="(lobby, idx) in form.lobbies" :key="idx" :span="12">
          <a-card :title="`第 ${idx + 1} 廳`" size="small">
            <a-form-item label="大廳名稱" required>
              <a-input v-model:value="lobby.lobbyName" placeholder="請輸入大廳名稱" />
            </a-form-item>

            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="點數比率 (Credit)" required>
                  <a-select
                    v-model:value="lobby.credit"
                    :options="creditOptions"
                    placeholder="請選擇"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="機台數 (1~300)" required>
                  <a-input-number
                    v-model:value="lobby.machinePerLobby"
                    :min="1"
                    :max="300"
                    :step="1"
                    style="width: 100%"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item>
              <a-checkbox v-model:checked="lobby.randomSeat">隨機座位</a-checkbox>
            </a-form-item>

            <a-collapse>
              <a-collapse-panel key="reserved" header="保留座時間 (VIP0~VIP4)">
                <a-row :gutter="12">
                  <a-col v-for="vip in [0, 1, 2, 3, 4]" :key="vip" :span="8">
                    <a-form-item :label="`VIP${vip}`">
                      <a-input-number
                        v-model:value="lobby.reservedTime[vip]"
                        :min="0"
                        :step="1"
                        style="width: 100%"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-collapse-panel>
            </a-collapse>
          </a-card>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup lang="tsx">
import { computed, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useTable } from '@/components/core/dynamic-table';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';
import ShareholderApi from '@/api/backend/adminAccount/shareholder';
import GameApi, { isExternalGame, type GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import SeatManagerApi, {
  type SeatManagerSetting,
  type SeatManagerLobby,
} from '@/api/backend/adminSystem/seatManager';

defineOptions({ name: 'AdminAccountMachineSettingPublic' });

type TableListItem = SeatManagerSetting & { gameName?: string };

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const loading = ref(false);
const shareholder = ref<string | undefined>(undefined);
const shareholderOptions = ref<Array<{ label: string; value: string }>>([]);

const filterList = ['0007', '0026', '0031', '0035', '0038', '0059']; // Vue2 既有排除清單

const gameOptions = ref<Array<{ label: string; value: string }>>([]);
const gameNameMap = ref<Record<string, string>>({});

const creditOptions = [
  { label: '1:1', value: 1 },
  { label: '1:100', value: 100 },
];

const modalOpen = ref(false);
const modalSubmitting = ref(false);
const modalMode = ref<'add' | 'edit' | 'all'>('add');

type LobbyForm = {
  lobbyName: string;
  credit: number | undefined;
  machinePerLobby: number | undefined;
  randomSeat: boolean;
  reservedTime: Record<number, number>;
};

const createDefaultLobby = (): LobbyForm => ({
  lobbyName: '',
  credit: 1,
  machinePerLobby: 100,
  randomSeat: false,
  reservedTime: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
});

const form = reactive<{
  id?: string;
  gameID?: string;
  lobbyCount: number;
  lobbies: LobbyForm[];
}>({
  id: undefined,
  gameID: undefined,
  lobbyCount: 1,
  lobbies: [createDefaultLobby()],
});

const modalTitle = computed(() => {
  if (modalMode.value === 'edit') return '編輯股東座位設定';
  if (modalMode.value === 'all') return '全遊戲套用股東座位設定';
  return '新增股東座位設定';
});

const normalizeGameName = (g: GameInfo) => {
  const base = String(g.gameName ?? '');
  const tw = g.language?.tw ? ` (${g.language.tw})` : '';
  return `${base}${tw}`.trim();
};

const loadShareholderOptions = async () => {
  const list = await ShareholderApi.getShareholderList({});
  const items = (Array.isArray(list) ? list : [])
    .filter((i: any) => i?.isMasterAccount)
    .map((i: any) => String(i.account ?? ''))
    .filter(Boolean);

  shareholderOptions.value = items.map((acc) => ({ label: acc, value: acc }));
};

const loadGameOptions = async () => {
  const list = await GameApi.globalGameList();
  const games = (Array.isArray(list) ? list : [])
    .filter((g: any) => g?.gameID)
    .filter((g: any) => !filterList.includes(String(g.gameID)))
    .filter((g: any) => !g?.race)
    .filter((g: any) => !isExternalGame(String(g.gameID)));

  const map: Record<string, string> = {};
  const opts = games
    .map((g: any) => {
      const gameID = String(g.gameID);
      const label = `${gameID} - ${normalizeGameName(g)}`;
      map[gameID] = label;
      return { label, value: gameID };
    })
    .sort((a, b) => Number(a.value) - Number(b.value));

  gameNameMap.value = map;
  gameOptions.value = opts;
};

const onShareholderChange = () => {
  tableInstance?.reload();
};

const loadTableData = async (_params: LoadDataParams) => {
  if (!shareholder.value) {
    return { items: [], meta: { totalItems: 0 } };
  }

  loading.value = true;
  try {
    const res: any = await SeatManagerApi.querySeatManagerSettings({
      shareholder: shareholder.value,
      pageSize: 99,
    });

    const settings: SeatManagerSetting[] = Array.isArray(res?.settings)
      ? res.settings
      : Array.isArray(res?.data?.settings)
        ? res.data.settings
        : [];

    const items: TableListItem[] = settings.map((s: any) => ({
      ...s,
      gameName: gameNameMap.value[String(s.gameID)] ?? String(s.gameID ?? ''),
    }));

    currentSettings.value = items;
    return { items, meta: { totalItems: items.length } };
  } finally {
    loading.value = false;
  }
};

const openModal = (mode: 'add' | 'edit' | 'all', record?: Partial<TableListItem>) => {
  modalMode.value = mode;
  modalOpen.value = true;
  modalSubmitting.value = false;

  form.id = undefined;
  form.gameID = undefined;
  form.lobbyCount = 1;
  form.lobbies = [createDefaultLobby()];

  if (mode === 'edit' && record) {
    form.id = record.id as any;
    form.gameID = String(record.gameID ?? '');
    const lobbyList = Array.isArray(record.lobbyList) ? record.lobbyList : [];
    form.lobbyCount = Math.min(Math.max(lobbyList.length || 1, 1), 4);
    form.lobbies = lobbyList.slice(0, form.lobbyCount).map((l: any) => {
      const nameObj = l?.name;
      const lobbyName =
        typeof nameObj === 'object'
          ? String(nameObj.tw ?? nameObj.default ?? '')
          : typeof nameObj === 'string'
            ? nameObj
            : '';

      const reserved = l?.reservedTime ?? {};
      return {
        lobbyName,
        credit: Number(l?.creditRate ?? 1),
        machinePerLobby: Number(l?.machinePerLobby ?? 100),
        randomSeat: Boolean(l?.randomSeat),
        reservedTime: {
          0: Number(reserved.vip0 ?? 0),
          1: Number(reserved.vip1 ?? 0),
          2: Number(reserved.vip2 ?? 0),
          3: Number(reserved.vip3 ?? 0),
          4: Number(reserved.vip4 ?? 0),
        },
      } as LobbyForm;
    });
    syncLobbyCount();
  }
};

const closeModal = () => {
  modalOpen.value = false;
};

const syncLobbyCount = () => {
  const count = Math.min(Math.max(Number(form.lobbyCount || 1), 1), 4);
  form.lobbyCount = count;
  if (!Array.isArray(form.lobbies)) form.lobbies = [];

  if (form.lobbies.length > count) {
    form.lobbies = form.lobbies.slice(0, count);
  } else {
    while (form.lobbies.length < count) {
      form.lobbies.push(createDefaultLobby());
    }
  }
};

const applyDefaultTemplate = () => {
  form.lobbies.forEach((l, idx) => {
    if (!l.lobbyName) l.lobbyName = `第${idx + 1}廳`;
    if (!l.credit) l.credit = 1;
    if (!l.machinePerLobby) l.machinePerLobby = 100;
  });
};

const validateModal = () => {
  if (!shareholder.value) throw new Error('請先選擇股東');
  if (modalMode.value !== 'all' && !form.gameID) throw new Error('請選擇遊戲');

  if (!form.lobbies.length) throw new Error('至少需要 1 個大廳設定');
  for (let i = 0; i < form.lobbies.length; i++) {
    const l = form.lobbies[i];
    if (!String(l.lobbyName ?? '').trim()) throw new Error(`第 ${i + 1} 廳：請輸入大廳名稱`);
    const m = Number(l.machinePerLobby);
    if (!Number.isInteger(m) || m < 1 || m > 300) throw new Error(`第 ${i + 1} 廳：機台數需為 1~300 的整數`);
    const c = Number(l.credit);
    if (![1, 100].includes(c)) throw new Error(`第 ${i + 1} 廳：請選擇點數比率`);
  }
};

const buildLobbyListPayload = (): SeatManagerLobby[] => {
  return form.lobbies.map((l) => {
    const reservedTime: Record<string, number> = {
      default: 0,
      vip0: Number(l.reservedTime?.[0] ?? 0),
      vip1: Number(l.reservedTime?.[1] ?? 0),
      vip2: Number(l.reservedTime?.[2] ?? 0),
      vip3: Number(l.reservedTime?.[3] ?? 0),
      vip4: Number(l.reservedTime?.[4] ?? 0),
    };

    return {
      name: {
        default: l.lobbyName,
        tw: l.lobbyName,
        cn: '',
        en: '',
        vi: '',
      },
      lobbyInfo: { description: '' },
      vipOnly: 0,
      machinePerLobby: Number(l.machinePerLobby ?? 100),
      reservedTime,
      creditRate: Number(l.credit ?? 1),
      randomSeat: Boolean(l.randomSeat),
    };
  });
};

const submitOne = async (gameID: string, id?: string) => {
  const lobbyList = buildLobbyListPayload();
  const machinesPerZone = Number(lobbyList?.[0]?.machinePerLobby ?? 100);
  const payload = {
    id,
    shareholder: shareholder.value as string,
    gameID,
    name: `${gameID} Setting`,
    machinesPerZone,
    lobbyList,
  };
  if (id) return SeatManagerApi.updateSeatManagerSettings(payload);
  return SeatManagerApi.createSeatManagerSettings(payload);
};

const submitModal = async () => {
  try {
    validateModal();
    modalSubmitting.value = true;

    if (modalMode.value === 'all') {
      const jobs = gameOptions.value.map((g) => {
        const gameID = g.value;
        const existed = currentSettings.value.find((r: any) => String(r.gameID) === String(gameID));
        return submitOne(gameID, existed?.id ? String(existed.id) : undefined);
      });
      await Promise.allSettled(jobs);
      message.success('已套用到全部遊戲');
    } else if (modalMode.value === 'edit') {
      await submitOne(String(form.gameID), form.id ? String(form.id) : undefined);
      message.success('更新成功');
    } else {
      await submitOne(String(form.gameID));
      message.success('新增成功');
    }

    closeModal();
    tableInstance?.reload();
  } catch (e: any) {
    message.error(e?.message || '操作失敗');
  } finally {
    modalSubmitting.value = false;
  }
};

const onDelete = async (record: TableListItem) => {
  if (!shareholder.value) return;
  Modal.confirm({
    title: '確認刪除',
    content: `確定要刪除 ${record.gameName || record.gameID} 的座位設定嗎？`,
    okText: '刪除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await SeatManagerApi.deleteSeatManagerSettings({
        id: String(record.id),
        shareholder: shareholder.value as string,
      });
      message.success('刪除成功');
      tableInstance?.reload();
    },
  });
};

const columns = ref<TableColumn<TableListItem>[]>([
  {
    title: '遊戲 ID',
    dataIndex: 'gameID',
    width: 110,
    hideInSearch: true,
  },
  {
    title: '遊戲名稱',
    dataIndex: 'gameName',
    hideInSearch: true,
  },
  {
    title: '機台數',
    dataIndex: 'machinesPerZone',
    width: 120,
    hideInSearch: true,
  },
  {
    title: '更新時間',
    dataIndex: 'updatedAt',
    width: 180,
    hideInSearch: true,
  },
  {
    title: '操作',
    dataIndex: 'ACTION',
    width: 180,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '編輯',
        type: 'link',
        onClick: () => openModal('edit', record),
      },
      {
        label: '刪除',
        type: 'link',
        danger: true,
        onClick: () => onDelete(record),
      },
    ],
  },
]);

const currentSettings = ref<TableListItem[]>([]);

onMounted(async () => {
  await Promise.all([loadShareholderOptions(), loadGameOptions()]);
});
</script>





