import { createI18n } from 'vue-i18n';
import { localeMap } from './config';
import { setHtmlPageLang, setLoadLocalePool } from './helper';
import type { App } from 'vue';
import { useLocaleStoreWithOut } from '@/store/modules/locale';

async function createI18nOptions() {
  const localeStore = useLocaleStoreWithOut();
  const locale = localeStore.getLocale;
  const defaultLocal = await import(`./lang/${locale}.ts`);
  const message = defaultLocal.default?.message ?? {};

  setHtmlPageLang(locale);
  setLoadLocalePool((loadLocalePool) => {
    loadLocalePool.push(locale);
  });

  return {
    locale,
    legacy: false, // 禁用舊版 API，使用 Composition API
    fallbackLocale: localeMap.zh_CN, // set fallback locale
    messages: {
      [locale]: message as { [key: string]: string },
    },
    globalInjection: true,
    silentTranslationWarn: true, // true - warning off
    missingWarn: false,
    silentFallbackWarn: true,
  };
}

// 動態建立 i18n 實例
export let i18n: ReturnType<typeof createI18n>;

// setup i18n instance with global
export async function setupI18n(app: App) {
  const options = await createI18nOptions();
  i18n = createI18n(options);
  app.use(i18n);
}
