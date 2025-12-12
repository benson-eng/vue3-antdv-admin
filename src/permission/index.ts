/**
 * 權限驗證模組
 * 
 * 使用範例：
 * <a-button v-auth="'system:role:create'">新增角色</a-button>
 * <a-button v-if="$auth('system:role:update')">編輯角色</a-button>
 * 
 * 權限碼格式：類別:表單:存取
 * - 'system:role:create' - 系統類別:角色表單:新增存取
 * - '*:*:*' - 所有類別:所有表單:所有存取（超級管理員）
 */

import type { PermissionType } from './permCode';
import type { App, Directive, DirectiveBinding } from 'vue';
import { useUserStore } from '@/store/modules/user';

/**
 * 驗證權限
 * 
 * @param {PermissionType} permCode - 權限碼，格式：類別:表單:存取
 * @returns {boolean} true: 有權限 | false: 無權限
 * 
 * @example
 * hasPermission('system:role:create')  // 檢查是否有新增角色權限
 * hasPermission('member:data:update')  // 檢查是否有編輯會員權限
 */
export const hasPermission = (permCode: PermissionType) => {
  const permissionList = useUserStore().perms;

  // 檢查是否為超級管理員（擁有所有類別:所有表單:所有存取權限）
  if (permissionList.includes('*:*:*')) {
    return true;
  }

  // 精確匹配權限碼
  if (permissionList.some((n) => n === permCode)) {
    return true;
  }

  // 支持萬用字元匹配（如 system:*:*, system:role:* 等）
  const [reqCategory, reqTable, reqAccess] = permCode.split(':');
  
  return permissionList.some((perm) => {
    const [category, table, access] = perm.split(':');
    
    // 逐段比對，* 代表匹配任意值
    const categoryMatch = category === '*' || category === reqCategory;
    const tableMatch = table === '*' || table === reqTable;
    const accessMatch = access === '*' || access === reqAccess;
    
    return categoryMatch && tableMatch && accessMatch;
  });
};

const vAuth: Directive = {
  mounted(el: Element, binding: DirectiveBinding<any>) {
    const bindVal = binding.value;

    if (bindVal == undefined) return;

    if (!hasPermission(bindVal)) {
      el.remove();
    }
  },
};

export default {
  install(app: App) {
    app.config.globalProperties.$auth = hasPermission;
    app.directive('auth', vAuth);
  },
};
