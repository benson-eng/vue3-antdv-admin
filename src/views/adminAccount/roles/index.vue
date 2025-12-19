<template>
  <div class="app-container">
    <a-button type="primary" :disabled="!canCreateRole" @click="handleCreateRole">
      新增角色
    </a-button>

    <a-table
      class="roles-table"
      :data-source="rolesList"
      :columns="columns"
      :loading="loading"
      :row-key="(record) => record.key || record.id"
      bordered
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'operations'">
          <a-space>
            <a-button
              type="primary"
              size="small"
              :disabled="userAccount !== record.creatorAccount"
              @click="onEditClick(record)"
            >
              編輯
            </a-button>
            <a-button
              danger
              size="small"
              :disabled="record.id <= 2 || userAccount !== record.creatorAccount"
              @click="onDeleteClick(record)"
            >
              刪除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="dialogVisible"
      :title="dialogType === 'edit' ? '編輯角色' : '新增角色'"
      :mask-closable="false"
      :destroy-on-close="true"
      width="860px"
      @ok="confirmRole"
    >
    <a-form
      ref="formRef"
      :model="tempRoleData"
      :rules="rules"
      :initial-values="{ serviceRoutes: [] }"
      layout="vertical"
    >
        <a-form-item label="角色名稱" name="name">
          <a-input v-model:value="tempRoleData.name" />
        </a-form-item>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="tempRoleData.description" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>

        <a-form-item label="選單/頁面權限" name="serviceRoutes">
          <!--
            ✅ 關鍵：讓 antd Form 有「受控的欄位元件」承接 v-model
            否則 a-tree 不屬於表單元件，Form 內部的 value 可能維持舊值（例如 [""]）
            使用 tags 模式可接受任何字串值（不需 options）
          -->
          <a-select v-model:value="tempRoleData.serviceRoutes" mode="tags" :open="false" style="display: none" />
          <a-tree
            class="permission-tree"
            checkable
            block-node
            :check-strictly="checkStrictly"
            :tree-data="routesTreeData"
            :checked-keys="antdCheckedKeys"
            @check="handleTreeCheck"
          />
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button danger @click="dialogVisible = false">取消</a-button>
          <a-button type="primary" @click="confirmRole">確認</a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { Modal, message, notification } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import type { AlignType } from 'ant-design-vue/es/vc-table/interface';
import { cloneDeep } from 'lodash-es';
import routeModules from '@/router/routes/modules';
import { uniqueSlash } from '@/utils/urlUtils';
import { transformI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import RolesApi from '@/api/backend/adminAccount/roles';

defineOptions({ name: 'AdminAccountRoles' });

/**
 * =========================================
 * Types（貼近 admin-web/src/views/adminAccount/roles.vue）
 * =========================================
 */
type AppRoute = {
  path: string;
  meta?: Record<string, any> & { roles?: string[] };
  children?: AppRoute[];
};

type RoleItem = {
  id: number;
  key: string;
  name: string;
  description: string;
  creatorAccount?: string;
  routes?: AppRoute[];
};

type RoleForm = RoleItem & {
  // 僅供 a-form 驗證欄位占位（真實選擇以 checkedKeys 為準）
  serviceRoutes?: string[];
};

type TreeNode = {
  title: string;
  key: string;
  children?: TreeNode[];
};

const SUPER_ROLE_KEY = '5478c9d5-1078-4607-9624-4a6dbcae92e7';

const userStore = useUserStore();

const loading = ref(false);
const rolesList = ref<RoleItem[]>([]);

const dialogVisible = ref(false);
const dialogType = ref<'new' | 'edit'>('new');
const checkStrictly = ref(false);

type AFormInstance = FormInstance & {
  setFieldsValue?: (values: Record<string, any>) => void;
  getFieldsValue?: (...args: any[]) => any;
  getFieldValue?: (name: string) => any;
  validateFields?: (nameList?: any) => Promise<any>;
  getFieldsError?: (...args: any[]) => any;
};
const formRef = ref<AFormInstance>();

const defaultRole: RoleForm = {
  id: 0,
  key: '',
  name: '',
  description: '',
  routes: [],
  serviceRoutes: [],
};

const tempRoleData = ref<RoleForm>({ ...defaultRole });

// 權限樹相關（對齊 Vue2 的 serviceRoutes / reshapedRoutes）
const allRoutes = ref<AppRoute[]>([]);
const serviceRoutes = ref<AppRoute[]>([]);
const reshapedRoutes = ref<AppRoute[]>([]);

// Tree checked keys（永遠用 string[] 存）
const checkedKeys = ref<string[]>([]);
const oriRulesPage = ref<string[]>([]);
const delRulesPage = ref<string[]>([]);

const canCreateRole = computed(() => userStore.level > 1 && userStore.level < 4);
const userAccount = computed(() => userStore.account);
const authLevel = computed(() => userStore.level);

/**
 * =========================================
 * 表格欄位（保留 Vue2 行為：欄位/操作/禁用條件）
 * =========================================
 */
const columns = computed(() => [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 220,
    align: 'center' as AlignType,
  },
  {
    title: '角色名稱',
    dataIndex: 'name',
    width: 220,
    align: 'center' as AlignType,
  },
  // Vue2 原檔案有重複的 ID 欄位（156–171 對應頁面保留行為）
  {
    title: 'ID',
    dataIndex: 'id',
    width: 150,
    align: 'center' as AlignType,
  },
  {
    title: '描述',
    dataIndex: 'description',
    align: 'left' as AlignType,
  },
  {
    title: '操作',
    key: 'operations',
    align: 'center' as AlignType,
  },
]);

/**
 * =========================================
 * 表單 rules（保留：name/description 必填 + menus 必選）
 * =========================================
 */
const rules: Record<string, Rule[]> = {
  name: [{ required: true, message: '請輸入角色名稱', trigger: 'blur' }],
  description: [{ required: true, message: '請輸入描述', trigger: 'blur' }],
  // 這裡的 name 是給 a-form-item 用（對齊 Vue2 的 prop="serviceRoutes"）
  serviceRoutes: [
    {
      // ✅ 只能依賴 value（禁止再讀 checkedKeys）
      validator: async (_rule, value: string[] | undefined) => {
        console.log('[Roles][validator] serviceRoutes raw value =', value);
        console.log('[Roles][validator] tempRoleData.serviceRoutes =', tempRoleData.value.serviceRoutes);
        console.log('[Roles][validator] checkedKeys(UI) =', checkedKeys.value);

        const keys = Array.isArray(value)
          ? value
              .filter((v) => typeof v === 'string')
              .map((v) => v.trim())
              .filter(Boolean)
          : [];

        console.log('[Roles][validator] serviceRoutes keys(after trim/filter) =', keys);

        const routes = generateTree(cloneDeep(serviceRoutes.value), '/', keys);
        tempRoleData.value.routes = routes;

        console.log('[Roles][validator] generateTree(routes).length =', routes?.length, routes);

        if (keys.length === 0 || routes.length === 0) {
          return Promise.reject(new Error('請至少選擇一個頁面'));
        }
        return Promise.resolve();
      },
      trigger: 'change',
    },
  ],
};

/**
 * =========================================
 * Tree：對齊 element-ui 的 checkStrictly 行為
 * - antdv checkStrictly=true 時 checkedKeys 需要 object
 * =========================================
 */
const antdCheckedKeys = computed(() => {
  if (checkStrictly.value) {
    return { checked: checkedKeys.value, halfChecked: [] as string[] };
  }
  return checkedKeys.value;
});

const routesTreeData = computed<TreeNode[]>(() => {
  return generateTreeData(reshapedRoutes.value);
});

const handleTreeCheck = (keys: any) => {
  console.log('[Roles][tree] onCheck payload =', keys);

  // antd Tree：checkStrictly=true 時 keys = { checked, halfChecked }
  const rawKeys = Array.isArray(keys) ? keys : (keys?.checked ?? []);
  console.log('[Roles][tree] rawKeys =', rawKeys);

  /**
   * ✅ Tree UI 狀態：不要過濾（包含 ''），否則使用者點勾選會被你立刻「受控回寫」成未勾選，造成「無法勾選」
   * 只做字串化，確保 :checked-keys 的型別一致
   */
  const uiKeys = (rawKeys as any[]).map((k) => (k == null ? '' : String(k)));
  checkedKeys.value = uiKeys;
  console.log('[Roles][tree] uiKeys(checkedKeys) =', uiKeys);

  /**
   * ✅ Form 值：必須是有效 route path string[]（去掉空字串/空白）
   * validator 會只依賴 value，所以這裡要保證寫進去的是乾淨的值
   */
  const formKeys = uiKeys.map((v) => v.trim()).filter(Boolean);
  tempRoleData.value.serviceRoutes = formKeys;
  console.log('[Roles][tree] formKeys(tempRoleData.serviceRoutes) =', formKeys);

  // Vue2：delRulesPage = oriRulesPage 中被移除的 keys（用「有效 formKeys」來算）
  delRulesPage.value = oriRulesPage.value.filter((k) => !formKeys.includes(k));
  console.log('[Roles][tree] delRulesPage =', delRulesPage.value);
};


/**
 * =========================================
 * Routes permission（從 Vue2 permission module 抽出最小必要邏輯）
 * =========================================
 */
const hasPermission = (roles: string[], route: AppRoute) => {
  const metaRoles: string[] | undefined = route.meta?.roles;
  if (metaRoles) {
    if (route.path === '*') return true;
    return roles.some((role) => metaRoles.includes(role));
  }
  return true;
};

const filterAsyncRoutes = (routes: AppRoute[], roles: string[]) => {
  const res: AppRoute[] = [];
  routes.forEach((route) => {
    const r = cloneDeep(route);
    if (hasPermission(roles, r)) {
      if (r.children?.length) {
        r.children = filterAsyncRoutes(r.children, roles);
      }
      res.push(r);
    }
  });
  return res;
};

const setRole = (routes: AppRoute[], roleMap: Record<string, string[]>) => {
  return routes.map((route) => {
    const r = cloneDeep(route);
    r.meta ||= {};
    r.meta.roles = roleMap?.[r.path] ? [...roleMap[r.path]] : [];
    if (r.children?.length) {
      r.children = setRole(r.children, roleMap);
    }
    return r;
  });
};

const generateRoutesForUser = (userRoles: string[], routesWithRoles: AppRoute[]) => {
  if (userRoles.includes(SUPER_ROLE_KEY)) {
    return routesWithRoles;
  }
  return filterAsyncRoutes(routesWithRoles, userRoles);
};
void generateRoutesForUser;

/**
 * =========================================
 * Route utils（對齊 roles.vue 的 reshape/flatten/generateTree）
 * =========================================
 */
const normalizeRoutes = (routes: any[], parentPath = ''): AppRoute[] => {
  return routes.map((route) => {
    const rawPath = String(route.path ?? '');
    const fullPath = rawPath.startsWith('/')
      ? rawPath
      : uniqueSlash(`${parentPath || ''}/${rawPath}`).startsWith('/')
        ? uniqueSlash(`${parentPath || ''}/${rawPath}`)
        : `/${uniqueSlash(`${parentPath || ''}/${rawPath}`)}`;

    const r: AppRoute = {
      path: fullPath,
      meta: { ...(route.meta || {}) },
    };
    if (route.children?.length) {
      r.children = normalizeRoutes(route.children, fullPath);
    }
    return r;
  });
};

const isHidden = (route: AppRoute) => {
  return Boolean(route.meta?.hidden || route.meta?.hideInMenu || route.meta?.show === 0);
};

// NOTE: Roles 權限樹不使用 sidebar 的折疊策略，保留但避免 lint 告警
const onlyOneShowingChild = (children: AppRoute[] = [], parent: AppRoute) => {
  const showingChildren = children.filter((item) => !isHidden(item));
  if (showingChildren.length === 1) {
    return showingChildren[0];
  }
  if (showingChildren.length === 0) {
    /**
     * ✅ 修正：不要產生 path = ''（會變成 a-tree 的 key = ''，導致 onCheck 只回 ['']，Form 驗證永遠不過）
     * 直接保留父節點原本的 path 作為 key（不改資料結構，只避免空 key）
     */
    return { ...parent, path: parent.path } as AppRoute;
  }
  return false as const;
};
void onlyOneShowingChild;

const reshapeRoutes = (routes: AppRoute[], basePath = '/', insert?: boolean) => {
  const rtReshapedRoutes: AppRoute[] = [];
  for (let route of routes) {
    if (isHidden(route)) continue;

    if (insert) {
      rtReshapedRoutes.push({ path: route.path, meta: route.meta });
    }
    /**
     * ✅ 修正：Roles 的權限樹需要保留階層，不做「只有一個子節點就折疊」的 sidebar 策略
     * 否則像「後台帳戶」會被折疊成 leaf，children 直接消失
     */

    const data: AppRoute = {
      path: route.path,
      meta: {
        title: route.meta?.title,
      },
    };
    if (route.children?.length) {
      data.children = reshapeRoutes(route.children, data.path);
    }
    rtReshapedRoutes.push(data);
  }
  return rtReshapedRoutes;
};

const flattenRoutes = (routes: AppRoute[]) => {
  let data: AppRoute[] = [];
  routes.forEach((route) => {
    data.push(route);
    if (route.children?.length) {
      const temp = flattenRoutes(route.children);
      if (temp.length) data = [...data, ...temp];
    }
  });
  return data;
};

const generateTreeData = (routes: AppRoute[]): TreeNode[] => {
  // ✅ 保證 key 唯一且穩定（避免空 path / 重複 key 導致 tree 行為異常）
  const seen = new Set<string>();

  const walk = (list: AppRoute[], parentKey = ''): TreeNode[] => {
    const out: TreeNode[] = [];
    list.forEach((route) => {
      const titleRaw = route.meta?.title;
      const title = titleRaw ? transformI18n(titleRaw) : route.path;

      const rawKey = String(route.path ?? '').trim();
      let key = rawKey || uniqueSlash(`${parentKey}/__index`);

      // 若仍發生重複，追加父層資訊（保持穩定）
      if (seen.has(key)) {
        key = uniqueSlash(`${parentKey}/${key}`);
      }
      seen.add(key);

      const node: TreeNode = {
        title: String(title),
        key,
        children: [],
      };

      if (route.children?.length) {
        node.children = walk(route.children, key);
      } else {
        delete node.children;
      }
      out.push(node);
    });
    return out;
  };

  return walk(routes);
};

const generateTree = (routes: AppRoute[], basePath = '/', selectedKeys: string[]) => {
  const res: AppRoute[] = [];
  for (const route of routes) {
    if (route.children?.length) {
      route.children = generateTree(route.children, route.path, selectedKeys);
    }
    if (selectedKeys.includes(route.path) || (route.children && route.children.length >= 1)) {
      res.push(route);
    }
  }
  return res;
};

const checkRoutesPathUnique = (routes: AppRoute[]) => {
  const allPaths: string[] = [];
  const walk = (list: AppRoute[]) => {
    list.forEach((r) => {
      if (allPaths.includes(r.path)) {
        throw new Error(`Duplicate route path: ${r.path}`);
      }
      allPaths.push(r.path);
      if (r.children?.length) walk(r.children);
    });
  };
  walk(routes);
};

/**
 * =========================================
 * Data load（對齊 Vue2 updateView/getRoutes/getRoles）
 * =========================================
 */
let __rolesTreeDebugOnce = false;
const updateView = async () => {
  loading.value = true;
  try {
    // 1) 路由權限表（permissionList）
    const routesRoleResp = await RolesApi.getRouteRoles();
    const roleMap = routesRoleResp?.roles;
    if (!roleMap) {
      // ⚠️ 需補資料：後端 permissionList 回傳格式不符
      throw new Error('需補資料：/AdminSystem/api/permissionList 回傳缺少 roles');
    }

    // 2) 產生 allRoutes（以 routeModules 為基底，轉成 absolute path）
    const normalized = normalizeRoutes(routeModules as any[]);
    checkRoutesPathUnique(normalized);
    const routesWithRoles = setRole(normalized, roleMap);
    allRoutes.value = routesWithRoles;

    /**
     * ✅ 修正：Roles 權限樹用「完整 routesWithRoles」當來源，避免因 meta.roles mapping 不完整而把 children 過濾掉
     * （不改後端 API，只調整本頁 routes 來源選用）
     */
    serviceRoutes.value = cloneDeep(allRoutes.value);
    reshapedRoutes.value = reshapeRoutes(cloneDeep(serviceRoutes.value));

    // 一次性 debug log：確認 normalized / reshaped 是否包含幣別管理、權限管理，以及 parent 是否保留 children
    if (!__rolesTreeDebugOnce) {
      __rolesTreeDebugOnce = true;
      const flatNormalized = flattenRoutes(cloneDeep(normalized));
      const flatReshaped = flattenRoutes(cloneDeep(reshapedRoutes.value));

      const hasCurrency = flatNormalized.some((r) => r.path === '/adminAccount/currency');
      const hasRoles = flatNormalized.some((r) => r.path === '/adminAccount/roles');
      const adminAccountNode = reshapedRoutes.value.find((r) => r.path === '/adminAccount');

      console.log('================ [Roles][tree-data debug once] ================');
      console.log('[Roles][tree-data] normalized has /adminAccount/currency =', hasCurrency);
      console.log('[Roles][tree-data] normalized has /adminAccount/roles =', hasRoles);
      console.log(
        '[Roles][tree-data] reshaped /adminAccount children count =',
        adminAccountNode?.children?.length ?? 0,
        adminAccountNode?.children,
      );
      console.log(
        '[Roles][tree-data] reshaped flat paths (head 30) =',
        flatReshaped.map((r) => r.path).slice(0, 30),
      );
    }

    // 4) 讀取角色清單 + 為每個 role 計算可用 routes
    const rolesResp = await RolesApi.getlocalRoles({});
    const rolesData = rolesResp?.roles;
    if (!Array.isArray(rolesData)) {
      // ⚠️ 需補資料：後端 rolesList 回傳格式不符
      throw new Error('需補資料：/AdminSystem/api/rolesList 回傳缺少 roles(Array)');
    }

    const dynamicRoutesClone = cloneDeep(serviceRoutes.value);
    for (const role of rolesData) {
      role.routes = filterAsyncRoutes(cloneDeep(dynamicRoutesClone), [role.key]);
    }
    rolesList.value = rolesData;
  } finally {
    loading.value = false;
  }
};

/**
 * =========================================
 * UI actions（CRUD）
 * =========================================
 */
const handleCreateRole = () => {
  tempRoleData.value = { ...cloneDeep(defaultRole) };
  checkedKeys.value = [];
  oriRulesPage.value = [];
  delRulesPage.value = [];
  dialogType.value = 'new';
  dialogVisible.value = true;
  nextTick(() => {
    formRef.value?.setFieldsValue?.({ serviceRoutes: [] }); // 保險
    formRef.value?.clearValidate?.();
  });
};

const handleEdit = (record: RoleItem) => {
  oriRulesPage.value = [];
  delRulesPage.value = [];
  dialogType.value = 'edit';
  dialogVisible.value = true;
  checkStrictly.value = true;
  tempRoleData.value = { ...cloneDeep(record), serviceRoutes: [] };

  nextTick(() => {
    formRef.value?.resetFields?.();

    const selectedRoutes = reshapeRoutes(cloneDeep(tempRoleData.value.routes || []));
    const flatKeys = Array.from(new Set(flattenRoutes(selectedRoutes).map((r) => r.path)));

    checkedKeys.value = flatKeys;
    oriRulesPage.value = [...flatKeys];
    tempRoleData.value.serviceRoutes = [...flatKeys];
    formRef.value?.setFieldsValue?.({ serviceRoutes: tempRoleData.value.serviceRoutes });

    // element-ui：先 strict，再放開避免父子互相影響
    checkStrictly.value = false;
  });
};

const handleDelete = (record: RoleItem) => {
  Modal.confirm({
    title: '警告',
    content: `確定要刪除角色「${record.name}」？`,
    okText: '確認',
    cancelText: '取消',
    async onOk() {
      const resp = await RolesApi.deletelocalRoles({ key: record.key });
      const status = resp?.status;
      if (status) {
        rolesList.value = rolesList.value.filter((r) => r.key !== record.key);
        message.success('刪除成功');
      } else {
        throw new Error('刪除失敗（需補資料：請確認 /AdminSystem/api/deleteRole 回傳 status）');
      }
    },
  });
};

// template slot 的 record 推導為 Record<string, any>，這裡做一次薄包裝轉型
const onEditClick = (record: any) => handleEdit(record as RoleItem);
const onDeleteClick = (record: any) => handleDelete(record as RoleItem);

const confirmRole = async () => {
  // ✅ 確保送出前 Form 內的 serviceRoutes 一定是乾淨值（validator 只吃 value）
  formRef.value?.setFieldsValue?.({ serviceRoutes: tempRoleData.value.serviceRoutes || [] });

  console.log('================ [Roles][confirmRole] ================');
  console.log('[Roles][confirmRole] tempRoleData.serviceRoutes =', tempRoleData.value.serviceRoutes);
  console.log('[Roles][confirmRole] checkedKeys(UI) =', checkedKeys.value);
  console.log('[Roles][confirmRole] form.getFieldValue(serviceRoutes) =', formRef.value?.getFieldValue?.('serviceRoutes'));
  console.log('[Roles][confirmRole] form.getFieldsValue() =', formRef.value?.getFieldsValue?.());

  try {
    await formRef.value?.validate();
  } catch {
    console.log('[Roles][confirmRole] validate failed. form.getFieldsError() =', formRef.value?.getFieldsError?.());
    return;
  }

  const isEdit = dialogType.value === 'edit';
  const selectedKeys = (tempRoleData.value.serviceRoutes || []).map((v) => v.trim()).filter(Boolean);
  console.log('[Roles][confirmRole] selectedKeys =', selectedKeys);

  // 1) 產生 routes 結構（對齊 Vue2：generateTree）
  tempRoleData.value.routes = generateTree(cloneDeep(serviceRoutes.value), '/', selectedKeys);
  console.log('[Roles][confirmRole] generateTree(routes).length =', tempRoleData.value.routes?.length, tempRoleData.value.routes);

  // 2) rolePath：對齊 Vue2 的 treeDataKeys（用 flatten 後的 path 列表）
  const reshapedSelected = reshapeRoutes(cloneDeep(tempRoleData.value.routes), '/', true);
  const rolePath = Array.from(new Set(flattenRoutes(reshapedSelected).map((r) => r.path)));
  console.log('[Roles][confirmRole] rolePath =', rolePath);

  if (isEdit) {
    // Vue2：deleteRolePath 計算（用 delRulesPage 反推）
    const removedRoutesTree = generateTree(cloneDeep(serviceRoutes.value), '/', delRulesPage.value);
    const removedFlat = flattenRoutes(removedRoutesTree).map((r) => r.path);
    const deleteRolePath = removedFlat.filter((p) => !rolePath.includes(p));

    const payload = {
      key: tempRoleData.value.key,
      rolePath,
      name: tempRoleData.value.name,
      description: tempRoleData.value.description,
      deleteRolePath,
    };
    console.log('[Roles][confirmRole] updatelocalRole payload =', payload);
    await RolesApi.updatelocalRole(payload);
    await updateView();
  } else {
    const payload = {
      role: tempRoleData.value,
      rolePath,
      creatorLevel: authLevel.value,
      creatorAccount: userAccount.value,
    };
    console.log('[Roles][confirmRole] createlocalRole payload =', payload);
    await RolesApi.createlocalRole(payload);
    await updateView();
  }

  dialogVisible.value = false;
  notification.success({
    message: '成功',
    description: `角色「${tempRoleData.value.name}」已儲存`,
  });
};

onMounted(async () => {
  await updateView();
});
</script>

<style scoped>
.roles-table {
  margin-top: 30px;
}

.permission-tree {
  margin-bottom: 10px;
  max-height: 420px;
  overflow: auto;
  border: 1px solid #f0f0f0;
  padding: 8px;
  border-radius: 6px;
}
</style>

