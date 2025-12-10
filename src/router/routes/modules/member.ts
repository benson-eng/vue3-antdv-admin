import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/member',
    name: 'Member',
    redirect: '/member/data',
    meta: {
      title: t('routes.member.member'),
      icon: 'ant-design:user-outlined',
      orderNo: 1,
    },
    children: [
      {
        path: 'data',
        name: 'MemberData',
        component: () => import('@/views/member/data/index.vue'),
        meta: {
          title: t('routes.member.data'),
          icon: 'ant-design:team-outlined',
        },
      },
    ],
  },
];

export default routes;
