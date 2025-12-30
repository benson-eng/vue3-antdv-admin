<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Api from '@/api/backend/adminAccount/masterAgent';
import { useUserStore } from '@/store/modules/user';
import { setNewMasterAgentDefaultData } from '@/utils/setDefaultData';
import Step1BasicInfo from '../masterAgent/createWizard/components/Step1BasicInfo.vue';
import Step2Roles from '../masterAgent/createWizard/components/Step2Roles.vue';
import Step3WalletAndFormula from '../masterAgent/createWizard/components/Step3WalletAndFormula.vue';
import Step5FirebaseAnalytics from '../masterAgent/createWizard/components/Step5FirebaseAnalytics.vue';
import Step7CustomerAndSocial from '../masterAgent/createWizard/components/Step7CustomerAndSocial.vue';
import Step8PaymentSettings from '../masterAgent/createWizard/components/Step8PaymentSettings.vue';
import Step11Recaptcha from '../masterAgent/createWizard/components/Step11Recaptcha.vue';
import Step12AdvancedSettings from '../masterAgent/createWizard/components/Step12AdvancedSettings.vue';
import { buildInternalSettings, buildRemoteConfigURLs, generateHashKey, generateSecret } from '../masterAgent/createWizard/utils';

defineOptions({ name: 'CreateWizardDialog' });

const props = withDefaults(defineProps<Props>(), {
  accountType: undefined,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'success': [];
}>();

type AccountType = 'masterAgent' | 'masterAgentX';

interface StepStatus {
  touched: boolean;
  valid: boolean;
}

interface Props {
  visible: boolean;
  accountType?: AccountType;
  editRecord?: Partial<any> | null;
}

const userStore = useUserStore();

const currentStep = ref<number>(0);
const isSubmitting = ref<boolean>(false);
const createdAccountId = ref<number | null>(null);
/**
 * Wizard 是否已完成
 */
const isWizardCompleted = ref<boolean>(false);

/** Step 狀態管理 */
const stepStates = reactive<Record<number, StepStatus>>({});

const step1Ref = ref<InstanceType<typeof Step1BasicInfo> | null>(null);
const step2Ref = ref<InstanceType<typeof Step2Roles> | null>(null);
const step5Ref = ref<InstanceType<typeof Step5FirebaseAnalytics> | null>(null);
const step7Ref = ref<InstanceType<typeof Step7CustomerAndSocial> | null>(null);
const step8Ref = ref<InstanceType<typeof Step8PaymentSettings> | null>(null);
const step11Ref = ref<InstanceType<typeof Step11Recaptcha> | null>(null);
const step12Ref = ref<InstanceType<typeof Step12AdvancedSettings> | null>(null);

/**
 * Step 3 的預設值
 */
const getStep3Defaults = () => ({
  minTransactionBalance: 0,
  sendSmsOTPIntervals: 2,
  authExpireTime: 30,
  spinUnfreezeRatio: 0,
});

const formModel = reactive<{
  accountType: AccountType | undefined;
  account: string;
  name: string;
  website: string;
  currencyCode: string;
  roles: number[];
  boSmsAccount: string;
  boSmsPassWord: string;
  onePhoneNumberToAccountCounts: number;
  /** Step 3 欄位 */
  minTransactionBalance: number;
  sendSmsOTPIntervals: number;
  authExpireTime: number;
  spinUnfreezeRatio: number;
  /** Step 4 欄位 */
  gaKey: string;
  firebaseSdkConfig: string;
  firebaseAdminSdkConfig: string;
  firebaseConfig: string;
  /** Step 5 欄位 */
  serviceEmail: string;
  lineOfficialAccount: string;
  liffID: string;
  lineClientID: string;
  lineClientSecret: string;
  facebookID: string;
  /** Step 6 欄位 */
  myCard_facServiceID: string;
  myCard_secretKey: string;
  myCard_allowIPs: string;
  myCard_topUpSecretKeyA: string;
  myCard_topUpSecretKeyB: string;
  myCard_topUpFacId: string;
  /** Step 7 欄位 */
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
  roles: [],
  boSmsAccount: '',
  boSmsPassWord: '',
  onePhoneNumberToAccountCounts: 1,
  /** Step 3 預設值 */
  ...getStep3Defaults(),
  /** Step 4 預設值 */
  gaKey: '',
  firebaseSdkConfig: '',
  firebaseAdminSdkConfig: '',
  firebaseConfig: '',
  /** Step 5 預設值 */
  serviceEmail: '',
  lineOfficialAccount: '',
  liffID: '',
  lineClientID: '',
  lineClientSecret: '',
  facebookID: '',
  /** Step 8 預設值 */
  myCard_facServiceID: '',
  myCard_secretKey: '',
  myCard_allowIPs: '',
  myCard_topUpSecretKeyA: '',
  myCard_topUpSecretKeyB: '',
  myCard_topUpFacId: '',
  /** Step 7 預設值 */
  reCaptcha_secretKey: '',
  reCaptcha_name: '',
  reCaptcha_siteKey: '',
  reCaptcha_enabled: false,
  /** Step 8 預設值 */
  internalSettings: '',
  remoteConfigURLs: '',
});

/**
 * 檢查 accountType 是否合法
 */
const validateAccountType = (accountType: string | undefined): accountType is AccountType => {
  return accountType === 'masterAgent' || accountType === 'masterAgentX';
};

/**
 * 關閉 Dialog
 */
const handleClose = () => {
  emit('update:visible', false);
};

/**
 * 初始化 Wizard
 */
/**
 * 安全解析 JSON
 */
const safeJsonParse = (raw?: string) => {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  }
  catch {
    return null;
  }
};

/**
 * 載入編輯資料
 */
const loadEditData = (record: Partial<any>) => {
  const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
  const internalObj: any = safeJsonParse(record.internalSettings) ?? {};
  const paymentSettings = internalObj?.paymentSettings ?? {};
  const smsSettings = internalObj?.smsSettings ?? {};
  const accountSettings = internalObj?.accountSettings ?? {};
  const transactionSettings = internalObj?.transactionSettings ?? {};

  const remoteObj: any = safeJsonParse(record.remoteConfigURLs) ?? {};

  // 對齊 vue2：先從 internalSettings.accountSettings.lingLoginConfig 讀取，然後如果 remoteConfigURLs.lingLoginConfig 存在則覆蓋
  const lingLoginConfigBase = accountSettings?.lingLoginConfig ?? {};
  const lingLoginConfigRemote = remoteObj?.lingLoginConfig ?? {};
  const lingLoginConfig = {
    ...lingLoginConfigBase,
    ...lingLoginConfigRemote,
  };

  const myCard = paymentSettings?.myCard ?? {};

  // 設定 createdAccountId
  if (record.id) {
    createdAccountId.value = Number(record.id);
  }

  // 載入資料到 formModel
  Object.assign(formModel, {
    account: record.account ?? '',
    name: record.name ?? '',
    website: record.website ?? '',
    currencyCode: record.currencies?.[0]?.code ?? '',
    roles: roleIds,

    // Firebase 設定
    firebaseAdminSdkConfig: (record as any)?.firebaseAdminSdkConfig ?? '',
    firebaseConfig: (record as any)?.firebaseConfig ?? '',
    gaKey: '',
    firebaseSdkConfig: '',

    // 客服/Line/Facebook（對齊 vue2：優先使用 remoteConfigURLs，如果沒有則使用 internalSettings）
    serviceEmail: remoteObj?.serviceEmail ?? (record as any)?.serviceEmail ?? '',
    lineOfficialAccount: lingLoginConfig?.lineOfficialAccount ?? '',
    liffID: lingLoginConfig?.liffID ?? '',
    lineClientID: lingLoginConfig?.clientID ?? '',
    lineClientSecret: lingLoginConfig?.clientSecret ?? '',
    facebookID: remoteObj?.facebookID ?? (record as any)?.facebookID ?? '',

    // MyCard 設定
    myCard_facServiceID: myCard?.facServiceID ?? '',
    myCard_secretKey: myCard?.secretKey ?? '',
    myCard_allowIPs: myCard?.allowIPs ?? '',
    myCard_topUpSecretKeyA: myCard?.topUpSecretKeyA ?? '',
    myCard_topUpSecretKeyB: myCard?.topUpSecretKeyB ?? '',
    myCard_topUpFacId: myCard?.topUpFacId ?? '',

    // 簡訊設定
    boSmsAccount: smsSettings?.boSmsAccount ?? '',
    boSmsPassWord: smsSettings?.boSmsPassWord ?? '',

    // 交易設定（從 internalSettings.transactionSettings 讀取，對齊 vue2）
    minTransactionBalance: transactionSettings?.minTransactionBalance ?? 0,
    sendSmsOTPIntervals: transactionSettings?.sendSmsOTPIntervals?.value ?? 2,
    authExpireTime: transactionSettings?.authExpireTime?.value ?? 30,
    spinUnfreezeRatio: transactionSettings?.spinUnfreezeRatio ?? 0,
    onePhoneNumberToAccountCounts: accountSettings?.onePhoneNumberToAccountCounts ?? 1,

    // 人機驗證
    reCaptcha_secretKey: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.secretKey ?? '',
    reCaptcha_name: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.name ?? '',
    reCaptcha_siteKey: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.siteKey ?? '',
    reCaptcha_enabled: Boolean((remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.enabled),

    // raw json（僅管理員顯示）
    internalSettings: record.internalSettings ?? '',
    remoteConfigURLs: record.remoteConfigURLs ?? '',
  });
};

const initializeWizard = () => {
  const accountType = props.accountType;

  console.log('[Wizard][初始化] 檢查 accountType:', accountType);

  // 檢查 accountType 是否存在且合法
  if (!accountType || !validateAccountType(accountType)) {
    console.warn('[Wizard][流程保護] 非法進入：無法判斷建立程序種類', { accountType });
    Modal.warning({
      title: '無法進入建立程序',
      content: '無法判斷建立程序種類，將關閉此對話框',
      okText: '確認',
      onOk: () => {
        handleClose();
      },
    });
    return false;
  }

  // 設定 accountType
  formModel.accountType = accountType;

  // 如果是編輯模式，載入資料
  if (props.editRecord) {
    loadEditData(props.editRecord);
    // 編輯模式下，將所有 step 標記為已觸碰和已驗證（因為資料已經存在，通過了建立流程）
    // 注意：TOTAL_STEPS 在後面定義，這裡使用 8（固定值）
    for (let i = 0; i < 8; i++) {
      stepStates[i] = {
        touched: true, // 編輯模式下所有 step 都可以點擊
        valid: true, // 默認已驗證，因為已經是通過建立的程序流程了
      };
    }
    console.log('[Wizard][初始化] 編輯模式，已載入資料，所有 step 已標記為已驗證且可點擊');
  }

  console.log('[Wizard][初始化] Wizard 已啟動，accountType:', accountType);
  return true;
};

/**
 * Steps 總數（固定為 8，涵蓋所有可能的 steps）
 */
const TOTAL_STEPS = 8;

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
 * Step 驗證入口
 */
const validateCurrentStep = async (): Promise<boolean> => {
  const step = currentStep.value;
  console.log('[Wizard][validate]', {
    step,
    data: JSON.parse(JSON.stringify(formModel)),
  });

  // 根據當前 step 調用對應的驗證方法
  let isValid = true;
  switch (step) {
    case 0: // Step 1: 基本資訊
      isValid = await step1Ref.value?.validate() ?? false;
      break;
    case 1: // Step 2: 角色
      isValid = await step2Ref.value?.validate() ?? false;
      break;
    case 2: // Step 3: 錢包與公式（不需要驗證）
    case 3: // Step 4: Firebase Analytics（不需要驗證）
    case 4: // Step 5: 社群登入（不需要驗證）
    case 5: // Step 6: 金流設定（不需要驗證）
    case 6: // Step 7: 人機驗證（不需要驗證）
      // 這些 step 不需要驗證，直接返回 true
      isValid = true;
      break;
    default:
      isValid = true;
      break;
  }

  if (!isValid) {
    message.error('請先完成當前步驟的必填欄位驗證');
  }

  return isValid;
};

/**
 * 檢查 Step 是否可點擊
 */
const isStepClickable = (i: number) => {
  // 編輯模式下，所有 step 都可以點擊（touched 為 true）
  if (props.editRecord) {
    return stepStates[i]?.touched === true;
  }
  // 創建模式下，只有已驗證的 step 可以點擊
  return stepStates[i]?.touched && stepStates[i]?.valid;
};

/**
 * Step 點擊事件處理
 */
const onStepClick = async (targetStep: number) => {
  const clickable = isStepClickable(targetStep);
  console.log('[Wizard][click step]', { step: targetStep, clickable, isEdit: Boolean(props.editRecord) });

  // 編輯模式下，檢查當前 step 的驗證狀態
  if (props.editRecord) {
    // 檢查當前 step 的驗證機制是否有不符的
    const ok = await validateCurrentStep();
    if (!ok) {
      message.warning('當前步驟驗證失敗，無法切換。請先完成當前步驟的驗證。');
      console.warn('[Wizard] current step validation failed in edit mode, blocked');
      return;
    }

    // 驗證通過，更新當前 step 狀態並允許切換
    stepStates[currentStep.value].touched = true;
    stepStates[currentStep.value].valid = true;
    currentStep.value = targetStep;
    return;
  }

  // 創建模式下的原有邏輯
  // 尚未填寫過的 step，不允許直接跳
  if (!stepStates[targetStep]?.touched) {
    message.warning('請先完成前面的步驟');
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

  /** Step 2 驗證 */
  if (currentStep.value === 1) {
    const isValid = await step2Ref.value?.validate();
    if (!isValid) {
      return;
    }

    console.log('=== Wizard Step 2 完成 ===');
    currentStep.value = 2;
    return;
  }

  /** Step 3 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 2) {
    // Step 3 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 3 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 4（僅 masterAgent 顯示）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 3;
    }
    else {
      // masterAgentX 跳過 Step 4-7，直接完成
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 4 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 3) {
    // Step 4 不需要額外處理，資料已經在 formModel 中

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

  /** Step 7 處理：建立帳戶並設定預設資料 */
  if (currentStep.value === 6) {
    // 如果是編輯模式，跳過創建帳戶
    if (props.editRecord && createdAccountId.value) {
      console.log('=== Wizard Step 7 完成（編輯模式，跳過創建） ===');
      // 進入 Step 8（僅 masterAgent 且 level === 1）
      if (formModel.accountType === 'masterAgent' && userStore.level === 1) {
        currentStep.value = 7;
      }
      else {
        // 如果不是 level 1 或不是 masterAgent，在 Step 7 完成時直接調用更新 API
        isSubmitting.value = true;
        try {
          const account = String(formModel.account ?? '').trim();
          const websiteToUse
            = formModel.accountType === 'masterAgentX' ? account : formModel.website;

          const roleIds = Array.isArray(formModel.roles)
            ? formModel.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
            : [];

          const internalSettings = buildInternalSettings(account, formModel, userStore.level);
          const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

          // Vue2 對齊：構建 reCaptchaV2Settings（作為獨立欄位傳遞）
          const reCaptchaHasValue = Boolean(
            formModel.reCaptcha_secretKey || formModel.reCaptcha_name || formModel.reCaptcha_siteKey,
          );
          const reCaptchaV2Settings = reCaptchaHasValue
            ? {
                masterAgent: account,
                secretKey: String(formModel.reCaptcha_secretKey ?? ''),
                name: String(formModel.reCaptcha_name ?? ''),
                siteKey: String(formModel.reCaptcha_siteKey ?? ''),
                enabled: Boolean(formModel.reCaptcha_enabled),
                platform: 'web',
              }
            : undefined;

          // Vue2 對齊：從 editRecord 保留必要欄位，從 formModel 構建更新欄位
          const updatePayload = {
            id: createdAccountId.value,
            account,
            name: String(formModel.name ?? props.editRecord.name ?? ''),
            prefix: props.editRecord.prefix,
            isEnabled: Boolean(props.editRecord.isEnabled), // 保持原有狀態
            isMaintained: Boolean(props.editRecord.isMaintained), // 保持原有狀態
            roles: roleIds,
            website: websiteToUse,
            hashKey: props.editRecord.hashKey, // 保留原有 hashKey
            currencyCode: formModel.currencyCode ?? props.editRecord.currencyCode,
            apiDomain: (formModel as any).apiDomain ?? props.editRecord.apiDomain,
            whiteIPList: (formModel as any).whiteIPList ?? props.editRecord.whiteIPList ?? '',
            cdnList: (formModel as any).cdnList ?? props.editRecord.cdnList ?? '',
            proxyList: (formModel as any).proxyList ?? props.editRecord.proxyList ?? '',
            currencies: props.editRecord.currencies ?? [], // 保留原有 currencies
            isSingleWallet: (formModel as any).isSingleWallet !== undefined
              ? Boolean((formModel as any).isSingleWallet)
              : props.editRecord.isSingleWallet,
            singleWallerVersion: (formModel as any).singleWallerVersion !== undefined
              ? Number((formModel as any).singleWallerVersion)
              : props.editRecord.singleWallerVersion,
            vipDowngradeFormula: (formModel as any).vipDowngradeFormula !== undefined
              ? Number((formModel as any).vipDowngradeFormula)
              : props.editRecord.vipDowngradeFormula,
            isRanking: Boolean((formModel as any).isRanking ?? props.editRecord.isRanking),
            levelFormula: (formModel as any).levelFormula !== undefined
              ? Number((formModel as any).levelFormula)
              : props.editRecord.levelFormula,
            activityFormula: (formModel as any).activityFormula ?? props.editRecord.activityFormula,
            levelUpNeedPoint: (formModel as any).levelUpNeedPoint !== undefined
              ? (formModel as any).levelUpNeedPoint
              : props.editRecord.levelUpNeedPoint,
            gaKey: formModel.gaKey ?? props.editRecord.gaKey ?? '',
            firebaseSdkConfig: formModel.firebaseSdkConfig ?? props.editRecord.firebaseSdkConfig ?? '',
            firebaseAdminSdkConfig: formModel.firebaseAdminSdkConfig ?? props.editRecord.firebaseAdminSdkConfig,
            firebaseConfig: formModel.firebaseConfig ?? props.editRecord.firebaseConfig,
            iosPaymentKey: (formModel as any).iosPaymentKey ?? props.editRecord.iosPaymentKey ?? '',
            androidPaymentKey: (formModel as any).androidPaymentKey ?? props.editRecord.androidPaymentKey ?? '',
            ecPaymentKey: (formModel as any).ecPaymentKey ?? props.editRecord.ecPaymentKey ?? '',
            gcpKey: (formModel as any).gcpKey ?? props.editRecord.gcpKey ?? '',
            androidBundleID: (formModel as any).androidBundleID ?? props.editRecord.androidBundleID,
            iosBundleID: (formModel as any).iosBundleID ?? props.editRecord.iosBundleID,
            serviceEmail: formModel.serviceEmail ?? props.editRecord.serviceEmail,
            facebookID: formModel.facebookID ?? props.editRecord.facebookID,
            backendKey: props.editRecord.backendKey, // 保留原有 backendKey
            agentBackendKey: props.editRecord.agentBackendKey, // 保留原有 agentBackendKey
            isAllowMemberNicknameDuplicate: (formModel as any).isAllowMemberNicknameDuplicate !== undefined
              ? Boolean((formModel as any).isAllowMemberNicknameDuplicate)
              : props.editRecord.isAllowMemberNicknameDuplicate,
            internalSettings,
            remoteConfigURLs,
            reCaptchaV2Settings, // Vue2 對齊：作為獨立欄位
          };

          // 調用 API 更新帳戶
          await Api.updateMasterAgentAccount(updatePayload);

          console.log('=== Wizard 編輯模式完成（Step 7） ===');
          console.log('Update Payload:', JSON.parse(JSON.stringify(updatePayload)));

          message.success('設定更新成功');
        }
        catch (error: any) {
          console.error('更新設定失敗:', error);
          const errorMessage
            = error?.response?.data?.message || error?.message || '更新設定失敗，請稍後再試';
          message.error(errorMessage);
          isSubmitting.value = false;
          return;
        }
        finally {
          isSubmitting.value = false;
        }

        // 標記 Wizard 為已完成
        isWizardCompleted.value = true;
        // 觸發 success 事件
        emit('success');
        // 關閉 Dialog
        handleClose();
      }
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
      const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

      const payload = {
        account,
        name: String(formModel.name ?? ''),
        prefix: undefined,
        roles: roleIds,
        website: websiteToUse,
        currencyCode: formModel.currencyCode,
        currencyName: formModel.currencyCode,
        password: '123456',
        currencyIndex: 1,
        backendKey: generateSecret(),
        agentBackendKey: generateSecret(),
        hashKey: generateHashKey(),
        internalSettings,
        remoteConfigURLs,
        isEnabled: true,
        isSingleWallet: Boolean((formModel as any).isSingleWallet ?? false),
        singleWallerVersion: Number((formModel as any).singleWallerVersion ?? 1),
        vipDowngradeFormula: Number((formModel as any).vipDowngradeFormula ?? 1),
        levelFormula: Number((formModel as any).levelFormula ?? 0),
        isAllowMemberNicknameDuplicate: Boolean((formModel as any).isAllowMemberNicknameDuplicate ?? false),
        whiteIPList: (formModel as any).whiteIPList ?? '',
        cdnList: (formModel as any).cdnList ?? '',
        proxyList: (formModel as any).proxyList ?? '',
        activityFormula: (formModel as any).activityFormula,
        gaKey: formModel.gaKey ?? '',
        firebaseSdkConfig: formModel.firebaseSdkConfig ?? '',
        iosPaymentKey: (formModel as any).iosPaymentKey ?? '',
        androidPaymentKey: (formModel as any).androidPaymentKey ?? '',
        ecPaymentKey: (formModel as any).ecPaymentKey ?? '',
        gcpKey: (formModel as any).gcpKey ?? '',
        levelUpNeedPoint: (formModel as any).levelUpNeedPoint ?? undefined,
      };

      // 呼叫 API 建立帳戶
      await Api.createMasterAgentAccount(payload);

      // 建立成功後，重新獲取列表以取得新帳戶的完整資訊（包含 ID）
      const list = await Api.getMasterAgentAccountList({});
      const newMasterAgent = list.find((ma: any) => ma.account === account);

      if (newMasterAgent) {
        // 調用 setNewMasterAgentDefaultData 設置預設資料
        try {
          await setNewMasterAgentDefaultData(
            newMasterAgent.id,
            newMasterAgent.account,
            newMasterAgent.name || account,
            newMasterAgent.website || websiteToUse || '',
          );
          console.log('=== 預設資料設定完成 ===');
        }
        catch (error: any) {
          console.error('設定預設資料失敗:', error);
          // 不阻斷流程，僅記錄錯誤
          message.warning('帳戶建立成功，但設定預設資料時發生錯誤，請稍後手動檢查');
        }
      }

      // 儲存帳戶 ID（用於後續步驟）
      createdAccountId.value = newMasterAgent?.id || null;

      console.log('=== Wizard Step 7 完成（帳戶建立） ===');
      console.log('Current Step Index:', currentStep.value);
      console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
      console.log('Create Payload:', JSON.parse(JSON.stringify(payload)));
      console.log('Created Account ID:', createdAccountId.value);

      // 進入 Step 8（僅 masterAgent 且 level === 1）
      if (formModel.accountType === 'masterAgent' && userStore.level === 1) {
        currentStep.value = 7;
      }
      else {
        // 不符合條件，直接完成
        isWizardCompleted.value = true;
        // 觸發 success 事件
        emit('success');
        // 關閉 Dialog
        handleClose();
      }
    }
    catch (error: any) {
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

  /** Step 8 處理（僅整理資料，不呼叫 API） */
  if (currentStep.value === 7) {
    // Step 8 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 8 完成（最後一步） ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
    console.log('=== Wizard 完整流程結束 ===');

    // 如果是編輯模式，更新帳戶
    console.log('=== Wizard Step 8 完成（編輯模式） ===', props.editRecord, createdAccountId.value);
    if (props.editRecord && createdAccountId.value) {
      isSubmitting.value = true;
      try {
        const account = String(formModel.account ?? '').trim();
        const websiteToUse
          = formModel.accountType === 'masterAgentX' ? account : formModel.website;

        const roleIds = Array.isArray(formModel.roles)
          ? formModel.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        const internalSettings = buildInternalSettings(account, formModel, userStore.level);
        const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

        // Vue2 對齊：構建 reCaptchaV2Settings（作為獨立欄位傳遞）
        const reCaptchaHasValue = Boolean(
          formModel.reCaptcha_secretKey || formModel.reCaptcha_name || formModel.reCaptcha_siteKey,
        );
        const reCaptchaV2Settings = reCaptchaHasValue
          ? {
              masterAgent: account,
              secretKey: String(formModel.reCaptcha_secretKey ?? ''),
              name: String(formModel.reCaptcha_name ?? ''),
              siteKey: String(formModel.reCaptcha_siteKey ?? ''),
              enabled: Boolean(formModel.reCaptcha_enabled),
              platform: 'web',
            }
          : undefined;

        // Vue2 對齊：從 editRecord 保留必要欄位，從 formModel 構建更新欄位
        const updatePayload = {
          id: createdAccountId.value,
          account,
          name: String(formModel.name ?? props.editRecord.name ?? ''),
          prefix: props.editRecord.prefix,
          isEnabled: Boolean(props.editRecord.isEnabled), // 保持原有狀態
          isMaintained: Boolean(props.editRecord.isMaintained), // 保持原有狀態
          roles: roleIds,
          website: websiteToUse,
          hashKey: props.editRecord.hashKey, // 保留原有 hashKey
          currencyCode: formModel.currencyCode ?? props.editRecord.currencyCode,
          apiDomain: (formModel as any).apiDomain ?? props.editRecord.apiDomain,
          whiteIPList: (formModel as any).whiteIPList ?? props.editRecord.whiteIPList ?? '',
          cdnList: (formModel as any).cdnList ?? props.editRecord.cdnList ?? '',
          proxyList: (formModel as any).proxyList ?? props.editRecord.proxyList ?? '',
          currencies: props.editRecord.currencies ?? [], // 保留原有 currencies
          isSingleWallet: (formModel as any).isSingleWallet !== undefined
            ? Boolean((formModel as any).isSingleWallet)
            : props.editRecord.isSingleWallet,
          singleWallerVersion: (formModel as any).singleWallerVersion !== undefined
            ? Number((formModel as any).singleWallerVersion)
            : props.editRecord.singleWallerVersion,
          vipDowngradeFormula: (formModel as any).vipDowngradeFormula !== undefined
            ? Number((formModel as any).vipDowngradeFormula)
            : props.editRecord.vipDowngradeFormula,
          isRanking: Boolean((formModel as any).isRanking ?? props.editRecord.isRanking),
          levelFormula: (formModel as any).levelFormula !== undefined
            ? Number((formModel as any).levelFormula)
            : props.editRecord.levelFormula,
          activityFormula: (formModel as any).activityFormula ?? props.editRecord.activityFormula,
          levelUpNeedPoint: (formModel as any).levelUpNeedPoint !== undefined
            ? (formModel as any).levelUpNeedPoint
            : props.editRecord.levelUpNeedPoint,
          gaKey: formModel.gaKey ?? props.editRecord.gaKey ?? '',
          firebaseSdkConfig: formModel.firebaseSdkConfig ?? props.editRecord.firebaseSdkConfig ?? '',
          firebaseAdminSdkConfig: formModel.firebaseAdminSdkConfig ?? props.editRecord.firebaseAdminSdkConfig,
          firebaseConfig: formModel.firebaseConfig ?? props.editRecord.firebaseConfig,
          iosPaymentKey: (formModel as any).iosPaymentKey ?? props.editRecord.iosPaymentKey ?? '',
          androidPaymentKey: (formModel as any).androidPaymentKey ?? props.editRecord.androidPaymentKey ?? '',
          ecPaymentKey: (formModel as any).ecPaymentKey ?? props.editRecord.ecPaymentKey ?? '',
          gcpKey: (formModel as any).gcpKey ?? props.editRecord.gcpKey ?? '',
          androidBundleID: (formModel as any).androidBundleID ?? props.editRecord.androidBundleID,
          iosBundleID: (formModel as any).iosBundleID ?? props.editRecord.iosBundleID,
          serviceEmail: formModel.serviceEmail ?? props.editRecord.serviceEmail,
          facebookID: formModel.facebookID ?? props.editRecord.facebookID,
          backendKey: props.editRecord.backendKey, // 保留原有 backendKey
          agentBackendKey: props.editRecord.agentBackendKey, // 保留原有 agentBackendKey
          isAllowMemberNicknameDuplicate: (formModel as any).isAllowMemberNicknameDuplicate !== undefined
            ? Boolean((formModel as any).isAllowMemberNicknameDuplicate)
            : props.editRecord.isAllowMemberNicknameDuplicate,
          internalSettings,
          remoteConfigURLs,
          reCaptchaV2Settings, // Vue2 對齊：作為獨立欄位
        };

        // 調用 API 更新帳戶
        await Api.updateMasterAgentAccount(updatePayload);

        console.log('=== Wizard 編輯模式完成 ===');
        console.log('Update Payload:', JSON.parse(JSON.stringify(updatePayload)));

        message.success('設定更新成功');
      }
      catch (error: any) {
        console.error('更新設定失敗:', error);
        const errorMessage
          = error?.response?.data?.message || error?.message || '更新設定失敗，請稍後再試';
        message.error(errorMessage);
        isSubmitting.value = false;
        return;
      }
      finally {
        isSubmitting.value = false;
      }
    }
    else {
      // 直接完成（不呼叫 API）
      message.info('進階設定已儲存（待後續 API 整合）');
    }

    // 標記 Wizard 為已完成
    isWizardCompleted.value = true;
    // 觸發 success 事件
    emit('success');
    // 關閉 Dialog
    handleClose();
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
  // Step 7：僅 masterAgent 且 level === 1 顯示
  if (currentStep.value === 7) {
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
    return '完成';
  }
  return '下一步';
});

const prev = () => {
  if (currentStep.value > 0) {
    currentStep.value = currentStep.value - 1;
  }
};

/**
 * 重置 Wizard 狀態
 */
const resetWizard = () => {
  currentStep.value = 0;
  isSubmitting.value = false;
  createdAccountId.value = null;
  isWizardCompleted.value = false;

  // 重置 formModel
  Object.assign(formModel, {
    accountType: props.accountType || 'masterAgent',
    account: '',
    name: '',
    website: '',
    currencyCode: '',
    shareholderAccount: '',
    roles: [],
    ...getStep3Defaults(),
    gaKey: '',
    firebaseSdkConfig: '',
    firebaseAdminSdkConfig: '',
    firebaseConfig: '',
    serviceEmail: '',
    lineOfficialAccount: '',
    liffID: '',
    lineClientID: '',
    lineClientSecret: '',
    facebookID: '',
    myCard_facServiceID: '',
    myCard_secretKey: '',
    myCard_allowIPs: '',
    myCard_topUpSecretKeyA: '',
    myCard_topUpSecretKeyB: '',
    myCard_topUpFacId: '',
    boSmsAccount: '',
    boSmsPassWord: '',
    onePhoneNumberToAccountCounts: 1,
    reCaptcha_secretKey: '',
    reCaptcha_name: '',
    reCaptcha_siteKey: '',
    reCaptcha_enabled: false,
    internalSettings: '',
    remoteConfigURLs: '',
  });

  // 重置 stepStates
  for (let i = 0; i < TOTAL_STEPS; i++) {
    stepStates[i] = {
      touched: false,
      valid: false,
    };
  }
};

/**
 * 監聽 visible 變化，當 Dialog 開啟時初始化
 */
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // Dialog 開啟時初始化
      resetWizard();
      initializeWizard();
    }
  },
  { immediate: true },
);

/**
 * 生命週期：組件掛載時
 */
onMounted(() => {
  if (props.visible) {
    const isValid = initializeWizard();
    if (!isValid) {
      return;
    }
    console.log('[Wizard][生命週期] 組件已掛載');
  }
});

/**
 * 生命週期：組件卸載前
 */
onBeforeUnmount(() => {
  console.log('[Wizard][生命週期] 組件即將卸載');
});
</script>

<template>
  <a-modal
    :open="visible"
    :title="props.editRecord ? '導引式編輯' : '導引式建立'"
    width="90%"
    :footer="null"
    :mask-closable="false"
    :keyboard="false"
    :style="{ top: '40px' }"
    @cancel="handleClose"
  >
    <div class="create-wizard-dialog">
      <a-steps
        :current="currentStep"
        class="steps steps-readonly"
        @change="onStepClick"
      >
        <a-step
          title="Step 1"
          description="基礎設定"
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
          description="交易設定"
          :status="getStepStatus(2)"
          :class="{
            'step-clickable': isStepClickable(2),
            'step-disabled': !isStepClickable(2),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 4"
          description="Firebase"
          :status="getStepStatus(3)"
          :class="{
            'step-clickable': isStepClickable(3),
            'step-disabled': !isStepClickable(3),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 5"
          description="社群登入"
          :status="getStepStatus(4)"
          :class="{
            'step-clickable': isStepClickable(4),
            'step-disabled': !isStepClickable(4),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 6"
          description="金流設定"
          :status="getStepStatus(5)"
          :class="{
            'step-clickable': isStepClickable(5),
            'step-disabled': !isStepClickable(5),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 7"
          description="人機驗證設定"
          :status="getStepStatus(6)"
          :class="{
            'step-clickable': isStepClickable(6),
            'step-disabled': !isStepClickable(6),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent' && userStore.level === 1"
          title="Step 8"
          description="進階設定"
          :status="getStepStatus(7)"
          :class="{
            'step-clickable': isStepClickable(7),
            'step-disabled': !isStepClickable(7),
          }"
        />
      </a-steps>

      <div class="content">
        <Step1BasicInfo
          v-show="currentStep === 0"
          ref="step1Ref"
          :form-model="formModel"
          :is-edit="Boolean(props.editRecord)"
        />
        <Step2Roles
          v-show="currentStep === 1"
          ref="step2Ref"
          :form-model="formModel"
          @update:roles="(value) => { formModel.roles = value; }"
        />
        <Step3WalletAndFormula
          v-show="currentStep === 2"
          :form-model="formModel"
        />
        <Step5FirebaseAnalytics
          v-show="currentStep === 3 && formModel.accountType === 'masterAgent'"
          ref="step5Ref"
          :form-model="formModel"
        />
        <Step7CustomerAndSocial
          v-show="currentStep === 4 && formModel.accountType === 'masterAgent'"
          ref="step7Ref"
          :form-model="formModel"
        />
        <Step8PaymentSettings
          v-show="currentStep === 5 && formModel.accountType === 'masterAgent'"
          ref="step8Ref"
          :form-model="formModel"
        />
        <Step11Recaptcha
          v-show="currentStep === 6 && formModel.accountType === 'masterAgent'"
          ref="step11Ref"
          :form-model="formModel"
        />
        <Step12AdvancedSettings
          v-show="currentStep === 7 && formModel.accountType === 'masterAgent' && userStore.level === 1"
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
          <!-- <a-button
            v-if="currentStep === 3 && formModel.accountType === 'masterAgent'"
            type="default"
            :disabled="isSubmitting"
            @click="skipStep4"
          >
            跳過
          </a-button> -->
          <a-button @click="handleClose">
            取消
          </a-button>
        </a-space>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.create-wizard-dialog {
  padding: 16px 0;
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
