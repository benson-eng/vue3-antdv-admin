import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/template',
    name: 'Template',
    redirect: '/template/OTPSmsTemplates',
    meta: {
      title: t('routes.template.template'),
      icon: 'ant-design:file-text-outlined',
      orderNo: 20,
    },
    children: [
      {
        path: 'OTPSmsTemplates',
        name: 'OTPSmsTemplates',
        component: () => import('@/views/template/OTPSmsTemplates/index.vue'),
        meta: {
          title: t('routes.template.OTPSmsTemplates'),
          icon: 'ant-design:message-outlined',
        },
      },
    ],
  },
];

export default routes;

