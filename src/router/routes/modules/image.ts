import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/image',
    name: 'Image',
    redirect: '/image/imageSetting',
    meta: {
      title: t('routes.image.image'),
      icon: 'ant-design:picture-outlined',
      orderNo: 10,
    },
    children: [
      {
        path: 'imageSetting',
        name: 'ImageSetting',
        component: () => import('@/views/image/imageSetting/index.vue'),
        meta: {
          title: t('routes.image.imageSetting'),
          icon: 'ant-design:setting-outlined',
        },
      },
    ],
  },
];

export default routes;

