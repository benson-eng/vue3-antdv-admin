import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const moduleName = 'dashboard';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/dashboard',
    name: moduleName,
    redirect: '/dashboard/mabu',
    meta: {
      title: t('routes.dashboard.dashboard'),
      icon: 'ant-design:dashboard-outlined',
    },
    children: [
      {
        path: 'mabu',
        name: `${moduleName}-mabu`,
        meta: {
          title: t('routes.dashboard.mabu'),
          icon: 'ant-design:dashboard-outlined',
          affix: true,
          noCache: true,
        },
        component: () => import('@/views/dashboard/mabu/index.vue'),
      },
      {
        path: 'welcome',
        name: `${moduleName}-welcome`,
        meta: {
          title: t('routes.dashboard.workbench'),
          icon: 'ant-design:home-filled',
        },
        component: () => import('@/views/dashboard/welcome/index.vue'),
      },
    ],
  },
];

export default routes;
