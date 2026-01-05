<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from '@/hooks/useI18n';
import { generateHashKey } from '../utils';

defineOptions({ name: 'Step12AdvancedSettings' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    gaKey: string;
    internalSettings: string;
    remoteConfigURLs: string;
    [key: string]: any;
  };
  level?: number;
  /** 是否為唯讀模式（Level 4 檢視模式） */
  isReadonly?: boolean;
}

// 多語系
const pageI18n = useI18n('page.adminAccount');
const t = pageI18n.t;

const formRef = ref<FormInstance>();

/**
 * 本地表單副本（用於 readonly 模式下隔離寫入）
 * 在 readonly 模式下，所有變更僅影響 localForm，不會寫回父層
 * 在非 readonly 模式下，變更會同步回父層 formModel
 */
const localForm = reactive<{
  gaKey: string;
  internalSettings: string;
  remoteConfigURLs: string;
  hashKey?: string;
  isSingleWallet?: boolean;
  singleWallerVersion?: number;
  vipDowngradeFormula?: number;
  levelFormula?: number;
  activityFormula?: number;
  levelUpNeedPoint?: number;
  [key: string]: any;
}>({
  gaKey: props.formModel.gaKey,
  internalSettings: props.formModel.internalSettings,
  remoteConfigURLs: props.formModel.remoteConfigURLs,
  hashKey: (props.formModel as any).hashKey,
  isSingleWallet: (props.formModel as any).isSingleWallet,
  singleWallerVersion: (props.formModel as any).singleWallerVersion,
  vipDowngradeFormula: (props.formModel as any).vipDowngradeFormula,
  levelFormula: (props.formModel as any).levelFormula,
  activityFormula: (props.formModel as any).activityFormula,
  levelUpNeedPoint: (props.formModel as any).levelUpNeedPoint,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    gaKey: localForm.gaKey,
    internalSettings: localForm.internalSettings,
    remoteConfigURLs: localForm.remoteConfigURLs,
  });
  // 同步動態欄位
  if (localForm.hashKey !== undefined) {
    (props.formModel as any).hashKey = localForm.hashKey;
  }
  if (localForm.isSingleWallet !== undefined) {
    (props.formModel as any).isSingleWallet = localForm.isSingleWallet;
  }
  if (localForm.singleWallerVersion !== undefined) {
    (props.formModel as any).singleWallerVersion = localForm.singleWallerVersion;
  }
  if (localForm.vipDowngradeFormula !== undefined) {
    (props.formModel as any).vipDowngradeFormula = localForm.vipDowngradeFormula;
  }
  if (localForm.levelFormula !== undefined) {
    (props.formModel as any).levelFormula = localForm.levelFormula;
  }
  if (localForm.activityFormula !== undefined) {
    (props.formModel as any).activityFormula = localForm.activityFormula;
  }
  if (localForm.levelUpNeedPoint !== undefined) {
    (props.formModel as any).levelUpNeedPoint = localForm.levelUpNeedPoint;
  }
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.gaKey = props.formModel.gaKey;
  localForm.internalSettings = props.formModel.internalSettings;
  localForm.remoteConfigURLs = props.formModel.remoteConfigURLs;
  localForm.hashKey = (props.formModel as any).hashKey;
  localForm.isSingleWallet = (props.formModel as any).isSingleWallet;
  localForm.singleWallerVersion = (props.formModel as any).singleWallerVersion;
  localForm.vipDowngradeFormula = (props.formModel as any).vipDowngradeFormula;
  localForm.levelFormula = (props.formModel as any).levelFormula;
  localForm.activityFormula = (props.formModel as any).activityFormula;
  localForm.levelUpNeedPoint = (props.formModel as any).levelUpNeedPoint;
};

// 監聽父層 formModel 變化，同步到 localForm（僅在 readonly 模式下）
watch(
  () => props.formModel,
  () => {
    if (props.isReadonly) {
      syncFromParent();
    }
  },
  { deep: true },
);

// 在非 readonly 模式下，監聽 localForm 變化並同步回父層
watch(
  () => [
    localForm.gaKey,
    localForm.internalSettings,
    localForm.remoteConfigURLs,
    localForm.hashKey,
    localForm.isSingleWallet,
    localForm.singleWallerVersion,
    localForm.vipDowngradeFormula,
    localForm.levelFormula,
    localForm.activityFormula,
    localForm.levelUpNeedPoint,
  ],
  () => {
    syncToParent();
  },
  { deep: true },
);

onMounted(() => {
  syncFromParent();
});

/**
 * 產生 hashKey
 */
const generateHashKeyValue = async () => {
  if (props.isReadonly) {
    return; // readonly 模式下不允許產生
  }
  localForm.hashKey = generateHashKey();
  // 立即同步到父層
  syncToParent();

  // 等待 DOM 更新後，清除該欄位的驗證錯誤
  await nextTick();
  formRef.value?.clearValidate(['hashKey']);
};

/**
 * 驗證表單
 */
const validate = async (): Promise<boolean> => {
  try {
    // 檢查金鑰是否必填
    const hashKey = localForm.hashKey;
    if (!hashKey || !String(hashKey).trim()) {
      await formRef.value?.validateFields(['hashKey']);
      return false;
    }

    // 1️⃣ 先跑 ant-form 的 rules（如果有）
    if (formRef.value) {
      try {
        await formRef.value.validate();
      }
      catch (error) {
        console.log('[Step12] 表單規則驗證失敗:', error);
        return false;
      }
    }

    return true;
  }
  catch (error) {
    console.error('Step 12 驗證失敗:', error);
    return false;
  }
};

// 暴露方法給父元件
defineExpose({
  formRef,
  validate,
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="localForm"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!-- 警告訊息 -->
    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 24px"
    >
      <template #message>
        <span>此區塊為進階設定，僅限系統管理員使用。錯誤設定可能導致系統異常。</span>
      </template>
    </a-alert>

    <!-- 網路安全設定 -->
    <a-divider orientation="left">
      網路安全設定
    </a-divider>

    <a-form-item v-if="false" label="API Domain" name="apiDomain">
      <a-input
        v-model:value="(formModel as any).apiDomain"
        placeholder="請輸入 API Domain"
      />
    </a-form-item>

    <a-form-item v-if="false" label="白名單" name="whiteIPList">
      <a-input
        v-model:value="(formModel as any).whiteIPList"
        placeholder="請輸入白名單"
      />
    </a-form-item>

    <a-form-item v-if="false" label="CDN 名單" name="cdnList">
      <a-input
        v-model:value="(formModel as any).cdnList"
        placeholder="請輸入 CDN 名單"
      />
    </a-form-item>

    <a-form-item v-if="false" label="代理伺服器名單" name="proxyList">
      <a-input
        v-model:value="(formModel as any).proxyList"
        placeholder="請輸入代理伺服器名單"
      />
    </a-form-item>

    <a-form-item
      label="金鑰"
      name="hashKey"
      :rules="[
        { required: true, message: '請輸入金鑰或點擊產生按鈕自動產生' },
      ]"
    >
      <a-input-group compact>
        <a-input-password
          v-model:value="localForm.hashKey"
          style="width: calc(100% - 100px)"
          placeholder="請輸入金鑰或點擊產生"
          :disabled="props.isReadonly"
        />
        <a-button
          v-if="!props.isReadonly"
          type="default"
          style="width: 100px"
          @click="generateHashKeyValue"
        >
          {{ t('labels.generate') }}
        </a-button>
      </a-input-group>
    </a-form-item>

    <!-- 錢包設定 -->
    <a-divider orientation="left">
      錢包設定
    </a-divider>

    <a-form-item label="單一錢包" name="isSingleWallet">
      <a-checkbox v-model:checked="localForm.isSingleWallet" :disabled="props.isReadonly" />
    </a-form-item>

    <a-form-item
      label="單一錢包版本"
      name="singleWallerVersion"
    >
      <a-select
        v-model:value="localForm.singleWallerVersion"
        :disabled="props.isReadonly || !localForm.isSingleWallet"
        style="width: 100%"
      >
        <a-select-option :value="1">
          {{ t('singleWalletVersionLabel.1') }}
        </a-select-option>
        <a-select-option :value="2">
          {{ t('singleWalletVersionLabel.2') }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <!-- 等級與公式設定 -->
    <a-divider orientation="left">
      等級與公式設定
    </a-divider>

    <a-form-item label="VIP 降級公式" name="vipDowngradeFormula">
      <a-select
        v-model:value="localForm.vipDowngradeFormula"
        :disabled="true"
        style="width: 100%"
      >
        <a-select-option :value="0">
          {{ t('vipDowngradeFormula.0') }}
        </a-select-option>
        <a-select-option :value="1">
          {{ t('vipDowngradeFormula.1') }}  <!-- BoTV作法 -->
        </a-select-option>
        <a-select-option :value="2">
          {{ t('vipDowngradeFormula.2') }}
        </a-select-option>
        <!-- <a-select-option :value="3">
          {{ t('vipDowngradeFormula.3') }}
        </a-select-option> -->
      </a-select>
    </a-form-item>

    <a-form-item label="等級公式" name="levelFormula">
      <a-select
        v-model:value="localForm.levelFormula"
        :disabled="props.isReadonly"
        style="width: 100%"
      >
        <a-select-option :value="0">
          {{ t('levelFormula.0') }}
        </a-select-option>
        <a-select-option :value="1">
          {{ t('levelFormula.1') }}
        </a-select-option>
        <a-select-option :value="2">
          {{ t('levelFormula.2') }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item
      v-if="localForm.levelFormula === 1"
      label="升級所需點數"
      name="levelUpNeedPoint"
    >
      <a-input-number
        v-model:value="localForm.levelUpNeedPoint"
        :min="1"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入升級所需點數"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="活躍值公式" name="activityFormula">
      <a-select
        v-model:value="localForm.activityFormula"
        :disabled="props.isReadonly"
        style="width: 100%"
      >
        <a-select-option :value="1">
          1:100
        </a-select-option>
        <a-select-option :value="10">
          1:1000
        </a-select-option>
      </a-select>
    </a-form-item>

    <!-- 支付金鑰設定 -->
    <!-- <a-divider orientation="left">
      支付金鑰設定
    </a-divider>

    <a-form-item label="iOS 支付金鑰" name="iosPaymentKey">
      <a-textarea
        v-model:value="(formModel as any).iosPaymentKey"
        :rows="3"
        placeholder="請輸入 iOS 支付金鑰"
      />
    </a-form-item>

    <a-form-item label="Android 支付金鑰" name="androidPaymentKey">
      <a-textarea
        v-model:value="(formModel as any).androidPaymentKey"
        :rows="3"
        placeholder="請輸入 Android 支付金鑰"
      />
    </a-form-item>

    <a-form-item label="EC 支付金鑰" name="ecPaymentKey">
      <a-textarea
        v-model:value="(formModel as any).ecPaymentKey"
        :rows="3"
        placeholder="請輸入 EC 支付金鑰"
      />
    </a-form-item>

    <a-form-item label="GCP 金鑰" name="gcpKey">
      <a-textarea
        v-model:value="(formModel as any).gcpKey"
        :rows="3"
        placeholder="請輸入 GCP 金鑰"
      />
    </a-form-item>

    <a-form-item label="Android 應用包識別碼" name="androidBundleID">
      <a-input
        v-model:value="(formModel as any).androidBundleID"
        placeholder="請輸入 Android 應用包識別碼"
      />
    </a-form-item>

    <a-form-item label="iOS 應用包識別碼" name="iosBundleID">
      <a-input
        v-model:value="(formModel as any).iosBundleID"
        placeholder="請輸入 iOS 應用包識別碼"
      />
    </a-form-item> -->

    <!-- JSON 設定欄位 -->
    <a-divider orientation="left">
      JSON 設定
    </a-divider>

    <a-form-item label="系統內部設定(internalSettings)" name="internalSettings">
      <a-textarea
        v-model:value="localForm.internalSettings"
        :rows="10"
        :disabled="true"
        placeholder="請輸入 JSON 格式，例如：{&quot;key&quot;: &quot;value&quot;}"
      />
    </a-form-item>

    <a-form-item label="遠端設定檔(remoteConfigURLs)" name="remoteConfigURLs">
      <a-textarea
        v-model:value="localForm.remoteConfigURLs"
        :rows="8"
        :disabled="true"
        placeholder="請輸入 JSON 格式，例如：{&quot;key&quot;: &quot;value&quot;}"
      />
    </a-form-item>
  </a-form>
</template>
