<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { wizardStateManager } from '@/router/router-guards';
import { useTabsViewStore } from '@/store/modules/tabsView';
import { useUserStore } from '@/store/modules/user';
import Step1BasicInfo from './components/Step1BasicInfo.vue';
import Step2Roles from './components/Step2Roles.vue';
import Step3WalletAndFormula from './components/Step3WalletAndFormula.vue';
import Step4NetworkSecurity from './components/Step4NetworkSecurity.vue';
import Step5FirebaseAnalytics from './components/Step5FirebaseAnalytics.vue';
import Step6PaymentKeys from './components/Step6PaymentKeys.vue';

import Step7CustomerAndSocial from './components/Step7CustomerAndSocial.vue';
import Step8PaymentSettings from './components/Step8PaymentSettings.vue';
import Step9SmsSettings from './components/Step9SmsSettings.vue';
import Step10SlotSettings from './components/Step10SlotSettings.vue';
import Step11Recaptcha from './components/Step11Recaptcha.vue';
import Step12AdvancedSettings from './components/Step12AdvancedSettings.vue';
import { buildInternalSettings, buildRemoteConfigURLs, generateHashKey, generateSecret } from './utils';

defineOptions({ name: 'AdminAccountMasterAgentCreateWizard' });

type AccountType = 'masterAgent' | 'masterAgentX';

interface StepStatus {
  touched: boolean;
  valid: boolean;
}

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const tabsViewStore = useTabsViewStore();

const currentStep = ref<number>(0);
const isSubmitting = ref<boolean>(false);
const createdAccountId = ref<number | null>(null);
/**
 * Wizard 是否已完成
 */
const isWizardCompleted = ref<boolean>(false);
/**
 * Wizard 是否處於活動狀態
 */
const isWizardActive = ref<boolean>(false);

/** Step 狀態管理 */
const stepStates = reactive<Record<number, StepStatus>>({});

/** Step 3 的初始值（用於判斷是否有變動） */
const step3InitialValues = ref<ReturnType<typeof getStep3Defaults> | null>(null);

const step1Ref = ref<InstanceType<typeof Step1BasicInfo> | null>(null);
const step2Ref = ref<InstanceType<typeof Step2Roles> | null>(null);
const step4Ref = ref<InstanceType<typeof Step4NetworkSecurity> | null>(null);
const step5Ref = ref<InstanceType<typeof Step5FirebaseAnalytics> | null>(null);
const step6Ref = ref<InstanceType<typeof Step6PaymentKeys> | null>(null);
const step7Ref = ref<InstanceType<typeof Step7CustomerAndSocial> | null>(null);
const step8Ref = ref<InstanceType<typeof Step8PaymentSettings> | null>(null);
const step9Ref = ref<InstanceType<typeof Step9SmsSettings> | null>(null);
const step10Ref = ref<InstanceType<typeof Step10SlotSettings> | null>(null);
const step11Ref = ref<InstanceType<typeof Step11Recaptcha> | null>(null);
const step12Ref = ref<InstanceType<typeof Step12AdvancedSettings> | null>(null);

/**
 * Step 3 的預設值
 */
const getStep3Defaults = () => ({
  isSingleWallet: false,
  singleWallerVersion: 1,
  vipDowngradeFormula: 1,
  levelFormula: 0,
  activityFormulaRatio: 1,
  levelUpNeedPoint: 0,
  isRanking: true,
});

const formModel = reactive<{
  accountType: AccountType | undefined;
  account: string;
  name: string;
  website: string;
  currencyCode: string;
  shareholderAccount: string;
  roles: number[];
  /** Step 3 欄位 */
  isSingleWallet: boolean;
  singleWallerVersion: number;
  vipDowngradeFormula: number;
  levelFormula: number;
  activityFormulaRatio: number;
  levelUpNeedPoint: number;
  isRanking: boolean;
  /** Step 4 欄位 */
  networkSettings?: {
    apiDomain: string[];
    whiteIPList: string[];
    cdnList: string[];
    proxyList: string[];
  };
  securitySettings?: {
    hashKey: string;
  };
  /** Step 5 欄位 */
  gaKey: string;
  firebaseSdkConfig: string;
  firebaseAdminSdkConfig: string;
  firebaseConfig: string;
  /** Step 6 欄位 */
  iosPaymentKey: string;
  androidPaymentKey: string;
  ecPaymentKey: string;
  gcpKey: string;
  androidBundleID: string;
  iosBundleID: string;
  /** Step 7 欄位 */
  serviceEmail: string;
  lineOfficialAccount: string;
  liffID: string;
  lineClientID: string;
  lineClientSecret: string;
  facebookID: string;
  /** Step 8 欄位 */
  myCardShowType: boolean;
  soNetShowType: boolean;
  nganLuongShowType: boolean;
  moPayShowType: boolean;
  btPayShowType: boolean;
  paymentMode: string;
  topUpRate: number;
  /** Step 9 欄位 */
  smsAccount: string;
  smsPassWord: string;
  boSmsAccount: string;
  boSmsPassWord: string;
  onePhoneNumberToAccountCounts: number;
  /** Step 10 欄位 */
  slot_waitingSettleTime: number;
  slot_oneTimeToken: boolean;
  slot_prizeDecimalPlaces: number;
  /** Step 11 欄位 */
  reCaptcha_secretKey: string;
  reCaptcha_name: string;
  reCaptcha_siteKey: string;
  reCaptcha_enabled: boolean;
  /** Step 12 欄位 */
  internalSettings: string;
  remoteConfigURLs: string;
}>({
  accountType: 'masterAgent',
  account: '',
  name: '',
  website: '',
  currencyCode: '',
  shareholderAccount: '',
  roles: [],
  /** Step 3 預設值 */
  ...getStep3Defaults(),
  /** Step 4 預設值 */
  networkSettings: {
    apiDomain: [],
    whiteIPList: [],
    cdnList: [],
    proxyList: [],
  },
  securitySettings: {
    hashKey: generateHashKey(),
  },
  /** Step 5 預設值 */
  gaKey: '',
  firebaseSdkConfig: '',
  firebaseAdminSdkConfig: '',
  firebaseConfig: '',
  /** Step 6 預設值 */
  iosPaymentKey: '',
  androidPaymentKey: '',
  ecPaymentKey: '',
  gcpKey: '',
  androidBundleID: '',
  iosBundleID: '',
  /** Step 7 預設值 */
  serviceEmail: '',
  lineOfficialAccount: '',
  liffID: '',
  lineClientID: '',
  lineClientSecret: '',
  facebookID: '',
  /** Step 8 預設值 */
  myCardShowType: false,
  soNetShowType: false,
  nganLuongShowType: false,
  moPayShowType: false,
  btPayShowType: false,
  paymentMode: 'Real',
  topUpRate: 100,
  /** Step 9 預設值 */
  smsAccount: '',
  smsPassWord: '',
  boSmsAccount: '',
  boSmsPassWord: '',
  onePhoneNumberToAccountCounts: 1,
  /** Step 10 預設值 */
  slot_waitingSettleTime: 30,
  slot_oneTimeToken: false,
  slot_prizeDecimalPlaces: 2,
  /** Step 11 預設值 */
  reCaptcha_secretKey: '',
  reCaptcha_name: '',
  reCaptcha_siteKey: '',
  reCaptcha_enabled: false,
  /** Step 12 預設值 */
  internalSettings: '',
  remoteConfigURLs: '',
});

/**
 * 關閉 Wizard 並導向首頁
 */
const closeWizardAndGoHome = () => {
  console.log('[Wizard][流程保護] 關閉 Wizard 並導向首頁');
  isWizardActive.value = false;
  isWizardCompleted.value = true;
  wizardStateManager.setCompleted(true); // 同步全局狀態

  // 關閉當前頁籤
  const currentTab = tabsViewStore.getCurrentTab;
  if (currentTab) {
    tabsViewStore.closeCurrentTab(currentTab);
  }

  // 導向首頁
  router.push({ name: 'DashboardMabu' }).catch((err) => {
    console.error('[Wizard][流程保護] 導向首頁失敗:', err);
  });
};

/**
 * 檢查 accountType 是否合法
 */
const validateAccountType = (accountType: string | undefined): accountType is AccountType => {
  return accountType === 'masterAgent' || accountType === 'masterAgentX';
};

/**
 * 初始化 Wizard：檢查是否為非法進入
 */
const initializeWizard = () => {
  const accountType = route.query.accountType as string | undefined;

  console.log('[Wizard][初始化] 檢查 accountType:', accountType);

  // 檢查 accountType 是否存在且合法
  if (!accountType || !validateAccountType(accountType)) {
    console.warn('[Wizard][流程保護] 非法進入：無法判斷建立程序種類', { accountType });
    Modal.warning({
      title: '無法進入建立程序',
      content: '無法判斷建立程序種類，將關閉此頁',
      okText: '確認',
      onOk: () => {
        closeWizardAndGoHome();
      },
    });
    return false;
  }

  // 設定 accountType
  formModel.accountType = accountType;
  isWizardActive.value = true;
  wizardStateManager.setActive(true); // 同步全局狀態
  console.log('[Wizard][初始化] Wizard 已啟動，accountType:', accountType);
  return true;
};

const goBack = () => {
  // 根據 accountType 返回到正確的頁面
  const targetRouteName = formModel.accountType === 'masterAgentX'
    ? 'AdminAccountMasterAgentX'
    : 'AdminAccountMasterAgent';
  router.push({ name: targetRouteName });
};

/**
 * Steps 總數（固定為 12，涵蓋所有可能的 steps）
 */
const TOTAL_STEPS = 12;

/**
 * 初始化 Step 狀態
 */
const initializeStepStates = () => {
  for (let i = 0; i < TOTAL_STEPS; i++) {
    if (!stepStates[i]) {
      stepStates[i] = {
        touched: false,
        valid: false,
      };
    }
  }
};

// 初始化 Step 狀態
initializeStepStates();

/**
 * Step 驗證入口（暫時版）
 */
const validateCurrentStep = async (): Promise<boolean> => {
  console.log('[Wizard][validate]', {
    step: currentStep.value,
    data: JSON.parse(JSON.stringify(formModel)),
  });
  return true;
};

/**
 * 檢查 Step 是否可點擊
 */
const isStepClickable = (i: number) => {
  return stepStates[i]?.touched && stepStates[i]?.valid;
};

/**
 * Step 點擊事件處理
 */
const onStepClick = async (targetStep: number) => {
  const clickable = isStepClickable(targetStep);
  console.log('[Wizard][click step]', { step: targetStep, clickable });

  // 尚未填寫過的 step，不允許直接跳
  if (!stepStates[targetStep]?.touched) {
    console.warn('[Wizard] step not touched, blocked', targetStep);
    return;
  }

  // 若目前 step 尚未驗證通過，不允許離開
  if (!stepStates[currentStep.value]?.valid) {
    const ok = await validateCurrentStep();
    if (!ok) {
      console.warn('[Wizard] current step invalid, blocked');
      return;
    }

    stepStates[currentStep.value].touched = true;
    stepStates[currentStep.value].valid = true;
  }

  currentStep.value = targetStep;
};

/**
 * 原有的 next 邏輯（由 onNext 調用）
 * 注意：此函數定義在 onNext 之後，但使用函數聲明以支持提升
 */
async function nextOriginal() {
  /** Step 1 驗證 */
  if (currentStep.value === 0) {
    const isValid = await step1Ref.value?.validate();
    if (!isValid) {
      return;
    }
    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 1 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
    currentStep.value = 1;
    return;
  }

  /** Step 2 驗證並建立帳戶 */
  if (currentStep.value === 1) {
    const isValid = await step2Ref.value?.validate();
    if (!isValid) {
      return;
    }

    // 開始提交
    isSubmitting.value = true;

    try {
      const account = String(formModel.account ?? '').trim();
      const websiteToUse
        = formModel.accountType === 'masterAgentX' ? account : formModel.website;

      // 組裝 payload（對齊舊 Modal 的邏輯）
      const roleIds = Array.isArray(formModel.roles)
        ? formModel.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];

      const internalSettings = buildInternalSettings(account, formModel, userStore.level);
      const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level);

      const payload = {
        account,
        name: String(formModel.name ?? ''),
        roles: roleIds,
        website: websiteToUse,
        currencyCode: formModel.currencyCode,
        password: '123456',
        currencyIndex: 1,
        backendKey: generateSecret(),
        agentBackendKey: generateSecret(),
        hashKey: generateHashKey(),
        internalSettings,
        remoteConfigURLs,
        slotGameSettings: {
          waitingSettleTime: 30,
          oneTimeToken: false,
          prizeDecimalPlaces: 2,
        },
      };

      // Phase 3 過渡：停用 API 呼叫
      // const response = await Api.createMasterAgentAccount(payload);

      // Phase 3 過渡：停用 API 呼叫
      // 處理股東歸屬（若為 masterAgent 且有選擇股東）
      // if (formModel.accountType === 'masterAgent' && formModel.shareholderAccount?.trim()) {
      //   try {
      //     await Api.updateMasterAgentShareholder({
      //       masterAgentAccount: account,
      //       shareholderAccount: formModel.shareholderAccount.trim(),
      //     });
      //   }
      //   catch (error) {
      //     console.error('設定股東歸屬失敗:', error);
      //     // 不阻擋流程，僅記錄錯誤
      //   }
      // }

      // Phase 3 過渡：停用 API 呼叫
      // 取得建立的帳戶 ID
      // 嘗試從 response 取得，若沒有則嘗試從列表查詢（使用 account 作為 key）
      // let accountId: number | null = null;
      // if ((response as any)?.id) {
      //   accountId = Number((response as any).id);
      // }
      // else {
      //   // 若 response 沒有 id，嘗試從列表查詢
      //   try {
      //     const list = await Api.getMasterAgentAccountList({});
      //     const found = (Array.isArray(list) ? list : []).find(
      //       (item: any) => String(item?.account) === account,
      //     );
      //     if (found?.id) {
      //       accountId = Number(found.id);
      //     }
      //   }
      //   catch (error) {
      //     console.warn('無法從列表取得帳戶 ID:', error);
      //   }
      // }
      // createdAccountId.value = accountId;

      // Phase 3 過渡：模擬帳戶 ID（用於後續步驟）
      createdAccountId.value = 99999; // 模擬 ID

      // Phase 3 過渡：輸出當前 Step 和 formModel
      console.log('=== Wizard Step 2 完成（帳戶建立） ===');
      console.log('Current Step Index:', currentStep.value);
      console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
      console.log('Create Payload:', JSON.parse(JSON.stringify(payload)));

      currentStep.value = 2;
    }
    catch (error: any) {
      // Phase 3 過渡：API 已停用，此 catch 不會被觸發
      console.error('建立帳戶失敗:', error);
      const errorMessage
        = error?.response?.data?.message || error?.message || '建立帳戶失敗，請稍後再試';
      message.error(errorMessage);
    }
    finally {
      isSubmitting.value = false;
    }
    return;
  }

  /** Step 3 處理（更新帳戶設定） */
  if (currentStep.value === 2) {
    if (!createdAccountId.value) {
      message.error('無法更新設定：帳戶 ID 不存在');
      return;
    }

    // 如果還沒有記錄初始值，先記錄（進入 Step 3 時的初始狀態）
    if (!step3InitialValues.value) {
      step3InitialValues.value = {
        isSingleWallet: formModel.isSingleWallet,
        singleWallerVersion: formModel.singleWallerVersion,
        vipDowngradeFormula: formModel.vipDowngradeFormula,
        levelFormula: formModel.levelFormula,
        activityFormulaRatio: formModel.activityFormulaRatio,
        levelUpNeedPoint: formModel.levelUpNeedPoint,
        isRanking: formModel.isRanking,
      };
    }

    // 檢查是否有變動（與初始值比較）
    const initial = step3InitialValues.value;
    const hasChanges
      = formModel.isSingleWallet !== initial.isSingleWallet
        || formModel.singleWallerVersion !== initial.singleWallerVersion
        || formModel.vipDowngradeFormula !== initial.vipDowngradeFormula
        || formModel.levelFormula !== initial.levelFormula
        || formModel.activityFormulaRatio !== initial.activityFormulaRatio
        || formModel.levelUpNeedPoint !== initial.levelUpNeedPoint
        || formModel.isRanking !== initial.isRanking;

    // 沒有變動，直接進入下一步
    if (!hasChanges) {
      // Phase 3 過渡：輸出當前 Step 和 formModel
      console.log('=== Wizard Step 3 完成（無變動） ===');
      console.log('Current Step Index:', currentStep.value);
      console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

      message.info('未修改任何設定，跳過此步驟');
      // 進入 Step 4（僅 masterAgent 顯示）
      if (formModel.accountType === 'masterAgent') {
        currentStep.value = 3;
      }
      else {
        // masterAgentX 跳過 Step 4-9，直接進入 Step 10
        currentStep.value = 9;
      }
      return;
    }

    // 有變動，呼叫更新 API
    isSubmitting.value = true;

    try {
      const account = String(formModel.account ?? '').trim();

      // 組裝 activityFormula（僅 masterAgent 需要）
      const activityFormula
        = formModel.accountType === 'masterAgent' && formModel.activityFormulaRatio
          ? {
              name: 'default',
              formula: 'defaultFormula',
              params: { ratio: Number(formModel.activityFormulaRatio) },
            }
          : undefined;

      // 組裝更新 payload（只包含 Step 3 的欄位）
      const updatePayload: Record<string, any> = {
        id: createdAccountId.value,
        account,
        isSingleWallet: Boolean(formModel.isSingleWallet),
      };

      // 僅 masterAgent 需要這些欄位
      if (formModel.accountType === 'masterAgent') {
        updatePayload.singleWallerVersion = Number(formModel.singleWallerVersion);
        updatePayload.vipDowngradeFormula = Number(formModel.vipDowngradeFormula);
        updatePayload.levelFormula = Number(formModel.levelFormula);
        updatePayload.activityFormula = activityFormula;
        updatePayload.levelUpNeedPoint = Number(formModel.levelUpNeedPoint);
        updatePayload.isRanking = Boolean(formModel.isRanking);
      }

      // Phase 3 過渡：停用 API 呼叫
      // await Api.updateMasterAgentAccount(updatePayload);

      // Phase 3 過渡：輸出當前 Step 和 formModel
      console.log('=== Wizard Step 3 完成（有變動） ===');
      console.log('Current Step Index:', currentStep.value);
      console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
      console.log('Update Payload:', JSON.parse(JSON.stringify(updatePayload)));

      message.success('設定更新成功');
      // 進入 Step 4（僅 masterAgent 顯示）
      if (formModel.accountType === 'masterAgent') {
        currentStep.value = 3;
      }
      else {
        // masterAgentX 跳過 Step 4-9，直接進入 Step 10
        currentStep.value = 9;
      }
    }
    catch (error: any) {
      // Phase 3 過渡：API 已停用，此 catch 不會被觸發
      console.error('更新設定失敗:', error);
      const errorMessage
        = error?.response?.data?.message || error?.message || '更新設定失敗，請稍後再試';
      message.error(errorMessage);
      // 失敗時停留在 Step 3，不影響已建立的帳戶
    }
    finally {
      isSubmitting.value = false;
    }
    return;
  }

  /** Step 4 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 3) {
    // 從 Step 4 元件取得處理後的資料
    const processedData = step4Ref.value?.getProcessedData();
    if (processedData) {
      // 更新 formModel
      formModel.networkSettings = processedData.networkSettings;
      formModel.securitySettings = processedData.securitySettings;
    }

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 4 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 5（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 4;
    }
    else {
      // masterAgentX 跳過 Step 4 和 Step 5，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 5 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 4) {
    // Step 5 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 5 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 6（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 5;
    }
    else {
      // masterAgentX 跳過 Step 5 和 Step 6，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 6 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 5) {
    // Step 6 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 6 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 7（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 6;
    }
    else {
      // masterAgentX 跳過 Step 6 和 Step 7，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 7 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 6) {
    // Step 7 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 7 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 8（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 7;
    }
    else {
      // masterAgentX 跳過 Step 7 和 Step 8，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 8 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 7) {
    // Step 8 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 8 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 9（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 8;
    }
    else {
      // masterAgentX 跳過 Step 8 和 Step 9，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 9 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 8) {
    // Step 9 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 9 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 10（所有帳戶類型都顯示）
    currentStep.value = 9;
    return;
  }

  /** Step 10 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 9) {
    // Step 10 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 10 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 11（僅 masterAgent）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 10;
    }
    else {
      // masterAgentX 跳過 Step 11，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 11 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 10) {
    // Step 11 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 11 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 12（僅 masterAgent 且 level === 1）
    if (formModel.accountType === 'masterAgent' && userStore.level === 1) {
      currentStep.value = 11;
    }
    else {
      // 不符合條件，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 12 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 11) {
    // Step 12 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 12 完成（最後一步） ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
    console.log('=== Wizard 完整流程結束 ===');

    // 直接完成（不呼叫 API）
    message.info('進階設定已儲存（待後續 API 整合）');
    // 標記 Wizard 為已完成
    isWizardCompleted.value = true;
    isWizardActive.value = false;
    wizardStateManager.setCompleted(true); // 同步全局狀態
    // TODO: 進入下一步或完成（目前先停留在 Step 12）
  }
}

/**
 * Next（下一步）邏輯
 */
const onNext = async () => {
  const ok = await validateCurrentStep();
  if (!ok) {
    return;
  }

  stepStates[currentStep.value].touched = true;
  stepStates[currentStep.value].valid = true;

  console.log('[Wizard][next]', {
    step: currentStep.value,
    confirmed: true,
    formModel: JSON.parse(JSON.stringify(formModel)),
  });

  // 調用原有的 next 邏輯（但會經過驗證）
  await nextOriginal();
};

/**
 * 計算 Step 的狀態
 */
const getStepStatus = (stepIndex: number): 'wait' | 'process' | 'finish' => {
  if (stepIndex === currentStep.value) {
    return 'process'; // 當前步驟
  }
  if (stepStates[stepIndex]?.valid === true) {
    return 'finish'; // 已完成
  }
  return 'wait'; // 未完成
};

/**
 * 計算是否顯示「下一步」按鈕
 */
const shouldShowNextButton = computed(() => {
  // Step 0-2 都顯示
  if (currentStep.value < 3) {
    return true;
  }
  // Step 3：masterAgent 有 Step 4，masterAgentX 沒有
  if (currentStep.value === 3) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 4：僅 masterAgent 顯示（因為有 Step 5）
  if (currentStep.value === 4) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 5：僅 masterAgent 顯示（因為有 Step 6）
  if (currentStep.value === 5) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 6：僅 masterAgent 顯示（因為有 Step 7）
  if (currentStep.value === 6) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 7：僅 masterAgent 顯示（因為有 Step 8）
  if (currentStep.value === 7) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 8：僅 masterAgent 顯示（因為有 Step 9）
  if (currentStep.value === 8) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 9：僅 masterAgent 顯示（因為有 Step 10）
  if (currentStep.value === 9) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 10：所有帳戶類型都顯示
  if (currentStep.value === 10) {
    return true;
  }
  // Step 11：僅 masterAgent 顯示（因為有 Step 12）
  if (currentStep.value === 11) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 12：僅 masterAgent 且 level === 1 顯示
  if (currentStep.value === 12) {
    return formModel.accountType === 'masterAgent' && userStore.level === 1;
  }
  // Step 12 之後（待實作）
  return false;
});

/**
 * 計算「下一步」按鈕文字
 */
const getNextButtonText = computed(() => {
  if (currentStep.value === 2) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 3) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 4) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 5) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 6) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 7) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 8) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 9) {
    return '下一步';
  }
  if (currentStep.value === 10) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
  if (currentStep.value === 11) {
    return '完成';
  }
  return '下一步';
});

/**
 * 跳過 Step 4
 */
const skipStep4 = () => {
  // 不處理資料，直接進入下一步
  // TODO: 進入 Step 5（目前先停留在 Step 4）
  message.info('已跳過網路與安全設定');
};

const prev = () => {
  if (currentStep.value > 0) {
    // 如果從 Step 3 返回，清除初始值記錄（下次進入時重新記錄）
    if (currentStep.value === 2) {
      step3InitialValues.value = null;
    }
    // 處理跳過邏輯：masterAgentX 從 Step 5 返回時要跳過 Step 4
    let prevStep = currentStep.value - 1;
    if (formModel.accountType === 'masterAgentX' && prevStep === 4) {
      prevStep = 3; // 跳過 Step 4，直接到 Step 3
    }
    if (formModel.accountType === 'masterAgentX' && prevStep === 3) {
      prevStep = 2; // 跳過 Step 4，直接到 Step 3（但這裡 prevStep 已經是 3，所以不需要再調整）
    }
    currentStep.value = prevStep;
  }
};

/**
 * 生命週期：組件掛載時
 */
onMounted(() => {
  // 初始化 Wizard（檢查非法進入）
  const isValid = initializeWizard();
  if (!isValid) {
    return; // 非法進入，已顯示警告並導向首頁
  }

  console.log('[Wizard][生命週期] 組件已掛載，流程保護已啟動（路由守衛）');
});

/**
 * 生命週期：組件卸載前
 */
onBeforeUnmount(() => {
  isWizardActive.value = false;
  // 如果 Wizard 未完成，清除活動狀態
  if (!isWizardCompleted.value) {
    wizardStateManager.setActive(false);
  }
  console.log('[Wizard][生命週期] 組件即將卸載，流程保護已移除');
});
</script>

<template>
  <div class="create-wizard">
    <a-card :bordered="false">
      <div class="header">
        <div class="title">
          導引式建立總代理
        </div>
        <a-space>
          <a-button @click="goBack">
            返回列表
          </a-button>
        </a-space>
      </div>

      <a-steps
        :current="currentStep"
        class="steps steps-readonly"

        @change="onStepClick"
      >
        <a-step
          title="Step 1"
          description="帳戶類型與基本資料"
          :status="getStepStatus(0)"
          :class="{
            'step-clickable': isStepClickable(0),
            'step-disabled': !isStepClickable(0),
          }"
        />
        <a-step
          title="Step 2"
          description="角色與權限"
          :status="getStepStatus(1)"
          :class="{
            'step-clickable': isStepClickable(1),
            'step-disabled': !isStepClickable(1),
          }"
        />
        <a-step
          title="Step 3"
          description="錢包與等級設定"
          :status="getStepStatus(2)"
          :class="{
            'step-clickable': isStepClickable(2),
            'step-disabled': !isStepClickable(2),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 4"
          description="網路與安全設定"
          :status="getStepStatus(3)"
          :class="{
            'step-clickable': isStepClickable(3),
            'step-disabled': !isStepClickable(3),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 5"
          description="Firebase / GA"
          :status="getStepStatus(4)"
          :class="{
            'step-clickable': isStepClickable(4),
            'step-disabled': !isStepClickable(4),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 6"
          description="支付金鑰設定"
          :status="getStepStatus(5)"
          :class="{
            'step-clickable': isStepClickable(5),
            'step-disabled': !isStepClickable(5),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 7"
          description="客服與社群登入"
          :status="getStepStatus(6)"
          :class="{
            'step-clickable': isStepClickable(6),
            'step-disabled': !isStepClickable(6),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 8"
          description="金流設定"
          :status="getStepStatus(7)"
          :class="{
            'step-clickable': isStepClickable(7),
            'step-disabled': !isStepClickable(7),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 9"
          description="簡訊設定"
          :status="getStepStatus(8)"
          :class="{
            'step-clickable': isStepClickable(8),
            'step-disabled': !isStepClickable(8),
          }"
        />
        <a-step
          title="Step 10"
          description="老虎機設定"
          :status="getStepStatus(9)"
          :class="{
            'step-clickable': isStepClickable(9),
            'step-disabled': !isStepClickable(9),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 11"
          description="人機驗證設定"
          :status="getStepStatus(10)"
          :class="{
            'step-clickable': isStepClickable(10),
            'step-disabled': !isStepClickable(10),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent' && userStore.level === 1"
          title="Step 12"
          description="進階設定"
          :status="getStepStatus(11)"
          :class="{
            'step-clickable': isStepClickable(11),
            'step-disabled': !isStepClickable(11),
          }"
        />
      </a-steps>

      <div class="content">
        <Step1BasicInfo
          v-show="currentStep === 0"
          ref="step1Ref"
          :form-model="formModel"
        />
        <Step2Roles
          v-show="currentStep === 1"
          ref="step2Ref"
          :form-model="formModel"
        />
        <Step3WalletAndFormula
          v-show="currentStep === 2"
          :form-model="formModel"
        />
        <Step4NetworkSecurity
          v-show="currentStep === 3 && formModel.accountType === 'masterAgent'"
          ref="step4Ref"
          :form-model="formModel"
        />
        <Step5FirebaseAnalytics
          v-show="currentStep === 4 && formModel.accountType === 'masterAgent'"
          ref="step5Ref"
          :form-model="formModel"
        />
        <Step6PaymentKeys
          v-show="currentStep === 5 && formModel.accountType === 'masterAgent'"
          ref="step6Ref"
          :form-model="formModel"
        />
        <Step7CustomerAndSocial
          v-show="currentStep === 6 && formModel.accountType === 'masterAgent'"
          ref="step7Ref"
          :form-model="formModel"
        />
        <Step8PaymentSettings
          v-show="currentStep === 7 && formModel.accountType === 'masterAgent'"
          ref="step8Ref"
          :form-model="formModel"
        />
        <Step9SmsSettings
          v-show="currentStep === 8 && formModel.accountType === 'masterAgent'"
          ref="step9Ref"
          :form-model="formModel"
        />
        <Step10SlotSettings
          v-show="currentStep === 9"
          ref="step10Ref"
          :form-model="formModel"
        />
        <Step11Recaptcha
          v-show="currentStep === 10 && formModel.accountType === 'masterAgent'"
          ref="step11Ref"
          :form-model="formModel"
        />
        <Step12AdvancedSettings
          v-show="currentStep === 11 && formModel.accountType === 'masterAgent' && userStore.level === 1"
          ref="step12Ref"
          :form-model="formModel"
        />
      </div>

      <div class="footer">
        <a-space>
          <a-button :disabled="currentStep === 0 || isSubmitting" @click="prev">
            上一步
          </a-button>
          <a-button
            v-if="shouldShowNextButton"
            type="primary"
            :loading="isSubmitting"
            @click="onNext"
          >
            {{ getNextButtonText }}
          </a-button>
          <a-button
            v-if="currentStep === 3 && formModel.accountType === 'masterAgent'"
            type="default"
            :disabled="isSubmitting"
            @click="skipStep4"
          >
            跳過
          </a-button>
        </a-space>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.create-wizard {
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.steps {
  margin-bottom: 16px;
}

/* ==============================
   Wizard Steps 強制唯讀模式
   ============================== */

/* 預設：所有 step 一律不顯示 pointer */
.steps-readonly :deep(.ant-steps-item),
.steps-readonly :deep(.ant-steps-item *),
.steps-readonly :deep(.ant-steps-item-container) {
  cursor: default !important;
}

/* 只有「已完成」的 step 才允許顯示 pointer */
.steps-readonly :deep(.step-clickable),
.steps-readonly :deep(.step-clickable .ant-steps-item),
.steps-readonly :deep(.step-clickable .ant-steps-item-container),
.steps-readonly :deep(.step-clickable .ant-steps-item *) {
  cursor: pointer !important;
}

/* 未完成 step：完全不可互動 */
.steps-readonly :deep(.step-disabled),
.steps-readonly :deep(.step-disabled *) {
  pointer-events: none !important;
}

.content {
  padding: 8px 0 0;
  min-height: 240px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
