import { theme } from 'ant-design-vue';

const { defaultAlgorithm, darkAlgorithm } = theme;

export const themeStyle = [
  {
    label: '亮色主題風格',
    value: 'light',
  },
  {
    label: '暗色主題風格',
    value: 'dark',
  },
  {
    label: '暗黑模式',
    value: 'realDark',
  },
] as const;

/** 主题色 */
export const themeColor = {
  light: defaultAlgorithm,
  dark: defaultAlgorithm,
  realDark: darkAlgorithm,
} as const;
export type ThemeColor = keyof typeof themeColor;

/** 主题色 */
export const themeColors = [
  {
    title: '拂曉藍（默認）',
    key: 'techBlue',
    value: '#1677FF',
  },
  {
    title: '薄暮紅',
    key: 'dust',
    value: '#F5222D',
  },
  {
    title: '火山橙',
    key: 'volcano',
    value: '#FA541C',
  },
  {
    title: '日暮橙',
    key: 'sunset',
    value: '#FAAD14',
  },
  {
    title: '明青藍',
    key: 'cyan',
    value: '#13C2C2',
  },
  {
    title: '極光綠',
    key: 'green',
    value: '#52C41A',
  },
  {
    title: '極客藍',
    key: 'geekblue',
    value: '#2F54EB',
  },
  {
    title: '醬紫',
    key: 'purple',
    value: '#722ED1',
  },
] as const;

/** 导航模式（布局方式） */
export const layouts = [
  {
    label: '側邊菜單布局',
    value: 'sidemenu',
  },
  {
    label: '頂部菜單布局',
    value: 'topmenu',
  },
] as const;

/** 界面显示相关 */
export const uiSettings = [
  {
    label: '頁籤持久化',
    value: 'cacheTabs',
  },
] as const;
