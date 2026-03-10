<script setup lang="ts">
import type { Rule } from 'ant-design-vue/es/form';
import type { Dayjs } from 'dayjs';
import type { ISettings, StationMasterItem } from '@/api/backend/agentHubManager';
import type { TableColumn } from '@/components/core/dynamic-table';

import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getRemoteConfig } from '@/api/backend/adminSystem/slotgameServer';
import {
  createShortUrl,
  deleteAgent,
  editAgentSettings,
  enableAgent,
  getStationMasters,
  queryAgent,
  queryShortUrls,
  queryStationMaster,
  setDefaultAgent,
  toggleShortUrlStatus,
} from '@/api/backend/agentHubManager';
import { operatingReports } from '@/api/backend/financialSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { getDefDistAcctSettings } from '@/utils/setDefaultData';

defineOptions({
  name: 'DistAcctFamilySetting',
});

const { t } = useI18n('page.distAcctFamilySetting');
const userStore = useUserStore();
const route = useRoute();

const permissionsLevel = 4;

/**
 * ============ 頁面模式判斷 ============
 */
const checkPageShow = (validPages: string[]): boolean => {
  const path = route.path;
  if (path.includes('familySetting')) {
    return validPages.includes('familySetting');
  }
  if (path.includes('familyList')) {
    return validPages.includes('familyList');
  }
  if (path.includes('distAcctOperatingRecord')) {
    return validPages.includes('distAcctOperatingRecord');
  }
  return false;
};

const isFamilySetting = computed(() => checkPageShow(['familySetting']));
const isFamilyList = computed(() => checkPageShow(['familyList']));
const isOperatingRecord = computed(() => checkPageShow(['distAcctOperatingRecord']));

// ============ 查詢條件 ============
interface QueryState {
  date: [Dayjs, Dayjs];
  gameID: string;
  memberID: string;
}

const queryForm = ref<QueryState>({
  date: [
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ],
  gameID: '',
  memberID: '',
});

// ============ 站台和家族列表 ============
const stationList = ref<StationMasterItem[]>([]);
const station = ref<string>('');
const family = ref<string>('');

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
const isReportDialog = ref(false);
const isShortURLDialog = ref(false);
const isDialogForm7 = ref(false);
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

// ============ 統計資料（Statistics）- 僅用於頁面上方顯示 ============
const statisticsData = ref({
  commissionable: 0,
  count: 0,
  firstPayment: 0,
  firstPaymentTotal: 0,
  gamePlay: 0,
  gamePlayCount: 0,
  gamePlayTotal: 0,
  payment: 0,
  paymentCount: 0,
  paymentTotal: 0,
  register: 0,
  userCount: 0,
});

// ============ 帳務明細資料（Report Detail）- 僅在 dialog 中使用 ============
const billPrintDate = ref<string>('');
const reportDetailData = reactive({
  type1: [] as any[], // 組織數據
  type2: [] as any[], // 財務數據
  type3: [] as any[], // 注單
});

// ============ 短網址 ============
const shortURLDialogTitle = ref('');
const shortURLAgent = ref('');
const ShortURLList = ref<any[]>([]);
const shortURLForm = ref({
  id: -1,
  urlId: -1,
  shortUrl: '',
  shortURLtitle: '',
  enabled: false,
  enabledBtnType: '',
  clickCount: '',
});
const ShortUrlBtn = ref(false);
const liffID = ref('');

/**
 * ============ 工具函數 ============
 */
function formatDate(date: Date | string): string {
  if (!date) {
    return '';
  }
  const d = new Date(date);
  return `${d.getFullYear()}年${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}月${d.getDate().toString().padStart(2, '0')}日`;
}

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
/**
 * 更新統計資料（Statistics）
 * 僅用於頁面上方顯示，不影響列表、不影響 dialog
 */
const updateStatistics = async () => {
  // 先重置為預設值
  statisticsData.value = {
    commissionable: 0,
    count: 0,
    firstPayment: 0,
    firstPaymentTotal: 0,
    gamePlay: 0,
    gamePlayCount: 0,
    gamePlayTotal: 0,
    payment: 0,
    paymentCount: 0,
    paymentTotal: 0,
    register: 0,
    userCount: 0,
  };

  if (isOperatingRecord.value && station.value && queryForm.value.date) {
    try {
      const postData = {
        startSearchTime: queryForm.value.date[0].toDate(),
        endSearchTime: queryForm.value.date[1].toDate(),
        masterAgent: station.value,
      };
      const res = await operatingReports(postData);

      // 調試：查看實際回傳結構
      console.log('operatingReports response:', res);

      // 處理回傳格式：{ data: { items: [{ userCount, register, ... }] } }
      // 注意：Vue3 的 request interceptor 對於 AdminSystem API 返回整個 AxiosResponse
      // 所以實際資料在 res.data，而 API 回傳的格式是 { data: { items: [...] } }
      // 因此需要訪問 res.data.data.items
      let items: any[] | null = null;

      // 嘗試多種可能的資料結構（兼容不同的響應格式）
      if (res) {
        // 情況1：res 是 AxiosResponse，實際資料在 res.data，API 回傳格式是 { data: { items: [...] } }
        if (res.data && res.data.data && res.data.data.items && Array.isArray(res.data.data.items)) {
          items = res.data.data.items;
        }
        // 情況2：res 已經是提取後的資料，直接包含 data.items
        else if (res.data && res.data.items && Array.isArray(res.data.items)) {
          items = res.data.items;
        }
        // 情況3：res 直接包含 items（如果已經被處理過）
        else if (res.items && Array.isArray(res.items)) {
          items = res.items;
        }
      }

      if (items && items.length > 0) {
        const item = items[0];
        // 確保所有欄位都有值，如果 API 回傳 undefined 則使用 0
        statisticsData.value = {
          userCount: item.userCount ?? 0,
          register: item.register ?? 0,
          count: item.count ?? 0,
          firstPayment: item.firstPayment ?? 0,
          firstPaymentTotal: item.firstPaymentTotal ?? 0,
          payment: item.payment ?? 0,
          paymentCount: item.paymentCount ?? 0,
          paymentTotal: item.paymentTotal ?? 0,
          gamePlay: item.gamePlay ?? 0,
          gamePlayCount: item.gamePlayCount ?? 0,
          gamePlayTotal: item.gamePlayTotal ?? 0,
          commissionable: item.commissionable ?? 0,
        };
        console.log('statisticsData updated:', statisticsData.value);
      }
      else {
        console.warn('operatingReports: No items found in response', res);
      }
    }
    catch (error) {
      console.error('Failed to get operating reports:', error);
    }
  }
};

/**
 * @deprecated 使用 updateStatistics 代替
 * 保留此函數以維持向後兼容，內部調用 updateStatistics
 */
const _changeData = updateStatistics;

// 使用 ref 存儲 dynamicTableInstance，避免定義順序問題
const dynamicTableInstanceRef = ref<any>(null);

/**
 * 載入族長清單（僅處理統計資料和 liffID，不處理 table 資料）
 * table 資料由 loadTableData 直接處理
 */
const getFamilyList = async () => {
  liffID.value = '';

  if (userStore.level <= 3) {
    if (!station.value) {
      return;
    }
    // 更新統計資料（不影響列表、不影響 dialog）
    if (isOperatingRecord.value) {
      await updateStatistics();
    }
  }
  else {
    if (!station.value || !family.value) {
      return;
    }
    // 更新統計資料（不影響列表、不影響 dialog）
    if (isOperatingRecord.value) {
      await updateStatistics();
    }
  }

  if (isFamilyList.value) {
    try {
      const masterAgent = station.value;
      const res = await getRemoteConfig({ masterAgent });
      if (res && res.lingLoginConfig) {
        liffID.value = res.lingLoginConfig.liffID || '';
      }
    }
    catch (error) {
      console.error('Failed to get remote config:', error);
    }
  }
};

const getStationList = async () => {
  stationList.value = [];
  if (userStore.level <= 2) {
    try {
      const response = await getStationMasters({}) as any;

      // 調試：查看實際回傳結構
      console.log('getStationMasters response:', response);

      // 處理回傳格式：
      // Vue2: request 返回 response.data，vueRequest 返回 { data: result.data, error: result.error }
      //       所以 Vue2 的 response.data 實際上是 response.data.data（如果 API 返回有 data 層級）
      // Vue3: request 返回整個 AxiosResponse，實際資料在 response.data
      // API 回傳格式可能是：{ value: [...] } 或 { data: { value: [...] }, result: true }

      // 對照 Vue2：if (response.data.result === true)
      // 嘗試多種可能的結構
      let result = false;
      let stationMasters: StationMasterItem[] = [];

      if (response) {
        // 情況1：response.data.result（最常見的情況）
        if (response.data && response.data.result === true && response.data.value) {
          result = true;
          stationMasters = Array.isArray(response.data.value) ? response.data.value : [];
        }
        // 情況2：response.data.data.result（如果 API 返回有 data 層級）
        else if (response.data && response.data.data && response.data.data.result === true && response.data.data.value) {
          result = true;
          stationMasters = Array.isArray(response.data.data.value) ? response.data.data.value : [];
        }
        // 情況3：response 直接包含資料（兼容處理）
        else if (response.result === true && response.value) {
          result = true;
          stationMasters = Array.isArray(response.value) ? response.value : [];
        }
        // 情況4：response.data 直接包含 value（沒有 result 欄位）
        else if (response.data && response.data.value && Array.isArray(response.data.value)) {
          result = true;
          stationMasters = response.data.value;
        }
      }

      if (result && stationMasters && Array.isArray(stationMasters) && stationMasters.length > 0) {
        stationMasters.forEach((item: StationMasterItem) => {
          stationList.value.push({
            name: item.name,
            value: item.name,
          });
        });
        if (stationList.value.length > 0 && !station.value) {
          station.value = stationList.value[0].name;
          await getFamilyList();
          // 觸發 table 重新載入資料（初始化時）
          await nextTick();
          if (dynamicTableInstanceRef.value) {
            await dynamicTableInstanceRef.value.reload?.();
          }
        }
      }
      else {
        console.warn('getStationMasters: No stations found or result is false', response);
      }
    }
    catch (error) {
      console.error('Failed to get station list:', error);
    }
  }
  else {
    station.value = userStore.masterAgent || '';
    family.value = userStore.account || '';
    await getFamilyList();
    // 觸發 table 重新載入資料（初始化時）
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
};

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
    let settings: ISettings[] = getDefDistAcctSettings(station.value, 'family', dialogFamily.value);
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
  const data = getDefDistAcctSettings(station.value, 'family');
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

const enableSwitch = async (data: FamilyRowData) => {
  try {
    dataTableLoading.value = true;
    const postData = {
      stationMasterName: station.value,
      name: data.name || '',
      enable: !data.enabled,
    };
    await enableAgent(postData);
    message.success('更新成功');
    // 觸發 table 重新載入資料
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
  catch (error) {
    console.error('Failed to enable/disable agent:', error);
    message.error('更新失敗');
  }
  finally {
    dataTableLoading.value = false;
  }
};

const isDefaultSwitch = async (data: FamilyRowData) => {
  try {
    dataTableLoading.value = true;
    const postData = {
      stationMasterName: station.value,
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

/**
 * ============ 報表操作 ============
 */
/**
 * 處理帳務明細資料（Report Detail）
 * 僅在 dialog 中使用，僅在點擊「營運報表」後才載入
 */
const processReportDetail = (data: any[]) => {
  // 清空舊資料，避免狀態混用
  reportDetailData.type1 = [];
  reportDetailData.type2 = [];
  reportDetailData.type3 = [];

  data.forEach((item: any, index: number) => {
    // 組織數據
    const type1Item: any = {
      seq: index,
      userCount: item.userCount,
      register: item.register,
      count: item.count,
    };
    reportDetailData.type1.push(type1Item);

    // 財務數據
    const type2Item: any = {
      seq: index,
      firstPayment: item.firstPayment,
      firstPaymentTotal: item.firstPaymentTotal,
      payment: item.payment,
      paymentCount: item.paymentCount,
      paymentTotal: item.paymentTotal,
    };
    reportDetailData.type2.push(type2Item);

    // 注單
    const type3Item: any = {
      seq: index,
      gamePlay: item.gamePlay,
      gamePlayCount: item.gamePlayCount,
      gamePlayTotal: item.gamePlayTotal,
      commissionable: item.commissionable,
    };
    reportDetailData.type3.push(type3Item);
  });
};

/**
 * @deprecated 使用 processReportDetail 代替
 * 保留此函數以維持向後兼容
 */
const _dataInPage = processReportDetail;

/**
 * 開啟帳務明細 dialog
 * 僅在點擊「營運報表」後才調用，此時才載入帳務明細資料
 */
const openReportDialog = (modeType: 'add' | 'edit' | 'view', data?: any) => {
  console.log('📋 [openReportDialog] 開始執行');
  console.log('📋 [openReportDialog] modeType:', modeType);
  console.log('📋 [openReportDialog] data:', data);
  console.log('📋 [openReportDialog] data?.items:', data?.items);

  mode.value = modeType;

  // 確認 isReportDialog 被設為 true
  console.log('📋 [openReportDialog] 設置 isReportDialog = true (之前:', isReportDialog.value, ')');
  isReportDialog.value = true;
  console.log('📋 [openReportDialog] isReportDialog 現在為:', isReportDialog.value);

  // 不要直接假設 data.items 一定存在
  if (modeType !== 'add' && data) {
    // 嘗試取得 items
    let items: any[] = [];

    if (data.items && Array.isArray(data.items)) {
      items = data.items;
      console.log('✅ [openReportDialog] 從 data.items 取得資料，數量:', items.length);
    }
    else if (Array.isArray(data)) {
      // 如果 data 本身就是陣列
      items = data;
      console.log('✅ [openReportDialog] data 本身就是陣列，數量:', items.length);
    }

    if (items.length > 0) {
      // 僅在此時處理帳務明細資料，避免與統計資料混用
      console.log('📊 [openReportDialog] 開始處理報表明細資料');
      processReportDetail(items);
    }
    else {
      console.warn('⚠️ [openReportDialog] 沒有找到 items 資料，data:', data);
    }
  }
  else {
    console.log('📋 [openReportDialog] modeType 為 add 或 data 不存在，跳過處理');
  }

  console.log('📋 [openReportDialog] 執行完成');
};

const closeReportDialog = () => {
  isReportDialog.value = false;
};

const onViewReportBtnHandler = async (data: FamilyRowData) => {
  console.log('📊 [onViewReportBtnHandler] 開始執行');
  console.log('📊 [onViewReportBtnHandler] data:', data);

  try {
    const postData = {
      startSearchTime: queryForm.value.date[0].toDate(),
      endSearchTime: queryForm.value.date[1].toDate(),
      masterAgent: station.value,
      agent: data.name || '',
    };
    console.log('📊 [onViewReportBtnHandler] postData:', postData);

    family.value = data.name || '';
    billPrintDate.value = `${formatDate(queryForm.value.date[0].toDate())} ~ ${formatDate(queryForm.value.date[1].toDate())}`;

    console.log('📤 [onViewReportBtnHandler] 呼叫 operatingReports');
    const res = await operatingReports(postData);
    console.log('📥 [onViewReportBtnHandler] operatingReports 回應 (完整):', res);
    console.log('📥 [onViewReportBtnHandler] res.data:', res?.data);
    console.log('📥 [onViewReportBtnHandler] res.items:', res?.items);
    console.log('📥 [onViewReportBtnHandler] res.data?.items:', res?.data?.items);
    console.log('📥 [onViewReportBtnHandler] res.data?.data?.items:', res?.data?.data?.items);

    // 統一整理成 { items } 格式
    let items: any[] = [];

    // 嘗試多種可能的資料結構
    if (res) {
      // 情況1：res.data.items（最常見的情況）
      if (res.data && res.data.items && Array.isArray(res.data.items)) {
        items = res.data.items;
        console.log('✅ [onViewReportBtnHandler] 從 res.data.items 取得資料，數量:', items.length);
      }
      // 情況2：res.items（直接包含 items）
      else if (res.items && Array.isArray(res.items)) {
        items = res.items;
        console.log('✅ [onViewReportBtnHandler] 從 res.items 取得資料，數量:', items.length);
      }
      // 情況3：res.data.data.items（如果 API 返回有 data 層級）
      else if (res.data && res.data.data && res.data.data.items && Array.isArray(res.data.data.items)) {
        items = res.data.data.items;
        console.log('✅ [onViewReportBtnHandler] 從 res.data.data.items 取得資料，數量:', items.length);
      }
      // 情況4：res.data 本身就是 items 陣列
      else if (res.data && Array.isArray(res.data)) {
        items = res.data;
        console.log('✅ [onViewReportBtnHandler] 從 res.data (陣列) 取得資料，數量:', items.length);
      }
    }

    if (items.length > 0) {
      console.log('📤 [onViewReportBtnHandler] 準備開啟報表 dialog，items 數量:', items.length);
      openReportDialog('view', { items });
    }
    else {
      console.warn('⚠️ [onViewReportBtnHandler] 沒有找到 items 資料');
      message.warning('沒有報表資料');
    }
  }
  catch (error) {
    console.error('❌ [onViewReportBtnHandler] Failed to get operating reports:', error);
    console.error('❌ [onViewReportBtnHandler] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    message.error('取得報表失敗');
  }
};

/**
 * ============ 短網址操作 ============
 */
/**
 * getShortUrlList 必須在 openDialogShortURL 之前定義，因為被 openDialogShortURL 調用
 */
const getShortUrlList = async (agentId: number) => {
  ShortURLList.value = [];
  shortURLForm.value = {
    id: agentId,
    urlId: -1,
    shortUrl: '',
    shortURLtitle: '',
    enabled: false,
    enabledBtnType: '',
    clickCount: '',
  };

  try {
    const postData = {
      agentId,
      includeDisabled: true,
    };
    const res = await queryShortUrls(postData);
    if (res && res.result && res.value) {
      ShortURLList.value = res.value;
      const listCopy = [...ShortURLList.value];
      listCopy.sort((a, b) => b.id - a.id);
      if (listCopy.length > 0) {
        const maxIdItem = listCopy[0];
        shortURLForm.value.urlId = maxIdItem.id;
        shortURLForm.value.shortUrl = maxIdItem.shortUrl;
        shortURLForm.value.enabled = maxIdItem.enabled;
        shortURLForm.value.shortURLtitle = maxIdItem.title;
        shortURLForm.value.enabledBtnType = maxIdItem.enabled ? 'danger' : 'success';
        shortURLForm.value.clickCount = maxIdItem.clickCount?.toString() || '0';
      }
    }
  }
  catch (error) {
    console.error('Failed to get short URL list:', error);
  }
};

const openDialogShortURL = async (row: FamilyRowData) => {
  isDialogForm7.value = true;
  shortURLDialogTitle.value = `${row.name} ${t('label.shortURLTitle')}`;
  shortURLAgent.value = row.name || '';
  await getShortUrlList(row.id || 0);
  isDialogForm7.value = false;
  isShortURLDialog.value = true;
};

const closeDialogShortURL = () => {
  isShortURLDialog.value = false;
};

const newShortUrl = async () => {
  ShortUrlBtn.value = true;
  try {
    const postData = {
      agentId: shortURLForm.value.id,
      title: `${shortURLAgent.value}短連結`,
      targetUrl: `https://liff.line.me/${liffID.value}?joinAgentID=${shortURLForm.value.id}`,
      disableOthers: true,
    };
    await createShortUrl(postData);
    message.success('建立成功');
    await getShortUrlList(shortURLForm.value.id);
  }
  catch (error) {
    console.error('建立短網址失敗', error);
    message.error('建立失敗');
  }
  finally {
    ShortUrlBtn.value = false;
  }
};

const copyShortURL = async () => {
  const text = shortURLForm.value.shortUrl;
  if (!text) {
    message.warning('沒有可複製的短網址');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    message.success('已複製到剪貼簿');
  }
  catch (err) {
    console.warn('Async clipboard failed, fallback to execCommand', err);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      message.success('已複製到剪貼簿');
    }
    catch (error) {
      message.error('複製失敗，請手動複製');
    }
    finally {
      document.body.removeChild(textarea);
    }
  }
};

const changeUrlState = async () => {
  ShortUrlBtn.value = true;
  try {
    const postData = {
      id: shortURLForm.value.urlId,
      enabled: !shortURLForm.value.enabled,
    };
    await toggleShortUrlStatus(postData);
    message.success('更新成功');
    await getShortUrlList(shortURLForm.value.id);
  }
  catch (error) {
    console.error('切換短網址狀態失敗：', error);
    message.error('更新失敗');
  }
  finally {
    ShortUrlBtn.value = false;
  }
};

// ============ 表格配置 ============
const columns = computed<TableColumn<FamilyRowData>[]>(() => {
  const cols: TableColumn<FamilyRowData>[] = [];

  // 基本欄位：族長名稱（所有模式都需要）
  cols.push({
    title: t('label.family'),
    dataIndex: 'name',
    width: 200,
    align: 'left',
  });

  // 1️⃣ isOperatingRecord === true 時，只顯示「族長名稱 + 操作」
  // 2️⃣ isFamilySetting === true 時，才加入抽成相關 columns
  // 3️⃣ isFamilyList === true 時，也只顯示「族長名稱 + 操作」（不顯示抽成欄位）
  // 4️⃣ 確保每個 column.dataIndex 在 row item 的第一層 key 中實際存在

  // 只有在 FamilySetting 模式下才添加抽成欄位
  // 數字欄位使用右對齊，與 Vue2 的 DataTable 一致
  if (isFamilySetting.value) {
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
  }

  // action 欄位由 actionColumn 處理，不需要在這裡添加
  // DynamicTable 使用 actionColumn 配置來顯示操作按鈕

  return cols;
});

const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
  showActionColumn: true,
  actionColumn: {
    title: '操作',
    width: 300,
    fixed: 'right',
    actions: ({ record }) => {
      const actions: any[] = [];

      if (isOperatingRecord.value) {
        actions.push({
          label: t('label.viewReport'),
          type: 'link',
          onClick: () => {
            console.log('🔍 [查看報表] 點擊事件觸發');
            console.log('🔍 [查看報表] record:', record);
            onViewReportBtnHandler(record as FamilyRowData);
          },
        });
      }

      if (isFamilyList.value) {
        actions.push({
          label: record.enabled ? t('enable.disable') : t('enable.enable'),
          type: 'link',
          disabled: (record.unions && record.unions.length > 0) || false,
          onClick: () => enableSwitch(record as FamilyRowData),
        });
      }

      if (isFamilySetting.value && record.isDefault) {
        actions.push({
          label: record.isDefault ? t('isDefault.disable') : t('isDefault.enable'),
          type: 'link',
          disabled: record.isDefault || false,
          onClick: () => isDefaultSwitch(record as FamilyRowData),
        });
      }

      if (isFamilySetting.value) {
        actions.push({
          label: userStore.level <= 3 ? t('edit') : t('view'),
          type: 'link',
          onClick: () => onEditBtnHandler(record as FamilyRowData),
        });
      }

      if (isFamilyList.value) {
        actions.push({
          label: t('label.shortURL'),
          type: 'link',
          onClick: () => openDialogShortURL(record as FamilyRowData),
        });
      }

      return actions;
    },
  },
});

// 將 dynamicTableInstance 存儲到 ref 中
dynamicTableInstanceRef.value = dynamicTableInstance;

/**
 * loadTableData 直接負責呼叫 queryStationMaster 或 queryAgent
 * 並回傳 { items: agents, meta: { totalItems: agents.length } }
 */
const loadTableData = async () => {
  console.log('=== loadTableData 開始 ===');
  console.log('userStore.level:', userStore.level);
  console.log('station.value:', station.value);
  console.log('family.value:', family.value);

  dataTableLoading.value = true;

  try {
    const agents: FamilyRowData[] = [];

    if (userStore.level <= 3) {
      if (!station.value) {
        console.log('⚠️ station.value 為空，返回空資料');
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 呼叫 queryStationMaster（對照 Vue2 版本）
      const postData = { name: station.value };
      console.log('📤 呼叫 queryStationMaster, postData:', postData);
      const response = await queryStationMaster(postData) as any;
      console.log('📥 queryStationMaster 回應 (完整):', response);
      console.log('📥 queryStationMaster 回應 (response.data):', response?.data);
      console.log('📥 queryStationMaster 回應 (response.data?.value):', response?.data?.value);

      // 檢查是否有錯誤（對照 Vue2：if (!respone.error)）
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

      // 提取 agents 資料（對照 Vue2：respone.data.value.agents）
      // Vue2 直接使用 response.data.value.agents，Vue3 的 request 返回整個 AxiosResponse
      // 所以實際資料在 response.data，API 回傳格式是 { data: { value: { agents: [...] } } }
      const rawAgents = response.value?.agents;
      console.log('📋 提取的 rawAgents:', rawAgents);
      console.log('📋 rawAgents 類型:', Array.isArray(rawAgents) ? 'Array' : typeof rawAgents);
      console.log('📋 rawAgents 長度:', rawAgents?.length);

      // 處理 agents 資料（對照 Vue2 版本的邏輯）
      if (rawAgents && Array.isArray(rawAgents)) {
        console.log('✅ 開始處理 agents 資料，共', rawAgents.length, '筆');
        rawAgents.forEach((item: any, index: number) => {
          console.log(`  [${index}] 原始 item:`, item);
          // 對照 Vue2：let one = { ...item };
          const one: FamilyRowData = { ...item };
          console.log(`  [${index}] 展開後的 one:`, one);
          console.log(`  [${index}] one 的欄位:`, Object.keys(one));

          // 對照 Vue2：if (item.commissionSettings.length > 0)
          if (item.commissionSettings && item.commissionSettings.length > 0) {
            console.log(`  [${index}] commissionSettings:`, item.commissionSettings);
            // 對照 Vue2：rowData.commissionSettings.forEach((item2: any) => { one[item2.name] = (item2.percentage * 100).toString(); });
            item.commissionSettings.forEach((setting: any) => {
              console.log(`    - 處理 setting:`, setting, '→', setting.name, '=', (setting.percentage * 100).toString());
              (one as any)[setting.name] = (setting.percentage * 100).toString();
            });
            console.log(`  [${index}] 處理 commissionSettings 後的 one:`, one);
          }
          // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
          one.pk = item.name || `family-${item.id || Math.random()}`;
          console.log(`  [${index}] 最終 one (含 pk):`, one);
          console.log(`  [${index}] 最終 one 的欄位:`, Object.keys(one));
          agents.push(one);
        });
      }
      else {
        console.warn('⚠️ rawAgents 不是陣列或為空:', rawAgents);
      }
    }
    else {
      if (!station.value || !family.value) {
        console.log('⚠️ station.value 或 family.value 為空，返回空資料');
        dataTableLoading.value = false;
        return {
          items: [],
          meta: { totalItems: 0 },
        };
      }

      // 呼叫 queryAgent（對照 Vue2 版本）
      const postData = {
        stationMasterName: station.value,
        name: family.value,
      };
      console.log('📤 呼叫 queryAgent, postData:', postData);
      const response = await queryAgent(postData) as any;
      console.log('📥 queryAgent 回應 (完整):', response);
      console.log('📥 queryAgent 回應 (response.data):', response?.data);
      console.log('📥 queryAgent 回應 (response.data?.value):', response?.data?.value);

      // 檢查是否有錯誤（對照 Vue2：if (!response.error)）
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

      // 提取 agent 資料（對照 Vue2：response.data.value）
      // Vue2 直接使用 response.data.value，Vue3 的 request 返回整個 AxiosResponse
      // 所以實際資料在 response.data，API 回傳格式是 { data: { value: {...} } }
      const agentData = response.data?.value;
      console.log('📋 提取的 agentData:', agentData);
      console.log('📋 agentData 的欄位:', agentData ? Object.keys(agentData) : 'null');

      // 處理 agent 資料（對照 Vue2 版本的邏輯）
      if (agentData) {
        console.log('✅ 開始處理 agent 資料');
        // 對照 Vue2：let one = { ...response.data.value };
        const one: FamilyRowData = { ...agentData };
        console.log('  展開後的 one:', one);
        console.log('  one 的欄位:', Object.keys(one));

        // 對照 Vue2：if (response.data.value.commissionSettings.length > 0)
        if (agentData.commissionSettings && agentData.commissionSettings.length > 0) {
          console.log('  commissionSettings:', agentData.commissionSettings);
          // 對照 Vue2：rowData.commissionSettings.forEach((item2: any) => { one[item2.name] = (item2.percentage * 100).toString(); });
          agentData.commissionSettings.forEach((setting: any) => {
            console.log('    - 處理 setting:', setting, '→', setting.name, '=', (setting.percentage * 100).toString());
            (one as any)[setting.name] = (setting.percentage * 100).toString();
          });
          console.log('  處理 commissionSettings 後的 one:', one);
        }
        // Vue3 DynamicTable 需要 row-key，添加 pk 欄位
        one.pk = agentData.name || `family-${agentData.id || Math.random()}`;
        console.log('  最終 one (含 pk):', one);
        console.log('  最終 one 的欄位:', Object.keys(one));
        agents.push(one);
      }
      else {
        console.warn('⚠️ agentData 為空');
      }
    }

    console.log('📊 處理完成，agents 總數:', agents.length);
    console.log('📊 agents 陣列:', agents);
    if (agents.length > 0) {
      console.log('📊 第一筆 agent 的完整資料:', agents[0]);
      console.log('📊 第一筆 agent 的所有欄位:', Object.keys(agents[0]));
      console.log('📊 第一筆 agent 的關鍵欄位檢查:');
      console.log('  - name:', agents[0].name);
      console.log('  - id:', agents[0].id);
      console.log('  - enabled:', agents[0].enabled);
      console.log('  - isDefault:', agents[0].isDefault);
      console.log('  - pk:', agents[0].pk);
      console.log('  - Purchase:', agents[0].Purchase);
      console.log('  - PurchaseServiceCost:', agents[0].PurchaseServiceCost);
      console.log('  - ServiceFee:', agents[0].ServiceFee);
      console.log('  - SMSServiceCost:', agents[0].SMSServiceCost);
      console.log('  - Bonus:', agents[0].Bonus);
      console.log('  - GameWinLose:', agents[0].GameWinLose);
    }

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

/**
 * ============ 事件處理 ============
 */
const handleFilter = async () => {
  await getFamilyList();
  // 如果是營運報表模式，確保統計資料被更新
  if (isOperatingRecord.value) {
    await updateStatistics();
  }
  // 觸發 table 重新載入資料
  await nextTick();
  if (dynamicTableInstanceRef.value) {
    await dynamicTableInstanceRef.value.reload?.();
  }
};

// ============ 監聽站台變化 ============
watch(station, async () => {
  if (station.value) {
    // 切換站台 → 更新統計資料和 liffID
    await getFamilyList();
    // 如果是營運報表模式，確保統計資料被更新
    if (isOperatingRecord.value) {
      await updateStatistics();
    }
    // 觸發 table 重新載入資料
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
});

// ============ 初始化 ============
onMounted(async () => {
  if (userStore.level <= 4) {
    await getStationList();
  }
  if (userStore.level === 4) {
    disabledMode.value = true;
  }
  if (isOperatingRecord.value && userStore.level === 4) {
    // permissionsLevel = 3;
  }
  // 如果是營運報表模式，初始化時載入統計資料
  if (isOperatingRecord.value && station.value) {
    await updateStatistics();
  }
  // 確保 table 在初始化時載入資料（如果 station 已經有值）
  // 如果 station 還沒有值，會在 getStationList 中設置後觸發 reload
  if (station.value) {
    await nextTick();
    if (dynamicTableInstanceRef.value) {
      await dynamicTableInstanceRef.value.reload?.();
    }
  }
});
</script>

<template>
  <div class="app-container">
    <div v-if="userStore.level <= permissionsLevel" class="app-container">
      <!-- 查詢條件 -->
      <div
        v-if="(userStore.level < 4 && isOperatingRecord) || (userStore.level < 3 && (isFamilySetting || isFamilyList))"
        class="filter-container"
      >
        <div class="wrap">
          <!-- 站台選擇 -->
          <div v-if="userStore.level < 3" class="input_group">
            <div class="txt">
              <label>{{ t('label.station') }}:</label>
            </div>
            <a-select
              v-model:value="station"
              :disabled="dataTableLoading"
              style="width: 200px; margin: 10px"
            >
              <a-select-option
                v-for="item in stationList"
                :key="item.value || item.name"
                :value="item.value || item.name"
              >
                {{ item.name }}
              </a-select-option>
            </a-select>
          </div>

          <!-- 日期選擇 -->
          <div v-if="isOperatingRecord" class="input_group">
            <div class="txt">
              <label>{{ t('label.reportStr') }}:</label>
            </div>
            <a-range-picker
              v-model:value="queryForm.date"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              style="width: 400px; margin: 10px"
              @change="updateStatistics"
            />
          </div>

          <!-- 搜尋按鈕 -->
          <div v-if="isOperatingRecord" class="input_group">
            <a-button type="primary" @click="handleFilter">
              {{ t('search') }}
            </a-button>
          </div>
        </div>
      </div>

      <!-- 總覽資訊 -->
      <div v-if="isOperatingRecord" class="filter-container">
        <div class="wrap">
          <div class="input_group">
            <div class="txtShow">
              <label>
                總會員數: <span class="highlight-text">{{ statisticsData.userCount }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                註冊人數: <span class="highlight-text">{{ statisticsData.register }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                登入人數: <span class="highlight-text">{{ statisticsData.count }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                首儲人數: <span class="highlight-text">{{ statisticsData.firstPayment }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                首儲點數: <span class="highlight-text">{{ statisticsData.firstPaymentTotal }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                儲值人數: <span class="highlight-text">{{ statisticsData.payment }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                儲值次數: <span class="highlight-text">{{ statisticsData.paymentCount }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                儲值點數: <span class="highlight-text">{{ statisticsData.paymentTotal }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                下注人數: <span class="highlight-text">{{ statisticsData.gamePlay }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                注單數: <span class="highlight-text">{{ statisticsData.gamePlayCount }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                投注總額: <span class="highlight-text">{{ statisticsData.gamePlayTotal }}</span>
              </label>
            </div>
          </div>
          <div class="input_group">
            <div class="txtShow">
              <label>
                有效投注: <span class="highlight-text">{{ statisticsData.commissionable }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 表格 -->
      <DynamicTable
        row-key="pk"
        :columns="columns"
        :data-request="loadTableData"
        :loading="dataTableLoading"
        :show-action-column="true"
        :scroll="{ x: 'max-content' }"
        :immediate="false"
      />

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

      <!-- 報表對話框（帳務明細） -->
      <a-modal
        v-model:open="isReportDialog"
        title="營運報表查詢"
        :width="1200"
        :mask-closable="false"
        @cancel="closeReportDialog"
      >
        <div id="printArea" class="bill-container">
          <div class="bill-section">
            <h2>營運對象：{{ family }}</h2>
            <p>此為 {{ billPrintDate }} 的營運報表。</p>
          </div>

          <div class="bill-section">
            <h3>營運統計</h3>

            <!-- 組織數據 -->
            <div v-if="reportDetailData.type1.length > 0" class="bill-table-wrapper">
              <h4>組織數據</h4>
              <table class="bill-table">
                <thead>
                  <tr>
                    <th class="center-align">
                      總會員數
                    </th>
                    <th class="center-align">
                      註冊人數
                    </th>
                    <th class="center-align">
                      登入人數
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportDetailData.type1"
                    :key="item.seq"
                  >
                    <td class="center-align">
                      {{ item.userCount.toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ item.register.toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ item.count.toLocaleString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 財務數據 -->
            <div v-if="reportDetailData.type2.length > 0" class="bill-table-wrapper">
              <h4>財務數據</h4>
              <table class="bill-table">
                <thead>
                  <tr>
                    <th class="center-align">
                      首儲人數
                    </th>
                    <th class="center-align">
                      首儲點數
                    </th>
                    <th class="center-align">
                      儲值人數
                    </th>
                    <th class="center-align">
                      儲值次數
                    </th>
                    <th class="center-align">
                      儲值點數
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportDetailData.type2"
                    :key="item.seq"
                  >
                    <td class="center-align">
                      {{ (item.firstPayment * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.firstPaymentTotal * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.payment * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.paymentCount * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.paymentTotal * 1).toLocaleString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 注單 -->
            <div v-if="reportDetailData.type3.length > 0" class="bill-table-wrapper">
              <h4>注單</h4>
              <table class="bill-table">
                <thead>
                  <tr>
                    <th class="center-align">
                      下注人數
                    </th>
                    <th class="center-align">
                      注單數
                    </th>
                    <th class="center-align">
                      投注總額
                    </th>
                    <th class="center-align">
                      有效投注
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportDetailData.type3"
                    :key="item.seq"
                  >
                    <td class="center-align">
                      {{ (item.gamePlay * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.gamePlayCount * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.gamePlayTotal * 1).toLocaleString() }}
                    </td>
                    <td class="center-align">
                      {{ (item.commissionable * 1).toLocaleString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <template #footer>
          <a-button @click="closeReportDialog">
            {{ t('close') }}
          </a-button>
        </template>
      </a-modal>

      <!-- 短網址對話框 -->
      <a-modal
        v-model:open="isShortURLDialog"
        :title="shortURLDialogTitle"
        :width="560"
        @cancel="closeDialogShortURL"
      >
        <a-form
          :model="shortURLForm"
          :label-col="{ span: 8 }"
          :wrapper-col="{ span: 16 }"
        >
          <a-form-item :label="t('label.shortURL')">
            <span>{{ shortURLForm.shortUrl }}</span>
          </a-form-item>
          <a-form-item :label="t('label.clickCount')">
            <span>{{ shortURLForm.clickCount }}</span>
          </a-form-item>
        </a-form>
        <template #footer>
          <div class="dialog-footer">
            <a-button
              :disabled="!shortURLForm.shortUrl || ShortUrlBtn"
              :loading="ShortUrlBtn"
              @click="copyShortURL"
            >
              {{ t('copy') }}{{ t('label.shortURL') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn"
              @click="newShortUrl"
            >
              {{ t('label.addShortURL') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn || !shortURLForm.enabledBtnType"
              :type="shortURLForm.enabledBtnType"
              @click="changeUrlState"
            >
              {{ shortURLForm.enabled ? t('enable.enable') : t('enable.disable') }}
            </a-button>
            <a-button
              :loading="ShortUrlBtn"
              :disabled="ShortUrlBtn"
              @click="closeDialogShortURL"
            >
              {{ t('cancel') }}
            </a-button>
          </div>
        </template>
      </a-modal>

      <!-- 載入中對話框 -->
      <a-modal
        v-model:open="isDialogForm7"
        title="設定讀取中"
        :width="200"
        :footer="null"
        :closable="false"
        :mask-closable="false"
      >
        Loading ...
      </a-modal>
    </div>
    <div v-else>
      <a-result status="403" title="403" sub-title="您沒有權限訪問此頁面" />
    </div>
  </div>
</template>

<style scoped>
/* 對照 Vue2：filter-container 和 wrap 的樣式 */
.filter-container {
  padding-bottom: 10px;
}

.wrap {
  display: flex;
  flex-wrap: wrap;
  background-color: #e7e7e7;
}

.input_group {
  display: flex;
  padding: 10px;

  .txt {
    width: 70px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .txtShow {
    margin: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    white-space: nowrap;
  }
}

.highlight-text {
  color: #409eff;
}

.bill-container {
  padding: 5px;
  background: #fff;
  width: 97%;
  max-height: 70vh;
  overflow-y: auto;
}

.bill-section {
  width: 100%;
  margin-bottom: 10px;
  padding: 10px;
  border: 2px solid #ccc;
}

.bill-table-wrapper {
  margin-top: 5px;
}

.bill-table {
  width: 100%;
  border: 1px solid #000;
  border-collapse: collapse;
  table-layout: fixed;
}

.bill-table thead {
  background: #ddd;
  font-weight: bold;
}

.bill-table th,
.bill-table td {
  padding: 5px;
  border: 1px solid #000;
}

.bill-table th.center-align,
.bill-table td.center-align {
  text-align: center;
}

.bill-table th.right-align,
.bill-table td.right-align {
  text-align: right;
}

.dialog-footer {
  display: flex !important;
  justify-content: center !important;
  padding: 10px 0;
}
</style>
