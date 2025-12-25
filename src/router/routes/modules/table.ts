import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/table',
    name: 'Table',
    redirect: '/table/cashRecord-table',
    meta: {
      title: t('routes.table.title'),
      icon: 'ant-design:table-outlined',
      orderNo: 2,
    },
    children: [
      {
        path: 'grandPrizeRecord-table',
        name: 'GrandPrizeRecordTable',
        component: () => import('@/views/table/grandPrizeRecord-table/index.vue'),
        meta: {
          title: t('routes.table.grandPrizeRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'cashRecord-table',
        name: 'CashRecordTable',
        component: () => import('@/views/table/cashRecord-table/index.vue'),
        meta: {
          title: t('routes.table.cashRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'gameRecord-table',
        name: 'GameRecordTable',
        component: () => import('@/views/table/gameRecord-table/index.vue'),
        meta: {
          title: t('routes.table.gameRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
    ],
  },
];

export default routes;
