export type LocaleType = keyof typeof localeMap;

export const localeMap = {
  zh_TW: 'zh_TW',
  en: 'en',
} as const;

export const localeList = [
  {
    lang: localeMap.en,
    label: 'English',
    icon: '🇺🇸',
    title: 'Language',
  },
  {
    lang: localeMap.zh_TW,
    label: '繁體中文',
    icon: '🇹🇼',
    title: '語言',
  },
] as const;
