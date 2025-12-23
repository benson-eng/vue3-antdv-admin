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
      {
        path: 'gameRestrictions',
        name: 'GameRestrictions',
        component: () => import('@/views/gamesetting/gameRestrictions/index.vue'),
        meta: {
          title: t('routes.gamesetting.gameRestrictions'),
          icon: 'ant-design:lock-outlined',
        },
      },
      {
        path: 'gameRestrictionsGlobalSetting',
        name: 'GameRestrictionsGlobalSetting',
        component: () => import('@/views/gamesetting/gameRestrictionsGlobalSetting/index.vue'),
        meta: {
          title: t('routes.gamesetting.gameRestrictionsGlobalSetting'),
          icon: 'ant-design:lock-outlined',
        },
      },
      {
        path: 'gameRestrictionsFullSetting',
        name: 'GameRestrictionsFullSetting',
        component: () => import('@/views/gamesetting/gameRestrictionsGlobalSetting/index.vue'),
        meta: {
          title: t('routes.gamesetting.gameRestrictionsFullSetting'),
          icon: 'ant-design:lock-outlined',
        },
      },
      {
        path: 'levelExtraSetting',
        name: 'LevelExtraSetting',
        component: () => import('@/views/gamesetting/levelExtraSetting/index.vue'),
        meta: {
          title: t('routes.gamesetting.levelExtraSetting'),
          icon: 'ant-design:appstore-outlined',
        },
      },
      {
        path: 'configSetting',
        name: 'ConfigSetting',
        component: () => import('@/views/gamesetting/configSetting/index.vue'),
        meta: {
          title: t('routes.gamesetting.configSetting'),
          icon: 'ant-design:setting-outlined',
        },
      },
    ],
  },
];

export default routes;
