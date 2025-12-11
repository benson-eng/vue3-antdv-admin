// 路由權限守衛
// 來源：src/permission.ts
// 注意：需要轉換為 Vue Router 4 的 API
// Vue Router 3: router.beforeEach(async(to, _, next) => { ... })
// Vue Router 4: router.beforeEach(async(to, from) => { ... return ... })

import router from "./index";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { Route } from "vue-router";
// 注意：以下導入需要根據目標專案調整
// import { useUserStore } from "@/stores/user";
// import { usePermissionStore } from "@/stores/permission";
// import { message } from "ant-design-vue";
// import i18n from "@/lang";
// import settings from "@/settings";

NProgress.configure({ showSpinner: false });

const whiteList = ["/login", "/auth-redirect"];

// 取得頁面標題（需要根據目標專案的 i18n 方案調整）
const getPageTitle = (key: string) => {
  // 範例：使用 i18n
  // const hasKey = i18n.te(`route.${key}`);
  // if (hasKey) {
  //   const pageName = i18n.t(`route.${key}`);
  //   return `${pageName} - ${settings.title}`;
  // }
  // return `${settings.title}`;
  return key || "Admin";
};

// Vue Router 3 版本（原始）
// router.beforeEach(async(to: Route, _: Route, next: any) => {
//   NProgress.start();
// 
//   if (UserModule.token) {
//     if (to.path === "/login") {
//       next({ path: "/" });
//       NProgress.done();
//     } else {
//       if (UserModule.roles.length === 0) {
//         try {
//           await UserModule.GetUserInfo();
//           const roles = UserModule.roles;
//           await PermissionModule.GenerateRoutes(roles);
//           router.addRoutes(PermissionModule.routes);
//           next({ ...to, replace: true });
//         } catch (err: any) {
//           UserModule.ResetToken();
//           Message.error(err || "Has Error");
//           next(`/login?redirect=${to.path}`);
//           NProgress.done();
//         }
//       } else {
//         next();
//       }
//     }
//   } else {
//     if (whiteList.indexOf(to.path) !== -1) {
//       next();
//     } else {
//       next(`/login?redirect=${to.path}`);
//       NProgress.done();
//     }
//   }
// });

// Vue Router 4 版本（需要轉換為此格式）
// router.beforeEach(async(to, from) => {
//   NProgress.start();
// 
//   const userStore = useUserStore();
//   const permissionStore = usePermissionStore();
// 
//   if (userStore.token) {
//     if (to.path === "/login") {
//       NProgress.done();
//       return "/";
//     } else {
//       if (userStore.roles.length === 0) {
//         try {
//           await userStore.GetUserInfo();
//           const roles = userStore.roles;
//           await permissionStore.GenerateRoutes(roles);
//           // Vue Router 4 使用 addRoute 而非 addRoutes
//           permissionStore.routes.forEach(route => {
//             router.addRoute(route);
//           });
//           NProgress.done();
//           return { ...to, replace: true };
//         } catch (err: any) {
//           userStore.resetToken();
//           message.error(err || "Has Error");
//           NProgress.done();
//           return `/login?redirect=${to.path}`;
//         }
//       } else {
//         NProgress.done();
//         return true;
//       }
//     }
//   } else {
//     if (whiteList.includes(to.path)) {
//       NProgress.done();
//       return true;
//     } else {
//       NProgress.done();
//       return `/login?redirect=${to.path}`;
//     }
//   }
// });

// router.afterEach((to: Route) => {
//   NProgress.done();
//   document.title = getPageTitle(to.meta.title);
// });

