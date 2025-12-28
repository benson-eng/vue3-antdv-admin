<template>
  <div class="setting">
    <a-card :title="t('routes.setting.passwordSetting')" class="setting-card">
      <a-form :model="formState" layout="vertical" @finish="handleSubmit">
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
          <a-button type="primary" html-type="submit" :loading="loading" size="large">
            {{ t('page.setting.actions.changePassword') }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { changeAdminAccountPassword } from '@/api/backend/adminAccount/admin';

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();

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
        // 登出並重新導向到登入頁
        await userStore.LogOut();
        router.push(`/login?redirect=${router.currentRoute.value.fullPath}`);
      },
    });
  } catch (error: any) {
    console.error('修改密碼失敗:', error);
    const errorMsg = error?.error?.message || error?.message || t('page.setting.notify.error');
    message.error(errorMsg);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="less">
.setting {
  padding: 24px;

  .setting-card {
    max-width: 600px;
    margin: 0 auto;
  }
}
</style>

