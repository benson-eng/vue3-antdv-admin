<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import { ref } from 'vue';

defineOptions({ name: 'Step3WalletAndFormula' });

defineProps<Props>();

interface Props {
  formModel: {
    minTransactionBalance: number;
    spinUnfreezeRatio: number;
    freezeDuration: number;
    orderExpireTime: number;
  };
}

const formRef = ref<FormInstance>();

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
    :model="formModel"
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
        v-model:value="formModel.minTransactionBalance"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入贈禮最小交易金額"
      />
    </a-form-item>

    <a-form-item label="押注解鎖倍率 (數值)" name="spinUnfreezeRatio">
      <a-input-number
        v-model:value="formModel.spinUnfreezeRatio"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入押注解鎖倍率"
      />
    </a-form-item>

    <a-form-item
      label="凍結週期(天)"
      name="freezeDuration"
    >
      <a-input-number
        v-model:value="formModel.freezeDuration"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item
      label="贈禮交易過期時間(天)"
      name="orderExpireTime"
    >
      <a-input-number
        v-model:value="formModel.orderExpireTime"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>
  </a-form>
</template>
