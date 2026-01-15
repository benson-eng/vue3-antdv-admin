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
        path: 'create-wizard',
        name: 'AdminAccountMasterAgentCreateWizard',
        component: () => import('@/views/adminAccount/masterAgent/createWizard/index.vue'),
        meta: {
          title: t('routes.adminAccount.createWizard'),
          hideInMenu: true,
          // 讓側邊欄高亮仍停留在「總代理管理」
          activeMenu: 'AdminAccountMasterAgent',
          keepAlive: false,
        },
      },
      {
        path: 'masterAgent',
        name: 'AdminAccountMasterAgent',
        component: () => import('@/views/adminAccount/masterAgent/index.vue'),
        meta: {
          title: t('routes.adminAccount.masterAgent'),
          icon: 'ant-design:UserSwitch-outlined',
          showMasterAgent: true,
        },
      },
      // {
      //   // Vue2 既有：總代理管理(遊戲) masterAgentX（同頁但隱藏部分設定）
      //   // 這個頁面路徑先留著，但暫時不使用(2026-01-01 備註人:shang)
      //   path: 'masterAgentX',
      //   name: 'AdminAccountMasterAgentX',
      //   component: () => import('@/views/adminAccount/masterAgent/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.masterAgentX'),
      //     icon: 'ant-design:UserSwitch-outlined',
      //   },
      // },

      // {
      //   path: 'shareholder',
      //   name: 'AdminAccountShareholder',
      //   component: () => import('@/views/adminAccount/shareholder/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.shareholder'),
      //     icon: 'ant-design:Team-outlined',
      //   },
      // },
      // {
      //   path: 'machineSettingPublic',
      //   name: 'AdminAccountMachineSettingPublic',
      //   component: () => import('@/views/adminAccount/machineSettingPublic/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.machineSettingPublic'),
      //     icon: 'ant-design:Setting-outlined',
      //   },
      // },
      // 2026-01-12 備註人:shang 移除顯示但為對照頁面，目前用戶不會使用到
      // {
      //   path: 'agent',
      //   name: 'AdminAccountAgent',
      //   component: () => import('@/views/adminAccount/agent/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.agent'),
      //     icon: 'ant-design:UserSwitch-outlined',
      //     showMasterAgent: true,
      //   },
      // },
      // {
      //   path: 'agentSettings',
      //   name: 'AdminAccountAgentSettings',
      //   component: () => import('@/views/adminAccount/agentSettings/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.agentSettings'),
      //     icon: 'ant-design:Setting-outlined',
      //   },
      // },
      {
        path: 'subaccountChildren',
        name: 'AdminAccountSubaccountChildren',
        component: () => import('@/views/adminAccount/subaccountChildren/index.vue'),
        meta: {
          title: t('routes.adminAccount.subaccountChildren'),
          icon: 'ant-design:User-outlined',
          showMasterAgent: true,
        },
      },
      {
        path: 'subaccount',
        name: 'AdminAccountSubaccount',
        component: () => import('@/views/adminAccount/subaccount/index.vue'),
        meta: {
          title: t('routes.adminAccount.subaccount'),
          icon: 'ant-design:User-outlined',
          showMasterAgent: true,
        },
      },
      // 2026-01-15 備註人:shang 移除貨幣管理，目前用戶不會使用到
      // {
      //   path: 'currency',
      //   name: 'AdminAccountCurrency',
      //   component: () => import('@/views/adminAccount/currency/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.currency'),
      //     icon: 'ant-design:PayCircle-outlined',
      //   },
      // },
      // 2026-01-15 備註人:shang 移除代幣管理頁面，目前用戶不會使用到
      // {
      //   path: 'token',
      //   name: 'AdminAccountToken',
      //   component: () => import('@/views/adminAccount/token/index.vue'),
      //   meta: {
      //     title: t('routes.adminAccount.token'),
      //     icon: 'ant-design:PayCircle-outlined',
      //   },
      // },
      {
        path: 'roles',
        name: 'AdminAccountRoles',
        component: () => import('@/views/adminAccount/roles/index.vue'),
        meta: {
          title: t('routes.adminAccount.roles'),
          icon: 'ant-design:SafetyCertificate-outlined',
          showMasterAgent: true,
        },
      },
      {
        path: 'authenticator',
        name: 'AdminAccountAuthenticator',
        component: () => import('@/views/adminAccount/authenticator/index.vue'),
        meta: {
          title: t('routes.adminAccount.authenticator'),
          icon: 'ant-design:SafetyCertificate-outlined',
          showMasterAgent: true,
        },
      },
    ],
  },
];

export default routes;
