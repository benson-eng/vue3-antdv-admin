<script setup lang="ts">
import type { Rule } from 'ant-design-vue/es/form';
import type { ISettings, StationMasterItem } from '@/api/backend/agentHubManager';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  editAgentSettings,
  queryAgent,
  queryStationMaster,
  setDefaultAgent,
} from '@/api/backend/agentHubManager';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getDefDistAcctSettings } from '@/utils/setDefaultData';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';

defineOptions({
  name: 'DistAcctFamilySetting',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const { t } = useI18n('page.distAcctFamilySetting');
const userStore = useUserStore();

const permissionsLevel = 4;

// ============ Breadcrumb 站長來源 ============
// 從 Breadcrumb 注入取得站長選單狀態
const masterAgentCtx = inject<{
  selectedMasterAgent: { value: string | undefined };
} | undefined>(MASTER_AGENT_SELECT_KEY);

// masterAgent 由 Breadcrumb 注入
const masterAgent = ref('');

// 同步 Breadcrumb 的 selectedMasterAgent 到 masterAgent
watch(
  () => masterAgentCtx?.selectedMasterAgent.value,
  (newValue) => {
    masterAgent.value = newValue || '';
  },
  { immediate: true },
);

// ============ 表格資料 ============
interface FamilyRowData extends StationMasterItem {
  pk?: string;
  Purchase?: string;
  PurchaseServiceCost?: string;
  ServiceFee?: string;
  SMSServiceCost?: string;
  Bonus?: string;
  GameWinLose?: string;
  enabled?: boolean;
  isDefault?: boolean;
  unions?: any[];
  commissionSettings?: any[];
  id?: number;
}

const dataTableLoading = ref(false);

// ============ 對話框 ============
const isDialog = ref(false);
const mode = ref<'add' | 'edit' | 'view'>('add');
const disabledMode = ref(false);

interface DialogForm {
  Purchase: string;
  PurchaseServiceCost: string;
  ServiceFee: string;
  SMSServiceCost: string;
  Bonus: string;
  GameWinLose: string;
}

const dialogForm = ref<DialogForm>({
  Purchase: '',
  PurchaseServiceCost: '',
  ServiceFee: '',
  SMSServiceCost: '',
  Bonus: '',
  GameWinLose: '',
});

const dialogFormDisabled = ref<Record<keyof DialogForm, boolean>>({
  Purchase: false,
  PurchaseServiceCost: false,
  ServiceFee: false,
  SMSServiceCost: false,
  Bonus: false,
  GameWinLose: false,
});

const dialogFamily = ref<string>('');

/**
 * ============ 工具函數 ============
 */
function getDefaultDialogForm(): DialogForm {
  return {
    Purchase: '',
    PurchaseServiceCost: '',
    ServiceFee: '',
    SMSServiceCost: '',
    Bonus: '',
    GameWinLose: '',
  };
}

function getDefaultDialogFormDisabled(): Record<keyof DialogForm, boolean> {
  return {
    Purchase: false,
    PurchaseServiceCost: false,
    ServiceFee: false,
    SMSServiceCost: false,
    Bonus: false,
    GameWinLose: false,
  };
}

/**
 * ============ 驗證規則 ============
 */
const validatePercentage = (_rule: any, value: string, callback: any) => {
  const int = /^(?:0|[1-9][0-9]?|100)$/;
  if ((value !== '' && !int.test(value.toString())) || value === '') {
    callback(new Error('請輸入 0~100 的整數'));
  }
  else {
    callback();
  }
};

const rules = computed<Record<string, Rule[]>>(() => ({
  Purchase: [{ required: true, validator: validatePercentage, trigger: 'change' }],
  PurchaseServiceCost: [{ required: true, validator: validatePercentage, trigger: 'change' }],
  ServiceFee: [{ required: true, validator: validatePercentage, trigger: 'change' }],
  SMSServiceCost: [{ required: true, validator: validatePercentage, trigger: 'change' }],
  Bonus: [{ required: true, validator: validatePercentage, trigger: 'change' }],
  GameWinLose: [{ required: true, validator: validatePercentage, trigger: 'change' }],
}));

/**
 * ============ API 調用 ============
 */

// 使用 ref 存儲 dynamicTableInstance，避免定義順序問題
const dynamicTableInstanceRef = ref<any>(null);

/**
 * ============ 對話框操作 ============
 */
const openDialog = (modeType: 'add' | 'edit' | 'view', data?: FamilyRowData) => {
  mode.value = modeType;
  isDialog.value = true;
  dialogForm.value = getDefaultDialogForm();
  dialogFormDisabled.value = getDefaultDialogFormDisabled();
  disabledMode.value = modeType === 'view' || userStore.level > 3;

  if (modeType !== 'add' && data) {
    dialogFamily.value = data.name || '';
    if (data.commissionSettings && data.commissionSettings.length > 0) {
      data.commissionSettings.forEach((item: any) => {
        const key = item.name as keyof DialogForm;
        if (key in dialogForm.value) {
          dialogForm.value[key] = (item.percentage * 100).toString();
        }

        const today = new Date();
        const itemDate = new Date(item.updatedAt);
        const isToday
          = itemDate.getFullYear() === today.getFullYear()
            && itemDate.getMonth() === today.getMonth()
            && itemDate.getDate() === today.getDate();

        if (isToday && key in dialogFormDisabled.value) {
          dialogFormDisabled.value[key] = true;
        }
      });
    }
  }
};

const closeDialog = () => {
  isDialog.value = false;
};

const dialogConfirm = async () => {
  try {
    dataTableLoading.value = true;
    let settings: ISettings[] = getDefDistAcctSettings(masterAgent.value, 'family', dialogFamily.value);
    settings = settings.map((item) => {
      const key = item.name as keyof DialogForm;
      if (key in dialogForm.value) {
        return {
          ...item,
          percentage: Number.parseFloat(dialogForm.value[key]) * 0.01,
        };
      }
      return item;
    });

    const postData = { settings };
    await editAgentSettings(postData);
    message.success('更新成功');
    closeDialog();
    // 觸發 table 重新載入資料
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
  catch (error) {
    console.error('Failed to update settings:', error);
    message.error('更新失敗');
  }
  finally {
    dataTableLoading.value = false;
  }
};

const setDefault = () => {
  const data = getDefDistAcctSettings(masterAgent.value, 'family');
  data.forEach((item: ISettings) => {
    const key = item.name as keyof DialogForm;
    if (key in dialogForm.value) {
      dialogForm.value[key] = (item.percentage * 100).toString();
    }
  });
};

/**
 * ============ 表格操作 ============
 */
const onEditBtnHandler = (data: FamilyRowData) => {
  let modeType: 'add' | 'edit' | 'view' = 'edit';
  if (userStore.level > 2) {
    modeType = 'view';
  }
  openDialog(modeType, data);
};

const isDefaultSwitch = async (data: FamilyRowData) => {
  try {
    dataTableLoading.value = true;
    const postData = {
      stationMasterName: masterAgent.value,
      name: data.name || '',
    };
    await setDefaultAgent(postData);
    message.success('更新成功');
    // 觸發 table 重新載入資料
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
  catch (error) {
    console.error('Failed to set default agent:', error);
    message.error('更新失敗');
  }
  finally {
    dataTableLoading.value = false;
  }
};

// ============ 表格配置 ============
const columns = computed<TableColumn<FamilyRowData>[]>(() => {
  const cols: TableColumn<FamilyRowData>[] = [];

  // 基本欄位：族長名稱
  cols.push({
    title: t('label.family'),
    dataIndex: 'name',
    width: 200,
    align: 'left',
  });

  // 抽成相關欄位
  // 數字欄位使用右對齊，與 Vue2 的 DataTable 一致
  cols.push(
    {
      title: t('label.Purchase'),
      dataIndex: 'Purchase',
      width: 120,
      align: 'right',
    },
    {
      title: t('label.PurchaseServiceCost'),
      dataIndex: 'PurchaseServiceCost',
      width: 150,
      align: 'right',
    },
    {
      title: t('label.ServiceFee'),
      dataIndex: 'ServiceFee',
      width: 120,
      align: 'right',
    },
    {
      title: t('label.SMSServiceCost'),
      dataIndex: 'SMSServiceCost',
      width: 150,
      align: 'right',
    },
    {
      title: t('label.Bonus'),
      dataIndex: 'Bonus',
      width: 120,
      align: 'right',
    },
    {
      title: t('label.GameWinLose'),
      dataIndex: 'GameWinLose',
      width: 150,
      align: 'right',
    },
  );

  // 操作欄位：直接添加到 columns 中，避免重複操作列
  cols.push({
    title: '操作',
    dataIndex: 'ACTION',
    width: 300,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => {
      const actions: any[] = [];

      // 設為預設按鈕
      if (record.isDefault) {
        actions.push({
          label: record.isDefault ? t('isDefault.disable') : t('isDefault.enable'),
          type: 'link',
          disabled: record.isDefault || false,
          onClick: () => isDefaultSwitch(record as FamilyRowData),
        });
      }

      // 編輯/查看按鈕
      actions.push({
        label: userStore.level <= 3 ? t('edit') : t('view'),
        type: 'link',
        onClick: () => onEditBtnHandler(record as FamilyRowData),
      });

      return actions;
    },
  });

  return cols;
});

const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
  showActionColumn: false, // 明確禁用默認操作列，因為我們在 columns 中已經添加了操作欄位
});

// 將 dynamicTableInstance 存儲到 ref 中
dynamicTableInstanceRef.value = dynamicTableInstance;

// ============ Scroll 配置（動態計算 scroll.y）============
// 類型 A（無搜尋區頁面）：依據 table container 的實際位置計算 scroll.y
const tableScrollY = ref(400);

/**
 * 更新表格高度：依據 table container 的實際位置計算
 */
function updateTableHeight() {
  if (typeof window === 'undefined') {
    return;
  }

  const tableTop = document
    .querySelector('.app-container')
    ?.getBoundingClientRect()
    .top || 0;

  tableScrollY.value = window.innerHeight - tableTop - 120;
}

/**
 * loadTableData 直接負責呼叫 queryStationMaster 或 queryAgent
 * 並回傳 { items: agents, meta: { totalItems: agents.length } }
 */
const loadTableData = async () => {
  console.log('=== loadTableData 開始 ===');
  console.log('userStore.level:', userStore.level);
  console.log('masterAgent.value:', masterAgent.value);

  // 如果沒有 masterAgent，返回空資料
  if (!masterAgent.value) {
    console.log('⚠️ masterAgent 為空，返回空資料');
    dataTableLoading.value = false;
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }

  dataTableLoading.value = true;

  try {
    const agents: FamilyRowData[] = [];

    // 根據 userStore.level 決定查詢方式
    if (userStore.level <= 3) {
      // level <= 3: 使用 queryStationMaster 查詢該站長下的所有族長
      const postData = { name: masterAgent.value };
      console.log('📤 呼叫 queryStationMaster, postData:', postData);
      const response = await queryStationMaster(postData) as any;
      console.log('📥 queryStationMaster 回應 (完整):', response);

      // 檢查是否有錯誤
      if (!response || response.error) {
        if (response && response.error) {
          console.error('❌ queryStationMaster error:', response.error);
        }
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 提取 agents 資料（queryStationMaster 返回 { value: { agents: [...] } }）
      const rawAgents = response.value?.agents || response.data?.value?.agents || [];
      console.log('📋 提取的 rawAgents:', rawAgents);

      // 處理 agents 資料
      if (rawAgents && Array.isArray(rawAgents)) {
        console.log('✅ 開始處理 agents 資料，共', rawAgents.length, '筆');
        rawAgents.forEach((item: any) => {
          const one: FamilyRowData = { ...item };
          // 處理 commissionSettings
          if (item.commissionSettings && item.commissionSettings.length > 0) {
            item.commissionSettings.forEach((setting: any) => {
              (one as any)[setting.name] = (setting.percentage * 100).toString();
            });
          }
          // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
          one.pk = item.name || `family-${item.id || Math.random()}`;
          agents.push(one);
        });
      }
    }
    else {
      // level > 3: 查詢單一族長
      const family = userStore.account || '';
      if (!family) {
        console.log('⚠️ family 為空，返回空資料');
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      const postData = {
        stationMasterName: masterAgent.value,
        name: family,
      };
      console.log('📤 呼叫 queryAgent (查詢單一族長), postData:', postData);
      const response = await queryAgent(postData) as any;
      console.log('📥 queryAgent 回應 (完整):', response);

      // 檢查是否有錯誤
      if (!response || response.error) {
        if (response && response.error) {
          console.error('❌ queryAgent error:', response.error);
        }
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 提取 agent 資料
      const agentData = response.data?.value || response.value;
      console.log('📋 提取的 agentData:', agentData);

      // 處理 agent 資料
      if (agentData) {
        console.log('✅ 開始處理 agent 資料');
        const one: FamilyRowData = { ...agentData };
        // 處理 commissionSettings
        if (agentData.commissionSettings && agentData.commissionSettings.length > 0) {
          agentData.commissionSettings.forEach((setting: any) => {
            (one as any)[setting.name] = (setting.percentage * 100).toString();
          });
        }
        // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
        one.pk = agentData.name || `family-${agentData.id || Math.random()}`;
        agents.push(one);
      }
    }

    console.log('📊 處理完成，agents 總數:', agents.length);

    dataTableLoading.value = false;

    const result = {
      items: agents,
      meta: { totalItems: agents.length },
    };
    console.log('📤 返回結果:', result);
    console.log('=== loadTableData 結束 ===');
    return result;
  }
  catch (error) {
    console.error('❌ Failed to load table data:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    dataTableLoading.value = false;
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }
};

// ============ 監聽 Breadcrumb 站長切換 ============
watch(masterAgent, async (newValue) => {
  // 當 masterAgent 有值時，觸發表格載入
  if (newValue) {
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
});

// ============ 初始化 ============
// 確保頁面載入時，如果 masterAgent 已經有值，自動載入資料
onMounted(async () => {
  if (userStore.level === 4) {
    disabledMode.value = true;
  }
  // 初始化表格高度
  await nextTick();
  updateTableHeight();

  // 監聽視窗大小變化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateTableHeight);
  }

  await nextTick();
  // 如果 masterAgent 已經有值，觸發表格載入
  if (masterAgent.value && dynamicTableInstanceRef.value) {
    await dynamicTableInstanceRef.value.reload?.();
  }
});

// 清理視窗監聽器
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateTableHeight);
  }
});

/**
 * ============ SearchMode 狀態顯示 ============
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 本頁為 search: false（無搜尋區），所有查詢皆為後端 API
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
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
</script>

<template>
  <div class="app-container">
    <div v-if="userStore.level <= permissionsLevel" class="app-container">
      <!-- 表格 -->
      <DynamicTable
        row-key="pk"
        :columns="columns"
        :data-request="loadTableData"
        :loading="dataTableLoading"
        :show-action-column="false"
        :scroll="{ x: 'max-content', y: tableScrollY }"
        :immediate="false"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('label.family') }}設定</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>

      <!-- 編輯對話框 -->
      <a-modal
        v-model:open="isDialog"
        :title="`${mode === 'add' ? t('add') : mode === 'edit' ? t('edit') : t('view')} ${t('label.areaTitle2')}`"
        :width="800"
        @cancel="closeDialog"
      >
        <a-form
          :model="dialogForm"
          :rules="rules"
          :label-col="{ span: 8 }"
          :wrapper-col="{ span: 16 }"
        >
          <a-row :gutter="20">
            <a-col :span="12">
              <a-form-item :label="t('label.Purchase')" name="Purchase">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.Purchase ? Number.parseFloat(dialogForm.Purchase) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.Purchase"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.Purchase = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.Purchase }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('label.PurchaseServiceCost')" name="PurchaseServiceCost">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.PurchaseServiceCost ? Number.parseFloat(dialogForm.PurchaseServiceCost) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.PurchaseServiceCost"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.PurchaseServiceCost = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.PurchaseServiceCost }}</span>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="20">
            <a-col :span="12">
              <a-form-item :label="t('label.ServiceFee')" name="ServiceFee">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.ServiceFee ? Number.parseFloat(dialogForm.ServiceFee) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.ServiceFee"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.ServiceFee = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.ServiceFee }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('label.SMSServiceCost')" name="SMSServiceCost">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.SMSServiceCost ? Number.parseFloat(dialogForm.SMSServiceCost) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.SMSServiceCost"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.SMSServiceCost = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.SMSServiceCost }}</span>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="20">
            <a-col :span="12">
              <a-form-item :label="t('label.GameWinLose')" name="GameWinLose">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.GameWinLose ? Number.parseFloat(dialogForm.GameWinLose) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.GameWinLose"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.GameWinLose = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.GameWinLose }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('label.Bonus')" name="Bonus">
                <a-input-number
                  v-if="!disabledMode"
                  :value="dialogForm.Bonus ? Number.parseFloat(dialogForm.Bonus) : undefined"
                  :min="0"
                  :max="100"
                  :disabled="dialogFormDisabled.Bonus"
                  style="width: 100%"
                  @update:value="(val) => { dialogForm.Bonus = val !== null && val !== undefined ? val.toString() : ''; }"
                />
                <span v-else>{{ dialogForm.Bonus }}</span>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <template #footer>
          <div class="dialog-footer">
            <a-button v-if="!disabledMode" type="primary" @click="dialogConfirm">
              {{ t('confirm') }}
            </a-button>
            <a-button v-if="!disabledMode" @click="setDefault">
              {{ t('label.setDefault') }}
            </a-button>
            <a-button @click="closeDialog">
              {{ t('cancel') }}
            </a-button>
          </div>
        </template>
      </a-modal>
    </div>
    <div v-else>
      <a-result status="403" title="403" sub-title="您沒有權限訪問此頁面" />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  overflow: hidden;
  min-height: 0; /* 讓 table scroll.y 成為唯一 Y 軸 */
}

.dialog-footer {
  display: flex !important;
  justify-content: center !important;
  padding: 10px 0;
}
</style>
