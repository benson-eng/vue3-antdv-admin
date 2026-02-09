import type { ComputedRef } from 'vue';
import type { TableMethods } from './useTableMethods';
import type { TableState } from './useTableState';
import type { FormSchema, SchemaFormProps } from '@/components/core/schema-form';
import { computed, unref, useSlots } from 'vue';
import { ColumnKeyFlag } from '../types/column';

export type TableForm = ReturnType<typeof useTableForm>;

interface UseTableFormPayload {
  tableState: TableState;
  tableMethods: TableMethods;
}

export function useTableForm(payload: UseTableFormPayload) {
  const slots = useSlots();
  const { tableState, tableMethods } = payload;
  const { innerPropsRef, loadingRef } = tableState;
  const { getColumnKey } = tableMethods;

  const formSchemas = computed<FormSchema[]>(() => {
    const columnKeyFlags = Object.keys(ColumnKeyFlag);
    // @ts-expect-error - innerPropsRef.columns may not have proper typing
    return unref(innerPropsRef)
      .columns
      .filter((n) => {
        const field = getColumnKey(n);
        return !n.hideInSearch && !!field && !columnKeyFlags.includes(field as string);
      })
      .map((n) => {
        return {
          field: n.searchField ?? ([] as string[]).concat(getColumnKey(n)).join('.'),
          component: 'Input',
          label: n.title as string,
          colProps: {
            span: 8,
          },
          ...n.formItemProps,
        } as FormSchema;
      })
      .sort((a, b) => Number(a?.order) - Number(b?.order)) as FormSchema[];
  });

  const getFormProps = computed((): SchemaFormProps => {
    const { formProps } = unref(innerPropsRef);
    const { submitButtonOptions, schemas: customSchemas, ...restFormProps } = formProps || {};
    return {
      showAdvancedButton: true,
      layout: 'horizontal',
      labelWidth: 100,
      // 如果 formProps 中有自定義 schemas，優先使用；否則使用從 columns 生成的 schemas
      schemas: customSchemas || unref(formSchemas),
      ...restFormProps,
      submitButtonOptions: { loading: unref(loadingRef), ...submitButtonOptions },
      compact: true,
    };
  });

  const getFormSlotKeys: ComputedRef<string[]> = computed(() => {
    const keys = Object.keys(slots);
    return keys
      .map(item => (item.startsWith('form-') ? item : null))
      .filter((item): item is string => !!item);
  });

  function replaceFormSlotKey(key: string) {
    if (!key) {
      return '';
    }
    return key?.replace?.(/form-/, '') ?? '';
  }

  return {
    formSchemas,
    getFormProps,
    replaceFormSlotKey,
    getFormSlotKeys,
  };
}
