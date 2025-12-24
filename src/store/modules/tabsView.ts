import type { RouteLocationMatched, RouteLocationNormalizedLoaded } from 'vue-router';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  useRoute,
} from 'vue-router';
import router from '@/router';
import { LOGIN_NAME, PAGE_NOT_FOUND_NAME, REDIRECT_NAME } from '@/router/constant';
import { store } from '@/store';
import { useKeepAliveStore } from './keepAlive';
import { useLayoutSettingStore } from './layoutSetting';

/** 不需要出现在标签页中的路由 */
export const routeExcludes = [REDIRECT_NAME, LOGIN_NAME, PAGE_NOT_FOUND_NAME] as const;

export const useTabsViewStore = defineStore(
  'tabs-view',
  () => {
    const currentRoute = useRoute();
    const layoutSettingStore = useLayoutSettingStore();
    const tabsList = ref<RouteLocationNormalizedLoaded[]>([]);

    /** 给定的路由是否在排除名单里面 */
    const isInRouteExcludes = (route: RouteLocationNormalizedLoaded) => {
      if (route.meta?.hideInTabs) {
        return true;
      }
      if (!route.name) {
        return false;
      }
      return routeExcludes.includes(route.name as typeof routeExcludes[number]);
    };

    /** 檢查是否為首頁路由（不可關閉） */
    const isHomeRoute = (route: RouteLocationNormalizedLoaded): boolean => {
      return route.name === 'dashboard-mabu';
    };

    /** 檢查是否為 Wizard 路由 */
    const isWizardRoute = (route: RouteLocationNormalizedLoaded): boolean => {
      return route.name === 'AdminAccountMasterAgentCreateWizard';
    };

    const getRawRoute = (route: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded => {
      // 確保 route.matched 是 Array，防止 undefined.map 錯誤
      const matched = Array.isArray(route.matched) ? route.matched : [];
      return {
        ...route,
        matched: matched.map((item) => {
          const { meta, path, name } = item;
          return { meta, path, name };
        }) as RouteLocationMatched[],
      };
    };

    const getTabsList = computed(() => {
      return tabsList.value.filter((item) => {
        return item && !isInRouteExcludes(item) && router.hasRoute(item.name!);
      });
    });

    /** 当前activity tab */
    const getCurrentTab = computed(() => {
      return tabsList.value.find((item) => {
        return item && !isInRouteExcludes(item) && item.fullPath === currentRoute.fullPath;
      });
    });

    /** 確保首頁存在於 tabsList 中 */
    const ensureHomeTabExists = () => {
      // 確保 tabsList 是 Array
      if (!Array.isArray(tabsList.value)) {
        tabsList.value = [];
      }

      const homeRoute = router.getRoutes().find(r => r.name === 'dashboard-mabu');
      if (homeRoute) {
        const homeTab = tabsList.value.find(tab => tab.name === 'dashboard-mabu');
        if (!homeTab) {
          try {
            // 首頁不存在，添加首頁
            const resolvedRoute = router.resolve({ name: 'dashboard-mabu' });
            const homeRouteLocation: RouteLocationNormalizedLoaded = {
              ...resolvedRoute,
              matched: resolvedRoute.matched || [],
            } as RouteLocationNormalizedLoaded;
            const rawRoute = getRawRoute(homeRouteLocation);
            // 確保首頁永遠在第一個位置
            tabsList.value.unshift(rawRoute);
            console.log('[TabsView] 確保首頁存在：已添加首頁 tab');
          }
          catch (error) {
            console.error('[TabsView] 添加首頁失敗:', error);
          }
        }
        else {
          // 如果首頁存在但不在第一個位置，移到第一個
          const homeIndex = tabsList.value.findIndex(tab => tab.name === 'dashboard-mabu');
          if (homeIndex > 0) {
            const homeTab = tabsList.value.splice(homeIndex, 1)[0];
            tabsList.value.unshift(homeTab);
            console.log('[TabsView] 首頁已移動到第一個位置');
          }
        }
      }
    };

    /** 将已关闭的标签页的组件从keep-alive中移除 */
    const delCompFromClosedTabs = (closedTabs: RouteLocationNormalizedLoaded[]) => {
      const keepAliveStore = useKeepAliveStore();
      const routes = router.getRoutes();
      const compNames = closedTabs.reduce<string[]>((prev, curr) => {
        if (curr.name && router.hasRoute(curr.name)) {
          const componentName = routes.find(n => n.name === curr.name)?.components?.default?.name;
          if (componentName) {
            prev.push(componentName);
          }
        }
        return prev;
      }, []);
      keepAliveStore.remove(compNames);
    };

    /** 添加标签页 */
    const addTabs = (route: RouteLocationNormalizedLoaded) => {
      // 確保 tabsList 是 Array
      if (!Array.isArray(tabsList.value)) {
        tabsList.value = [];
      }

      if (isInRouteExcludes(route)) {
        return false;
      }

      // ====================================================
      // 🏠 首頁保護：確保首頁存在
      // ====================================================
      // 不允許添加重複的首頁
      if (isHomeRoute(route)) {
        ensureHomeTabExists();
        return true; // 首頁已存在，不需要重複添加
      }

      // 如果添加的是 Wizard 頁籤，確保首頁存在
      if (isWizardRoute(route)) {
        ensureHomeTabExists();
      }

      // 如果 tabsList 為空，先確保首頁存在
      if (tabsList.value.length === 0) {
        ensureHomeTabExists();
      }

      const isExists = tabsList.value.some(item => item.fullPath === route.fullPath);
      if (!isExists) {
        tabsList.value.push(getRawRoute(route));
      }
      return true;
    };

    /** 关闭左侧 */
    const closeLeftTabs = (route: RouteLocationNormalizedLoaded) => {
      const index = tabsList.value.findIndex(item => item.fullPath === route.fullPath);
      if (index > 0) {
        // 確保不關閉首頁
        const tabsToClose = tabsList.value.slice(0, index).filter(tab => !isHomeRoute(tab));
        delCompFromClosedTabs(tabsToClose);
        tabsList.value = tabsList.value.filter((_, i) => i >= index || isHomeRoute(tabsList.value[i]));
      }
    };

    /** 关闭右侧 */
    const closeRightTabs = (route: RouteLocationNormalizedLoaded) => {
      const index = tabsList.value.findIndex(item => item.fullPath === route.fullPath);
      if (index >= 0 && index < tabsList.value.length - 1) {
        // 確保不關閉首頁
        const tabsToClose = tabsList.value.slice(index + 1).filter(tab => !isHomeRoute(tab));
        delCompFromClosedTabs(tabsToClose);
        tabsList.value = tabsList.value.filter((_, i) => i <= index || isHomeRoute(tabsList.value[i]));
      }
    };

    /** 关闭其他 */
    const closeOtherTabs = (route: RouteLocationNormalizedLoaded) => {
      const targetIndex = tabsList.value.findIndex(item => item.fullPath === route.fullPath);
      if (targetIndex !== -1) {
        const current = tabsList.value[targetIndex];
        const homeTab = tabsList.value.find(tab => isHomeRoute(tab));
        // 保留當前 tab 和首頁
        const tabsToKeep = homeTab && !isHomeRoute(current) ? [homeTab, current] : [current];
        const tabsToClose = tabsList.value.filter(tab => !tabsToKeep.includes(tab));
        delCompFromClosedTabs(tabsToClose);
        tabsList.value = tabsToKeep;
      }
    };

    /** 关闭当前页 */
    const closeCurrentTab = (route: RouteLocationNormalizedLoaded) => {
      // ====================================================
      // 🏠 首頁保護：首頁不可關閉
      // ====================================================
      if (isHomeRoute(route)) {
        console.log('[TabsView][頁籤保護] 首頁不可關閉，操作被阻止');
        return;
      }

      const index = tabsList.value.findIndex(item => item.fullPath === route.fullPath);
      if (index === -1) {
        return; // 找不到該 tab
      }

      // ====================================================
      // 🔐 Wizard 頁籤保護：不能成為最後一個 tab
      // ====================================================
      if (isWizardRoute(route)) {
        const remainingTabs = tabsList.value.filter((_, i) => i !== index);
        const remainingNonWizardTabs = remainingTabs.filter(tab => !isWizardRoute(tab));

        // 如果關閉後只剩下 Wizard 或其他非首頁 tab，則阻止
        if (remainingNonWizardTabs.length === 0) {
          console.log('[TabsView][頁籤保護] Wizard 頁籤不能成為最後一個 tab，操作被阻止');
          // 確保首頁存在
          ensureHomeTabExists();
          return;
        }
      }

      // 計算關閉後的 tab 數量（排除 Wizard）
      const tabsAfterClose = tabsList.value.filter((_, i) => i !== index);
      const nonWizardTabsAfterClose = tabsAfterClose.filter(tab => !isWizardRoute(tab));

      // 如果關閉後只剩下 Wizard，則阻止
      if (nonWizardTabsAfterClose.length === 0 && tabsAfterClose.some(tab => isWizardRoute(tab))) {
        console.log('[TabsView][頁籤保護] 關閉後只剩下 Wizard，操作被阻止');
        // 確保首頁存在
        ensureHomeTabExists();
        return;
      }

      const isDelCurrentTab = Object.is(getCurrentTab.value, tabsList.value[index]);
      delCompFromClosedTabs(tabsList.value.splice(index, 1));

      // 如果关闭的tab就是当前激活的tab，则重定向页面
      if (isDelCurrentTab) {
        // 確保首頁存在
        ensureHomeTabExists();
        // 優先導向首頁
        const homeTab = tabsList.value.find(tab => isHomeRoute(tab));
        const targetRoute = homeTab || tabsList.value[Math.max(0, tabsList.value.length - 1)];
        if (targetRoute) {
          router.push(targetRoute).catch((err) => {
            console.error('[TabsView] 導航失敗:', err);
            // 如果導航失敗，強制導向首頁
            router.push({ name: 'dashboard-mabu' });
          });
        }
        else {
          // 如果沒有任何 tab，確保首頁存在並導向
          ensureHomeTabExists();
          router.push({ name: 'dashboard-mabu' }).catch((err) => {
            console.error('[TabsView] 導向首頁失敗:', err);
          });
        }
      }
    };

    /** 关闭全部 */
    const closeAllTabs = () => {
      // 確保 tabsList 是 Array
      if (!Array.isArray(tabsList.value)) {
        tabsList.value = [];
      }

      // 保留首頁
      const homeTab = tabsList.value.find(tab => isHomeRoute(tab));
      delCompFromClosedTabs(tabsList.value.filter(tab => !isHomeRoute(tab)));
      tabsList.value = homeTab ? [homeTab] : [];
      // 如果沒有首頁，確保首頁存在
      if (!homeTab) {
        ensureHomeTabExists();
      }
      // 導向首頁
      router.push({ name: 'dashboard-mabu' }).catch((err) => {
        console.error('[TabsView] 導向首頁失敗:', err);
      });
    };

    /**
     * 更新tab标题
     */
    const updateTabTitle = (title: string) => {
      const currentRoute = router.currentRoute.value;
      const upTarget = tabsList.value.find(item => item.fullPath === currentRoute.fullPath);
      if (upTarget) {
        upTarget.meta.title = title;
      }
    };

    // 初始化時確保首頁存在
    ensureHomeTabExists();

    watch(
      () => currentRoute.fullPath,
      () => {
        addTabs(currentRoute);
        // 每次路由變化時，確保首頁存在且在第一個位置
        ensureHomeTabExists();
      },
      { immediate: true },
    );

    window.addEventListener('beforeunload', () => {
      if (!layoutSettingStore.layoutSetting.cacheTabs) {
        // 確保 tabsList 是 Array
        if (!Array.isArray(tabsList.value)) {
          tabsList.value = [];
        }

        if (isInRouteExcludes(currentRoute)) {
          // 保留首頁
          const homeTab = tabsList.value.find(tab => isHomeRoute(tab));
          tabsList.value = homeTab ? [homeTab] : [];
        }
        else {
          const currentTab = getCurrentTab.value;
          const homeTab = tabsList.value.find(tab => isHomeRoute(tab));
          // 如果當前 tab 是首頁，保留首頁；否則保留當前 tab 和首頁
          if (currentTab && isHomeRoute(currentTab)) {
            tabsList.value = [currentTab];
          }
          else if (currentTab) {
            tabsList.value = homeTab ? [homeTab, currentTab] : [currentTab];
          }
          else {
            tabsList.value = homeTab ? [homeTab] : [];
          }
        }
        tabsList.value = tabsList.value.filter(Boolean);
        // 確保首頁存在
        ensureHomeTabExists();
      }
    });

    return {
      tabsList,
      getTabsList,
      getCurrentTab,
      addTabs,
      closeLeftTabs,
      closeRightTabs,
      closeOtherTabs,
      closeCurrentTab,
      closeAllTabs,
      updateTabTitle,
      ensureHomeTabExists,
    };
  },
  {
    persist: {
      pick: ['tabsList'],
    },
  },
);

/**
 * 在组件setup函数外使用
 */
export function useTabsViewStoreWithOut() {
  return useTabsViewStore(store);
}
