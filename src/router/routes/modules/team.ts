import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/team',
    name: 'Team',
    redirect: '/team/teamItemTags',
    meta: {
      title: t('routes.team.title'),
      icon: 'ant-design:team-outlined',
      orderNo: 10,
    },
    children: [
      {
        path: 'teamItemTags',
        name: 'TeamItemTags',
        component: () => import('@/views/treasureChest/teamItemTags/index.vue'),
        meta: {
          title: t('routes.team.teamItemTags'),
          icon: 'ant-design:tags-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'teamSetting',
        name: 'TeamSetting',
        component: () => import('@/views/treasureChest/teamSetting/index.vue'),
        meta: {
          title: t('routes.team.teamSetting'),
          icon: 'ant-design:setting-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
    ],
  },
];

export default routes;
