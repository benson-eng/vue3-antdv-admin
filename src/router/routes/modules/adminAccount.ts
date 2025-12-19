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
        path: 'masterAgent',
        name: 'AdminAccountMasterAgent',
        component: () => import('@/views/adminAccount/masterAgent/index.vue'),
        meta: {
          title: t('routes.adminAccount.masterAgent'),
          icon: 'ant-design:UserSwitch-outlined',
        },
      },
      {
        // Vue2 既有：總代理管理(遊戲) masterAgentX（同頁但隱藏部分設定）
        path: 'masterAgentX',
        name: 'AdminAccountMasterAgentX',
        component: () => import('@/views/adminAccount/masterAgent/index.vue'),
        meta: {
          title: t('routes.adminAccount.masterAgentX'),
          icon: 'ant-design:UserSwitch-outlined',
        },
      },
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
      {
        path: 'machineSettingPublic',
        name: 'AdminAccountMachineSettingPublic',
        component: () => import('@/views/adminAccount/machineSettingPublic/index.vue'),
        meta: {
          title: t('routes.adminAccount.machineSettingPublic'),
          icon: 'ant-design:Setting-outlined',
        },
      },
      {
        path: 'agent',
        name: 'AdminAccountAgent',
        component: () => import('@/views/adminAccount/agent/index.vue'),
        meta: {
          title: t('routes.adminAccount.agent'),
          icon: 'ant-design:UserSwitch-outlined',
        },
      },
    ],
  },
];

export default routes;
