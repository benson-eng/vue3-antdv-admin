import type { RouteRecordRaw } from 'vue-router';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import Api from '@/api/';
import { getBackendKey, getUserInfoLocal, loginLocal, logoutLocal } from '@/api/users';
import { resetRouter } from '@/router';
import { generateDynamicRoutes } from '@/router/helper/routeHelper';
import { store } from '@/store';
import { getToken, removeToken, setToken as setTokenCookie } from '@/utils/cookies';
import { useLockscreenStore } from './lockscreen';
import { useSSEStore } from './sse';

export const useUserStore = defineStore(
  'user',
  () => {
    const sseStore = useSSEStore();
    const lockscreenStore = useLockscreenStore();
    const token = ref<string>(getToken() || '');
    const perms = ref<string[]>([]);
    const menus = ref<RouteRecordRaw[]>([]);
    const userInfo = ref<Partial<API.UserEntity>>({});

    /**
     * 新增：從 Vue 2 專案整合的狀態欄位
     */
    const name = ref<string>('');
    const avatar = ref<string>('');
    const roles = ref<string[]>([]);
    const email = ref<string>('');
    const account = ref<string>('');
    const introduction = ref<string>('');
    const level = ref<number>(-1);
    const website = ref<string>('');
    const masterAgent = ref<string>('');
    const agent = ref<string>('');
    const currencies = ref<string[]>([]);
    const shareholder = ref<string>('');

    const sortMenus = (menus: RouteRecordRaw[] = []) => {
      return menus
        .filter((n) => {
          const flag = !n.meta?.hideInMenu;
          if (flag && n.children?.length) {
            n.children = sortMenus(n.children);
          }
          return flag;
        })
        .sort((a, b) => ~~Number(a.meta?.orderNo) - ~~Number(b.meta?.orderNo));
    };

    /** 取得使用者資訊（使用新的 API） */
    const GetUserInfo = async () => {
      if (!token.value) {
        throw new Error('GetUserInfo: token is undefined!');
      }

      const response = await getUserInfoLocal({ token: token.value });
      const data = (response as any)?.data || response;

      if (!data) {
        throw new Error('Verification failed, please Login again.');
      }

      const {
        roles: userRoles,
        name: userName,
        avatar: userAvatar,
        introduction: userIntroduction,
        email: userEmail,
        level: userLevel,
        website: userWebsite,
        masterAgentAccount,
        agent: userAgent,
        currencies: userCurrencies,
        account: userAccount,
        shareholder: userShareholder,
      } = data;

      if (!userRoles || userRoles.length <= 0) {
        throw new Error('GetUserInfo: roles must be a non-null array!');
      }

      roles.value = userRoles;
      name.value = userName || '';
      avatar.value = userAvatar || '';
      introduction.value = userIntroduction || '';
      email.value = userEmail || '';
      level.value = userLevel || -1;
      website.value = userWebsite || '';

      if (masterAgent.value.length === 0 && userLevel >= 4) {
        masterAgent.value = masterAgentAccount || '';
      }

      agent.value = userAgent || '';
      currencies.value = userCurrencies || [];
      account.value = userAccount || '';

      if (userLevel >= 3) {
        shareholder.value = userShareholder?.account || '';
      }
    };

    /** 获取权限及菜单 */
    const fetchPermsAndMenus = async () => {
      try {
        // TODO: 這兩個 API 尚未導入，暫時使用預設值
        // 等 AdminSystem API 的權限和菜單 API 整合後，再替換此部分
        // const { accountPermissions, accountMenu } = Api.account;
        // const [menusData, permsData] = await Promise.all([accountMenu(), accountPermissions()]);

        // 暫時使用預設值，避免登入流程中斷
        const menusData: RouteRecordRaw[] = [];
        /**
         * 使用從 GetUserInfo 獲取的 roles 作為權限
         */
        const permsData: string[] = roles.value || [];

        perms.value = permsData;
        const result = generateDynamicRoutes(menusData as unknown as RouteRecordRaw[]);
        menus.value = sortMenus(result);

        console.warn('權限和菜單 API 尚未整合，使用預設值。請在 AdminSystem API 整合後更新此方法。');
      }
      catch (error) {
        // 如果 API 調用失敗，使用預設值，不影響登入流程
        console.warn('獲取權限和菜單失敗，使用預設值:', error);
        perms.value = roles.value || [];
        menus.value = [];
      }
    };

    /** 登录成功之后, 获取用户信息以及生成权限路由 */
    const afterLogin = async () => {
      try {
        // 使用新的 API 獲取使用者資訊（從 Vue 2 專案整合）
        await GetUserInfo();

        // 將新 API 獲取的資料映射到 userInfo（保持與原有專案的兼容性）
        // 注意：根據實際 API 回應調整欄位映射
        userInfo.value = {
          ...userInfo.value, // 保留原有欄位
          username: account.value || name.value,
          nickname: name.value,
          avatar: avatar.value,
          email: email.value,
          // roles 需要轉換為 RoleEntity[] 格式，這裡先保留為空陣列
          // 如果新 API 有提供完整的 role 物件，請在這裡映射
          // roles: roles.value.map(role => ({ name: role, ... })) as API.RoleEntity[],
        } as Partial<API.UserEntity>;

        /**
         * 獲取權限及菜單（如果原有專案需要）
         * 注意：如果新 API 也提供權限和菜單，可能需要調整 fetchPermsAndMenus
         */
        await fetchPermsAndMenus();
        sseStore.initServerMsgListener();
      }
      catch (error) {
        return Promise.reject(error);
        // return logout();
      }
    };

    /** 清空登录态(token、userInfo...) */
    const clearLoginStatus = () => {
      token.value = '';
      perms.value = [];
      menus.value = [];
      userInfo.value = {};
      // 清除新增的狀態欄位
      name.value = '';
      avatar.value = '';
      roles.value = [];
      email.value = '';
      account.value = '';
      introduction.value = '';
      level.value = -1;
      website.value = '';
      masterAgent.value = '';
      agent.value = '';
      currencies.value = [];
      shareholder.value = '';
      resetRouter();
      setTimeout(() => {
        localStorage.clear();
      });
    };
    /** 登录成功保存token */
    const setToken = (_token: string) => {
      token.value = _token;
      setTokenCookie(_token);
    };

    /** 重置 Token */
    const resetToken = () => {
      removeToken();
      token.value = '';
      roles.value = [];
      name.value = '';
      avatar.value = '';
      email.value = '';
      account.value = '';
    };
    /** 登录 */
    const login = async (params: API.LoginDto) => {
      try {
        const data = await Api.auth.authLogin(params);
        setToken(data.token);
        await afterLogin();
        lockscreenStore.setLock(false);
        lockscreenStore.saveLoginPwd(params.password);
      }
      catch (error) {
        return Promise.reject(error);
      }
    };
    /** 登出 */
    const logout = async () => {
      // 使用新的 AdminSystem API 登出
      try {
        if (token.value) {
          await logoutLocal({});
        }
      }
      catch (error) {
        console.error('登出 API 調用失敗:', error);
        // 即使 API 調用失敗，也繼續執行登出流程
      }

      // 清除所有登入狀態
      sseStore.closeEventSource();
      clearLoginStatus();

      // 清除新增的狀態欄位
      resetToken();
    };
    // ========== 從 Vue 2 專案整合的新方法 ==========

    /** 登入（使用新的 API） */
    const Login = async (userInfo: { account: string; password: string }) => {
      let { account: accountInput, password } = userInfo;
      accountInput = accountInput.trim();
      const response = await loginLocal({ account: accountInput, password });

      // 處理回應格式（適配 IVueResponse）
      const data = (response as any)?.data || response;
      let Authenticator = false;
      if (data.authenticator) {
        Authenticator = data.authenticator;
      }

      if (!Authenticator) {
        if (data) {
          const accessToken = data.accessToken || data.token;
          setToken(accessToken);
          masterAgent.value = data.userData?.masterAgent || '';
          agent.value = data.userData?.agent || '';
          currencies.value = data.userData?.currencies || [];
        }
      }
      else {
        return Authenticator;
      }
    };

    /** Authenticator驗證登入 */
    const Login2 = async (userInfo: { account: string; password: string; backendKey: string }) => {
      let { account: accountInput, password, backendKey } = userInfo;
      accountInput = accountInput.trim();

      // 先登入獲取 token 和 userData
      const response = await loginLocal({ account: accountInput, password });
      const data = (response as any)?.data || response;

      if (!data || !data.userData || !data.userData.id) {
        throw new Error('無法取得使用者資訊');
      }

      // 先設置 token，讓 getBackendKey API 可以正常調用
      const accessToken = data.accessToken || data.token;
      if (accessToken) {
        setToken(accessToken);
      }

      // 取得 BackendKey secret
      const backendKeyResponse = await getBackendKey({ id: data.userData.id });
      const backendKeyData = (backendKeyResponse as any)?.data || backendKeyResponse;

      // 清除 token，準備驗證
      removeToken();
      token.value = '';

      // 驗證 backendKey
      let verified = false;
      if (backendKeyData && backendKeyData.backendKey) {
        try {
          // 使用 otplib（瀏覽器兼容的 TOTP 庫）
          const otplib = await import('otplib');

          // otplib 的 verifySync 方法同步驗證 TOTP token
          // 確保 token 是字符串格式
          const tokenStr = String(backendKey).trim();

          let verifyResult: any = null;
          try {
            // 使用 otplib.verifySync 驗證
            // 參數格式: { token: string, secret: string }
            // 注意：otplib 的 verifySync 會自動處理時間窗口
            verifyResult = otplib.verifySync({
              token: tokenStr,
              secret: backendKeyData.backendKey,
            });

            // 檢查驗證結果
            // otplib.verifySync 返回 { valid: boolean } 格式
            if (verifyResult && typeof verifyResult === 'object') {
              // 檢查 valid 屬性（otplib 13.x 版本使用 valid）
              if ('valid' in verifyResult) {
                verified = verifyResult.valid === true;
              }
              // 檢查 ok 屬性（某些版本的 otplib 使用 ok）
              else if ('ok' in verifyResult) {
                verified = verifyResult.ok === true;
              }
              // 如果有 delta 屬性，通常表示驗證成功
              else if ('delta' in verifyResult) {
                verified = true;
              }
              else {
                // 如果返回值不符合預期格式，視為驗證失敗
                verified = false;
              }
            }
            else {
              // 如果返回值不是對象，視為驗證失敗
              verified = false;
            }

            // 如果驗證失敗，拋出錯誤
            if (!verified) {
              throw new Error('Authenticator驗證碼錯誤');
            }
          }
          catch (verifyError: any) {
            // 驗證失敗時會拋出錯誤
            verified = false;
            // 重新拋出錯誤，確保登入流程被中斷
            throw new Error('Authenticator驗證碼錯誤');
          }
        }
        catch (error: any) {
          // 檢查是否是因為缺少依賴
          if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
            throw new Error('Authenticator驗證失敗：請先安裝依賴套件（pnpm add otplib）');
          }
          throw new Error(`Authenticator驗證失敗：${error.message || '無法驗證驗證碼'}`);
        }
      }
      else {
        throw new Error('無法取得Authenticator驗證密鑰');
      }

      // 如果驗證通過，設定 token
      if (!verified) {
        throw new Error('Authenticator驗證碼錯誤');
      }

      if (!accessToken) {
        throw new Error('無法取得登入 token');
      }

      // 只有驗證通過且有 token 時才設置
      setToken(accessToken);
      masterAgent.value = data.userData?.masterAgent || '';
      agent.value = data.userData?.agent || '';
      currencies.value = data.userData?.currencies || [];
    };

    /** 登出（使用新的 API） */
    const LogOut = async () => {
      if (!token.value) {
        throw new Error('LogOut: token is undefined!');
      }

      try {
        await logoutLocal({});
      }
      catch (error) {
        console.error('登出 API 調用失敗:', error);
      }

      removeToken();
      resetRouter();
      token.value = '';
      roles.value = [];
      name.value = '';
      avatar.value = '';
      email.value = '';
      account.value = '';
      sseStore.closeEventSource();
    };

    return {
      token,
      perms,
      menus,
      userInfo,
      // 新增狀態
      name,
      avatar,
      roles,
      email,
      account,
      introduction,
      level,
      website,
      masterAgent,
      agent,
      currencies,
      shareholder,
      // 原有方法
      login,
      afterLogin,
      logout,
      clearLoginStatus,
      fetchPermsAndMenus,
      setToken,
      // 新增方法
      Login,
      Login2,
      GetUserInfo,
      LogOut,
      resetToken,
    };
  },
  {
    persist: {
      pick: ['token'],
    },
  },
);

/**
 * 在组件setup函数外使用
 */
export function useUserStoreWithOut() {
  return useUserStore(store);
}
