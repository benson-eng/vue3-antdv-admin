<template>
  <div class="logo cursor-pointer" @click="goHome">
    <img src="~@/assets/images/logo.png" alt="" />
    <h2 v-show="!collapsed" class="title">One Piece</h2>
  </div>
</template>

<script setup>
  import { useRouter } from 'vue-router';

  defineProps({
    collapsed: {
      type: Boolean,
    },
  });

  const router = useRouter();
  const goHome = () => {
    router.push({ name: 'Home' });
  };
</script>

<style lang="less" scoped>
  .logo {
    @apply flex overflow-hidden whitespace-nowrap items-center;

    height: 64px;
    padding-left: 24px;
    line-height: 64px;

    img {
      height: 32px;
      margin-right: 8px;
    }

    .title {
      @apply mb-0 text-xl;

      color: var(--app-primary-color);
    }
  }
</style>
