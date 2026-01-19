<script setup lang="ts">
// 1️⃣ type imports（最前面）
import type { RouteRecordRaw } from 'vue-router';

// 2️⃣ external imports
import { computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// 3️⃣ internal imports
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';

defineOptions({
  name: 'LayoutBreadcrumb',
});

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { t } = useI18n('page.adminAccount');

// 從 Layout 根元件 inject 站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value);
const masterAgentOptions = computed(() => masterAgentCtx?.masterAgentOptions.value || []);
const canSelectMasterAgent = computed(() => masterAgentCtx?.canSelectMasterAgent.value ?? false);

/**
 * 處理站長選單變更
 */
const handleMasterAgentChange = (value: string) => {
  if (masterAgentCtx?.onMasterAgentChanged) {
    masterAgentCtx.onMasterAgentChanged(value);
  }
};

// 檢查是否為 Context Consumer UI（站長選單顯示頁面）
// 只依據當前 route.meta 宣告，不做 route.name 白名單判斷
const isAgentPage = computed(() => route.meta?.showMasterAgent === true);

/**
 * 点击菜单
 */
const clickMenuItem = (menuItem: RouteRecordRaw) => {
  // 如果點擊的是首頁，直接導向首頁
  if (menuItem.name === 'Home') {
    router.push({ name: 'Home' });
    return;
  }

  const { isExt, extOpenMode, type } = menuItem?.meta || {};

  if (type === 0 && !menuItem.redirect) {
    return;
  }

  if (isExt && extOpenMode === 1) {
    window.open(menuItem.path);
  }
  else {
    const to = typeof menuItem.redirect === 'string' ? menuItem.redirect : menuItem;
    router.push(to);
  }
};

const menus = computed(() => {
  // 首頁路由定義
  const homeRoute = {
    name: 'Home',
    path: '/home',
    meta: {
      title: '首頁',
    },
  };

  if (route.meta?.namePath) {
    let children = userStore.menus;
    const paths = route.meta?.namePath?.map((item) => {
      const a = children.find(n => n.name === item);
      children = a?.children || [];
      return a;
    });
      // 第一層永遠是首頁
    return [
      homeRoute,
      ...paths,
    ];
  }
  // 如果當前路由不是首頁，第一層仍然是首頁
  if (route.name !== 'Home') {
    return [homeRoute, ...route.matched];
  }
  // 如果當前就是首頁，只顯示首頁
  return [homeRoute];
});

const getSelectKeys = (rotueIndex: number) => {
  return [menus.value[rotueIndex + 1]?.name] as string[];
};
</script>

<template>
  <div style="display: flex; align-items: center; gap: 16px;">
    <a-breadcrumb>
      <template v-for="(routeItem, rotueIndex) in menus" :key="routeItem?.name">
        <a-breadcrumb-item>
          <span
            v-if="routeItem?.name === 'Home'"
            class="cursor-pointer"
            @click="clickMenuItem(routeItem as RouteRecordRaw)"
          >
            <TitleI18n :title="routeItem?.meta?.title" />
          </span>
          <template v-else>
            <TitleI18n :title="routeItem?.meta?.title" class="cursor-pointer" />
          </template>
          <template v-if="(routeItem as any)?.children?.length" #overlay>
            <a-menu :selected-keys="getSelectKeys(rotueIndex)">
              <template v-for="childItem in (routeItem as any)?.children" :key="childItem.name">
                <a-menu-item
                  v-if="!childItem.meta?.hideInMenu && !childItem.meta?.hideInBreadcrumb"
                  :key="childItem.name"
                  @click="clickMenuItem(childItem)"
                >
                  <TitleI18n :title="childItem.meta?.title" />
                </a-menu-item>
              </template>
            </a-menu>
          </template>
        </a-breadcrumb-item>
      </template>
    </a-breadcrumb>
    <!-- 站長下拉選單：僅在代理商管理頁面顯示 -->
    <div
      v-if="isAgentPage"
      style="display: flex; align-items: center; gap: 8px;"
    >
      <span>{{ t('page.masterAgent') }}：</span>
      <a-select
        :value="selectedMasterAgent"
        :options="masterAgentOptions"
        :placeholder="t('page.selectMasterAgent')"
        :disabled="!canSelectMasterAgent"
        :allow-clear="false"
        style="width: 200px"
        @update:value="handleMasterAgentChange"
      />
    </div>
  </div>
</template>

<style lang="less" scoped></style>
