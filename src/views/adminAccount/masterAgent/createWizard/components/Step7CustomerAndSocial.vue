<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 客服設定 -->
    <a-divider orientation="left">客服設定</a-divider>

    <a-form-item label="客服信箱" name="serviceEmail">
      <a-input
        v-model:value="formModel.serviceEmail"
        placeholder="請輸入客服信箱"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <!-- LINE 登入設定 -->
    <a-divider orientation="left">LINE 登入設定</a-divider>

    <a-form-item label="Line 官方帳號" name="lineOfficialAccount">
      <a-input
        v-model:value="formModel.lineOfficialAccount"
        placeholder="請輸入 Line 官方帳號"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="LIFF ID" name="liffID">
      <a-input
        v-model:value="formModel.liffID"
        placeholder="請輸入 LIFF ID"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="Line 登入 Client ID" name="lineClientID">
      <a-input
        v-model:value="formModel.lineClientID"
        placeholder="請輸入 Line 登入 Client ID"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="Line 登入 Client Secret" name="lineClientSecret">
      <a-input
        v-model:value="formModel.lineClientSecret"
        placeholder="請輸入 Line 登入 Client Secret"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <!-- Facebook 登入 -->
    <a-divider orientation="left">Facebook 登入</a-divider>

    <a-form-item label="Facebook 登入 ID" name="facebookID">
      <a-input
        v-model:value="formModel.facebookID"
        placeholder="請輸入 Facebook 登入 ID"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step7CustomerAndSocial' });

interface Props {
  formModel: {
    serviceEmail: string;
    lineOfficialAccount: string;
    liffID: string;
    lineClientID: string;
    lineClientSecret: string;
    facebookID: string;
  };
}

defineProps<Props>();

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 7 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>

