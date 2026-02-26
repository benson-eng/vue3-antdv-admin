<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Api from '@/api/';
import { Icon } from '@/components/basic/icon';
import { useUserStore } from '@/store/modules/user';
import { to } from '@/utils/awaitTo';

defineOptions({
  name: 'Login',
});

const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const loading2 = ref(false);
const captcha = ref('');
const captchaLoading = ref(false);
const captchaError = ref(false);
const showDialog = ref(false);
const errStr = ref(false);
/**
 * 是否顯示驗證碼（目前不使用）
 */
const needCaptcha = ref(false);
const backendKeyInputRef = ref();

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

/**
 * 從 localStorage 讀取記住的帳號
 */
const loadRememberedAccount = () => {
  const remembered = localStorage.getItem(REMEMBER_ACCOUNT_KEY);
  if (remembered) {
    try {
      const account = JSON.parse(remembered);
      loginFormModel.value.account = account;
      loginFormModel.value.rememberAccount = true;
    }
    catch (e) {
      console.error('讀取記住的帳號失敗:', e);
    }
  }
};

/**
 * 儲存或清除記住的帳號
 */
const saveRememberedAccount = () => {
  if (loginFormModel.value.rememberAccount) {
    localStorage.setItem(REMEMBER_ACCOUNT_KEY, JSON.stringify(loginFormModel.value.account));
  }
  else {
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
  }
  catch (error: any) {
    console.error('更新驗證碼失敗:', error);
    captchaError.value = true;
    // 如果驗證碼 API 失敗，暫時禁用驗證碼驗證
    needCaptcha.value = false;
    message.warning('驗證碼服務暫時無法使用，已自動跳過驗證碼驗證');
  }
  finally {
    captchaLoading.value = false;
  }
};

const handleSubmit = async () => {
  const { account, password, verifyCode } = loginFormModel.value;

  if (account.trim() === '' || password.trim() === '') {
    return message.warning('帳號或密碼不能為空！');
  }

  // 如果顯示驗證碼，則需要驗證碼
  if (needCaptcha.value && !verifyCode) {
    return message.warning('請輸入驗證碼！');
  }

  message.loading('登入中...', 0);
  loading.value = true;

  try {
    // 儲存或清除記住的帳號
    saveRememberedAccount();

    // 使用新的 Login 方法（支援Authenticator驗證檢測）
    const result = await userStore.Login({ account, password });

    // 如果返回 true，表示需要Authenticator驗證
    if (result === true) {
      loginFormModel.value.backendKey = '';
      errStr.value = false;
      showDialog.value = true;
      message.destroy();
      message.info('請輸入Authenticator驗證碼');
      // 等待 DOM 更新後聚焦輸入框
      await new Promise(resolve => setTimeout(resolve, 100));
      if (backendKeyInputRef.value) {
        backendKeyInputRef.value.focus();
      }
    }
    else {
      try {
        // 登入成功後載入路由（afterLogin 內部會調用 GetUserInfo）
        await userStore.afterLogin();
        message.destroy();
        message.success('登入成功！');
        // 導向首頁
        router.replace('/home').catch((err) => {
          console.error('導航失敗:', err);
          // 如果導航失敗，嘗試使用路由名稱
          router.replace({ name: 'Home' }).catch(() => {
            // 最後嘗試使用路徑
            window.location.href = '/home';
          });
        });
      }
      catch (error) {
        console.error('登入後處理失敗:', error);
        message.destroy();
        message.error('登入成功，但載入路由失敗，請重新整理頁面');
      }
    }
  }
  catch (error: any) {
    message.destroy();
    Modal.error({
      title: '提示',
      content: error.message || '登入失敗',
    });
  }
  finally {
    loading.value = false;
  }
};

const handleLogin2 = async () => {
  const { account, password, backendKey } = loginFormModel.value;

  if (!backendKey) {
    return message.warning('請輸入Authenticator驗證碼！');
  }

  loading2.value = true;
  errStr.value = false;

  try {
    const [err] = await to(
      userStore.Login2({
        account,
        password,
        backendKey,
      }),
    );

    if (err) {
      errStr.value = true;
    }
    else {
      try {
        // 登入成功後載入路由（afterLogin 內部會調用 GetUserInfo）
        await userStore.afterLogin();
        message.success('登入成功！');
        showDialog.value = false;
        loginFormModel.value.backendKey = '';
        // 導向首頁
        router.replace('/home').catch((err) => {
          console.error('導航失敗:', err);
          // 如果導航失敗，嘗試使用路由名稱
          router.replace({ name: 'Home' }).catch(() => {
            // 最後嘗試使用路徑
            window.location.href = '/home';
          });
        });
      }
      catch (error) {
        console.error('登入後處理失敗:', error);
        message.error('登入成功，但載入路由失敗，請重新整理頁面');
      }
    }
  }
  catch (error: any) {
    console.error('發生未預期的錯誤:', error);
    errStr.value = true;
  }
  finally {
    loading2.value = false;
  }
};

const closeDialog = () => {
  showDialog.value = false;
  loginFormModel.value.backendKey = '';
  errStr.value = false;
};

const handleKeyupEnter = () => {
  if (showDialog.value) {
    handleLogin2();
  }
};

// 初始化：載入記住的帳號
onMounted(() => {
  loadRememberedAccount();
  // 驗證碼功能目前不使用，不在此處獲取驗證碼
});
</script>

<template>
  <div class="login-box">
    <div class="login-logo">
      <!-- <svg-icon name="logo" :size="45" /> -->
      <img src="~@/assets/images/logo.png" width="45">
      <h1 class="mb-0 ml-2 text-3xl font-bold">
        Antdv Admin
      </h1>
    </div>
    <a-form layout="horizontal" :model="loginFormModel" @submit.prevent="handleSubmit">
      <a-form-item>
        <a-input v-model:value="loginFormModel.account" size="large" placeholder="帳號">
          <template #prefix>
            <Icon icon="ant-design:user-outlined" />
          </template>
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
          <template #prefix>
            <Icon icon="ant-design:lock-outlined" />
          </template>
        </a-input>
      </a-form-item>
      <!-- 原有驗證碼輸入框（保留原有功能） -->
      <a-form-item v-if="needCaptcha">
        <a-input
          v-model:value="loginFormModel.verifyCode"
          placeholder="验证码"
          :maxlength="4"
          size="large"
        >
          <template #prefix>
            <Icon icon="ant-design:safety-outlined" />
          </template>
          <template #suffix>
            <div v-if="captcha && !captchaError" class="captcha-wrapper">
              <img
                :src="captcha"
                class="captcha-image"
                alt="驗證碼"
                @click="updateCaptcha"
              >
            </div>
            <div v-else-if="captchaLoading" class="captcha-loading">
              載入中...
            </div>
            <div v-else-if="captchaError" class="captcha-error" title="點擊重試" @click="updateCaptcha">
              <Icon icon="ant-design:reload-outlined" />
            </div>
            <div v-else class="captcha-loading">
              載入中...
            </div>
          </template>
        </a-input>
      </a-form-item>
      <a-form-item>
        <div class="w-full flex items-center justify-between">
          <a-checkbox v-model:checked="loginFormModel.rememberAccount">
            記住帳號
          </a-checkbox>
        </div>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" size="large" :loading="loading" block>
          登入
        </a-button>
      </a-form-item>
    </a-form>

    <!-- Authenticator驗證彈出視窗 -->
    <a-modal
      v-model:open="showDialog"
      title="Authenticator驗證碼"
      :mask-closable="false"
      :closable="true"
      width="300px"
      centered
      @cancel="closeDialog"
    >
      <a-form :model="loginFormModel">
        <a-form-item>
          <a-input
            ref="backendKeyInputRef"
            v-model:value="loginFormModel.backendKey"
            size="large"
            placeholder="Authenticator驗證碼"
            :maxlength="6"
            @keyup.enter="handleKeyupEnter"
          >
            <template #prefix>
              <Icon icon="ant-design:safety-outlined" />
            </template>
          </a-input>
        </a-form-item>
      </a-form>
      <div v-if="errStr" style="color: red; margin-top: 8px;">
        驗證失敗
      </div>
      <template #footer>
        <a-button @click="closeDialog">
          取 消
        </a-button>
        <a-button type="primary" :loading="loading2" @click="handleLogin2">
          確定
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

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
