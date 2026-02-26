import type { Composer } from 'vue-i18n';
import type { FormSchema } from '@/components/core/schema-form';

type I18nGlobalTranslation = Composer['t'];

/**
 * 取得搜尋表單的 schemas
 * 目前此頁面沒有搜尋表單欄位（masterAgent 為 page-level 控制）
 * 預留此文件以備未來擴展
 */
export const getSearchSchemas = (_t: I18nGlobalTranslation): FormSchema[] => {
  // 目前沒有搜尋表單欄位，返回空陣列
  // 未來如需添加搜尋欄位，可在此擴展
  return [];
};
