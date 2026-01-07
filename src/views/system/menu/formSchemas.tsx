import type { FormSchema } from '@/components/core/schema-form/';
import { h } from 'vue';
import Api from '@/api/';
import { Icon, IconPicker } from '@/components/basic/icon';
import { asyncRoutes } from '@/router/asyncModules';
import { findPath, str2tree } from '@/utils/common';

/** 菜單類型 0: 目錄 | 1: 菜單 | 2: 按鈕 */
const isDir = (type: API.MenuDto['type']) => type === 0;
const isMenu = (type: API.MenuDto['type']) => type === 1;
const isButton = (type: API.MenuDto['type']) => type === 2;

export const useMenuSchemas = (): FormSchema<API.MenuDto>[] => [
  {
    field: 'type',
    component: 'RadioGroup',
    label: '菜單類型',
    defaultValue: 0,
    rules: [{ required: true, type: 'number' }],
    componentProps: {
      options: [
        {
          label: '目錄',
          value: 0,
        },
        {
          label: '菜單',
          value: 1,
        },
        {
          label: '權限',
          value: 2,
        },
      ],
    },
  },
  {
    field: 'name',
    component: 'Input',
    label: ({ formModel }) => (isButton(formModel.type) ? '權限名稱' : '節點名稱'),
    rules: [{ required: true, type: 'string' }],
  },
  {
    field: 'parentId',
    component: 'TreeSelect',
    label: '上級節點',
    componentProps: {
      fieldNames: {
        label: 'name',
        value: 'id',
      },
      request: async ({ schema, formModel }) => {
        const menuTree = await Api.systemMenu.menuList({});
        const treeDefaultExpandedKeys = [-1].concat(
          findPath(menuTree, formModel.parentId) || [],
        );
        schema.value.componentProps.treeDefaultExpandedKeys = treeDefaultExpandedKeys;
        return [{ id: -1, name: '根目錄', children: menuTree }];
      },
      getPopupContainer: () => document.body,
    },
    rules: [{ required: true, type: 'number' }],
  },
  {
    field: 'path',
    component: 'Input',
    label: '路由地址',
    label: '路由地址',
    vIf: ({ formModel }) => !isButton(formModel.type),
    rules: [{ required: true, type: 'string' }],
  },
  {
    field: 'permission',
    component: 'Input',
    label: '權限',
    helpMessage: `對應控制器中定義的權限字符，如：@Perm('system:menu:list'))`,
    vIf: ({ formModel }) => !isDir(formModel.type),
    required: ({ formModel }) => isButton(formModel.type),
    afterSlot: ({ schema, formInstance, formModel }) => {
      if (schema.value.component === 'Input') {
        return h(Icon, {
          icon: 'ant-design:folder-open-outlined',
          title: '選擇權限',
          class: 'ml-[12px] cursor-pointer',
          onclick: async () => {
            const data = await Api.systemMenu.menuGetPermissions();
            if (typeof formModel.permission === 'string') {
              // @ts-ignore
              formModel.permission = formModel.permission.split(':');
            }
            formInstance.updateSchema({
              field: 'permission',
              component: 'Cascader',
              componentProps: {
                displayRender: ({ labels }) => labels.join(':'),
                options: data.reduce((prev, curr) => (str2tree(curr, prev, ':'), prev), []),
              },
            });
          },
        });
      }
      else {
        return h(Icon, {
          icon: 'ant-design:edit-outlined',
          title: '手動輸入',
          class: 'ml-[12px] cursor-pointer',
          onclick: () => {
            if (Array.isArray(formModel.permission)) {
              formModel.permission = formModel.permission.join(':');
            }
            formInstance.updateSchema({
              field: 'permission',
              component: 'Input',
            });
          },
        });
      }
    },
  },
  {
    field: 'component',
    component: 'Cascader',
    label: '文件路徑',
    vIf: ({ formModel }) => isMenu(formModel.type) && !formModel.isExt,
    componentProps: {
      options: Object.keys(asyncRoutes).reduce(
        (prev, curr) => (str2tree(curr, prev, '/'), prev),
        [],
      ),
    },
    rules: [{ required: true, type: 'array' }],
  },
  {
    field: 'icon',
    component: () => IconPicker,
    label: '節點圖標',
    vIf: ({ formModel }) => !isButton(formModel.type),
  },
  {
    field: 'orderNo',
    component: 'InputNumber',
    label: '排序號',
    defaultValue: 255,
    componentProps: {
      style: {
        width: '100%',
      },
    },
  },
  {
    field: 'isExt',
    component: 'RadioGroup',
    label: '是否外鍊',
    defaultValue: false,
    helpMessage: '選擇是外鏈則路由地址需要以`http(s)://`開頭',
    colProps: {
      span: 12,
    },
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '是', value: true },
        { label: '否', value: false },
      ],
    },
    vIf: ({ formModel }) => !isButton(formModel.type),
  },
  {
    field: 'extOpenMode',
    component: 'RadioGroup',
    label: '打開方式',
    defaultValue: 1,
    vIf: ({ formModel }) => !isButton(formModel.type) && formModel.isExt,
    colProps: {
      span: 12,
    },
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        {
          label: '新窗口打開',
          value: 1,
        },
        {
          label: '內嵌頁打開',
          value: 2,
        },
      ],
    },
  },
  {
    field: 'keepAlive',
    component: 'RadioGroup',
    label: '是否緩存',
    defaultValue: 0,
    vIf: ({ formModel }) => isMenu(formModel.type),
    colProps: {
      span: 12,
    },
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '是', value: 1 },
        { label: '否', value: 0 },
      ],
    },
  },
  {
    field: 'show',
    component: 'RadioGroup',
    label: '是否顯示',
    defaultValue: 1,
    colProps: {
      span: 12,
    },
    helpMessage: '會生成路由,但左側菜單不可見',
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '是', value: 1 },
        { label: '否', value: 0 },
      ],
    },
    vIf: ({ formModel }) => !isButton(formModel.type),
  },
  {
    field: 'activeMenu',
    component: 'Input',
    label: '高亮菜單項',
    colProps: {
      span: 12,
    },
    helpMessage: '值為某個的節點的路由地址(可設置當前路由高亮的菜單項，多用於詳情頁)',
    componentProps: {
      placeholder: '需要高亮的菜單項(節點名稱)',
    },
    vIf: ({ formModel }) => !formModel.show && !isButton(formModel.type),
  },
  {
    field: 'status',
    label: '狀態',
    component: 'RadioGroup',
    defaultValue: 1,
    helpMessage: '不會生成路由,同時左側菜單不可見',
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '啟用', value: 1 },
        { label: '禁用', value: 0 },
        { label: '禁用', value: 0 },
      ],
    },
  },
];
