<script lang="ts" setup>
import { Layout } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { computed, onMounted, provide, ref } from 'vue';
import MasterAgentApi from '@/api/backend/adminAccount/masterAgent';
import { useLayoutSettingStore } from '@/store/modules/layoutSetting';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import PageFooter from './footer';
import PageHeader from './header/index.vue';
import Logo from './logo/index.vue';
import AsideMenu from './menu/menu.vue';
import { TabsView } from './tabs';

const layoutSettingStore = useLayoutSettingStore();
const { layoutSetting } = storeToRefs(layoutSettingStore);
const collapsed = ref<boolean>(false);
// 自定义侧边栏菜单收缩和展开时的宽度
const asiderWidth = computed(() => (collapsed.value ? 80 : 220));
const getTheme = computed(() => (layoutSetting.value.navTheme === 'light' ? 'light' : 'dark'));

// 站長選單狀態管理（provide 給所有子元件使用）
const selectedMasterAgent = ref<string>();
const masterAgentOptions = ref<{ label: string; value: string }[]>([]);
const canSelectMasterAgent = computed(() => true);
const contextVersion = ref<number>(0);

const loadMasterAgentOptions = async () => {
  try {
    const list = await MasterAgentApi.getMasterAgentAccountList({});
    masterAgentOptions.value = (Array.isArray(list) ? list : [])
      .map((i: any) => String(i?.account ?? '').trim())
      .filter(Boolean)
      .map(account => ({ label: account, value: account }));

    // 預設選第一個
    if (!selectedMasterAgent.value && masterAgentOptions.value.length > 0) {
      selectedMasterAgent.value = masterAgentOptions.value[0].value;
    }
  }
  catch (err) {
    console.error('[loadMasterAgentOptions]', err);
    masterAgentOptions.value = [];
  }
};

/**
 * 處理站長切換
 */
const onMasterAgentChanged = (value: string) => {
  selectedMasterAgent.value = value;
  contextVersion.value++;
};

onMounted(() => {
  loadMasterAgentOptions();
});

// Provide 站長選單狀態給所有子元件（LayoutBreadcrumb 和 agent/index.vue）
provide(MASTER_AGENT_SELECT_KEY, {
  masterAgentOptions,
  selectedMasterAgent,
  canSelectMasterAgent,
  contextVersion,
  onMasterAgentChanged,
});
</script>

<template>
  <Layout class="layout">
    <Layout.Sider
      v-if="layoutSetting.layout === 'sidemenu'"
      v-model:collapsed="collapsed"
      :width="asiderWidth"
      :trigger="null"
      collapsible
      :theme="getTheme"
      class="layout-sider"
    >
      <Logo :collapsed="collapsed" />
      <AsideMenu :collapsed="collapsed" :theme="getTheme" />
    </Layout.Sider>
    <Layout>
      <PageHeader v-model:collapsed="collapsed" :theme="getTheme">
        <template v-if="layoutSetting.layout === 'topmenu'" #left>
          <Logo :collapsed="collapsed" />
        </template>
        <template v-if="layoutSetting.layout === 'topmenu'" #menu>
          <AsideMenu :collapsed="collapsed" :theme="getTheme" />
        </template>
      </PageHeader>
      <Layout.Content class="layout-content">
        <TabsView />
      </Layout.Content>
      <PageFooter />
    </Layout>
  </Layout>
</template>

<style lang="less" scoped>
  .layout {
  display: flex;
  height: 100vh;
  overflow: hidden;

  .ant-layout {
    overflow: hidden;
  }

  .layout-content {
    flex: none;
  }
}
</style>
