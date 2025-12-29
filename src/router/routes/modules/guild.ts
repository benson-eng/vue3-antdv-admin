import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/guild',
    name: 'Guild',
    redirect: '/guild/guildSetting',
    meta: {
      title: t('routes.guild.title'),
      icon: 'ant-design:team-outlined',
      orderNo: 11,
    },
    children: [
      {
        path: 'guildSetting',
        name: 'GuildSetting',
        component: () => import('@/views/guild/guildSetting/index.vue'),
        meta: {
          title: t('routes.guild.guildSetting'),
          icon: 'ant-design:setting-outlined',
        },
      },
    ],
  },
];

export default routes;

