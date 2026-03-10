import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/distAcct',
    name: 'DistAcct',
    redirect: '/distAcct/familySetting',
    meta: {
      title: '分銷管理',
      icon: 'ant-design:setting-outlined',
      orderNo: 3,
    },
    children: [
      {
        path: 'familySetting',
        name: 'DistAcctFamilySetting',
        component: () => import('@/views/distAcct/familySetting/index.vue'),
        meta: {
          title: '家族分成設定',
          icon: 'ant-design:setting-outlined',
        },
      },
      {
        path: 'familyList',
        name: 'DistAcctFamilyList',
        component: () => import('@/views/distAcct/familyList/index.vue'),
        meta: {
          title: '家族列表',
          icon: 'ant-design:setting-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
    ],
  },
];

export default routes;
