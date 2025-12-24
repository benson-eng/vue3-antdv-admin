import type { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/home',
    name: 'Home',
    meta: {
      title: '首頁',
      icon: 'ant-design:home-outlined',
      affix: true,
      orderNo: 0, // 確保首頁排在第一個
    },
    component: () => import('@/views/dashboard/mabu/index.vue'),
  },
];

export default routes;
