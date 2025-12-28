<script setup lang="ts">
import type { Rule } from 'ant-design-vue/es/form';
import type { ExcelData } from '@/components/basic/excel';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
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

defineOptions({
  name: 'ChatroomIndecentWords',
});

const { t } = useI18n('page.IndecentWords');
const userStore = useUserStore();

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

interface DataListItem {
  seq: number;
  value: string;
}

// ============ 狀態管理 ============
const isTableLoading = ref(false);
const masterAgent = ref('');
const masterAgentList = ref<Array<{ account: string }>>([]);
const dataList = ref<DataListItem[]>([]);
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
const columns = ref<TableColumn<DataListItem>[]>([
  {
    title: getI18nText('labels.seq'),
    dataIndex: 'seq',
    width: 80,
  },
  {
    title: getI18nText('labels.setString'),
    dataIndex: 'value',
  },
]);

const extraData = ref<any[]>([]);

const extraDataInit = () => {
  const control: any[] = [];
  dataList.value.forEach((row) => {
    const actions: any[] = [
      {
        label: t('delete'),
        onClick: () => removeIndecentWordsHandler([row.value]),
      },
    ];
    control.push(actions);
  });
  extraData.value = control;
};

// ============ 工具函數 ============
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
  let re = dataList.value.map((el) => el.value).indexOf(form.setString.trim());
  if (re === -1) {
    re = form.content.map((el) => el.value).indexOf(form.setString.trim());
  }
  return re;
};

// ============ 表單驗證規則 ============
const getRules = (): Record<string, Rule[]> => {
  return {
    setString: [
      {
        required: true,
        validator: (_rule: Rule, value: string) => {
          return new Promise((resolve, reject) => {
            const check = /^[a-zA-Z0-9\u4e00-\u9fa5\u3105-\u3129]*$/;
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

// ============ 事件處理 ============
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
  } else {
    isReplaceAll.value = false;
  }
};

const addContentBtn = () => {
  const check = /^[a-zA-Z0-9\u4e00-\u9fa5\u3105-\u3129]*$/;
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
    form.content = form.content.filter((item) => item.value !== row.value);
  } else {
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
        } else {
          return await addIndecentWordsHandler();
        }
      case ModeType.EDIT:
      default:
        throw new Error('unknown form state');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form:', error);
  }
};

const onMasterAgentChanged = async (value: string) => {
  if (!value) {
    masterAgent.value = '';
    dataList.value = [];
    return;
  }
  isTableLoading.value = true;
  masterAgent.value = value;
  await queryIndecentWordsHandler();
  isTableLoading.value = false;
};

// ============ API 調用 ============
const queryIndecentWordsHandler = async () => {
  try {
    emptyMessage.value = true;
    dataList.value = [];
    const res = await queryIndecentWords({ masterAgent: masterAgent.value });
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

    if (indecentWordsData.length > 0) {
      indecentWordsData.forEach((item: string, index: number) => {
        dataList.value.push({
          seq: index + 1,
          value: item,
        });
      });
      extraDataInit();
    }
  } catch (error) {
    console.error('Failed to query indecent words:', error);
    message.error(t('fail'));
    dataList.value = [];
    emptyMessage.value = false;
  }
};

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
    if (!masterAgent.value) {
      message.error('請先選擇站長');
      return;
    }
    const res = await addIndecentWords({
      masterAgent: masterAgent.value,
      indecentWords: postData.postAdd,
    });
    // 處理不同的響應格式：只要沒有錯誤就視為成功
    if (res) {
      await queryIndecentWordsHandler();
      beforeDialogClose();
      message.success(t('success'));
    }
  } catch (error) {
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
    if (!masterAgent.value) {
      message.error('請先選擇站長');
      return;
    }
    const res = await updateIndecentWords({
      masterAgent: masterAgent.value,
      indecentWords: postData.postAdd,
    });
    // 處理不同的響應格式：只要沒有錯誤就視為成功
    if (res) {
      await queryIndecentWordsHandler();
      beforeDialogClose();
      message.success(t('success'));
    }
  } catch (error) {
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
        const res = await removeIndecentWords({
          masterAgent: masterAgent.value,
          indecentWords: postDel,
        });
        if (res && !res.data?.error) {
          await queryIndecentWordsHandler();
          message.success(t('success'));
        }
      } catch (error) {
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

// ============ Excel 導入 ============
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
  const check = /^[a-zA-Z0-9\u4e00-\u9fa5\u3105-\u3129]*$/;
  let importFormat = true;

  results.forEach((item: any, index: number) => {
    const str = item[getI18nText('labels.setString')];
    if (str) {
      if (str.trim().length > 0) {
        if (!isReplaceAll.value) {
          let re = dataList.value.map((el) => el.value).indexOf(str.trim());
          if (re === -1) {
            re = reData.ok.map((el) => el.value).indexOf(str.trim());
            if (re === -1) {
              if (!check.test(str.trim())) {
                const Repeat = t('notify.importErrValue', {
                  index: index + 1,
                  str: str,
                });
                reData.error.push({ msg: Repeat });
              } else {
                reData.ok.push({ value: str.trim() });
              }
            }
          }
          if (re !== -1) {
            const Repeat = t('notify.importErrRepeat', {
              index: index + 1,
              str: str,
            });
            reData.error.push({ msg: Repeat });
          }
        } else {
          if (!check.test(str.trim())) {
            const Repeat = t('notify.importErrValue', {
              index: index + 1,
              str: str,
            });
            reData.error.push({ msg: Repeat });
          } else {
            reData.ok.push({ value: str.trim() });
          }
        }
      }
    } else {
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

// ============ 表格 ============
const [DynamicTable] = useTable({
  search: false,
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

// ============ 初始化 ============
const fetchMasterAgentList = async () => {
  try {
    const list = await getMasterAgentAccountList();
    masterAgentList.value = (list || []).map((item: any) => ({ account: item.account }));
  } catch (error) {
    console.error('Failed to fetch master agent list:', error);
  }
};

onMounted(async () => {
  if (getAuthLevel.value < 4) {
    await fetchMasterAgentList();
  }
});
</script>

<template>
  <div class="app-container indecent-words-dashboard">
    <div class="filter-container">
      <div class="wrap">
        <div
          v-if="getAuthLevel < 4"
          class="input_group"
        >
          <div class="txt">
            <label>站長</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="masterAgent"
              placeholder="請選擇站長"
              style="width: 200px"
              @change="onMasterAgentChanged"
            >
              <a-select-option
                v-for="item in masterAgentList"
                :key="item.account"
                :value="item.account"
              >
                {{ item.account }}
              </a-select-option>
            </a-select>
          </div>
        </div>
        <div class="input_group">
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
        </div>
      </div>
    </div>

    <DynamicTable
      :loading="isTableLoading"
      :columns="columns"
      :data-source="dataList"
      :scroll="{ x: 'max-content' }"
    >
      <template #export-button>
        <a-button type="primary">
          Excel匯出
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
                      'a-button',
                      {
                        type: 'warning',
                        size: 'small',
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

