<script lang="tsx" setup>
import type { MenuTheme } from 'ant-design-vue';
import type { CSSProperties } from 'vue';
import {
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons-vue';
import {
  Avatar,
  Dropdown,
  Layout,
  Menu,
  message,
  Modal,
  Space,
  Tooltip,

} from 'ant-design-vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LocalePicker } from '@/components/basic/locale-picker';
import { LOGIN_NAME } from '@/router/constant';
import { useKeepAliveStore } from '@/store/modules/keepAlive';
import { useLayoutSettingStore } from '@/store/modules/layoutSetting';
import { useLockscreenStore } from '@/store/modules/lockscreen';
import { useUserStore } from '@/store/modules/user';
import { FullScreen, LayoutBreadcrumb, ProjectSetting, Search } from './components/';

defineProps({
  collapsed: {
    type: Boolean,
  },
  theme: {
    type: String as PropType<MenuTheme>,
  },
});
const emit = defineEmits(['update:collapsed']);
const userStore = useUserStore();
const layoutSettingStore = useLayoutSettingStore();
const lockscreenStore = useLockscreenStore();
const keepAliveStore = useKeepAliveStore();

const router = useRouter();
const route = useRoute();
const userInfo = computed(() => userStore.userInfo);
const headerStyle = computed<CSSProperties>(() => {
  const { navTheme, layout } = layoutSettingStore.layoutSetting;
  const isDark = navTheme === 'dark' && layout === 'topmenu';
  return {
    backgroundColor: navTheme === 'realDark' || isDark ? '' : 'rgba(255, 255, 255, 0.85)',
    color: isDark ? 'rgba(255, 255, 255, 0.85)' : '',
  };
});

/**
 * 退出登录
 */
const doLogout = () => {
  Modal.confirm({
    title: '您確定要退出登錄嗎？',
    icon: <QuestionCircleOutlined />,
    centered: true,
    onOk: async () => {
      await userStore.logout();
      keepAliveStore.clear();
      // 移除標籤頁
      localStorage.clear();
      message.success('成功退出登錄');
      router.replace({
        name: LOGIN_NAME,
        query: {
          redirect: route.fullPath,
        },
      });
    },
  });
};
</script>

<template>
  <Layout.Header :style="headerStyle" class="layout-header">
    <div class="header-left">
      <slot name="left">
        <Space :size="20">
          <span
            class="menu-fold cursor-pointer"
            @click="() => emit('update:collapsed', !collapsed)"
          >
            <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
          </span>
          <LayoutBreadcrumb />
        </Space>
      </slot>
    </div>
    <div class="header-menu">
      <slot name="menu" />
    </div>
    <div class="header-right">
      <Space :size="20">
        <Search />
        <Tooltip :title="$t('layout.header.tooltipLock')" placement="bottom">
          <LockOutlined @click="lockscreenStore.setLock(true)" />
        </Tooltip>
        <FullScreen />
        <LocalePicker />
        <Dropdown placement="bottomRight">
          <Avatar :src="userInfo.avatar" :alt="userInfo.username">
            {{ userInfo.username }}
          </Avatar>
          <template #overlay>
            <Menu>
              <Menu.Item @click="$router.push({ name: 'account-settings' })">
                {{ $t('routes.account.settings') }}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item>
                <div @click.prevent="doLogout">
                  <PoweroffOutlined /> {{ $t('layout.header.dropdownItemLoginOut') }}
                </div>
              </Menu.Item>
            </Menu>
          </template>
        </Dropdown>
        <ProjectSetting />
      </Space>
    </div>
  </Layout.Header>
</template>

<style lang="less" scoped>
  .layout-header {
  display: flex;
  position: sticky;
  z-index: 10;
  top: 0;
  align-items: center;
  justify-content: space-between;
  height: var(--app-header-height);
  padding: 0 20px;

  .header-right {
    min-width: 180px;
    cursor: pointer;
  }

  .header-menu {
    flex: 1;
    align-items: center;
    min-width: 0;
  }
}
</style>
