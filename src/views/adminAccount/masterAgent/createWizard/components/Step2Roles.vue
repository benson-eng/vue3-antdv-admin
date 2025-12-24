<template>
  <a-form
    ref="formRef"
    :model="formModel"
    :label-col="{ span: 6 }"
    :wrapper-col="{ span: 14 }"
  >
    <a-form-item
      label="角色"
      name="roles"
      :rules="[
        { required: true, message: '請至少選擇一個角色' },
        { type: 'array', min: 1, message: '請至少選擇一個角色' },
      ]"
    >
      <a-select
        v-model:value="formModel.roles"
        :options="roleOptions"
        mode="multiple"
        placeholder="請選擇角色"
        :loading="loadingRoles"
      />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { FormInstance } from 'ant-design-vue';
import RolesApi from '@/api/backend/adminAccount/roles';

defineOptions({ name: 'Step2Roles' });

interface Props {
  formModel: {
    roles: number[];
  };
}

defineProps<Props>();

const formRef = ref<FormInstance>();
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
const loadingRoles = ref(false);

// 暴露驗證方法給父元件
defineExpose({
  validate: async () => {
    try {
      await formRef.value?.validate();
      return true;
    } catch {
      return false;
    }
  },
  formRef,
});

// 載入角色列表
const loadRoles = async () => {
  try {
    loadingRoles.value = true;
    const res = await RolesApi.getlocalRoles({});
    const roles = res?.roles ?? [];
    roleOptions.value = roles.map((r: any) => ({
      label: r.name,
      value: r.id,
    }));
  } catch (error) {
    console.error('載入角色列表失敗:', error);
  } finally {
    loadingRoles.value = false;
  }
};

onMounted(() => {
  loadRoles();
});
</script>


