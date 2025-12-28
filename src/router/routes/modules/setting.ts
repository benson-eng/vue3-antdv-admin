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
        },
      },
      {
        path: 'defaultAvatarSetting',
        name: 'DefaultAvatarSetting',
        component: () => import('@/views/setting/defaultAvatarSetting/index.vue'),
        meta: {
          title: t('routes.setting.defaultAvatarSetting'),
          icon: 'ant-design:user-outlined',
        },
      },
    ],
  },
];

export default routes;
