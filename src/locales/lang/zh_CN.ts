import type { Locale } from 'ant-design-vue/es/locale-provider';
import antdLocale from 'ant-design-vue/es/locale/zh_CN';
import { genMessage } from '../helper';

const modulesFiles = import.meta.glob<Recordable>('./zh-CN/**/*.json', { eager: true });

// 自訂 Ant Design Vue locale，將分頁器文字改為繁體中文
const customAntdLocale: Locale = {
  ...antdLocale,
  Pagination: {
    ...antdLocale.Pagination,
    items_per_page: '條/頁',
    jump_to: '跳至',
    jump_to_confirm: '確定',
    page: '頁',
    prev_page: '上一頁',
    next_page: '下一頁',
    prev_5: '向前 5 頁',
    next_5: '向後 5 頁',
    prev_3: '向前 3 頁',
    next_3: '向後 3 頁',
  },
};

export default {
  message: {
    ...genMessage(modulesFiles, 'zh-CN'),
    antdLocale: customAntdLocale,
  },
};
