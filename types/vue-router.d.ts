import type { RouteMeta as VRouteMeta } from 'vue-router';
import type { LocaleType } from '@/locales/config';
import type { PermissionType } from '@/permission/permCode/';

declare global {
  type Title18n = {
    [p in LocaleType]: string;
  };
}

declare module 'vue-router' {
  interface RouteMeta extends VRouteMeta {
    /** 標題 */
    title: string | Title18n;
    /** 當前菜單類型 0: 目錄 | 1: 菜單 | 2: 權限 */
    type?: 0 | 1 | 2;
    /** 當前路由權限 */
    perms?: PermissionType[];
    /** 是否需要緩存 */
    keepAlive?: boolean;
    /** 當前路由namePath 祖先name集合 */
    namePath?: string[];
    /** 當前路由所在的完整路徑 */
    fullPath?: string;
    /** 是否固定在標籤欄 */
    affix?: boolean;
    /** 菜單圖標 */
    icon?: string;
    /** 當前頁面切換動畫 */
    transitionName?: string | false;
    /** @name 在菜單中隱藏子節點 */
    hideChildrenInMenu?: boolean;
    /** 不在菜單中顯示 */
    hideInMenu?: boolean;
    /** 不在麵包屑導航中顯示 */
    hideInBreadcrumb?: boolean;
    /** 不在tab標籤頁中顯示 */
    hideInTabs?: boolean;
    /** 設置當前路由高亮的菜單項，值為route fullPath或route name,一般用於詳情頁 */
    activeMenu?: string;
    /** 菜單排序號 */
    orderNo?: number;
    /** 是否外鏈 */
    isExt?: boolean;
    /**
     * 外鏈打開方式
     * 1: 新窗口打開
     * 2: 內嵌 iframe
     */
    extOpenMode?: 1 | 2;
    /** 是否隱藏頁面加載進度條 */
    hideProgressBar?: boolean;
  }
}
