<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import { onMounted, reactive, ref, watch } from 'vue';

defineOptions({ name: 'Step3WalletAndFormula' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    minTransactionBalance: number;
    spinUnfreezeRatio: number;
    freezeDuration?: number;
    orderExpireTime?: number;
  };
  /** 是否為唯讀模式（Level 4 檢視模式） */
  isReadonly?: boolean;
}

const formRef = ref<FormInstance>();

/**
 * 本地表單副本（用於 readonly 模式下隔離寫入）
 * 在 readonly 模式下，所有變更僅影響 localForm，不會寫回父層
 * 在非 readonly 模式下，變更會同步回父層 formModel
 */
const localForm = reactive<{
  minTransactionBalance: number;
  spinUnfreezeRatio: number;
  freezeDuration?: number;
  orderExpireTime?: number;
}>({
  minTransactionBalance: props.formModel.minTransactionBalance,
  spinUnfreezeRatio: props.formModel.spinUnfreezeRatio,
  freezeDuration: props.formModel.freezeDuration,
  orderExpireTime: props.formModel.orderExpireTime,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    minTransactionBalance: localForm.minTransactionBalance,
    spinUnfreezeRatio: localForm.spinUnfreezeRatio,
    freezeDuration: localForm.freezeDuration,
    orderExpireTime: localForm.orderExpireTime,
  });
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.minTransactionBalance = props.formModel.minTransactionBalance;
  localForm.spinUnfreezeRatio = props.formModel.spinUnfreezeRatio;
  localForm.freezeDuration = props.formModel.freezeDuration;
  localForm.orderExpireTime = props.formModel.orderExpireTime;
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
    localForm.minTransactionBalance,
    localForm.spinUnfreezeRatio,
    localForm.freezeDuration,
    localForm.orderExpireTime,
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
 * 自定義驗證函數：檢查數字欄位是否為有效值（不為 null、undefined，且為數字）
 */
const createNumberValidator = (fieldName: string) => {
  return (_rule: any, value: number | string | null | undefined) => {
    // 檢查是否為空值
    if (value === null || value === undefined || value === '') {
      return Promise.reject(new Error(`請輸入${fieldName}`));
    }

    // 嘗試轉換為數字
    const numValue = typeof value === 'number' ? value : Number(value);

    // 檢查是否為有效數字
    if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
      return Promise.reject(new Error(`${fieldName}必須為有效數字`));
    }

    return Promise.resolve();
  };
};

// 表單驗證規則
const rules: Record<string, Rule[]> = {
  minTransactionBalance: [
    { required: true, validator: createNumberValidator('贈禮最小交易金額'), trigger: 'blur' },
  ],
  spinUnfreezeRatio: [
    { required: true, validator: createNumberValidator('押注解鎖倍率'), trigger: 'blur' },
  ],
  freezeDuration: [
    { required: true, validator: createNumberValidator('凍結週期(天)'), trigger: 'blur' },
  ],
  orderExpireTime: [
    { required: true, validator: createNumberValidator('贈禮交易過期時間(天)'), trigger: 'blur' },
  ],
};

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 2 交易設定驗證：確保所有欄位都有值且不可為空 */
  validate: async () => {
    try {
      await formRef.value?.validate();
      return true;
    }
    catch (error) {
      console.error('[Step 2 交易設定] 驗證失敗:', error);
      return false;
    }
  },
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="localForm"
    :rules="rules"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!-- 交易設定 -->
    <a-divider orientation="left">
      交易設定
    </a-divider>
    <a-form-item label="贈禮最小交易金額" name="minTransactionBalance">
      <a-input-number
        v-model:value="localForm.minTransactionBalance"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入贈禮最小交易金額"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="押注解鎖倍率 (數值)" name="spinUnfreezeRatio">
      <a-input-number
        v-model:value="localForm.spinUnfreezeRatio"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入押注解鎖倍率"
        :disabled="props.isReadonly"
      />
    </a-form-item>
  </a-form>
</template>
