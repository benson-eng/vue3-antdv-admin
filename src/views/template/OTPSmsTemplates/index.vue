<script setup lang="ts">
import { EditOutlined } from '@ant-design/icons-vue';
import { Button, Form, Input, message, Select } from 'ant-design-vue';
import { computed, h, onMounted, ref, watch } from 'vue';

import {
  OTPTemplateTypeMember,
  queryOTPSmsTemplatesMember,
  setOTPSmsTemplateMember,
} from '@/api/backend/adminSystem/accountSystem';
import {
  OTPTemplateType,
  queryOTPSmsTemplates,
  setOTPSmsTemplate,
} from '@/api/backend/transactionSystem';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'OTPSmsTemplates',
});

const i18n = useI18n('routes.template.OTPSmsTemplatesPage');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level < 4);

const masterAgent = ref<string>('');
const isSelectedMasterAgent = ref(false);
const OTPType = ref<OTPTemplateType | OTPTemplateTypeMember | string>(OTPTemplateType.BIND_PHONE);
const dataForm = ref<{ template: string }>({
  template: '',
});
const showNotify = ref(false);
const messageText = ref('');

// OTP 類型列表
const OTPTypeList = computed(() => {
  const allTypes = [
    OTPTemplateType.BIND_PHONE,
    OTPTemplateType.SET_TRANSACTION_PASSWORD,
    OTPTemplateType.TRANSACTION_PASSWORD,
    OTPTemplateTypeMember.CHANGE_PASSWORD,
  ];
  // 過濾掉不需要顯示的類型
  const filterList = [OTPTemplateType.SET_TRANSACTION_PASSWORD, OTPTemplateTypeMember.CHANGE_PASSWORD];
  return allTypes.filter(item => !filterList.includes(item));
});

/**
 * 獲取模板
 */
const getTemplate = async () => {
  if (!masterAgent.value) {
    return;
  }

  dataForm.value.template = '';
  const postData: any = {
    masterAgent: masterAgent.value,
    type: OTPType.value,
  };

  try {
    let res: any;
    if (OTPType.value === OTPTemplateTypeMember.CHANGE_PASSWORD) {
      res = await queryOTPSmsTemplatesMember(postData);
    }
    else {
      res = await queryOTPSmsTemplates(postData);
    }

    // 對齊 Vue2：處理 AdminSystem API 的回傳格式
    // 回傳格式：{ data: [{ masterAgent: string, type: string, template: string }] }
    // 對齊 defaultAvatarSetting 的處理方式
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
    inputTemplate();
  }
  catch (error: any) {
    message.error(error?.message || t('notify.queryFailed'));
  }
};

/**
 * 插入變數按鈕
 */
const buttonInsert = (type: 'otp' | 'orderID' | 'expireTimeMin') => {
  const otpToInsert = `{${type}}`;
  const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
  if (textarea) {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentValue = dataForm.value.template;
    if (startPos !== null && endPos !== null) {
      const newValue = currentValue.slice(0, startPos) + otpToInsert + currentValue.slice(endPos);
      dataForm.value.template = newValue;
      // 重新聚焦到 textarea
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(startPos + otpToInsert.length, startPos + otpToInsert.length);
      }, 0);
    }
  }
  inputTemplate();
};

/**
 * 更新模板
 */
const onFormUpdate = async () => {
  if (!masterAgent.value) {
    message.warning(t('notify.masterAgentRequired'));
    return;
  }

  const postData: any = {
    masterAgent: masterAgent.value,
    type: OTPType.value,
    template: dataForm.value.template,
  };

  try {
    if (OTPType.value === OTPTemplateTypeMember.CHANGE_PASSWORD) {
      await setOTPSmsTemplateMember(postData);
    }
    else {
      await setOTPSmsTemplate(postData);
    }
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
    isSelectedMasterAgent.value = false;
    dataForm.value.template = '';
    return;
  }

  isSelectedMasterAgent.value = true;
  await getTemplate();
};

/**
 * 檢查字串長度（中文字算 2 個字元）
 */
const checkStrlength2 = (value: string, limit: number) => {
  // eslint-disable-next-line no-control-regex
  if (value.replace(/[^\x00-\xFF]/g, 'xx').length <= limit) {
    return true;
  }
  else {
    return false;
  }
};

/**
 * 輸入模板時檢查長度
 */
const inputTemplate = () => {
  let textarea = dataForm.value.template;
  let sendOtpCount = '';
  textarea = textarea
    .replace(/\{otp\}/g, '12345')
    .replace(/\{orderID\}/g, '1234567')
    .replace(/\{expireTimeMin\}/g, '12');
  if (checkStrlength2(textarea, 140)) {
    showNotify.value = false;
  }
  else {
    showNotify.value = true;
    // eslint-disable-next-line no-control-regex
    sendOtpCount = Math.ceil(textarea.replace(/[^\x00-\xFF]/g, 'xx').length / 140).toString();
    messageText.value = t('notify.otp', { limit1: '70', limit2: '140', limit3: sendOtpCount });
  }
};

// 監聽 masterAgent 變化
watch(
  () => masterAgent.value,
  () => {
    onMasterAgentChanged();
  },
);

// 監聽 OTPType 變化
watch(
  () => OTPType.value,
  () => {
    if (masterAgent.value) {
      getTemplate();
    }
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
        <AdminAccountSelector
          v-if="hasPermission"
          v-model="masterAgent"
          value-type="account"
          style="width: 200px; margin-right: 16px"
        />
        <div class="input_group">
          <Select
            v-model:value="OTPType"
            :options="OTPTypeList.map((item) => ({
              label: t(`OTPType.${item}`),
              value: item,
            }))"
            style="width: 200px"
            allow-clear
          />
        </div>
      </div>
    </div>
    <div>
      <div class="input_group">
        <Button type="primary" :icon="h(EditOutlined)" @click="buttonInsert('otp')">
          {{ t('label.otp') }}
        </Button>
        <Button
          v-if="OTPType === OTPTemplateType.TRANSACTION_PASSWORD"
          type="primary"
          :icon="h(EditOutlined)"
          @click="buttonInsert('orderID')"
        >
          {{ t('label.orderID') }}
        </Button>
        <Button type="primary" :icon="h(EditOutlined)" @click="buttonInsert('expireTimeMin')">
          {{ t('label.expireTimeMin') }}
        </Button>
      </div>
      <br>
      <Form :model="dataForm" layout="horizontal" :label-col="{ style: { width: '100px', textAlign: 'left' } }" :wrapper-col="{ style: { width: 'auto' } }">
        <Form.Item :label="t('label.template')">
          <Input.TextArea
            id="template-textarea"
            v-model:value="dataForm.template"
            :rows="7"
            style="width: 600px"
            @input="inputTemplate"
          />
        </Form.Item>
        <Form.Item v-if="showNotify" label="" :wrapper-col="{ offset: 0 }">
          <span style="color: #FFA500">{{ messageText }}</span>
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

.filter-container .input_group {
  margin-bottom: 0;
}
</style>
