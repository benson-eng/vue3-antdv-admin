import type { Composer } from 'vue-i18n';
import type { FormSchema } from '@/components/core/schema-form';

type I18nGlobalTranslation = Composer['t'];

/**
 * 取得搜尋表單的 schemas
 *
 * 【搜尋欄位】
 * - 此頁面無搜尋欄位，masterAgent 由 page-level 控制
 *
 * 【注意】
 * - masterAgent 不在搜尋表單中（page-level 控制）
 * - 此頁面為無搜尋區模式（search: false）
 */
export const getSearchSchemas = (_t: I18nGlobalTranslation): FormSchema[] => {
  // 此頁面無搜尋欄位，返回空陣列
  return [];
};
