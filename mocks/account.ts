import { delay, http, HttpResponse } from 'msw'
import { serverApi } from './_util'

export default [
  // 獲取用戶資料
  http.get(serverApi('/account/profile'), async () => {
    await delay(500)
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        realName: '管理員',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WhxWfqPqFOtEFYAKBlFJ.jpg',
        phone: '13800000000',
        status: 1,
        createdAt: '2023-01-01T00:00:00Z',
      },
    })
  }),

  // 獲取菜單列表
  http.get(serverApi('/account/menus'), async () => {
    await delay(500)
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: [
        // 先不要給額外的菜單，避免干擾目前開發中的功能
        // {
        //   id: '1',
        //   name: 'dashboard',
        //   path: '/dashboard',
        //   icon: 'ant-design:dashboard-outlined',
        //   title: '儀表板',
        //   orderNo: 0,
        //   roles: ['admin'],
        //   meta: {
        //     type: 0,
        //     show: 1,
        //   },
        //   children: [
        //     {
        //       id: '1-1',
        //       name: 'dashboard-welcome',
        //       path: 'welcome',
        //       component: 'dashboard/welcome/index',
        //       title: '工作台',
        //       orderNo: 1,
        //       meta: {
        //         type: 1,
        //         show: 1,
        //       },
        //     },
        //   ],
        // },
        // {
        //   id: '2',
        //   name: 'member',
        //   path: '/member',
        //   icon: 'ant-design:user-outlined',
        //   title: '會員管理',
        //   orderNo: 1,
        //   roles: ['admin'],
        //   meta: {
        //     type: 0,
        //     show: 1,
        //   },
        //   children: [
        //     {
        //       id: '2-1',
        //       name: 'member-data',
        //       path: 'data',
        //       component: 'member/data/index',
        //       title: '會員資料',
        //       orderNo: 1,
        //       meta: {
        //         type: 1,
        //         show: 1,
        //       },
        //     },
        //   ],
        // },
        // {
        //   id: '3',
        //   name: 'demos',
        //   path: '/demos',
        //   icon: 'ant-design:desktop-outlined',
        //   title: '示範功能',
        //   orderNo: 10,
        //   roles: ['admin'],
        //   meta: {
        //     type: 0,
        //     show: 1,
        //   },
        //   children: [
        //     {
        //       id: '3-1',
        //       name: 'demos-custom-modal',
        //       path: 'custom-modal',
        //       component: 'demos/custom-modal',
        //       title: '自訂 Modal',
        //       orderNo: 1,
        //       meta: {
        //         type: 1,
        //         show: 1,
        //       },
        //     },
        //     {
        //       id: '3-2',
        //       name: 'demos-button',
        //       path: 'button',
        //       component: 'demos/button',
        //       title: '按鈕',
        //       orderNo: 2,
        //       meta: {
        //         type: 1,
        //         show: 1,
        //       },
        //     },
        //   ],
        // },
      ],
    })
  }),

  // 獲取權限列表
  http.get(serverApi('/account/permissions'), async () => {
    await delay(500)
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: ['*:*:*'],
    })
  }),

  // 登出
  http.get(serverApi('/account/logout'), async () => {
    await delay(500)
    return HttpResponse.json({
      code: 200,
      message: '登出成功',
      data: null,
    })
  }),
]
