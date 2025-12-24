<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter, type RouteRecordRaw } from 'vue-router';
  import { useUserStore } from '@/store/modules/user';

  defineOptions({
    name: 'LayoutBreadcrumb',
  });

  const router = useRouter();
  const route = useRoute();
  const userStore = useUserStore();

  // 点击菜单
  const clickMenuItem = (menuItem: RouteRecordRaw) => {
    // 如果點擊的是首頁，直接導向首頁
    if (menuItem.name === 'Home') {
      router.push({ name: 'Home' });
      return;
    }

    const { isExt, extOpenMode, type } = menuItem?.meta || {};

    if (type === 0 && !menuItem.redirect) return;

    if (isExt && extOpenMode === 1) {
      window.open(menuItem.path);
    } else {
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
        const a = children.find((n) => n.name === item);
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
        <template v-if="routeItem?.children?.length" #overlay>
          <a-menu :selected-keys="getSelectKeys(rotueIndex)">
            <template v-for="childItem in routeItem?.children" :key="childItem.name">
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
</template>

<style lang="less" scoped></style>
