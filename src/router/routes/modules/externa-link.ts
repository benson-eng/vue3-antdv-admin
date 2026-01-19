import type { RouteRecordRaw } from 'vue-router';
import { RouterView } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: 'https://github.com/buqiyuan/nest-admin',
    name: 'https://github.com/buqiyuan/nest-admin',
    component: RouterView,
    meta: {
      title: '后台代码仓库',
      icon: 'ant-design:link-outlined',
      isExt: true,
      extOpenMode: 1,
      hideInMenu: true,
    },
  },
];

export default routes;
