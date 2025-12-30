<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 簡訊服務帳號 -->
    <a-divider orientation="left">簡訊服務帳號</a-divider>

    <a-form-item label="簡訊帳號" name="smsAccount">
      <a-input
        v-model:value="formModel.smsAccount"
        placeholder="請輸入簡訊帳號"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">未填寫時，系統將使用預設簡訊設定</span>
      </template>
    </a-form-item>

    <a-form-item label="簡訊密碼" name="smsPassWord">
      <a-input-password
        v-model:value="formModel.smsPassWord"
        placeholder="請輸入簡訊密碼"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">未填寫時，系統將使用預設簡訊設定</span>
      </template>
    </a-form-item>

    <!-- 三竹簡訊商 -->
    <a-divider orientation="left">三竹簡訊商</a-divider>

    <a-form-item label="三竹簡訊商帳號" name="boSmsAccount">
      <a-input
        v-model:value="formModel.boSmsAccount"
        placeholder="請輸入三竹簡訊商帳號"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">未填寫時，系統將使用預設簡訊設定</span>
      </template>
    </a-form-item>

    <a-form-item label="三竹簡訊商密碼" name="boSmsPassWord">
      <a-input-password
        v-model:value="formModel.boSmsPassWord"
        placeholder="請輸入三竹簡訊商密碼"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">未填寫時，系統將使用預設簡訊設定</span>
      </template>
    </a-form-item>

  </a-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step9SmsSettings' });

interface Props {
  formModel: {
    smsAccount: string;
    smsPassWord: string;
    boSmsAccount: string;
    boSmsPassWord: string;
  };
}

defineProps<Props>();

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 9 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


