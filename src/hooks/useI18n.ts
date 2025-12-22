import type { Composer } from 'vue-i18n';
import { unref } from 'vue';
import * as locales from '@/locales';

type I18nGlobalTranslation = Composer['t'];
type I18nTranslationRestParameters = [string, any];

function getKey(namespace: string | undefined, key: string) {
  if (!namespace) {
    return key;
  }
  if (key.startsWith(namespace)) {
    return key;
  }
  return `${namespace}.${key}`;
}

export function useI18n(namespace?: string): {
  t: I18nGlobalTranslation;
} {
  const i18n = locales.i18n;
  const normalFn: { t: I18nGlobalTranslation } = {
    t: (key: string) => getKey(namespace, key),
  };

  if (!i18n) return normalFn;

  // IMPORTANT:
  // 不要覆寫 / 改寫 i18n.global.t（否則不同頁面切換時會互相污染 namespace，導致翻譯 key 錯亂）
  const tOrigin = i18n.global.t.bind(i18n.global) as I18nGlobalTranslation;

  const tFn: I18nGlobalTranslation = (key: string, ...arg: any[]) => {
    if (!key) return '';
    if (!key.includes('.') && !namespace) return key;
    return tOrigin(getKey(namespace, key), ...(arg as I18nTranslationRestParameters));
  };
  return { t: tFn };
}

/**
 * 国际化转换工具函数，主要用于处理动态路由的title
 * @param {string | Title18n} message message
 * @param isI18n  默认为true，获取对应的翻译文本,否则返回本身
 * @returns message
 */
export function transformI18n(message: string | Title18n = '', isI18n = true) {
  if (!message) {
    return '';
  }
  const i18n = locales.i18n;
  if (!i18n) return typeof message === 'string' ? message : '';

  // vue-i18n typings: i18n.global 可能是 Composer 或 VueI18n（legacy）
  // 本專案 legacy=false，但這裡仍做型別收斂，避免 TS 報錯
  const tGlobal = (i18n.mode === 'legacy'
    ? (i18n.global as any).t
    : (i18n.global as unknown as Composer).t
  ).bind(i18n.global) as I18nGlobalTranslation;

  // 处理动态路由的title, 格式 {zh_CN:"",en_US:""}
  if (typeof message === 'object') {
    const locale = String(unref(i18n.global.locale as any));
    return (message as any)?.[locale] ?? '';
  }

  if (isI18n && typeof message === 'string') {
    return tGlobal(message);
  }
  return message;
}

// 主要用于配合vscode i18nn ally插件的提示。此功能仅用于路由和菜单。请在其他地方使用 vue-i18n 的 useI18n
export const t = (key: string) => key;
