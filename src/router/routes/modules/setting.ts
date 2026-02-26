import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/setting',
    name: 'Setting',
    redirect: '/setting/passwordSetting',
    meta: {
      title: t('routes.setting.setting'),
      icon: 'ant-design:setting-outlined',
      orderNo: 10,
    },
    children: [
      {
        path: 'passwordSetting',
        name: 'PasswordSetting',
        component: () => import('@/views/setting/index.vue'),
        meta: {
          title: t('routes.setting.passwordSetting'),
          icon: 'ant-design:lock-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'defaultAvatarSetting',
        name: 'DefaultAvatarSetting',
        component: () => import('@/views/setting/defaultAvatarSetting/index.vue'),
        meta: {
          title: t('routes.setting.defaultAvatarSetting'),
          icon: 'ant-design:user-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
    ],
  },
];

export default routes;
