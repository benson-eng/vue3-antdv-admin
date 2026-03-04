import type { RouteRecordRaw } from 'vue-router';
import { t } from '@/hooks/useI18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/chatroom',
    name: 'Chatroom',
    redirect: '/chatroom/rooms',
    meta: {
      title: t('routes.chatroom.title'),
      icon: 'ant-design:message-outlined',
      orderNo: 3,
    },
    children: [
      {
        path: 'rooms',
        name: 'ChatroomRooms',
        component: () => import('@/views/chatroom/rooms/index.vue'),
        meta: {
          title: t('routes.chatroom.rooms2'),
          icon: 'ant-design:message-outlined',
        },
      },
      {
        path: 'privateRooms',
        name: 'ChatroomPrivateRooms',
        component: () => import('@/views/chatroom/privateRooms/index.vue'),
        meta: {
          title: t('routes.chatroom.privateRooms2'),
          icon: 'ant-design:message-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'sticker',
        name: 'ChatroomSticker',
        component: () => import('@/views/chatroom/sticker/index.vue'),
        meta: {
          title: t('routes.chatroom.sticker'),
          icon: 'ant-design:message-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
      {
        path: 'IndecentWords',
        name: 'ChatroomIndecentWords',
        component: () => import('@/views/chatroom/IndecentWords/index.vue'),
        meta: {
          title: t('routes.chatroom.IndecentWords'),
          icon: 'ant-design:message-outlined',
          // 目標頁（memberList）：宣告為 Context Consumer UI，需顯示站長選單
          showMasterAgent: true,
        },
      },
    ],
  },
];

export default routes;
