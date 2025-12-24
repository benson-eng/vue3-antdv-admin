<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import {
  CloseOutlined,
  ColumnWidthOutlined,
  DownOutlined,
  MinusOutlined,
  ReloadOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { isFunction } from 'lodash-es';
import { computed, unref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TitleI18n } from '@/components/basic/title-i18n';
import { isDevMode } from '@/constants/env';
import { REDIRECT_NAME } from '@/router/constant';
import { useTabsViewStore } from '@/store/modules/tabsView';

defineOptions({
  name: 'TabOperator',
});

const props = defineProps({
  tabItem: {
    type: Object as PropType<RouteLocationNormalizedLoaded>,
    required: true,
  },
  isExtra: Boolean,
});

const route = useRoute();
const router = useRouter();
const tabsViewStore = useTabsViewStore();

const activeKey = computed(() => tabsViewStore.getCurrentTab?.fullPath);

/** 标签页列表 */
const tabsList = computed(() => tabsViewStore.getTabsList);

/** 目标路由是否等于当前路由 */
const isCurrentRoute = (route) => {
  return router.currentRoute.value.matched.some(item => item.name === route.name);
};

/** 关闭当前页面 */
const removeTab = () => {
  // 基本檢查：如果只有一個 tab，不允許關閉
  // 注意：tabsViewStore.closeCurrentTab 中已有更詳細的保護邏輯（首頁保護、Wizard 保護）
  if (tabsList.value.length === 1) {
    return message.warning('这已经是最后一页，不能再关闭了！');
  }
  // tabsViewMutations.closeCurrentTabs(route)
  tabsViewStore.closeCurrentTab(props.tabItem);
};

/** 刷新页面 */
const reloadPage = () => {
  router.replace({
    name: REDIRECT_NAME,
    params: {
      path: unref(route).fullPath,
    },
  });
};

/** 关闭左侧 */
const closeLeft = () => {
  // tabsViewMutations.closeLeftTabs(route)
  tabsViewStore.closeLeftTabs(props.tabItem);
  !isCurrentRoute(props.tabItem) && router.replace(props.tabItem.fullPath);
};

/** 关闭右侧 */
const closeRight = () => {
  // tabsViewMutations.closeRightTabs(route)
  tabsViewStore.closeRightTabs(props.tabItem);
  !isCurrentRoute(props.tabItem) && router.replace(props.tabItem.fullPath);
};

/** 关闭其他 */
const closeOther = () => {
  // tabsViewMutations.closeOtherTabs(route)
  tabsViewStore.closeOtherTabs(props.tabItem);
  !isCurrentRoute(props.tabItem) && router.replace(props.tabItem.fullPath);
};

/** 关闭全部 */
const closeAll = () => {
  tabsViewStore.closeAllTabs();
  router.replace('/');
};

/** 打开页面所在的文件(仅在开发环境有效) */
const openPageFile = async () => {
  if (!isDevMode) {
    console.warn('仅在开发环境有效');
    return;
  }

  const routes = router.getRoutes();
  const target = routes.find(n => n.name === props.tabItem.name);
  if (target) {
    const comp = target.components?.default;
    // @ts-ignore
    let __file = comp?.__file as string;
    if (isFunction(comp)) {
      try {
        // @ts-ignore
        const res = await comp();
        __file = res?.default?.__file;
      }
      catch (error) {
        console.log(error);
      }
    }
    if (__file) {
      const filePath = `/__open-in-editor?file=${__file}`;
      fetch(filePath);
    }
  }
};

defineExpose({
  removeTab,
});
</script>

<template>
  <a-dropdown :trigger="[isExtra ? 'click' : 'contextmenu']">
    <a v-if="isExtra" class="ant-dropdown-link" @click.prevent>
      <DownOutlined :style="{ fontSize: '20px' }" />
    </a>
    <div v-else style="display: inline-block">
      <TitleI18n :title="tabItem.meta?.title" />
    </div>
    <template #overlay>
      <a-menu style="user-select: none">
        <a-menu-item key="1" :disabled="activeKey !== tabItem.fullPath" @click="reloadPage">
          <ReloadOutlined />
          {{ $t('layout.multipleTab.reload') }}
        </a-menu-item>
        <a-menu-item key="2" @click="removeTab">
          <CloseOutlined />
          {{ $t('layout.multipleTab.close') }}
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="3" @click="closeLeft">
          <VerticalRightOutlined />
          {{ $t('layout.multipleTab.closeLeft') }}
        </a-menu-item>
        <a-menu-item key="4" @click="closeRight">
          <VerticalLeftOutlined />
          {{ $t('layout.multipleTab.closeRight') }}
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="5" @click="closeOther">
          <ColumnWidthOutlined />
          {{ $t('layout.multipleTab.closeOther') }}
        </a-menu-item>
        <a-menu-item key="6" @click="closeAll">
          <MinusOutlined />
          {{ $t('layout.multipleTab.closeAll') }}
        </a-menu-item>
        <template v-if="isDevMode">
          <a-menu-divider />
          <a-menu-item key="7" @click="openPageFile">
            <ColumnWidthOutlined />
            打开页面文件
          </a-menu-item>
        </template>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style lang="less" scoped></style>
