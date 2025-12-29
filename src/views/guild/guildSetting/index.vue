<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { GuildLevelItem } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { Modal, message } from 'ant-design-vue';
import { computed, nextTick, onMounted, ref } from 'vue';
import { cloneDeep } from 'lodash-es';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import {
  deleteGuildLevelsSetting,
  queryGuildCreateSetting,
  queryGuildLevelsSetting,
  setGuildCreateSetting,
  setGuildLevelsSetting,
  type ILevelSetting,
} from '@/api/backend/guildServer';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getColumns } from './columns';

defineOptions({
  name: 'GuildSetting',
});

const { t } = useI18n('page.guild');
const userStore = useUserStore();

// 查詢模式: 手動-> 0, 自動-> 1
const searchMode = ref<0 | 1>(1);
const decimalPlaces = 2; // 小數點位數

// 總代理選擇
const masterAgent = ref<string>('');
const masterAgentOptions = ref<DefaultOptionType[]>([]);
const isMasterAgentDisabled = computed(() => userStore.level >= 4);

// 表單數據
const guildSettingFormRef = ref();
const levelFormRef = ref();
const disableSubmit = ref(false);
const guildSettingData = ref<{
  preUser: string;
  createNeedCostCoins: number | null;
  oriCreateNeedCostCoins: number | null;
}>({
  preUser: '',
  createNeedCostCoins: null,
  oriCreateNeedCostCoins: null,
});

// 表格相關
const [DynamicTable, dynamicTableInstance] = useTable({
  formProps: { autoSubmitOnEnter: true, showAdvancedButton: false },
  search: false,
});
const tableData = ref<GuildLevelItem[]>([]);
const loading = ref(false);
const addLevelBtnDisabled = ref(false);
const usedLevel = ref<number[]>([]);

// 對話框相關
const dialogMode = ref<'add' | 'edit' | 'view'>('add');
const isDialogForm = ref(false);
const levelForm = ref<GuildLevelItem>({
  id: null,
  level: null,
  levelName: '',
  maxCounts: null,
  guildAccumulationFund: null,
  betFee: null,
  topUpFee: null,
  gameWinLoseFee: null,
});

// 列配置
const columns = computed(() => getColumns(t));

/**
 * 獲取總代理列表
 */
const fetchMasterAgents = async () => {
  const list = await getMasterAgentList();
  masterAgentOptions.value = (list || []).map(i => ({ label: i.account, value: i.account }));

  // 如果用戶等級 >= 4，自動選擇第一個總代理
  if (userStore.level >= 4 && list && list.length > 0) {
    masterAgent.value = list[0].account;
    await Promise.all([getGuildCreateSetting(), getGuildLevelsSetting()]);
  }
};

/**
 * 總代理變更處理
 */
const handleMasterAgentChange = async (value: string) => {
  masterAgent.value = value;
  if (searchMode.value === 1) {
    await getGuildCreateSetting();
    await getGuildLevelsSetting();
  }
};

/**
 * 獲取公會建立設定
 */
const getGuildCreateSetting = async () => {
  if (!masterAgent.value) return;

  guildSettingData.value = {
    preUser: '',
    createNeedCostCoins: null,
    oriCreateNeedCostCoins: null,
  };

  try {
    const res = await queryGuildCreateSetting({ masterAgent: masterAgent.value });
    if (res && res.result) {
      const data = res.result;
      guildSettingData.value.createNeedCostCoins = parseFloat(data.createNeedCostCoins);
      guildSettingData.value.oriCreateNeedCostCoins = parseFloat(data.createNeedCostCoins);
      guildSettingData.value.preUser = data.user;
    }
  } catch (error) {
    console.error('獲取公會建立設定失敗', error);
    message.error(t('loadFailed'));
  }
};

/**
 * 獲取公會等級設定
 */
const getGuildLevelsSetting = async () => {
  if (!masterAgent.value) {
    tableData.value = [];
    dynamicTableInstance?.reload();
    return;
  }

  addLevelBtnDisabled.value = true;
  loading.value = true;
  tableData.value = [];
  usedLevel.value = [];

  try {
    const res = await queryGuildLevelsSetting({ masterAgent: masterAgent.value });
    if (res && res.result) {
      const data = res.result;
      const levels: GuildLevelItem[] = [];

      data.forEach((item: any) => {
        const level = item.level * 1;
        const guildAccumulationFund = item.guildAccumulationFund ? item.guildAccumulationFund * 1 : null;
        usedLevel.value.push(level);
        levels.push({
          id: item.id,
          level: level,
          levelName: item.levelName,
          maxCounts: item.maxCounts * 1,
          guildAccumulationFund: guildAccumulationFund,
          betFee: item.betFee * 1,
          topUpFee: item.topUpFee * 1,
          gameWinLoseFee: item.gameWinLoseFee * 1,
        });
      });

      levels.sort((a, b) => (a.level || 0) - (b.level || 0));
      tableData.value = levels;
      dynamicTableInstance?.reload();
    }
  } catch (error) {
    console.error('獲取公會等級設定失敗', error);
    message.error(t('loadFailed'));
  } finally {
    addLevelBtnDisabled.value = false;
    loading.value = false;
  }
};

/**
 * 載入表格數據
 */
const loadTableData = async (params: LoadDataParams) => {
  if (!masterAgent.value) {
    return {
      ...params,
      items: [],
      total: 0,
    };
  }

  return {
    ...params,
    items: tableData.value,
    total: tableData.value.length,
  };
};

/**
 * 檢查是否有變更
 */
const checkDiff = computed(() => {
  if (
    guildSettingData.value.createNeedCostCoins &&
    guildSettingData.value.createNeedCostCoins.toString() !== guildSettingData.value.oriCreateNeedCostCoins?.toString()
  ) {
    return true;
  }
  return false;
});

/**
 * 提交公會設定表單
 */
const submitGuildSettingForm = async () => {
  try {
    await guildSettingFormRef.value?.validate();
    if (guildSettingData.value.createNeedCostCoins !== null) {
      disableSubmit.value = true;
      const postData = {
        masterAgent: masterAgent.value,
        user: userStore.name,
        createNeedCostCoins: truncateDecimals(guildSettingData.value.createNeedCostCoins).toFixed(decimalPlaces).toString(),
      };
      await setGuildCreateSetting(postData);
      message.success(t('updateSuccess'));
      await getGuildCreateSetting();
      setTimeout(() => {
        disableSubmit.value = false;
      }, 2000);
    }
  } catch (error) {
    console.error('驗證失敗', error);
  }
};

/**
 * 刷新按鈕
 */
const refreshBtn = async () => {
  await getGuildCreateSetting();
};

/**
 * 截斷小數點
 */
const truncateDecimals = (number: number) => {
  const multiplier = Math.pow(10, decimalPlaces);
  return (number * multiplier) / multiplier;
};

/**
 * 新增等級按鈕
 */
const addLevelBtn = () => {
  openDialog('add');
};

/**
 * 打開對話框
 */
const openDialog = async (mode: 'add' | 'edit' | 'view', data?: GuildLevelItem) => {
  isDialogForm.value = true;
  dialogMode.value = mode;
  await nextTick();
  levelFormRef.value?.resetFields();
  levelForm.value = {
    id: null,
    level: null,
    levelName: '',
    maxCounts: null,
    guildAccumulationFund: null,
    betFee: null,
    topUpFee: null,
    gameWinLoseFee: null,
  };

  if (mode === 'add') {
    setTimeout(() => {
      levelForm.value.level = tableData.value.length;
    }, 100);
  } else if (mode === 'edit' && data) {
    setTimeout(() => {
      const inData = cloneDeep(data);
      levelForm.value.id = inData.id;
      levelForm.value.level = inData.level;
      levelForm.value.levelName = inData.levelName;
      levelForm.value.maxCounts = inData.maxCounts;
      levelForm.value.guildAccumulationFund = inData.guildAccumulationFund;
      levelForm.value.betFee = inData.betFee;
      levelForm.value.topUpFee = inData.topUpFee;
      levelForm.value.gameWinLoseFee = inData.gameWinLoseFee;
    }, 100);
  }
};

/**
 * 關閉對話框
 */
const closeDialog = () => {
  dialogMode.value = 'add';
  isDialogForm.value = false;
};

/**
 * 新增/編輯等級
 */
const addLevel = async () => {
  try {
    await levelFormRef.value?.validate();
    if (
      (levelForm.value.level !== null || levelForm.value.level === 0) &&
      levelForm.value.maxCounts !== null &&
      (levelForm.value.betFee !== null || levelForm.value.betFee === 0) &&
      (levelForm.value.topUpFee !== null || levelForm.value.topUpFee === 0) &&
      (levelForm.value.gameWinLoseFee !== null || levelForm.value.gameWinLoseFee === 0)
    ) {
      const id = levelForm.value.id ? levelForm.value.id : undefined;
      const guildAccumulationFund = levelForm.value.guildAccumulationFund
        ? truncateDecimals(levelForm.value.guildAccumulationFund).toFixed(decimalPlaces).toString()
        : null;
      const postData: ILevelSetting = {
        id: id,
        masterAgent: masterAgent.value,
        level: levelForm.value.level!.toString(),
        levelName: levelForm.value.levelName,
        maxCounts: Number(levelForm.value.maxCounts),
        guildAccumulationFund: guildAccumulationFund,
        betFee: truncateDecimals(levelForm.value.betFee!).toFixed(decimalPlaces).toString(),
        topUpFee: truncateDecimals(levelForm.value.topUpFee!).toFixed(decimalPlaces).toString(),
        gameWinLoseFee: truncateDecimals(levelForm.value.gameWinLoseFee!).toFixed(decimalPlaces).toString(),
      };
      await setGuildLevelsSetting({ settings: [postData] });
      message.success(t('updateSuccess'));
      closeDialog();
      await getGuildLevelsSetting();
    }
  } catch (error) {
    console.error('驗證失敗', error);
  }
};

/**
 * 刪除等級
 */
const deleteLevel = (data: GuildLevelItem) => {
  const content = `${t('deleteConfirm')}：${t('label.level')} ${data.level}`;
  Modal.confirm({
    title: t('confirm'),
    content: content,
    okText: t('confirm'),
    cancelText: t('cancel'),
    onOk: async () => {
      try {
        await deleteGuildLevelsSetting({ ids: [data.id!] });
        message.success(t('deleteSuccess'));
        await getGuildLevelsSetting();
      } catch (error) {
        console.error('刪除失敗', error);
        message.error(t('deleteFailed'));
      }
    },
  });
};

/**
 * 等級變更處理
 */
const changeLevel = () => {
  if (!levelForm.value.level || levelForm.value.level < 1) {
    levelForm.value.guildAccumulationFund = null;
  }
};

/**
 * 表單驗證規則
 */
const getRules = () => {
  return {
    createNeedCostCoins: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!guildSettingData.value.createNeedCostCoins) {
            return Promise.reject(new Error(t('form.createNeedCostCoinsRequired')));
          }
          if (guildSettingData.value.createNeedCostCoins < 0) {
            return Promise.reject(new Error(t('form.createNeedCostCoinsInvalid')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    level: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          const int = /^\d+$/;
          if (dialogMode.value === 'add') {
            if (!value) {
              return Promise.reject(new Error(t('form.levelRequired')));
            }
            if (value < 0) {
              return Promise.reject(new Error(t('form.levelInvalid')));
            }
            if (!int.test(value)) {
              return Promise.reject(new Error(t('form.levelMustBeInteger')));
            }
            if (usedLevel.value.indexOf(Number(value)) !== -1) {
              return Promise.reject(new Error(t('form.levelDuplicate')));
            }
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    levelName: [
      {
        required: true,
        message: t('form.levelNameRequired'),
        trigger: 'change',
      },
    ],
    maxCounts: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          const int = /^\d+$/;
          if (!value) {
            return Promise.reject(new Error(t('form.maxCountsRequired')));
          }
          if (value <= 0 || !int.test(value)) {
            return Promise.reject(new Error(t('form.maxCountsInvalid')));
          }
          if (value > 200) {
            return Promise.reject(new Error(t('notify.maxCounts')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    guildAccumulationFund: [
      {
        validator: (_rule: any, value: any) => {
          if (!levelForm.value.guildAccumulationFund) {
            return Promise.resolve();
          }
          const int = /^(?!0\d)(0\.\d*[1-9]\d*|[1-9]\d*(\.\d+)?)$/;
          if (value <= 0 || !int.test(value)) {
            return Promise.reject(new Error(t('form.guildAccumulationFundInvalid')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    betFee: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (value <= 0) {
            return Promise.reject(new Error(t('form.betFeeInvalid')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    topUpFee: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (value < 0) {
            return Promise.reject(new Error(t('form.topUpFeeInvalid')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    gameWinLoseFee: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (value < 0) {
            return Promise.reject(new Error(t('form.gameWinLoseFeeInvalid')));
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
  };
};

onMounted(() => {
  fetchMasterAgents();
});
</script>

<template>
  <div v-if="userStore.level <= 3">
    <div class="mb-4">
      <div class="mb-4 flex items-center gap-4">
        <div class="input_group">
          <div class="txt">
            <label>{{ t('masterAgent') }}</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="masterAgent"
              :options="masterAgentOptions"
              :disabled="isMasterAgentDisabled"
              :placeholder="t('selectMasterAgent')"
              style="width: 200px"
              @change="handleMasterAgentChange"
            />
          </div>
        </div>
        <a-button v-if="searchMode !== 1" type="primary" @click="getGuildCreateSetting">
          {{ t('search') }}
        </a-button>
      </div>
    </div>

    <div class="guild-setting-container">
      <a-form
        ref="guildSettingFormRef"
        :model="guildSettingData"
        :label-col="{ style: { width: 'auto', minWidth: 'auto' } }"
        :wrapper-col="{ style: { flex: 1 } }"
        :rules="getRules()"
        label-align="left"
      >
        <div class="divA">
          <a-form-item :label="t('label.createNeedCostCoins')" name="createNeedCostCoins">
            <a-input-number
              v-model:value="guildSettingData.createNeedCostCoins"
              :min="0"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item :wrapper-col="{ offset: 0 }">
            <div class="form-actions">
              <a-button
                v-if="checkDiff"
                :disabled="disableSubmit"
                type="primary"
                @click="submitGuildSettingForm"
              >
                {{ t('update') }}
              </a-button>
              <a-button
                v-if="checkDiff"
                @click="refreshBtn"
              >
                {{ t('refresh2') }}
              </a-button>
              <a-button
                v-if="!checkDiff"
                @click="refreshBtn"
              >
                {{ t('refresh2') }}
              </a-button>
            </div>
          </a-form-item>
        </div>

        <div class="divA table-container">
          <a-form-item :label="t('label.guildLevelsSetting')">
            <a-button type="primary" :disabled="addLevelBtnDisabled" @click="addLevelBtn">
              {{ t('add') }}
            </a-button>
          </a-form-item>
          <div class="table-wrapper">
          <DynamicTable
            row-key="id"
            :header-title="t('title')"
            :columns="columns"
            :data-request="loadTableData"
            :loading="loading"
            :pagination="false"
            :scroll="{ x: 'max-content' }"
            :show-search="false"
          >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'ACTION'">
                  <a-space>
                    <a-button type="link" size="small" @click="openDialog('edit', record)">
                      {{ t('edit') }}
                    </a-button>
                    <a-button
                      type="link"
                      size="small"
                      danger
                      :disabled="tableData.length !== ((record.level || 0) + 1)"
                      @click="deleteLevel(record)"
                    >
                      {{ t('delete') }}
                    </a-button>
                  </a-space>
                </template>
              </template>
            </DynamicTable>
          </div>
        </div>
      </a-form>
    </div>

    <!-- 等級設定對話框 -->
    <a-modal
      v-model:open="isDialogForm"
      :title="dialogMode === 'add' ? t('formTitle.add') : dialogMode === 'edit' ? t('formTitle.edit') : t('formTitle.view')"
      width="800px"
      :mask-closable="false"
      @cancel="closeDialog"
    >
      <a-form
        ref="levelFormRef"
        :model="levelForm"
        :label-col="{ span: 6, style: { textAlign: 'left', width: '180px', minWidth: '180px' } }"
        :wrapper-col="{ span: 18, style: { flex: 1 } }"
        label-align="left"
        :rules="getRules()"
      >
        <a-form-item :label="t('label.level')" name="level">
          <a-input-number
            v-model:value="levelForm.level"
            :disabled="true"
            style="width: 100%"
            @change="changeLevel"
          />
        </a-form-item>
        <a-form-item :label="t('label.levelName')" name="levelName">
          <a-input v-model:value="levelForm.levelName" :disabled="dialogMode === 'view'" />
        </a-form-item>
        <a-form-item :label="t('label.maxCounts')" name="maxCounts">
          <a-input-number
            v-model:value="levelForm.maxCounts"
            :min="1"
            :max="200"
            style="width: 100%"
            :disabled="dialogMode === 'view'"
          />
        </a-form-item>
        <a-form-item
          v-if="levelForm.level && levelForm.level > 0"
          :label="t('label.guildAccumulationFund')"
          name="guildAccumulationFund"
        >
          <a-input-number
            v-model:value="levelForm.guildAccumulationFund"
            :min="0"
            style="width: 100%"
            :disabled="dialogMode === 'view'"
          />
        </a-form-item>
        <a-form-item :label="t('label.betFee')" name="betFee">
          <a-input-number
            v-model:value="levelForm.betFee"
            :min="0"
            style="width: 100%"
            :disabled="dialogMode === 'view'"
          />
        </a-form-item>
        <a-form-item :label="t('label.topUpFee')" name="topUpFee">
          <a-input-number
            v-model:value="levelForm.topUpFee"
            :min="0"
            style="width: 100%"
            :disabled="dialogMode === 'view'"
          />
        </a-form-item>
        <a-form-item :label="t('label.gameWinLoseFee')" name="gameWinLoseFee">
          <a-input-number
            v-model:value="levelForm.gameWinLoseFee"
            :min="0"
            style="width: 100%"
            :disabled="dialogMode === 'view'"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeDialog">
          {{ t('cancel') }}
        </a-button>
        <a-button v-if="dialogMode !== 'view'" type="primary" :disabled="disableSubmit" @click="addLevel">
          {{ t('save') }}
        </a-button>
      </template>
    </a-modal>
  </div>
  <div v-else>
    <a-alert :message="t('noPermission')" type="warning" show-icon />
  </div>
</template>

<style lang="less" scoped>
.guild-setting-container {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

:deep(.ant-form-item-label) {
  padding-right: 8px !important;
  width: auto !important;
  flex: 0 0 auto !important;
}

:deep(.ant-form-item) {
  margin-bottom: 16px;
  display: flex !important;
  align-items: center;
}

:deep(.ant-form-item-label > label) {
  width: auto !important;
  margin-right: 8px;
  white-space: nowrap;
}

:deep(.ant-form-item-control) {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.ant-modal .ant-form-item-label) {
  width: 180px !important;
  min-width: 180px !important;
  max-width: 180px !important;
  flex: 0 0 180px !important;
  padding-right: 16px !important;
  text-align: left !important;
}

:deep(.ant-modal .ant-form-item-label > label) {
  white-space: nowrap !important;
  word-break: keep-all !important;
  overflow: visible !important;
  text-overflow: clip !important;
  text-align: left !important;
  justify-content: flex-start !important;
  display: flex !important;
}

:deep(.ant-modal .ant-form-item) {
  display: flex !important;
  align-items: flex-start !important;
}

:deep(.ant-modal .ant-form-item-control) {
  flex: 1 !important;
  min-width: 0 !important;
}

.divA {
  border: solid gray;
  border-radius: 20px;
  display: block;
  height: 100%;
  width: 100%;
  padding: 10px;
  margin-bottom: 5px;
  box-sizing: border-box;
}

.table-container {
  overflow: visible;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
}

.input_group {
  display: flex;
  align-items: center;
  gap: 8px;

  .txt {
    min-width: 80px;
    text-align: right;

    label {
      margin: 0;
      font-weight: normal;
    }
  }

  .my_input {
    width: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>

