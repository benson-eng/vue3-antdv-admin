<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { changeAdminAccountPassword } from '@/api/backend/adminAccount/admin';
import { useI18n } from '@/hooks/useI18n';
import { useTabsViewStore } from '@/store/modules/tabsView';
import { useUserStore } from '@/store/modules/user';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const tabsViewStore = useTabsViewStore();

const loading = ref(false);

const formState = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const validateConfirmPassword = (_rule: any, value: string) => {
  if (!value) {
    return Promise.reject(t('page.setting.notify.emptyPassword'));
  }
  if (value !== formState.newPassword) {
    return Promise.reject(t('page.setting.notify.passwordNotMatch'));
  }
  return Promise.resolve();
};

const handleSubmit = async () => {
  if (!formState.oldPassword || !formState.newPassword || !formState.confirmPassword) {
    message.error(t('page.setting.notify.emptyPassword'));
    return;
  }

  if (formState.oldPassword.length < 6) {
    message.error(t('page.setting.notify.oldPasswordFormatInvalid'));
    return;
  }

  if (formState.newPassword !== formState.confirmPassword) {
    message.error(t('page.setting.notify.passwordNotMatch'));
    return;
  }

  if (formState.newPassword.length < 6) {
    message.error(t('page.setting.notify.shortPassword'));
    return;
  }

  if (formState.newPassword === formState.oldPassword) {
    message.error(t('page.setting.notify.oldPasswordAndNewPasswordIsSame'));
    return;
  }

  loading.value = true;

  try {
    const account = userStore.account || userStore.name || '';
    if (!account) {
      message.error('無法取得帳號資訊');
      loading.value = false;
      return;
    }

    const response = await changeAdminAccountPassword({
      account,
      password: formState.oldPassword,
      newPassword: formState.newPassword,
    });

    // 處理 IVueResponse 格式
    if (response && response.error) {
      const errorMsg = response.error.message || t('page.setting.notify.error');
      message.error(errorMsg);
      return;
    }

    // 成功
    Modal.success({
      title: t('page.setting.notify.success'),
      content: t('page.setting.notify.relog'),
      onOk: async () => {
        // 先關閉當前的密碼設定 tab
        try {
          tabsViewStore.closeCurrentTab(route);
        }
        catch (error) {
          console.warn('關閉 tab 失敗:', error);
        }
        // 登出並重新導向到登入頁（不帶 redirect 參數，登入後會導向首頁）
        await userStore.LogOut();
        router.push('/login');
      },
    });
  }
  catch (error: any) {
    console.error('修改密碼失敗:', error);
    const errorMsg = error?.error?.message || error?.message || t('page.setting.notify.error');
    message.error(errorMsg);
  }
  finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="password-setting-page">
    <div class="section-container">
      <div class="section-header">
        {{ t('routes.setting.passwordSetting') }}
      </div>

      <div class="section-body">
        <a-form
          :model="formState"
          layout="vertical"
          @finish="handleSubmit"
        >
          <a-form-item
            :label="t('page.setting.labels.oldPassword')"
            name="oldPassword"
            :rules="[{ required: true, message: t('page.setting.notify.emptyPassword') }]"
          >
            <a-input-password
              v-model:value="formState.oldPassword"
              :placeholder="t('page.setting.labels.oldPassword')"
              autocomplete="off"
              size="large"
            />
          </a-form-item>

          <a-form-item
            :label="t('page.setting.labels.newPassword')"
            name="newPassword"
            :rules="[
              { required: true, message: t('page.setting.notify.emptyPassword') },
              { min: 6, message: t('page.setting.notify.shortPassword') },
            ]"
          >
            <a-input-password
              v-model:value="formState.newPassword"
              :placeholder="t('page.setting.labels.passwordDescription')"
              autocomplete="off"
              size="large"
            />
          </a-form-item>

          <a-form-item
            :label="t('page.setting.labels.confirmPassword')"
            name="confirmPassword"
            :rules="[
              { required: true, message: t('page.setting.notify.emptyPassword') },
              { validator: validateConfirmPassword },
            ]"
          >
            <a-input-password
              v-model:value="formState.confirmPassword"
              :placeholder="t('page.setting.labels.passwordDescription')"
              autocomplete="off"
              size="large"
            />
          </a-form-item>

          <a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              :loading="loading"
            >
              {{ t('page.setting.actions.changePassword') }}
            </a-button>
          </a-form-item>
        </a-form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.password-setting-page {
  .section-container {
    background: #ffffff;
    border-radius: 6px;
    padding: 20px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .section-header {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .section-body {
    max-width: 480px;
  }

  :deep(.ant-form-item) {
    margin-bottom: 16px;
  }
}
</style>
