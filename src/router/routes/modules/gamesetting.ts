import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/gamesetting',
    name: 'GameSetting',
    redirect: '/gamesetting/giveAway',
    meta: {
      title: t('routes.gamesetting.title'),
      icon: 'ant-design:setting-outlined',
      orderNo: 50,
    },
    children: [
      {
        path: 'giveAway',
        name: 'GiveAway',
        component: () => import('@/views/gamesetting/giveAway/index.vue'),
        meta: {
          title: t('routes.gamesetting.giveAway'),
          icon: 'ant-design:gift-outlined',
        },
      },
    ],
  },
];

export default routes;

