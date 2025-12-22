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
      {
        path: 'memberPersonalInfo',
        name: 'MemberPersonalInfo',
        component: () => import('@/views/member/memberPersonalInfo/index.vue'),
        meta: {
          title: t('routes.member.memberPersonalInfo'),
          icon: 'ant-design:idcard-outlined',
        },
      },
      {
        path: 'vipSetting',
        name: 'MemberVipSetting',
        component: () => import('@/views/member/vipSetting2/index.vue'),
        meta: {
          title: t('routes.member.vipSetting'),
          icon: 'ant-design:star-outlined',
        },
      },
      {
        path: 'TransactionMemberSetting',
        name: 'TransactionMemberSetting',
        component: () => import('@/views/member/transactionMemberSetting/index.vue'),
        meta: {
          title: t('routes.member.transactionMemberSetting'),
          icon: 'ant-design:star-outlined',
        },
      },
      {
        path: 'FixedVipMemberSetting',
        name: 'FixedVipMemberSetting',
        component: () => import('@/views/member/fixedVipMemberSetting/index.vue'),
        meta: {
          title: t('routes.member.fixedVipMemberSetting'),
          icon: 'ant-design:star-outlined',
        },
      },
      {
        path: 'IdentityMemberSetting',
        name: 'IdentityMemberSetting',
        component: () => import('@/views/member/identityMemberSetting/index.vue'),
        meta: {
          title: t('routes.member.identityMemberSetting'),
          icon: 'ant-design:star-outlined',
        },
      },
      {
        path: 'ActivityMemberSetting',
        name: 'ActivityMemberSetting',
        component: () => import('@/views/member/activityMemberSetting/index.vue'),
        meta: {
          title: t('routes.member.activityMemberSetting'),
          icon: 'ant-design:star-outlined',
        },
      },
      {
        path: 'MemberLevel',
        name: 'MemberLevel',
        component: () => import('@/views/member/memberLevel/index.vue'),
        meta: {
          title: t('routes.member.memberLevel'),
          icon: 'ant-design:star-outlined',
        },
      },
    ],
  },
];

export default routes;
