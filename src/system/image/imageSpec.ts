export interface ImageSpecConfig {
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  previewSize: number;
  minWidth: number;
  minHeight: number;
  maxFileSizeMB: number;
  quality: number;
}

export const ImageSpec = {
  TEAM_BADGE: {
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    previewSize: 120,
    minWidth: 240,
    minHeight: 240,
    maxFileSizeMB: 2,
    quality: 0.6,
  },

  BANNER_16_9: {
    aspectRatio: 16 / 9,
    outputWidth: 960,
    outputHeight: 540,
    previewSize: 360,
    minWidth: 480,
    minHeight: 270,
    maxFileSizeMB: 3,
    quality: 0.7,
  },

  AVATAR: {
    aspectRatio: 1,
    outputWidth: 256,
    outputHeight: 256,
    previewSize: 120,
    minWidth: 200,
    minHeight: 200,
    maxFileSizeMB: 1,
    quality: 0.6,
  },

  ICON: {
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    previewSize: 120,
    minWidth: 130,
    minHeight: 130,
    maxFileSizeMB: 5,
    quality: 0.7,
  },

  DEFAULT_AVATAR: {
    aspectRatio: 1,
    outputWidth: 256,
    outputHeight: 256,
    previewSize: 128,
    minWidth: 200,
    minHeight: 200,
    maxFileSizeMB: 2,
    quality: 0.6,
  },

  STICKER: {
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    previewSize: 120,
    minWidth: 130,
    minHeight: 130,
    maxFileSizeMB: 5,
    quality: 0.7,
  },
} as const;
