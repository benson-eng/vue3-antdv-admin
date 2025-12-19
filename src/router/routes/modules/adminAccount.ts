import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/adminAccount',
    name: 'AdminAccount',
    redirect: '/adminAccount/currency',
    meta: {
      title: t('routes.adminAccount.index'),
      icon: 'ant-design:User-outlined',
      orderNo: 1,
    },
    children: [
      {
        path: 'currency',
        name: 'AdminAccountCurrency',
        component: () => import('@/views/adminAccount/currency/index.vue'),
        meta: {
          title: t('routes.adminAccount.currency'),
          icon: 'ant-design:PayCircle-outlined',
        },
      },
      {
        path: 'roles',
        name: 'AdminAccountRoles',
        component: () => import('@/views/adminAccount/roles/index.vue'),
        meta: {
          title: t('routes.adminAccount.roles'),
          icon: 'ant-design:SafetyCertificate-outlined',
        },
      },
      {
        path: 'shareholder',
        name: 'AdminAccountShareholder',
        component: () => import('@/views/adminAccount/shareholder/index.vue'),
        meta: {
          title: t('routes.adminAccount.shareholder'),
          icon: 'ant-design:Team-outlined',
        },
      },
    ],
  },
];

export default routes;

