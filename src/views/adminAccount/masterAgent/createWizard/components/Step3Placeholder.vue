<template>
  <div class="step3-placeholder">
    <a-result
      status="success"
      title="帳戶建立成功！"
      sub-title="後續進階設定（Step 3-12）將於下一階段補上"
    >
      <template #extra>
        <a-space>
          <a-typography-text type="secondary">
            已建立帳戶 ID：<a-typography-text strong>{{ createdAccountId }}</a-typography-text>
          </a-typography-text>
        </a-space>
        <a-divider />
        <a-space>
          <a-button type="primary" @click="goToEdit">
            前往帳戶編輯頁
          </a-button>
          <a-button @click="goBackToList">返回列表</a-button>
        </a-space>
      </template>
    </a-result>

    <a-alert
      message="提示"
      description="您可以在編輯頁面補齊所有進階設定，或稍後繼續使用 Wizard 完成設定（Phase 2 實作）。"
      type="info"
      show-icon
      style="margin-top: 24px"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

defineOptions({ name: 'Step3Placeholder' });

interface Props {
  createdAccountId: number | null;
}

const props = defineProps<Props>();

const router = useRouter();

const goToEdit = () => {
  if (!props.createdAccountId) {
    console.warn('createdAccountId 不存在，無法導向編輯頁');
    return;
  }

  // TODO: 確認編輯頁面的 route name 與參數傳遞方式
  // 建議搜尋方式：
  // 1. 在 router/routes/modules/adminAccount.ts 中搜尋 edit 相關路由
  // 2. 或在列表頁的「編輯」按鈕點擊事件中查看使用的 route name
  // 3. 目前先使用 console.log 記錄，待確認後再實作
  console.log('TODO: 導向編輯頁面，accountId:', props.createdAccountId);
  
  // 預期實作方式（待確認 route name）：
  // router.push({
  //   name: 'AdminAccountMasterAgentEdit', // 或實際的 route name
  //   params: { id: props.createdAccountId },
  // });
};

const goBackToList = () => {
  router.push({ name: 'AdminAccountMasterAgent' });
};
</script>

<style scoped>
.step3-placeholder {
  padding: 24px 0;
}
</style>

