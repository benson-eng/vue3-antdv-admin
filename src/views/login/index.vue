<template>
  <div class="login-box">
    <div class="login-logo">
      <!-- <svg-icon name="logo" :size="45" /> -->
      <img src="~@/assets/images/logo.png" width="45" />
      <h1 class="mb-0 ml-2 text-3xl font-bold">Antdv Admin</h1>
    </div>
    <a-form layout="horizontal" :model="loginFormModel" @submit.prevent="handleSubmit">
      <a-form-item>
        <a-input v-model:value="loginFormModel.account" size="large" placeholder="帳號">
          <template #prefix> <Icon icon="ant-design:user-outlined" /> </template>
        </a-input>
      </a-form-item>
      <a-form-item>
        <a-input
          v-model:value="loginFormModel.password"
          size="large"
          type="password"
          placeholder="密碼"
          autocomplete="new-password"
        >
          <template #prefix> <Icon icon="ant-design:lock-outlined" /></template>
        </a-input>
      </a-form-item>
      <!-- 雙因素驗證輸入框（當需要時顯示） -->
      <a-form-item v-if="showBackendKey">
        <a-input
          v-model:value="loginFormModel.backendKey"
          size="large"
          placeholder="雙因素驗證碼"
          :maxlength="6"
        >
          <template #prefix> <Icon icon="ant-design:safety-outlined" /> </template>
        </a-input>
      </a-form-item>
      <!-- 原有驗證碼輸入框（保留原有功能） -->
      <a-form-item v-if="!showBackendKey && needCaptcha">
        <a-input
          v-model:value="loginFormModel.verifyCode"
          placeholder="验证码"
          :maxlength="4"
          size="large"
        >
          <template #prefix> <Icon icon="ant-design:safety-outlined" /> </template>
          <template #suffix>
            <div class="captcha-wrapper" v-if="captcha && !captchaError">
              <img
                :src="captcha"
                class="captcha-image"
                @click="updateCaptcha"
                alt="驗證碼"
              />
            </div>
            <div v-else-if="captchaLoading" class="captcha-loading">載入中...</div>
            <div v-else-if="captchaError" class="captcha-error" @click="updateCaptcha" title="點擊重試">
              <Icon icon="ant-design:reload-outlined" />
            </div>
            <div v-else class="captcha-loading">載入中...</div>
          </template>
        </a-input>
      </a-form-item>
      <a-form-item>
        <div class="flex justify-between items-center w-full">
          <a-checkbox v-model:checked="loginFormModel.rememberAccount">記住帳號</a-checkbox>
        </div>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" size="large" :loading="loading" block>
          {{ showBackendKey ? '雙因素驗證登入' : '登入' }}
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { message, Modal } from 'ant-design-vue';
  import { Icon } from '@/components/basic/icon';
  import { useUserStore } from '@/store/modules/user';
  import Api from '@/api/';
  import { to } from '@/utils/awaitTo';

  defineOptions({
    name: 'Login',
  });

  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const loading = ref(false);
  const captcha = ref('');
  const captchaLoading = ref(false);
  const captchaError = ref(false);
  const showBackendKey = ref(false);
  const needCaptcha = ref(true); // 是否顯示驗證碼（可根據需求調整）
  
  // 記住帳號的 localStorage key
  const REMEMBER_ACCOUNT_KEY = 'remember_account';
  
  const loginFormModel = ref({
    account: '',
    password: '',
    verifyCode: '',
    captchaId: '',
    backendKey: '',
    rememberAccount: false,
  });

  // 從 localStorage 讀取記住的帳號
  const loadRememberedAccount = () => {
    const remembered = localStorage.getItem(REMEMBER_ACCOUNT_KEY);
    if (remembered) {
      try {
        const account = JSON.parse(remembered);
        loginFormModel.value.account = account;
        loginFormModel.value.rememberAccount = true;
      } catch (e) {
        console.error('讀取記住的帳號失敗:', e);
      }
    }
  };

  // 儲存或清除記住的帳號
  const saveRememberedAccount = () => {
    if (loginFormModel.value.rememberAccount) {
      localStorage.setItem(REMEMBER_ACCOUNT_KEY, JSON.stringify(loginFormModel.value.account));
    } else {
      localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
    }
  };

  const updateCaptcha = async () => {
    captchaLoading.value = true;
    captchaError.value = false;
    captcha.value = '';
    
    try {
      // 使用原有的驗證碼 API 調用方式
      const data = await Api.captcha.captchaCaptchaByImg({ width: 100, height: 50 });
      captcha.value = data.img;
      loginFormModel.value.captchaId = data.id || '';
      captchaError.value = false;
    } catch (error: any) {
      console.error('更新驗證碼失敗:', error);
      captchaError.value = true;
      // 如果驗證碼 API 失敗，暫時禁用驗證碼驗證
      needCaptcha.value = false;
      message.warning('驗證碼服務暫時無法使用，已自動跳過驗證碼驗證');
    } finally {
      captchaLoading.value = false;
    }
  };

  const handleSubmit = async () => {
    const { account, password, verifyCode, backendKey } = loginFormModel.value;
    
    if (account.trim() === '' || password.trim() === '') {
      return message.warning('帳號或密碼不能為空！');
    }
    
    // 如果顯示驗證碼，則需要驗證碼
    if (needCaptcha.value && !showBackendKey.value && !verifyCode) {
      return message.warning('請輸入驗證碼！');
    }
    
    // 如果顯示雙因素驗證，則需要驗證碼
    if (showBackendKey.value && !backendKey) {
      return message.warning('請輸入雙因素驗證碼！');
    }
    
    message.loading('登入中...', 0);
    loading.value = true;
    
    try {
      // 儲存或清除記住的帳號
      saveRememberedAccount();
      
      // 如果已經顯示雙因素驗證輸入框，使用 Login2 方法
      if (showBackendKey.value) {
        console.log('showBackendKey.value', showBackendKey.value);
        console.log('account', account);
        console.log('password', password);
        console.log('backendKey', backendKey);
        const [err] = await to(
          userStore.Login2({
            account,
            password,
            backendKey,
          })
        );
        
        if (err) {
          Modal.error({
            title: '提示',
            content: err.message || '雙因素驗證失敗',
          });
          showBackendKey.value = false;
          loginFormModel.value.backendKey = '';
          if (needCaptcha.value) {
            updateCaptcha();
          }
        } else {
          // 登入成功後獲取使用者資訊
          await userStore.GetUserInfo();
          message.success('登入成功！');
          setTimeout(() => router.replace((route.query.redirect as string) || '/'));
        }
      } else {
        // 使用新的 Login 方法（支援雙因素驗證檢測）
        const result = await userStore.Login({ account, password });
        
        // 如果返回 true，表示需要雙因素驗證
        if (result === true) {
          showBackendKey.value = true;
          message.info('請輸入雙因素驗證碼');
          if (needCaptcha.value) {
            updateCaptcha();
          }
        } else {
          // 登入成功後獲取使用者資訊
          await userStore.GetUserInfo();
          message.success('登入成功！');
          setTimeout(() => router.replace((route.query.redirect as string) || '/'));
        }
      }
    } catch (error: any) {
      Modal.error({
        title: '提示',
        content: error.message || '登入失敗',
      });
      if (needCaptcha.value) {
        updateCaptcha();
      }
    } finally {
      loading.value = false;
      message.destroy();
    }
  };

  // 初始化：載入記住的帳號和驗證碼
  onMounted(() => {
    loadRememberedAccount();
    if (needCaptcha.value) {
      updateCaptcha();
    }
  });
</script>

<style lang="less" scoped>
  .login-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100vw;
    height: 100vh;
    padding-top: 240px;
    background: url('@/assets/login.svg');
    background-size: 100%;

    .login-logo {
      display: flex;
      align-items: center;
      margin-bottom: 30px;

      .svg-icon {
        font-size: 48px;
      }
    }

    :deep(.ant-form) {
      width: 400px;

      .ant-col {
        width: 100%;
      }

      .ant-form-item-label {
        padding-right: 6px;
      }
    }

    .captcha-wrapper {
      display: flex;
      align-items: center;
      height: 100%;
      padding-right: 8px;
    }

    .captcha-image {
      height: 32px;
      cursor: pointer;
      border-radius: 2px;
    }

    .captcha-loading {
      padding-right: 8px;
      color: #999;
      font-size: 12px;
    }

    .captcha-error {
      padding-right: 8px;
      color: #ff4d4f;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 16px;
      
      &:hover {
        color: #ff7875;
      }
    }
  }
</style>
