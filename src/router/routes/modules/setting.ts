import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/setting',
    name: 'Setting',
    redirect: '/setting/defaultAvatarSetting',
    meta: {
      title: t('routes.setting.setting'),
      icon: 'ant-design:setting-outlined',
      orderNo: 10,
    },
    children: [
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

