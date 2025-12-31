<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';
import RolesApi from '@/api/backend/adminAccount/roles';

defineOptions({ name: 'Step2Roles' });

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:roles': [value: number[]];
}>();

interface Props {
  formModel: {
    roles: number[];
  };
  /** 編輯模式下的完整角色對象數組（用於檢查不在清單中的角色） */
  editRecordRoles?: Array<{ id: number; name: string; [key: string]: any }>;
}

// 使用 computed 的 getter/setter，通過 emit 更新父組件
const rolesValue = computed({
  get: () => props.formModel.roles,
  set: (value: number[]) => {
    emit('update:roles', value);
  },
});

const formRef = ref<FormInstance>();
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
const loadingRoles = ref(false);

// 暴露驗證方法給父元件
defineExpose({
  validate: async () => {
    try {
      await formRef.value?.validate();
      return true;
    }
    catch {
      return false;
    }
  },
  formRef,
});

/**
 * 載入角色列表
 */
const loadRoles = async () => {
  try {
    loadingRoles.value = true;
    const res = await RolesApi.getlocalRoles({});
    const roles = res?.roles ?? [];
    roleOptions.value = roles.map((r: any) => ({
      label: r.name,
      value: r.id,
    }));

    // Vue2 對齊：檢查已設定的角色是否在角色清單中，如果不在則加入
    if (props.editRecordRoles && props.editRecordRoles.length > 0) {
      const rolesIDList = roleOptions.value.map(role => role.value);
      props.editRecordRoles.forEach((role: any) => {
        if (role.id && rolesIDList.indexOf(role.id) === -1) {
          // 如果角色不在清單中，將其加入到選項列表中
          roleOptions.value.push({
            label: role.name || `角色 ${role.id}`,
            value: role.id,
          });
        }
      });
    }
  }
  catch (error) {
    console.error('載入角色列表失敗:', error);
  }
  finally {
    loadingRoles.value = false;
  }
};

onMounted(() => {
  loadRoles();
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <a-form-item
      label="角色"
      name="roles"
      :rules="[
        { required: true, type: 'array', min: 1, message: '請至少選擇一個角色' },
      ]"
    >
      <a-select
        v-model:value="rolesValue"
        :options="roleOptions"
        mode="multiple"
        placeholder="請選擇角色"
        :loading="loadingRoles"
      />
    </a-form-item>
  </a-form>
</template>
