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
        {
          id: '1',
          name: 'dashboard',
          path: '/dashboard',
          component: 'dashboard/index',
          icon: 'carbon:dashboard',
          title: '儀表板',
          orderNo: 1,
          roles: ['admin'],
          children: [],
        },
        {
          id: '2',
          name: 'system',
          path: '/system',
          icon: 'carbon:settings',
          title: '系統管理',
          orderNo: 2,
          roles: ['admin'],
          children: [
            {
              id: '2-1',
              name: 'user',
              path: 'user',
              component: 'system/user/index',
              title: '用戶管理',
              orderNo: 1,
            },
            {
              id: '2-2',
              name: 'role',
              path: 'role',
              component: 'system/role/index',
              title: '角色管理',
              orderNo: 2,
            },
            {
              id: '2-3',
              name: 'menu',
              path: 'menu',
              component: 'system/menu/index',
              title: '菜單管理',
              orderNo: 3,
            },
          ],
        },
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
