import type { RouteRecordRaw } from 'vue-router';
import basic from './basic';
import outsideLayout from './outsideLayout';

export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'Layout',
  redirect: '/home',
  component: () => import('@/layout/index.vue'),
  meta: {
    title: '根路由',
    showMasterAgent: true,
  },
  children: [],
};

export const basicRoutes: Array<RouteRecordRaw> = [
  rootRoute,
  // Layout之外的路由
  ...outsideLayout,
  // 基础路由
  ...basic,
];
