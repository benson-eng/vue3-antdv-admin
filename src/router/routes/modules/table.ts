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
        path: 'cashRecord-table',
        name: 'CashRecordTable',
        component: () => import('@/views/table/cashRecord-table/index.vue'),
        meta: {
          title: t('routes.table.cashRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'gachaponGameRecordTable',
        name: 'GachaponGameRecordTable',
        component: () => import('@/views/table/gachaponGameRecord-table/index.vue'),
        meta: {
          title: t('routes.table.gachaponGameRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'missionRecord-table',
        name: 'MissionRecordTable',
        component: () => import('@/views/table/missionRecord-table/index.vue'),
        meta: {
          title: t('routes.table.missionRecordTable'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'singleMailRecord-table',
        name: 'SingleMailRecordTable',
        component: () => import('@/views/table/singleMailRecord-table/index.vue'),
        meta: {
          title: t('routes.table.singleMailRecordTable'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'redemptionCodeRecord-table',
        name: 'RedemptionCodeRecordTable',
        component: () => import('@/views/table/redemptionCodeRecord-table/index.vue'),
        meta: {
          title: t('routes.table.redemptionCodeRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      // 已移除：grandPrizeRecord-table, gameRecord-table, gameJpRecord-table（多轉/轉錯頁面，後續會重新轉換）
    ],
  },
];

export default routes;
