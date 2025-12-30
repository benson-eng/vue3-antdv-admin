<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { computed, onMounted, ref, watch } from 'vue';
import { generateHashKey } from '../utils';

defineOptions({ name: 'Step4NetworkSecurity' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    networkSettings?: {
      apiDomain: string[];
      whiteIPList: string[];
      cdnList: string[];
      proxyList: string[];
    };
    securitySettings?: {
      hashKey: string;
    };
  };
}

const formRef = ref<FormInstance>();

/**
 * 本地表單模型（使用 Textarea 的字串格式）
 */
const localFormModel = ref<{
  apiDomainText: string;
  whiteIPListText: string;
  cdnListText: string;
  proxyListText: string;
  hashKey: string;
}>({
  apiDomainText: '',
  whiteIPListText: '',
  cdnListText: '',
  proxyListText: '',
  hashKey: '',
});

/**
 * 處理 Textarea 字串轉陣列
 */
const processTextareaToArray = (text: string): string[] => {
  if (!text || !text.trim()) { return []; }
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

/**
 * 處理陣列轉 Textarea 字串
 */
const processArrayToTextarea = (arr: string[]): string => {
  if (!Array.isArray(arr) || arr.length === 0) { return ''; }
  return arr.join('\n');
};

/**
 * 初始化資料（從 formModel 載入）
 */
const initializeData = () => {
  // 初始化 hashKey（進入 Step 4 時自動產生，如果已經有值則使用現有值）
  if (!props.formModel.securitySettings?.hashKey || !props.formModel.securitySettings.hashKey.trim()) {
    localFormModel.value.hashKey = generateHashKey();
  }
  else {
    localFormModel.value.hashKey = props.formModel.securitySettings.hashKey;
  }

  // 初始化網路設定（從陣列轉為字串）
  const network = props.formModel.networkSettings;
  if (network) {
    localFormModel.value.apiDomainText = processArrayToTextarea(network.apiDomain);
    localFormModel.value.whiteIPListText = processArrayToTextarea(network.whiteIPList);
    localFormModel.value.cdnListText = processArrayToTextarea(network.cdnList);
    localFormModel.value.proxyListText = processArrayToTextarea(network.proxyList);
  }
};

/**
 * 重新產生 hashKey
 */
const regenerateHashKey = () => {
  localFormModel.value.hashKey = generateHashKey();
};

/**
 * 取得處理後的資料（供父元件使用）
 */
const getProcessedData = () => {
  return {
    networkSettings: {
      apiDomain: processTextareaToArray(localFormModel.value.apiDomainText),
      whiteIPList: processTextareaToArray(localFormModel.value.whiteIPListText),
      cdnList: processTextareaToArray(localFormModel.value.cdnListText),
      proxyList: processTextareaToArray(localFormModel.value.proxyListText),
    },
    securitySettings: {
      hashKey: localFormModel.value.hashKey,
    },
  };
};

// 監聽 formModel 變化，同步資料
watch(
  () => props.formModel.networkSettings,
  () => {
    initializeData();
  },
  { deep: true },
);

watch(
  () => props.formModel.securitySettings,
  () => {
    if (props.formModel.securitySettings?.hashKey) {
      localFormModel.value.hashKey = props.formModel.securitySettings.hashKey;
    }
  },
  { deep: true },
);

onMounted(() => {
  initializeData();
});

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 4 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
  /** 取得處理後的資料 */
  getProcessedData,
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="localFormModel"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!-- 網路設定 -->
    <a-divider orientation="left">
      網路設定
    </a-divider>

    <a-form-item label="API Domain" name="apiDomain">
      <a-textarea
        v-model:value="localFormModel.apiDomainText"
        :rows="3"
        placeholder="一行一筆，例如：&#10;api.example.com&#10;api2.example.com"
      />
    </a-form-item>

    <a-form-item label="白名單" name="whiteIPList">
      <a-textarea
        v-model:value="localFormModel.whiteIPListText"
        :rows="4"
        placeholder="一行一筆 IP 位址，例如：&#10;192.168.1.1&#10;10.0.0.1"
      />
    </a-form-item>

    <a-form-item label="CDN 名單" name="cdnList">
      <a-textarea
        v-model:value="localFormModel.cdnListText"
        :rows="3"
        placeholder="一行一筆 CDN 網址"
      />
    </a-form-item>

    <a-form-item label="代理伺服器名單" name="proxyList">
      <a-textarea
        v-model:value="localFormModel.proxyListText"
        :rows="3"
        placeholder="一行一筆代理伺服器網址"
      />
    </a-form-item>

    <!-- 安全設定 -->
    <!-- <a-divider orientation="left">安全設定</a-divider>

    <a-form-item label="金鑰" name="hashKey">
      <a-input-group compact>
        <a-input
          v-model:value="localFormModel.hashKey"
          :readonly="true"
          style="width: calc(100% - 100px)"
          placeholder="自動產生"
        />
        <a-button type="default" style="width: 100px" @click="regenerateHashKey">
          重新產生
        </a-button>
      </a-input-group>
    </a-form-item> -->
  </a-form>
</template>
