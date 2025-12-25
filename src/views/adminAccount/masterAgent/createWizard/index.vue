<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { wizardStateManager } from '@/router/router-guards';
import { useTabsViewStore } from '@/store/modules/tabsView';
import CreateWizardDialog from '../../components/CreateWizardDialog.vue';

defineOptions({ name: 'AdminAccountMasterAgentCreateWizard' });

type AccountType = 'masterAgent' | 'masterAgentX';

const route = useRoute();
const router = useRouter();
const tabsViewStore = useTabsViewStore();

const dialogVisible = ref<boolean>(true);

/**
 * 檢查 accountType 是否合法
 */
const validateAccountType = (accountType: string | undefined): accountType is AccountType => {
  return accountType === 'masterAgent' || accountType === 'masterAgentX';
};

/**
 * 取得 accountType（從 route.query）
 */
const accountType = computed<AccountType | undefined>(() => {
  const type = route.query.accountType as string | undefined;
  if (type && validateAccountType(type)) {
    return type;
  }
  return undefined;
});

/**
 * 關閉 Dialog 並導向列表頁
 */
const handleDialogClose = () => {
  dialogVisible.value = false;

  // 根據 accountType 返回到正確的頁面
  const targetRouteName = accountType.value === 'masterAgentX'
    ? 'AdminAccountMasterAgentX'
    : 'AdminAccountMasterAgent';
  router.push({ name: targetRouteName }).catch((err) => {
    console.error('[Wizard] 導向列表頁失敗:', err);
  });
};

/**
 * 處理成功事件
 */
const handleSuccess = () => {
  console.log('[Wizard] 建立成功');
  // 關閉 Dialog 並導向列表頁
  handleDialogClose();
};
</script>

<template>
  <CreateWizardDialog
    :visible="dialogVisible"
    :account-type="accountType"
    @update:visible="dialogVisible = $event"
    @success="handleSuccess"
  />
</template>
