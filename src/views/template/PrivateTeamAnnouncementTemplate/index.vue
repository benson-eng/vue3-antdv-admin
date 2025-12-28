<script setup lang="ts">
import { Button, Form, Input, message } from 'ant-design-vue';
import { computed, onMounted, ref, watch } from 'vue';

import {
  queryPrivateTeamTemplates,
  setPrivateTeamAnnouncementTemplate,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'PrivateTeamAnnouncementTemplate',
});

const i18n = useI18n('routes.template.PrivateTeamAnnouncementTemplatePage');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

const masterAgent = ref<string>('');
const dataForm = ref<{ template: string }>({
  template: '',
});

/**
 * 獲取模板
 */
const getTemplate = async () => {
  if (!masterAgent.value) {
    return;
  }

  dataForm.value.template = '';
  const postData = {
    masterAgent: masterAgent.value,
  };

  try {
    const res = await queryPrivateTeamTemplates(postData);

    // 對齊 Vue2：處理 AdminSystem API 的回傳格式
    // 回傳格式：{ data: [{ masterAgent: string, template: string }] }
    const response = res as any;
    let templateData: any[] = [];

    if (Array.isArray(response)) {
      // 如果直接是陣列（request 返回 data.data）
      templateData = response;
    }
    else if (response && Array.isArray(response.data)) {
      // 如果是 { data: [...] } 格式（request 返回整個 response.data）
      templateData = response.data;
    }
    else {
      // 如果都沒有，設為空陣列
      templateData = [];
    }

    if (templateData.length > 0) {
      const d = templateData[0];
      dataForm.value.template = d.template || '';
    }
    else {
      // 如果沒有資料，清空模板
      dataForm.value.template = '';
    }
  }
  catch (error: any) {
    message.error(error?.message || t('notify.queryFailed'));
  }
};

/**
 * 更新模板
 */
const onFormUpdate = async () => {
  if (!masterAgent.value) {
    message.warning(t('notify.masterAgentRequired'));
    return;
  }

  const postData = {
    masterAgent: masterAgent.value,
    template: dataForm.value.template,
  };

  try {
    await setPrivateTeamAnnouncementTemplate(postData);
    message.success(t('notify.updateSuccess'));
    await getTemplate();
  }
  catch (error: any) {
    message.error(error?.message || t('notify.updateFailed'));
  }
};

/**
 * 刷新模板
 */
const onFormRefresh = async () => {
  await getTemplate();
};

/**
 * 總代理變更處理
 */
const onMasterAgentChanged = async () => {
  if (!masterAgent.value || masterAgent.value === '') {
    dataForm.value.template = '';
    return;
  }

  await getTemplate();
};

// 監聽 masterAgent 變化
watch(
  () => masterAgent.value,
  () => {
    onMasterAgentChanged();
  },
);

onMounted(() => {
  // 對齊其他頁面：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
    // 自動獲取模板
    if (masterAgent.value) {
      getTemplate();
    }
  }
});
</script>

<template>
  <div class="app-container">
    <div class="filter-container">
      <div class="wrap">
        <div
          v-if="hasPermission"
          class="input_group input_group-selector"
        >
          <div class="txt">
            <label>{{ t('filters.masterAgent') }}</label>
          </div>
          <div class="my_input">
            <AdminAccountSelector
              v-model="masterAgent"
              value-type="account"
              style="width: 200px"
            />
          </div>
        </div>
      </div>
    </div>
    <div>
      <Form :model="dataForm" layout="horizontal" :label-col="{ style: { width: '100px', textAlign: 'left' } }" :wrapper-col="{ style: { width: 'auto' } }">
        <Form.Item :label="t('label.template')">
          <Input.TextArea
            v-model:value="dataForm.template"
            :rows="7"
            style="width: 600px"
          />
        </Form.Item>
        <Form.Item label="" :wrapper-col="{ offset: 0 }">
          <Button type="primary" @click="onFormUpdate">
            {{ t('buttons.update') }}
          </Button>
          <Button style="margin-left: 8px" @click="onFormRefresh">
            {{ t('buttons.refresh') }}
          </Button>
        </Form.Item>
      </Form>
    </div>
  </div>
</template>

<style lang="less" scoped>
.app-container {
  padding: 24px;
}

.filter-container {
  margin-bottom: 16px;
}

.wrap {
  display: flex;
  align-items: center;
}

.input_group {
  display: flex;
  gap: 8px;
}

.input_group-selector {
  display: flex;
  align-items: center;
  margin-right: 16px;
}

.input_group-selector .txt {
  margin-right: 8px;
}

.input_group-selector .txt label {
  margin: 0;
}
</style>

