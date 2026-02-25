<script setup lang="ts">
import type { ImageSpecConfig } from '@/system/image/imageSpec';
import { message, Modal } from 'ant-design-vue';
import Compressor from 'compressorjs';
import { ref, watch } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

interface Props {
  modelValue?: File | null;
  spec: ImageSpecConfig;
  label?: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue']);

const fileInputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const rawImageUrl = ref<string | null>(null);
const cropperRef = ref<any>(null);
const cropModalVisible = ref(false);

const openFileDialog = () => {
  // 重置文件輸入框，確保可以重新選擇同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
};

const validateFile = (file: File) => {
  const { maxFileSizeMB } = props.spec;
  const maxSize = maxFileSizeMB * 1024 * 1024;

  if (file.size > maxSize) {
    message.error(`圖片不可超過 ${maxFileSizeMB}MB`);
    return false;
  }

  if (!file.type.startsWith('image/')) {
    message.error('僅支援圖片格式');
    return false;
  }

  return true;
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  if (!validateFile(file)) {
    return;
  }

  rawImageUrl.value = URL.createObjectURL(file);
  cropModalVisible.value = true;
};

const applyCrop = async () => {
  const cropper = cropperRef.value;
  if (!cropper) {
    return;
  }

  const result = cropper.getResult({
    width: props.spec.outputWidth,
    height: props.spec.outputHeight,
  });

  if (!result || !result.canvas) {
    message.error('裁切失敗，請重試');
    return;
  }

  const canvas = result.canvas;

  canvas.toBlob(
    (blob: Blob | null) => {
      if (!blob) {
        message.error('圖片轉換失敗');
        return;
      }

      // eslint-disable-next-line no-new
      new Compressor(blob, {
        quality: props.spec.quality,
        success(result) {
          const compressedFile = new File(
            [result],
            `image_${Date.now()}.jpg`,
            { type: 'image/jpeg' },
          );

          previewUrl.value = URL.createObjectURL(compressedFile);
          emit('update:modelValue', compressedFile);
          cropModalVisible.value = false;
        },
        error() {
          message.error('圖片壓縮失敗');
        },
      });
    },
    'image/jpeg',
  );
};

const removeImage = () => {
  previewUrl.value = null;
  emit('update:modelValue', null);
};

watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      previewUrl.value = null;
    }
    else if (val instanceof File) {
      // 如果有新的 File，更新預覽
      previewUrl.value = URL.createObjectURL(val);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="image-upload-field">
    <div v-if="label" class="label">
      {{ label }}
    </div>

    <div
      class="upload-box"
      @click="openFileDialog"
    >
      <template v-if="previewUrl">
        <div class="preview-container">
          <img
            :src="previewUrl"
            :style="{ width: `${spec.previewSize}px`, height: `${spec.previewSize}px` }"
            class="preview-img"
          >
          <div class="overlay-hint">
            點擊重新上傳
          </div>
        </div>
      </template>

      <template v-else>
        <div class="placeholder">
          <div>拖曳或點擊上傳</div>
          <div class="hint">
            比例 {{ spec.aspectRatio.toFixed(2) }}<br>
            最小 {{ spec.minWidth }}x{{ spec.minHeight }}
          </div>
        </div>
      </template>
    </div>

    <div v-if="previewUrl" class="action-row">
      <a-button size="small" @click.stop="removeImage">
        移除
      </a-button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display:none"
      @change="handleFileChange"
    >

    <!-- Crop Modal -->
    <Modal
      v-model:open="cropModalVisible"
      width="800"
      centered
      title="裁切圖片"
      @ok="applyCrop"
    >
      <div style="height: 500px">
        <Cropper
          ref="cropperRef"
          :src="rawImageUrl"
          :stencil-props="{ aspectRatio: spec.aspectRatio }"
          :auto-zoom="true"
        />
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.image-upload-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  font-weight: 500;
}

.upload-box {
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: 0.2s;
  max-width: 100%;
}

.upload-box:hover {
  border-color: #1677ff;
  background: #f0f5ff;
}

.preview-container {
  position: relative;
  display: inline-block;
}

.preview-container {
  position: relative;
  display: inline-block;
}

.preview-img {
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.overlay-hint {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 12px;
}

.upload-box:hover .overlay-hint {
  opacity: 1;
}

.overlay-hint {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 12px;
}

.upload-box:hover .overlay-hint {
  opacity: 1;
}

.placeholder {
  color: #888;
}

.hint {
  font-size: 12px;
  margin-top: 8px;
}

.action-row {
  display: flex;
  justify-content: flex-end;
}
</style>
