import type { RouteLocationNormalized, Router } from 'vue-router';
import type { WhiteNameList } from './constant';
import { Modal } from 'ant-design-vue';
import NProgress from 'nprogress'; // progress bar
import { isNavigationFailure, NavigationFailureType } from 'vue-router';
import { transformI18n } from '@/hooks/useI18n';
import { useKeepAliveStore } from '@/store/modules/keepAlive';
import { useTabsViewStore } from '@/store/modules/tabsView';
import { useUserStore } from '@/store/modules/user';
import { to as _to } from '@/utils/awaitTo';
import { LOGIN_NAME, PAGE_NOT_FOUND_NAME, REDIRECT_NAME } from './constant';

NProgress.configure({ showSpinner: false }); // NProgress Configuration

const defaultRoutePath = '/dashboard/mabu';

/**
 * Wizard 流程保護：全局狀態管理
 * 用於追蹤 Wizard 是否處於活動狀態
 */
const wizardState = {
  isActive: false,
  isCompleted: false,
};

/**
 * 檢查是否為 Wizard 路由
 */
const isWizardRoute = (route: RouteLocationNormalized): boolean => {
  return route.name === 'AdminAccountMasterAgentCreateWizard';
};

/**
 * 關閉 Wizard 並導向首頁
 */
const closeWizardAndGoHome = (router: Router) => {
  console.log('[Wizard][路由守衛] 關閉 Wizard 並導向首頁');
  wizardState.isActive = false;
  wizardState.isCompleted = true;

  const tabsViewStore = useTabsViewStore();
  const currentTab = tabsViewStore.getCurrentTab;
  if (currentTab && isWizardRoute(currentTab)) {
    tabsViewStore.closeCurrentTab(currentTab);
  }

  router.push({ name: 'dashboard-mabu' }).catch((err) => {
    console.error('[Wizard][路由守衛] 導向首頁失敗:', err);
  });
};

export function createRouterGuards(router: Router, whiteNameList: WhiteNameList) {
  router.beforeEach(async (to, from, next) => {
    if (!from.meta?.hideProgressBar || !to.meta?.hideProgressBar) {
      NProgress.start(); // start progress bar
    }
    const userStore = useUserStore();

    // ====================================================
    // 🔐 Wizard 流程保護：Tab 切換攔截
    // ====================================================
    // 如果從 Wizard 頁面離開，且 Wizard 尚未完成，則攔截
    if (isWizardRoute(from) && !isWizardRoute(to) && wizardState.isActive && !wizardState.isCompleted) {
      console.log('[Wizard][路由守衛] 偵測到 Tab 切換，攔截導航', {
        from: from.name,
        to: to.name,
        isActive: wizardState.isActive,
        isCompleted: wizardState.isCompleted,
      });

      // 顯示確認視窗
      Modal.confirm({
        title: '離開建立程序',
        content: '將會離開建立程序，並關閉此頁',
        okText: '確認',
        cancelText: '取消',
        onOk: () => {
          console.log('[Wizard][路由守衛] 使用者確認離開，關閉 Wizard');
          closeWizardAndGoHome(router);
          // 允許導航到目標路由
          next();
        },
        onCancel: () => {
          console.log('[Wizard][路由守衛] 使用者取消離開，留在 Wizard');
          // 取消導航，留在原頁面
          next(false);
        },
      });
      return; // 等待使用者確認
    }

    // 如果進入 Wizard 頁面，更新狀態
    if (isWizardRoute(to)) {
      wizardState.isActive = true;
      wizardState.isCompleted = false;
      console.log('[Wizard][路由守衛] 進入 Wizard 頁面，啟動流程保護');
    }

    if (userStore.token) {
      if (to.name === LOGIN_NAME) {
        next({ path: defaultRoutePath });
      }
      else {
        const hasRoute = router.hasRoute(to.name!);
        if (userStore.menus.length === 0) {
          // 从后台获取菜单
          const [err] = await _to(userStore.afterLogin());
          if (err) {
            userStore.clearLoginStatus();
            Modal.destroyAll();
            return next({ name: LOGIN_NAME });
          }
          // 解决警告：No match found for location with path "XXXXXXX"
          if (to.name === PAGE_NOT_FOUND_NAME) {
            next({ path: to.fullPath, query: to.query, replace: true });
          }
          // 如果该路由不存在，可能是动态注册的路由，它还没准备好，需要再重定向一次到该路由
          else if (!hasRoute) {
            next({ ...to, replace: true });
          }
          else {
            next();
          }
        }
        else {
          next();
        }
      }
    }
    else {
      // not login
      if (to.name && whiteNameList.includes(to.name as any)) {
        // 在免登录名单，直接进入
        next();
      }
      else {
        next({ name: LOGIN_NAME, query: { redirect: to.fullPath }, replace: true });
      }
    }
  });

  /** 获取路由对应的组件名称 */
  const getComponentName = (route: RouteLocationNormalized): string[] => {
    return route.matched
      .map((n) => {
        if (!n.meta?.keepAlive) {
          return undefined;
        }
        const comp = n.components?.default;
        return comp?.name ?? (comp as any)?.type?.name;
      })
      .filter((name): name is string => Boolean(name));
  };

  router.afterEach((to, from, failure) => {
    // 跳过自己手动取消路由导航时的错误
    if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
      NProgress.done();
      // console.error('failed navigation', failure);
      return;
    }

    if (to.meta?.title) {
      // 设置网页标题
      document.title = transformI18n(to.meta.title);
    }

    const keepAliveStore = useKeepAliveStore();

    // 在这里设置需要缓存的组件名称
    const toCompName = getComponentName(to);
    // 判断当前页面是否开启缓存，如果开启，则将当前页面的 componentName 信息存入 keep-alive 全局状态
    if (to.meta?.keepAlive) {
      // 需要缓存的组件
      if (toCompName) {
        keepAliveStore.add(toCompName);
      }
      else {
        console.warn(
          `${to.fullPath}页面组件的keepAlive为true但未设置组件名，会导致缓存失效，请检查`,
        );
      }
    }
    else {
      // 不需要缓存的组件
      if (toCompName) {
        keepAliveStore.remove(toCompName);
      }
    }
    // 如果进入的是 Redirect 页面，则也将离开页面的缓存清空(刷新页面的操作)
    if (to.name === REDIRECT_NAME) {
      const fromCompName = getComponentName(from);
      fromCompName && keepAliveStore.remove(fromCompName);
    }
    const userStore = useUserStore();
    // 如果用户已登出，则清空所有缓存的组件
    if (!userStore.token) {
      keepAliveStore.clear();
    }
    // 如果用戶已登入，確保首頁 Tab 存在
    if (userStore.token && to.name !== LOGIN_NAME) {
      const tabsViewStore = useTabsViewStore();
      // 確保首頁 Tab 存在（在登入後首次導航時）
      if (tabsViewStore.tabsList.length === 0 || !tabsViewStore.tabsList.find(tab => tab.name === 'dashboard-mabu')) {
        tabsViewStore.ensureHomeTabExists();
      }
    }
    // console.log('keepAliveStore', keepAliveStore.list);
    NProgress.done(); // finish progress bar
  });

  router.onError((error) => {
    console.error('路由错误', error);
  });
}

/**
 * 導出 Wizard 狀態管理函數（供 Wizard 組件使用）
 */
export const wizardStateManager = {
  setActive: (active: boolean) => {
    wizardState.isActive = active;
    console.log('[Wizard][狀態管理] 設置 isActive:', active);
  },
  setCompleted: (completed: boolean) => {
    wizardState.isCompleted = completed;
    wizardState.isActive = !completed; // 完成時自動設為非活動
    console.log('[Wizard][狀態管理] 設置 isCompleted:', completed);
  },
  getState: () => ({ ...wizardState }),
};
