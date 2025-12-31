<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Api from '@/api/backend/adminAccount/masterAgent';
import { useUserStore } from '@/store/modules/user';
import { setNewMasterAgentDefaultData } from '@/utils/setDefaultData';
import Step1BasicInfo from '../masterAgent/createWizard/components/Step1BasicInfo.vue';
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
/**
 * Dialog Key，用於強制重新創建子組件，重置密碼輸入框的眼睛狀態
 */
const dialogKey = ref<number>(0);
/**
 * 編輯模式下的完整角色對象數組（用於 Step1 檢查不在清單中的角色）
 */
const editRecordRoles = ref<Array<{ id: number; name: string; [key: string]: any }>>([]);

/** Step 狀態管理 */
const stepStates = reactive<Record<number, StepStatus>>({});

const step1Ref = ref<InstanceType<typeof Step1BasicInfo> | null>(null);
const step5Ref = ref<InstanceType<typeof Step5FirebaseAnalytics> | null>(null);
const step7Ref = ref<InstanceType<typeof Step7CustomerAndSocial> | null>(null);
const step8Ref = ref<InstanceType<typeof Step8PaymentSettings> | null>(null);
const step11Ref = ref<InstanceType<typeof Step11Recaptcha> | null>(null);
const step12Ref = ref<InstanceType<typeof Step12AdvancedSettings> | null>(null);

/**
 * Step 3 的預設值
 */
const getStep3Defaults = () => ({
  freezeDuration: 7,
  orderExpireTime: 3,
  otpMode: 'Real',
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
  accountPointsWarningValue?: number;
  onePhoneNumberToAccountCounts: number;
  /** Step 9 欄位 */
  smsAccount: string;
  smsPassWord: string;
  cloudSmsAccount: string;
  cloudSmsPassWord: string;
  isOpenOtherSMS?: string;
  useSMSPlatforms?: string;
  /** Step 8 欄位 */
  paymentMode?: string;
  topUpRate?: number;
  soNet?: any;
  nganLuong?: any;
  moPay?: any;
  btPay?: any;
  /** Step 10 欄位（目前未使用，僅保留 slot_prizeDecimalPlaces） */
  slot_prizeDecimalPlaces?: number;
  /** Step 3 欄位 */
  freezeDuration?: number;
  orderExpireTime?: number;
  otpMode?: string;
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
  myCardWebsite?: string;
  myCardRedirectVerifyWebsite?: string;
  myCardCallbackDomain?: string;
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
  isSingleWallet?: boolean;
  singleWallerVersion?: number;
  vipDowngradeFormula?: number;
  levelFormula?: number;
  activityFormula?: number;
  levelUpNeedPoint?: number;
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
  accountPointsWarningValue: 3000, // 預設值，確保 lv1 和 lv2 送出相同資料
  onePhoneNumberToAccountCounts: 1,
  /** Step 9 預設值 */
  smsAccount: '',
  smsPassWord: '',
  cloudSmsAccount: '',
  cloudSmsPassWord: '',
  isOpenOtherSMS: undefined,
  useSMSPlatforms: undefined,
  /** Step 8 預設值 */
  paymentMode: 'Real',
  topUpRate: 100,
  soNet: undefined,
  nganLuong: undefined,
  moPay: undefined,
  btPay: undefined,
  /** Step 10 預設值（目前未使用，僅保留 slot_prizeDecimalPlaces） */
  slot_prizeDecimalPlaces: 2,
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
  myCardWebsite: '',
  myCardRedirectVerifyWebsite: '',
  myCardCallbackDomain: '',
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
  /** Step 12 預設值 */
  isSingleWallet: false,
  singleWallerVersion: 1,
  vipDowngradeFormula: 1,
  levelFormula: 0,
  activityFormula: 1,
  levelUpNeedPoint: undefined,
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
  // 保存完整的角色對象（用於 Step1 檢查不在清單中的角色）
  editRecordRoles.value = (record.roles || []).map((r: any) => ({
    id: Number(r.id),
    name: r.name || `角色 ${r.id}`,
    ...r,
  })).filter((r: any) => Number.isFinite(r.id));

  const roleIds = editRecordRoles.value.map((r: any) => r.id);
  const internalObj: any = safeJsonParse(record.internalSettings) ?? {};
  const paymentSettings = internalObj?.paymentSettings ?? {};
  const smsSettings = internalObj?.smsSettings ?? {};
  const accountSettings = internalObj?.accountSettings ?? {};
  const transactionSettings = internalObj?.transactionSettings ?? {};
  const slotGameSettings = internalObj?.slotGameSettings ?? {};

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
    firebaseSdkConfig: (record as any)?.firebaseSdkConfig ?? '',

    // 客服/Line/Facebook（對齊 vue2：優先使用 remoteConfigURLs，如果沒有則使用 internalSettings）
    serviceEmail: remoteObj?.serviceEmail ?? (record as any)?.serviceEmail ?? '',
    lineOfficialAccount: lingLoginConfig?.lineOfficialAccount ?? '',
    liffID: lingLoginConfig?.liffID ?? '',
    lineClientID: lingLoginConfig?.clientID ?? '',
    lineClientSecret: lingLoginConfig?.clientSecret ?? '',
    facebookID: remoteObj?.facebookID ?? (record as any)?.facebookID ?? '',

    // MyCard 設定
    myCardWebsite: myCard?.website ?? '',
    myCardRedirectVerifyWebsite: myCard?.myCardRedirectVerifyWebsite ?? '',
    myCardCallbackDomain: myCard?.callbackDomain ?? '',
    myCard_facServiceID: myCard?.facServiceID ?? '',
    myCard_secretKey: myCard?.secretKey ?? '',
    myCard_allowIPs: myCard?.allowIPs ?? '',
    myCard_topUpSecretKeyA: myCard?.topUpSecretKeyA ?? '',
    myCard_topUpSecretKeyB: myCard?.topUpSecretKeyB ?? '',
    myCard_topUpFacId: myCard?.topUpFacId ?? '',

    // Payment 設定
    paymentMode: paymentSettings?.paymentMode ?? 'Real',
    topUpRate: paymentSettings?.topUpRate ?? 100,
    soNet: paymentSettings?.soNet ?? undefined,
    nganLuong: paymentSettings?.nganLuong ?? undefined,
    moPay: paymentSettings?.moPay ?? undefined,
    btPay: paymentSettings?.btPay ?? undefined,

    // 簡訊設定
    boSmsAccount: smsSettings?.boSmsAccount ?? '',
    boSmsPassWord: smsSettings?.boSmsPassWord ?? '',
    accountPointsWarningValue: smsSettings?.accountPointsWarningValue ?? 3000, // 對齊新建模式的預設值
    smsAccount: smsSettings?.smsAccount ?? '',
    smsPassWord: smsSettings?.smsPassWord ?? '',
    cloudSmsAccount: smsSettings?.cloudSmsAccount ?? '',
    cloudSmsPassWord: smsSettings?.cloudSmsPassWord ?? '',
    isOpenOtherSMS: smsSettings?.isOpenOtherSMS ?? undefined,
    useSMSPlatforms: smsSettings?.useSMSPlatforms ?? undefined,

    // 交易設定（從 internalSettings.transactionSettings 讀取，對齊 vue2）
    freezeDuration: transactionSettings?.freezeDuration?.value ?? 7,
    orderExpireTime: transactionSettings?.orderExpireTime?.value ?? 3,
    otpMode: transactionSettings?.otpMode ?? 'Real',
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

    // Slot 遊戲設定（目前僅使用 prizeDecimalPlaces）
    slot_prizeDecimalPlaces: slotGameSettings?.prizeDecimalPlaces ?? 2,

    // Step 8 進階設定欄位（從 record 直接讀取）
    apiDomain: (record as any)?.apiDomain ?? '',
    whiteIPList: (record as any)?.whiteIPList ?? '',
    cdnList: (record as any)?.cdnList ?? '',
    proxyList: (record as any)?.proxyList ?? '',
    hashKey: (record as any)?.hashKey ?? '',
    isSingleWallet: (record as any)?.isSingleWallet ?? false,
    singleWallerVersion: (record as any)?.singleWallerVersion ?? 1,
    vipDowngradeFormula: (record as any)?.vipDowngradeFormula ?? 1,
    levelFormula: (record as any)?.levelFormula ?? 0,
    activityFormula: (record as any)?.activityFormula ?? 1,
    levelUpNeedPoint: (record as any)?.levelUpNeedPoint ?? undefined,
    isAllowMemberNicknameDuplicate: (record as any)?.isAllowMemberNicknameDuplicate ?? false,

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
    // 注意：TOTAL_STEPS 在後面定義，這裡使用 7（固定值，已移除 Step 2）
    for (let i = 0; i < 7; i++) {
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
 * Steps 總數（固定為 7，涵蓋所有可能的 steps，已移除 Step 2）
 */
const TOTAL_STEPS = 7;

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
    case 0: // Step 1: 基本資訊（包含角色）
      isValid = await step1Ref.value?.validate() ?? false;
      break;
    case 1: // Step 2: 錢包與公式（不需要驗證）
      isValid = true;
      break;
    case 2: // Step 3: Firebase Analytics（Step5FirebaseAnalytics，需要驗證 JSON 格式）
      isValid = await step5Ref.value?.validate() ?? false;
      break;
    case 3: // Step 4: 社群登入（不需要驗證）
      isValid = true;
      break;
    case 4: // Step 5: 金流設定（不需要驗證）
      isValid = true;
      break;
    case 5: // Step 6: 人機驗證（不需要驗證）
      isValid = true;
      break;
    case 6: // Step 7: 進階設定（需要驗證金鑰）
      isValid = await step12Ref.value?.validate() ?? false;
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
  // 如果點擊的是當前 step，不需要處理
  if (targetStep === currentStep.value) {
    return;
  }

  const clickable = isStepClickable(targetStep);
  console.log('[Wizard][click step]', { step: targetStep, clickable, isEdit: Boolean(props.editRecord) });

  // 無論是編輯模式還是創建模式，切換前都要驗證當前 step
  const ok = await validateCurrentStep();
  if (!ok) {
    message.warning('當前步驟驗證失敗，無法切換。請先完成當前步驟的驗證。');
    console.warn('[Wizard] current step validation failed, blocked');
    return;
  }

  // 編輯模式下，驗證通過後允許切換
  if (props.editRecord) {
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

  // 驗證通過，更新當前 step 狀態並允許切換
  stepStates[currentStep.value].touched = true;
  stepStates[currentStep.value].valid = true;
  currentStep.value = targetStep;
};

/**
 * 原有的 next 邏輯（由 onNext 調用）
 * 注意：此函數定義在 onNext 之後，但使用函數聲明以支持提升
 */
async function nextOriginal() {
  /** Step 1 驗證（包含角色） */
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

  /** Step 2 處理（僅整理資料，不呼叫 API，原 Step 3） */
  if (currentStep.value === 1) {
    // Step 3 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 2 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 3（僅 masterAgent 顯示，原 Step 4）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 2;
    }
    else {
      // masterAgentX 跳過 Step 3-6，直接完成
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 3 處理（僅整理資料，不呼叫 API，原 Step 4） */
  if (currentStep.value === 2) {
    // Step 4 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 3 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 4（僅 masterAgent，原 Step 5）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 3;
    }
    else {
      // masterAgentX 跳過 Step 3 和 Step 4，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 4 處理（僅整理資料，不呼叫 API，原 Step 5） */
  if (currentStep.value === 3) {
    // Step 5 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 4 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 5（僅 masterAgent，原 Step 6）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 4;
    }
    else {
      // masterAgentX 跳過 Step 4 和 Step 5，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 5 處理（僅整理資料，不呼叫 API，原 Step 6） */
  if (currentStep.value === 4) {
    // Step 6 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 5 完成 ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));

    // 進入 Step 6（僅 masterAgent，原 Step 7）
    if (formModel.accountType === 'masterAgent') {
      currentStep.value = 5;
    }
    else {
      // masterAgentX 跳過 Step 5 和 Step 6，直接完成（待實作後續步驟）
      message.info('設定已完成（待後續 API 整合）');
    }
    return;
  }

  /** Step 6 處理：建立帳戶並設定預設資料（原 Step 7） */
  if (currentStep.value === 5) {
    // 如果是編輯模式，跳過創建帳戶
    if (props.editRecord && createdAccountId.value) {
      console.log('=== Wizard Step 6 完成（編輯模式，跳過創建） ===');
      // 進入 Step 7（僅 masterAgent 且 level === 1，原 Step 8）
      if (formModel.accountType === 'masterAgent' && userStore.level === 1) {
        currentStep.value = 6;
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

          // 為了確保使用 formModel 中的最新欄位值重新構建 internalSettings 和 remoteConfigURLs
          // 我們需要暫時保存原始值，然後清空它們，這樣 buildInternalSettings 和 buildRemoteConfigURLs 會重新構建
          const originalInternalSettings = formModel.internalSettings;
          const originalRemoteConfigURLs = formModel.remoteConfigURLs;
          formModel.internalSettings = '';
          formModel.remoteConfigURLs = '';

          const internalSettings = buildInternalSettings(account, formModel, userStore.level);
          const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

          // 恢復原始值
          formModel.internalSettings = originalInternalSettings;
          formModel.remoteConfigURLs = originalRemoteConfigURLs;

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
            hashKey: (formModel as any).hashKey && String((formModel as any).hashKey).trim()
              ? String((formModel as any).hashKey).trim()
              : props.editRecord.hashKey, // 優先使用 formModel 中的 hashKey，如果沒有則保留原有 hashKey
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

      console.log('=== Wizard Step 6 完成（帳戶建立） ===');
      console.log('Current Step Index:', currentStep.value);
      console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
      console.log('Create Payload:', JSON.parse(JSON.stringify(payload)));
      console.log('Created Account ID:', createdAccountId.value);

      // 進入 Step 7（僅 masterAgent 且 level === 1，原 Step 8）
      if (formModel.accountType === 'masterAgent' && userStore.level === 1) {
        currentStep.value = 6;
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

  /** Step 7 處理（僅整理資料，不呼叫 API，原 Step 8） */
  if (currentStep.value === 6) {
    // Step 8 不需要額外處理，資料已經在 formModel 中

    // Phase 3 過渡：輸出當前 Step 和 formModel
    console.log('=== Wizard Step 7 完成（最後一步） ===');
    console.log('Current Step Index:', currentStep.value);
    console.log('FormModel (深層):', JSON.parse(JSON.stringify(formModel)));
    console.log('=== Wizard 完整流程結束 ===');

    // 如果是編輯模式，更新帳戶
    console.log('=== Wizard Step 7 完成（編輯模式） ===', props.editRecord, createdAccountId.value);
    if (props.editRecord && createdAccountId.value) {
      isSubmitting.value = true;
      try {
        const account = String(formModel.account ?? '').trim();
        const websiteToUse
          = formModel.accountType === 'masterAgentX' ? account : formModel.website;

        const roleIds = Array.isArray(formModel.roles)
          ? formModel.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        // 為了確保使用 formModel 中的最新欄位值重新構建 internalSettings 和 remoteConfigURLs
        // 我們需要暫時保存原始值，然後清空它們，這樣 buildInternalSettings 和 buildRemoteConfigURLs 會重新構建
        const originalInternalSettings = formModel.internalSettings;
        const originalRemoteConfigURLs = formModel.remoteConfigURLs;
        formModel.internalSettings = '';
        formModel.remoteConfigURLs = '';

        const internalSettings = buildInternalSettings(account, formModel, userStore.level);
        const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

        // 恢復原始值
        formModel.internalSettings = originalInternalSettings;
        formModel.remoteConfigURLs = originalRemoteConfigURLs;

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
          hashKey: (formModel as any).hashKey && String((formModel as any).hashKey).trim()
            ? String((formModel as any).hashKey).trim()
            : props.editRecord.hashKey, // 優先使用 formModel 中的 hashKey，如果沒有則保留原有 hashKey
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
 * 完成按鈕處理（編輯模式下直接更新並關閉）
 */
const onFinish = async () => {
  // 驗證當前步驟
  const ok = await validateCurrentStep();
  if (!ok) {
    return;
  }

  // 如果沒有編輯記錄或帳戶 ID，不允許完成
  if (!props.editRecord || !createdAccountId.value) {
    message.warning('無法完成：缺少必要的編輯資訊');
    return;
  }

  isSubmitting.value = true;
  try {
    const account = String(formModel.account ?? '').trim();
    const websiteToUse
      = formModel.accountType === 'masterAgentX' ? account : formModel.website;

    const roleIds = Array.isArray(formModel.roles)
      ? formModel.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : [];

    // 為了確保使用 formModel 中的最新欄位值重新構建 internalSettings 和 remoteConfigURLs
    // 我們需要暫時保存原始值，然後清空它們，這樣 buildInternalSettings 和 buildRemoteConfigURLs 會重新構建
    const originalInternalSettings = formModel.internalSettings;
    const originalRemoteConfigURLs = formModel.remoteConfigURLs;
    formModel.internalSettings = '';
    formModel.remoteConfigURLs = '';

    const internalSettings = buildInternalSettings(account, formModel, userStore.level);
    const remoteConfigURLs = buildRemoteConfigURLs(formModel, userStore.level, account);

    // 恢復原始值（如果用戶在 step 8 直接編輯了 JSON，則使用編輯後的值）
    // 但只有在用戶確實修改了這些欄位時才使用原始值
    // 這裡我們優先使用重新構建的 internalSettings，因為它包含了所有 formModel 欄位的最新值
    // 如果用戶在 step 8 直接編輯了 internalSettings JSON，我們需要合併這些修改
    // 但為了簡化，我們先使用重新構建的值，確保所有欄位更新都被包含
    formModel.internalSettings = originalInternalSettings;
    formModel.remoteConfigURLs = originalRemoteConfigURLs;

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
      hashKey: (formModel as any).hashKey && String((formModel as any).hashKey).trim()
        ? String((formModel as any).hashKey).trim()
        : props.editRecord.hashKey, // 優先使用 formModel 中的 hashKey，如果沒有則保留原有 hashKey
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

    console.log('=== Wizard 編輯模式完成（完成按鈕） ===');
    console.log('Update Payload:', JSON.parse(JSON.stringify(updatePayload)));

    message.success('設定更新成功');

    // 標記 Wizard 為已完成
    isWizardCompleted.value = true;
    // 觸發 success 事件
    emit('success');
    // 關閉 Dialog
    handleClose();
  }
  catch (error: any) {
    console.error('更新設定失敗:', error);
    const errorMessage
      = error?.response?.data?.message || error?.message || '更新設定失敗，請稍後再試';
    message.error(errorMessage);
  }
  finally {
    isSubmitting.value = false;
  }
};

/**
 * 計算是否顯示「完成」按鈕（編輯模式下，且不在最後一步）
 */
const shouldShowFinishButton = computed(() => {
  // 只在編輯模式下顯示
  if (!props.editRecord) {
    return false;
  }
  // 如果當前步驟是最後一步（step 7），不顯示完成按鈕（因為「下一步」按鈕已經顯示為「完成」）
  if (currentStep.value === 6) {
    return false;
  }
  // 其他步驟在編輯模式下都顯示完成按鈕
  return true;
});

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
  // Step 0-1 都顯示
  if (currentStep.value < 2) {
    return true;
  }
  // Step 2：masterAgent 有 Step 3，masterAgentX 沒有（原 Step 3）
  if (currentStep.value === 2) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 3：僅 masterAgent 顯示（因為有 Step 4，原 Step 4）
  if (currentStep.value === 3) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 4：僅 masterAgent 顯示（因為有 Step 5，原 Step 5）
  if (currentStep.value === 4) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 5：僅 masterAgent 顯示（因為有 Step 6，原 Step 6）
  if (currentStep.value === 5) {
    return formModel.accountType === 'masterAgent';
  }
  // Step 6：僅 masterAgent 且 level === 1 顯示（原 Step 7）
  if (currentStep.value === 6) {
    return formModel.accountType === 'masterAgent' && userStore.level === 1;
  }
  // Step 7 之後（待實作）
  return false;
});

/**
 * 計算「下一步」按鈕文字
 */
const getNextButtonText = computed(() => {
  if (currentStep.value === 1) {
    return formModel.accountType === 'masterAgent' ? '下一步' : '完成';
  }
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
    return '完成';
  }
  return '下一步';
});

/**
 * 計算是否顯示「上一步」按鈕
 * Step 1（currentStep === 0）不顯示，其他步驟都顯示
 */
const shouldShowPrevButton = computed(() => {
  return currentStep.value > 0;
});

/**
 * 上一步按鈕處理
 */
const prev = async () => {
  // 如果已經在第一步，不需要處理
  if (currentStep.value <= 0) {
    return;
  }

  // 切換前驗證當前 step（包括必填欄位驗證）
  // 如果驗證失敗，阻止返回上一步，要求用戶先完成當前步驟
  const ok = await validateCurrentStep();
  if (!ok) {
    message.warning('當前步驟驗證失敗，無法返回上一步。請先完成當前步驟的驗證。');
    console.warn('[Wizard] current step validation failed, blocked prev');
    return;
  }

  // 驗證通過，更新當前 step 狀態並返回上一步
  stepStates[currentStep.value].touched = true;
  stepStates[currentStep.value].valid = true;
  currentStep.value = currentStep.value - 1;
};

/**
 * 重置 Wizard 狀態
 */
const resetWizard = () => {
  currentStep.value = 0;
  isSubmitting.value = false;
  createdAccountId.value = null;
  isWizardCompleted.value = false;

  // 重置 editRecordRoles
  editRecordRoles.value = [];

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
    myCardWebsite: '',
    myCardRedirectVerifyWebsite: '',
    myCardCallbackDomain: '',
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
    isSingleWallet: false,
    singleWallerVersion: 1,
    vipDowngradeFormula: 1,
    levelFormula: 0,
    activityFormula: 1,
    levelUpNeedPoint: undefined,
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
      // 更新 dialogKey 以強制重新創建子組件，重置密碼輸入框的眼睛狀態
      dialogKey.value = Date.now();
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
          description="交易設定"
          :status="getStepStatus(1)"
          :class="{
            'step-clickable': isStepClickable(1),
            'step-disabled': !isStepClickable(1),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 3"
          description="Firebase"
          :status="getStepStatus(2)"
          :class="{
            'step-clickable': isStepClickable(2),
            'step-disabled': !isStepClickable(2),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 4"
          description="社群登入"
          :status="getStepStatus(3)"
          :class="{
            'step-clickable': isStepClickable(3),
            'step-disabled': !isStepClickable(3),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 5"
          description="金流設定"
          :status="getStepStatus(4)"
          :class="{
            'step-clickable': isStepClickable(4),
            'step-disabled': !isStepClickable(4),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent'"
          title="Step 6"
          description="人機驗證設定"
          :status="getStepStatus(5)"
          :class="{
            'step-clickable': isStepClickable(5),
            'step-disabled': !isStepClickable(5),
          }"
        />
        <a-step
          v-if="formModel.accountType === 'masterAgent' && userStore.level === 1"
          title="Step 7"
          description="進階設定"
          :status="getStepStatus(6)"
          :class="{
            'step-clickable': isStepClickable(6),
            'step-disabled': !isStepClickable(6),
          }"
        />
      </a-steps>

      <div class="content">
        <Step1BasicInfo
          v-show="currentStep === 0"
          ref="step1Ref"
          :key="dialogKey"
          :form-model="formModel"
          :is-edit="Boolean(props.editRecord)"
          :level="userStore.level"
          :edit-record-roles="editRecordRoles"
          @update:roles="(value) => { formModel.roles = value; }"
        />
        <Step3WalletAndFormula
          v-show="currentStep === 1"
          :form-model="formModel"
        />
        <Step5FirebaseAnalytics
          v-show="currentStep === 2 && formModel.accountType === 'masterAgent'"
          ref="step5Ref"
          :form-model="formModel"
        />
        <Step7CustomerAndSocial
          v-show="currentStep === 3 && formModel.accountType === 'masterAgent'"
          ref="step7Ref"
          :form-model="formModel"
        />
        <Step8PaymentSettings
          v-show="currentStep === 4 && formModel.accountType === 'masterAgent'"
          ref="step8Ref"
          :form-model="formModel"
        />
        <Step11Recaptcha
          v-show="currentStep === 5 && formModel.accountType === 'masterAgent'"
          ref="step11Ref"
          :form-model="formModel"
        />
        <Step12AdvancedSettings
          v-show="currentStep === 6 && formModel.accountType === 'masterAgent' && userStore.level === 1"
          ref="step12Ref"
          :key="dialogKey"
          :form-model="formModel"
          :level="userStore.level"
        />
      </div>

      <div class="footer">
        <a-space>
          <a-button
            v-if="shouldShowPrevButton"
            :disabled="isSubmitting"
            @click="prev"
          >
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
            v-if="shouldShowFinishButton"
            type="primary"
            :loading="isSubmitting"
            @click="onFinish"
          >
            完成
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
