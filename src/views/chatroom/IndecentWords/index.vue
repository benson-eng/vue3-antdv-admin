<script setup lang="ts">
import type { Rule } from 'ant-design-vue/es/form';
import type { TableListItem } from './columns';
import type { ExcelData } from '@/components/basic/excel';

import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';
import { computed, h, inject, nextTick, onMounted, reactive, ref, watch } from 'vue';
import {
  addIndecentWords,
  queryIndecentWords,
  removeIndecentWords,
  updateIndecentWords,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import { ImpExcel } from '@/components/basic/excel';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { getBaseColumns } from './columns';
import { useTableConfig } from './useTableConfig';

defineOptions({
  name: 'ChatroomIndecentWords',
});

const { t } = useI18n('page.IndecentWords');
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * ============ Context 整合 ============
 * 判定：Reader（完全依賴 Breadcrumb Context 的 masterAgent）
 * - 從 Context 讀取 selectedMasterAgent
 * - 當 Context 變化時，自動 reload 表格資料
 * - 此頁面已關閉搜尋區，完全使用自動查詢模式
 */
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 從 Context 取得當前選取的站長值
const contextMasterAgent = computed(() => {
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  return '';
});

// 監聽 Context 版本變化（用於自動 reload）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

enum ModeType {
  ADD = 'add',
  EDIT = 'edit',
  VIEW = 'view',
}

enum ContentStatus {
  ORI = 'ori',
  NEW = 'new',
  DEL = 'del',
}

interface ContentItem {
  ori: string;
  value: string;
  status: ContentStatus;
}

// DataListItem 已從 columns.tsx 導入，使用 TableListItem 作為類型別名
type DataListItem = TableListItem;

// ============ 狀態管理 ============
const emptyMessage = ref(false);

// Dialog 狀態
const isDialogShow = ref(false);
const mode = ref<ModeType>(ModeType.ADD);
const form = reactive<{
  setString: string;
  content: ContentItem[];
}>({
  setString: '',
  content: [],
});
const formRef = ref();

// Excel 導入相關
const isExcelImport = ref(false);
const excelImportErr = ref<Array<{ msg: string }>>([]);
const isDialogExcelErrShow = ref(false);
const isReplaceAll = ref(false);

const getAuthLevel = computed(() => userStore.level);

const getI18nText = (path: string, params: Record<string, any> = {}) => {
  return t(path, params);
};

const defaultForm = () => {
  return {
    setString: '',
    content: [] as ContentItem[],
  };
};

// ============ 表格配置 ============
// 使用分離的 columns.tsx
// 注意：站長欄位已移除，改為使用 Breadcrumb Context 自動 reload
const allColumns = computed(() => getBaseColumns(getI18nText, getAuthLevel.value));
const tableConfig = useTableConfig(allColumns);
const columns = tableConfig.visibleColumns;

// ============ 表格 ============
// 搜尋主控權：自動查詢模式（使用 Breadcrumb Context 的 masterAgent 自動 reload）
// 注意：tableInstance 需要在其他函數之前定義，因為 checkContent 等函數會使用它
const [DynamicTable, tableInstance] = useTable({
  search: false, // 關閉搜尋區（使用 Breadcrumb Context 自動 reload）
  immediate: false, // 不立即請求，等待 Context 準備好後再觸發
  showActionColumn: true,
  exportFileName: 'IndecentWords',
  actionColumn: {
    title: t('actions'),
    width: 150,
    fixed: 'right',
    actions: ({ record, index }) => {
      const actions = extraData.value[index] || [];
      return actions.map((action: any) => ({
        ...action,
        onClick: () => action.onClick(record),
      }));
    },
  },
});

const extraData = ref<any[]>([]);

const extraDataInit = (dataList: DataListItem[]) => {
  const control: any[] = [];
  dataList.forEach((row) => {
    const actions: any[] = [
      {
        label: t('delete'),
        type: 'link', // 使用文字連結模式
        danger: true, /**
                       * 刪除操作使用 danger 樣式
                       */
        onClick: () => removeIndecentWordsHandler([row.value]),
      },
    ];
    control.push(actions);
  });
  extraData.value = control;
};

/**
 * ============ 工具函數 ============
 */
const controlDialogShow = (isShow: boolean) => {
  isDialogShow.value = isShow;
};

const beforeDialogClose = () => {
  controlDialogShow(false);
  Object.assign(form, defaultForm());
  isReplaceAll.value = false;
  nextTick(() => {
    formRef.value?.clearValidate();
    formRef.value?.resetFields();
  });
};

const getFormTitle = () => {
  switch (mode.value) {
    case ModeType.ADD:
      return getI18nText('title.add');
    case ModeType.EDIT:
      return getI18nText('title.edit');
    case ModeType.VIEW:
      return getI18nText('title.view');
    default:
      return '';
  }
};

const checkContent = (): number => {
  // 從表格實例獲取當前資料列表
  const currentData = (tableInstance?.tableData as any) || [];
  let re = currentData.map((el: any) => el.value).indexOf(form.setString.trim());
  if (re === -1) {
    re = form.content.map(el => el.value).indexOf(form.setString.trim());
  }
  return re;
};

/**
 * ============ 表單驗證規則 ============
 */
const getRules = (): Record<string, Rule[]> => {
  return {
    setString: [
      {
        required: true,
        validator: (_rule: Rule, value: string) => {
          return new Promise((resolve, reject) => {
            const check = /^[a-zA-Z0-9\u4E00-\u9FA5\u3105-\u3129]*$/;
            if (checkContent() !== -1) {
              reject(new Error(getI18nText('rule.setString')));
              return;
            }
            if (!check.test(form.setString.trim())) {
              reject(new Error(getI18nText('rule.setString2')));
              return;
            }
            resolve(true);
          });
        },
        trigger: 'change',
      },
    ],
  };
};

/**
 * ============ 事件處理 ============
 */
const onCreateBtnClick = (content?: DataListItem[]) => {
  mode.value = ModeType.ADD;
  controlDialogShow(true);
  Object.assign(form, defaultForm());
  if (content) {
    content.forEach((item) => {
      form.content.push({
        ori: '',
        value: cloneDeep(item.value),
        status: ContentStatus.NEW,
      });
    });
  }
  else {
    isReplaceAll.value = false;
  }
};

const addContentBtn = () => {
  const check = /^[a-zA-Z0-9\u4E00-\u9FA5\u3105-\u3129]*$/;
  if (form.setString.trim().length > 0) {
    const checkIndex = checkContent();
    if (check.test(form.setString.trim())) {
      if (checkIndex === -1) {
        form.content.push({
          ori: '',
          value: cloneDeep(form.setString.trim()),
          status: ContentStatus.NEW,
        });
        form.setString = '';
      }
    }
  }
};

const contentDel = (row: ContentItem) => {
  if (row.ori === '') {
    form.content = form.content.filter(item => item.value !== row.value);
  }
  else {
    row.status = ContentStatus.DEL;
  }
};

const onFormConfirm = async () => {
  try {
    await formRef.value?.validate();
    switch (mode.value) {
      case ModeType.ADD:
        if (isReplaceAll.value === true) {
          return await updateIndecentWordsHandler();
        }
        else {
          return await addIndecentWordsHandler();
        }
      case ModeType.EDIT:
      default:
        throw new Error('unknown form state');
    }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form:', error);
  }
};

/**
 * ============ API 調用 ============
 */
interface TableListResponse {
  items: DataListItem[];
  meta: { totalItems: number };
}

/**
 * 載入表格資料（DynamicTable data-request）
 * 搜尋主控權：自動查詢模式（使用 Breadcrumb Context 的 masterAgent 自動 reload）
 * Context 整合：完全依賴 Context 的 masterAgent（不再使用搜尋表單）
 *
 * 架構規範：純函數設計
 * - 僅負責 API 呼叫與資料轉換
 * - 不修改 reactive 狀態
 * - 不執行副作用操作
 */
const loadTableData = async (_params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  // Context 整合：完全使用 Context 的 masterAgent（此頁面已關閉搜尋區）
  const finalMasterAgent = contextMasterAgent.value;

  // 自動查詢模式：如果 Context 沒有選擇站長，返回空列表
  if (!finalMasterAgent) {
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }

  try {
    const res = await queryIndecentWords({ masterAgent: finalMasterAgent });
    /**
     * 處理不同的回應格式：
     * 可能是 { data: { indecentWords: [...] } } 或直接是 { indecentWords: [...] }
     */
    let indecentWordsData: string[] = [];
    if (res) {
      if (res.data && res.data.indecentWords && Array.isArray(res.data.indecentWords)) {
        indecentWordsData = res.data.indecentWords;
      }
      else if (res.indecentWords && Array.isArray(res.indecentWords)) {
        indecentWordsData = res.indecentWords;
      }
    }

    // 純函數：僅進行資料轉換，不修改狀態
    const dataList: DataListItem[] = [];
    if (indecentWordsData.length > 0) {
      indecentWordsData.forEach((item: string, index: number) => {
        dataList.push({
          seq: index + 1,
          value: item,
        });
      });
    }

    // 返回資料，狀態修改在外部處理
    return {
      items: dataList,
      meta: { totalItems: dataList.length },
    };
  }
  catch (error) {
    console.error('Failed to query indecent words:', error);
    message.error(t('fail'));
    return {
      items: [],
      meta: { totalItems: 0 },
    };
  }
};

/**
 * 監聽表格資料變化，更新動作欄和空訊息狀態
 * 將原本在 loadTableData 內的狀態修改移至外部，確保 loadTableData 為純函數
 */
watch(
  () => {
    // 從表格實例獲取資料（tableData 可能是 ref 或直接是陣列）
    const tableData = tableInstance?.tableData;
    if (tableData && typeof tableData === 'object' && 'value' in tableData) {
      return (tableData as any).value || [];
    }
    return (tableData as any) || [];
  },
  (newData) => {
    const dataList = (Array.isArray(newData) ? newData : []) as DataListItem[];
    // 初始化動作欄資料
    if (dataList.length > 0) {
      extraDataInit(dataList);
    }
    else {
      extraData.value = [];
    }

    // 更新空訊息狀態
    emptyMessage.value = dataList.length === 0;
  },
  { immediate: true, deep: true },
);

const addIndecentWordsHandler = async () => {
  try {
    if (form.content.length === 0) {
      message.warning('請至少新增一個不雅字');
      return;
    }
    const postData = buildPostData();
    if (postData.postAdd.length === 0) {
      message.warning('沒有可新增的不雅字');
      return;
    }
    // Context 整合：完全使用 Context 的 masterAgent（此頁面已關閉搜尋區）
    const masterAgent = contextMasterAgent.value;

    if (!masterAgent) {
      message.error('請先選擇站長');
      return;
    }
    const res = await addIndecentWords({
      masterAgent,
      indecentWords: postData.postAdd,
    });
    // 處理不同的響應格式：只要沒有錯誤就視為成功
    if (res) {
      tableInstance?.reload();
      beforeDialogClose();
      message.success(t('success'));
    }
  }
  catch (error) {
    console.error('Failed to add indecent words:', error);
    message.error(t('fail'));
  }
};

const updateIndecentWordsHandler = async () => {
  try {
    if (form.content.length === 0) {
      message.warning('請至少新增一個不雅字');
      return;
    }
    const postData = buildPostData();
    if (postData.postAdd.length === 0) {
      message.warning('沒有可更新的不雅字');
      return;
    }
    // Context 整合：完全使用 Context 的 masterAgent（此頁面已關閉搜尋區）
    const masterAgent = contextMasterAgent.value;

    if (!masterAgent) {
      message.error('請先選擇站長');
      return;
    }
    const res = await updateIndecentWords({
      masterAgent,
      indecentWords: postData.postAdd,
    });
    // 處理不同的響應格式：只要沒有錯誤就視為成功
    if (res) {
      tableInstance?.reload();
      beforeDialogClose();
      message.success(t('success'));
    }
  }
  catch (error) {
    console.error('Failed to update indecent words:', error);
    message.error(t('fail'));
  }
};

const removeIndecentWordsHandler = (postDel: string[]) => {
  const content = `${getI18nText('notify.deleteIndecentWords')} - ${postDel.join(', ')}`;
  const title = getI18nText('notify.title');
  Modal.confirm({
    title,
    content,
    okText: t('confirm'),
    cancelText: t('cancel'),
    onOk: async () => {
      try {
        // Context 整合：完全使用 Context 的 masterAgent（此頁面已關閉搜尋區）
        const masterAgent = contextMasterAgent.value;

        if (!masterAgent) {
          message.error('請先選擇站長');
          return;
        }

        const res = await removeIndecentWords({
          masterAgent,
          indecentWords: postDel,
        });
        if (res && !res.data?.error) {
          tableInstance?.reload();
          message.success(t('success'));
        }
      }
      catch (error) {
        console.error('Failed to remove indecent words:', error);
        message.error(t('fail'));
      }
    },
  });
};

const buildPostData = () => {
  const postAdd: string[] = [];
  const postDel: string[] = [];
  form.content.forEach((item) => {
    if (item.ori === '') {
      postAdd.push(item.value);
    }
    if (item.status === ContentStatus.DEL) {
      postDel.push(item.value);
    }
  });
  return { postAdd, postDel };
};

/**
 * ============ Excel 導入 ============
 */
const importExcel = () => {
  isExcelImport.value = true;
  isReplaceAll.value = false;
};

const closeImportDialog = () => {
  isExcelImport.value = false;
};

const handleExcelSuccess = (excelData: ExcelData[]) => {
  const resImport = parseExcelImportData(excelData);
  if (resImport.error.length > 0) {
    isDialogExcelErrShow.value = true;
    excelImportErr.value = resImport.error;
  }
  if (resImport.ok.length > 0) {
    closeImportDialog();
    onCreateBtnClick(resImport.ok);
  }
};

const parseExcelImportData = (excelData: ExcelData[]) => {
  const reData: {
    error: Array<{ msg: string }>;
    ok: DataListItem[];
  } = {
    error: [],
    ok: [],
  };

  if (excelData.length === 0 || !excelData[0].results || excelData[0].results.length === 0) {
    return reData;
  }

  const results = excelData[0].results;
  const check = /^[a-zA-Z0-9\u4E00-\u9FA5\u3105-\u3129]*$/;
  let importFormat = true;

  results.forEach((item: any, index: number) => {
    const str = item[getI18nText('labels.setString')];
    if (str) {
      if (str.trim().length > 0) {
        if (!isReplaceAll.value) {
          // 從表格實例獲取當前資料列表
          const currentData = (tableInstance?.tableData as any) || [];
          let re = currentData.map((el: any) => el.value).indexOf(str.trim());
          if (re === -1) {
            re = reData.ok.map(el => el.value).indexOf(str.trim());
            if (re === -1) {
              if (!check.test(str.trim())) {
                const Repeat = t('notify.importErrValue', {
                  index: index + 1,
                  str,
                });
                reData.error.push({ msg: Repeat });
              }
              else {
                reData.ok.push({ value: str.trim() });
              }
            }
          }
          if (re !== -1) {
            const Repeat = t('notify.importErrRepeat', {
              index: index + 1,
              str,
            });
            reData.error.push({ msg: Repeat });
          }
        }
        else {
          if (!check.test(str.trim())) {
            const Repeat = t('notify.importErrValue', {
              index: index + 1,
              str,
            });
            reData.error.push({ msg: Repeat });
          }
          else {
            reData.ok.push({ value: str.trim() });
          }
        }
      }
    }
    else {
      importFormat = false;
    }
  });

  if (!importFormat) {
    reData.error.push({ msg: t('notify.importErrFormat') });
  }

  return reData;
};

const closeExcelErrDialog = () => {
  excelImportErr.value = [];
  isDialogExcelErrShow.value = false;
};

// ============ Scroll 配置 ============
// 與 agent 頁對齊：使用 useTableConfig 計算 scroll.x
const tableScroll = computed(() => ({
  x: tableConfig.scrollX.value,
  // 不傳入 y，讓 useScroll 根據 autoHeight 自動計算（如果需要）
}));

/**
 * ============ SearchMode 計算 ============
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - 已關閉搜尋區（search: false）
 * - 完全依賴 Breadcrumb Context 的 masterAgent
 * - 查詢條件（masterAgent）會傳遞到後端 API（queryIndecentWords）
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 此頁面使用自動查詢模式，完全依賴 Context
  // 查詢條件直接傳遞到後端 API，因此為 BACKEND 模式
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

/**
 * ============ Context 監聽 ============
 * 當 Context 的 masterAgent 變化時，自動 reload 表格資料
 * 此頁面使用自動查詢模式，完全依賴 Breadcrumb Context
 */
watch(
  contextVersion,
  () => {
    // 當 Context 版本變化時，自動 reload 表格資料
    if (contextMasterAgent.value) {
      nextTick(() => {
        tableInstance?.reload();
      });
    }
  },
  { immediate: false },
);

/**
 * ============ 初始化 ============
 */
onMounted(() => {
  // 注意：此頁面完全依賴 Breadcrumb Context 的 masterAgent
  // 不再需要 fetchMasterAgentList，因為已關閉搜尋區

  // Context 整合：如果 Context 有值，自動 reload 表格資料
  if (contextMasterAgent.value) {
    nextTick(() => {
      tableInstance?.reload();
    });
  }
});
</script>

<template>
  <div class="app-container indecent-words-dashboard">
    <DynamicTable
      :columns="columns"
      :data-request="loadTableData"
      :scroll="tableScroll"
      :auto-height="true"
    >
      <template #headerTitle>
        <div style="display: flex; align-items: center; gap: 8px">
          <span>不雅字管理</span>
          <Tag :color="searchModeConfig.color" style="margin: 0">
            SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
          </Tag>
        </div>
      </template>
      <template #toolbar>
        <a-space>
          <a-button
            type="primary"
            @click="onCreateBtnClick"
          >
            {{ t('add') }}
          </a-button>
          <a-button
            type="default"
            @click="importExcel"
          >
            {{ getI18nText('labels.importBtn') }}
          </a-button>
        </a-space>
      </template>
      <template #export-button>
        <a-button type="primary">
          {{ getI18nText('labels.exportBtn') || 'Excel匯出' }}
        </a-button>
      </template>
    </DynamicTable>

    <!-- Dialog 編輯/新增 -->
    <a-modal
      v-model:open="isDialogShow"
      :title="getFormTitle()"
      :width="500"
      :mask-closable="false"
      @cancel="beforeDialogClose"
    >
      <a-form
        ref="formRef"
        :model="form"
        :label-col="{ span: 8 }"
        :wrapper-col="{ span: 16 }"
        :rules="getRules()"
      >
        <a-form-item
          :label="getI18nText('labels.setString')"
          name="setString"
        >
          <div style="display: flex; gap: 8px;">
            <a-input
              v-model:value="form.setString"
              style="width: 200px"
            />
            <a-button
              type="primary"
              @click="addContentBtn"
            >
              {{ getI18nText('labels.add') }}
            </a-button>
          </div>
        </a-form-item>
        <a-form-item>
          <a-table
            :data-source="form.content"
            :columns="[
              {
                title: getI18nText('labels.seq'),
                dataIndex: 'index',
                width: 50,
                customRender: ({ index }) => index + 1,
              },
              {
                title: getI18nText('labels.setString'),
                dataIndex: 'value',
                customRender: ({ record }) => {
                  return h(Tag, { color: 'blue' }, { default: () => record.value });
                },
              },
              {
                title: t('actions'),
                dataIndex: 'actions',
                width: 100,
                customRender: ({ record }) => {
                  if (record.status !== 'del') {
                    return h(
                      'a',
                      {
                        style: { color: '#ff4d4f', cursor: 'pointer' },
                        onClick: () => contentDel(record),
                      },
                      { default: () => t('delete') },
                    );
                  }
                  return null;
                },
              },
            ]"
            :pagination="false"
            size="small"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="beforeDialogClose">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="onFormConfirm"
        >
          {{ t('confirm') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Excel 導入 Dialog -->
    <a-modal
      v-model:open="isExcelImport"
      :title="getI18nText('title.excelConfirm')"
      :width="640"
      :mask-closable="false"
      @cancel="closeImportDialog"
    >
      <div class="input_group">
        <span class="text">
          {{ getI18nText('labels.replaceAll') }} :
          <a-checkbox v-model:checked="isReplaceAll">
            {{ getI18nText('labels.replaceAllinfo') }}
          </a-checkbox>
        </span>
      </div>
      <div style="margin-top: 10px;">
        <ImpExcel @success="handleExcelSuccess">
          <a-button type="primary">
            {{ getI18nText('labels.importBtn') }}
          </a-button>
        </ImpExcel>
      </div>
      <template #footer>
        <a-button @click="closeImportDialog">
          {{ t('cancel') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Excel 錯誤 Dialog -->
    <a-modal
      v-model:open="isDialogExcelErrShow"
      :title="t('dialog.excelerr')"
      :width="400"
      @cancel="closeExcelErrDialog"
    >
      <div
        v-for="(item, index) in excelImportErr"
        :key="index"
      >
        {{ item.msg }}
      </div>
      <template #footer>
        <a-button @click="closeExcelErrDialog">
          {{ t('dialog.close') }}
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.indecent-words-dashboard {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    .input_group {
      display: flex;
      padding: 10px;
      align-items: center;
      gap: 8px;
      .txt {
        width: 100px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .my_input {
        width: 200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .text {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
}
</style>
