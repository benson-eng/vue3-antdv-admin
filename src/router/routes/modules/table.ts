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
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'singleMailRecord-table',
        name: 'SingleMailRecordTable',
        component: () => import('@/views/table/singleMailRecord-table/index.vue'),
        meta: {
          title: t('routes.table.singleMailRecordTable'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'redemptionCodeRecord-table',
        name: 'RedemptionCodeRecordTable',
        component: () => import('@/views/table/redemptionCodeRecord-table/index.vue'),
        meta: {
          title: t('routes.table.redemptionCodeRecord'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'transactionRecord-table',
        name: 'TransactionRecordTable',
        component: () => import('@/views/table/transactionRecord-table/index.vue'),
        meta: {
          title: t('routes.table.transactionRecordTable'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'tokenRecordTable-table',
        name: 'TokenRecordTable',
        component: () => import('@/views/table/tokenRecordTable-table/index.vue'),
        meta: {
          title: t('routes.table.tokenRecordTable'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'validFrozenStatementsRecord-table',
        name: 'ValidFrozenStatementsRecordTable',
        component: () => import('@/views/table/validFrozenStatementsRecord-table/index.vue'),
        meta: {
          title: t('routes.table.validFrozenStatementsRecord'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'externalGameRecords-table',
        name: 'ExternalGameRecordsTable',
        component: () => import('@/views/table/externalGameRecords-table/index.vue'),
        meta: {
          title: t('routes.table.externalGameRecords'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'smsRecord-table',
        name: 'SmsRecordTable',
        component: () => import('@/views/table/smsRecord-table/index.vue'),
        meta: {
          title: t('routes.table.smsRecordTable'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'safetyBoxRecord-table',
        name: 'SafetyBoxRecordTable',
        component: () => import('@/views/table/safetyBoxRecord-table/index.vue'),
        meta: {
          title: t('routes.table.safetyBoxRecordTable'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'dailyLoginRewardRecord-table',
        name: 'DailyLoginRewardRecordTable',
        component: () => import('@/views/table/dailyLoginRewardRecord-table/index.vue'),
        meta: {
          title: t('routes.table.dailyLoginRewardRecord'),
          icon: 'ant-design:table-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'distAcctStationRecord-table',
        name: 'DistAcctStationRecordTable',
        component: () => import('@/views/table/distAcctStationRecord-table/index.vue'),
        meta: {
          title: t('routes.table.distAcctStationRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'distAcctFamilyRecord-table',
        name: 'DistAcctFamilyRecordTable',
        component: () => import('@/views/table/distAcctFamilyRecord-table/index.vue'),
        meta: {
          title: t('routes.table.distAcctFamilyRecord'),
          icon: 'ant-design:table-outlined',
        },
      },
      {
        path: 'distAcctOperatingRecord',
        name: 'DistAcctOperatingRecord',
        component: () => import('@/views/distAcct/familySetting/index.vue'),
        meta: {
          title: '站台營運報表',
          icon: 'ant-design:table-outlined',
        },
      },
      // 已移除：grandPrizeRecord-table, gameRecord-table, gameJpRecord-table（多轉/轉錯頁面，後續會重新轉換）
    ],
  },
];

export default routes;
