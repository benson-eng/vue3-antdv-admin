<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { ref } from 'vue';

defineOptions({ name: 'Step7CustomerAndSocial' });

defineProps<Props>();

interface Props {
  formModel: {
    lineOfficialAccount: string;
    liffID: string;
    lineClientID: string;
    lineClientSecret: string;
    facebookID: string;
  };
}

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 7 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!-- LINE 登入設定 -->
    <a-divider orientation="left">
      LINE 登入設定
    </a-divider>

    <a-form-item label="Line 官方帳號" name="lineOfficialAccount">
      <a-input
        v-model:value="formModel.lineOfficialAccount"
        placeholder="請輸入 Line 官方帳號"
      />
    </a-form-item>

    <a-form-item label="LIFF ID" name="liffID">
      <a-input
        v-model:value="formModel.liffID"
        placeholder="請輸入 LIFF ID"
      />
    </a-form-item>

    <a-form-item label="Line登入ID" name="lineClientID">
      <a-input
        v-model:value="formModel.lineClientID"
        placeholder="請輸入 Line 登入 ID"
      />
    </a-form-item>

    <a-form-item label="line登入密鑰" name="lineClientSecret">
      <a-input
        v-model:value="formModel.lineClientSecret"
        placeholder="請輸入 Line 登入 密鑰"
      />
    </a-form-item>

    <!-- Facebook 登入 -->
    <a-divider orientation="left">
      Facebook 登入
    </a-divider>

    <a-form-item label="Facebook 登入 ID" name="facebookID">
      <a-input
        v-model:value="formModel.facebookID"
        placeholder="請輸入 Facebook 登入 ID"
      />
    </a-form-item>
  </a-form>
</template>
