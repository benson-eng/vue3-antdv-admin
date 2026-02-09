import type { FormProps } from 'ant-design-vue';
import type { DynamicTableEmitFn, DynamicTableProps } from '../dynamic-table';
import type { OnChangeCallbackParams, TableColumn } from '../types/';
import type { Pagination, TableState } from './useTableState';
import { useInfiniteScroll } from '@vueuse/core';
import { debounce, get, isBoolean, isFunction } from 'lodash-es';
import { getCurrentInstance, nextTick, unref, watch } from 'vue';
import { isObject } from '@/utils/is';
import { warn } from '@/utils/log';
import tableConfig from '../dynamic-table.config';
import { useEditable } from './useEditable';
import { useTableExpand } from './useTableExpand';

export type UseInfiniteScrollParams = Parameters<typeof useInfiniteScroll>;

export type TableMethods = ReturnType<typeof useTableMethods>;
interface UseTableMethodsPayload {
  tableState: TableState;
  emit: DynamicTableEmitFn;
  props: DynamicTableProps;
}

export const useTableMethods = (payload: UseTableMethodsPayload) => {
  const { props, emit, tableState } = payload;
  const {
    innerPropsRef,
    tableData,
    loadingRef,
    searchFormRef,
    paginationRef,
    editFormErrorMsgs,
    searchState,
  } = tableState;
  // 可编辑行
  const editableMethods = useEditable({ props, tableState });
  const expandMethods = useTableExpand({ props, tableState, emit });

  watch(
    () => props.searchParams,
    () => {
      fetchData();
    },
  );

  watch(
    () => props.dataSource,
    (val) => {
      updatePagination({
        total: val?.length,
      });
    },
  );

  const setProps = (props: Partial<DynamicTableProps>) => {
    Object.assign(innerPropsRef.value, props);
  };

  /**
   * @description 表格查询
   */
  const handleSubmit = (params, page = 1) => {
    console.log('[DynamicTable] handleSubmit called with params:', params, 'page:', page);
    updatePagination({
      current: page,
    });
    fetchData(params);
    emit('search', params);
  };

  /**
   * @param {object} params 表格查询参数
   * @description 获取表格数据
   */
  const fetchData = debounce(async (params: Recordable = {}) => {
    console.log('[DynamicTable] fetchData called with params:', params);
    const { dataRequest, dataSource, fetchConfig, searchParams } = props;

    if (!dataRequest || !isFunction(dataRequest) || Array.isArray(dataSource)) {
      console.warn('[DynamicTable] fetchData skipped:', {
        hasDataRequest: !!dataRequest,
        isFunction: isFunction(dataRequest),
        isArrayDataSource: Array.isArray(dataSource),
      });
      return;
    }
    try {
      let pageParams: Recordable = {};
      const pagination = unref(paginationRef)!;

      const { pageField, sizeField, listField, totalField } = {
        ...tableConfig.fetchConfig,
        ...fetchConfig,
      };

      // 是否启用了分页
      const enablePagination = isObject(pagination);
      if (enablePagination) {
        pageParams = {
          [pageField]: pagination.current,
          [sizeField]: pagination.pageSize,
        };
      }
      const { sortInfo = {}, filterInfo } = searchState;
      // 表格查询参数
      let queryParams: Recordable = {
        ...pageParams,
        ...sortInfo,
        ...filterInfo,
        ...searchParams,
        ...params,
      };
      await nextTick();
      if (searchFormRef.value) {
        console.log('[DynamicTable] Validating form...');
        try {
          const values = await searchFormRef.value.validate();
          console.log('[DynamicTable] Form validation passed, values:', values);
          queryParams = {
            ...searchFormRef.value.handleFormValues(values),
            ...queryParams,
          };
        }
        catch (validationError) {
          console.error('[DynamicTable] Form validation failed:', validationError);
          // 驗證失敗時不繼續查詢
          throw validationError;
        }
      }

      console.log('[DynamicTable] Calling dataRequest with queryParams:', queryParams);
      loadingRef.value = true;
      const res = await dataRequest(queryParams);
      console.log('[DynamicTable] dataRequest response:', res);
      console.log('[DynamicTable] fetchConfig:', { listField, totalField });

      const isArrayResult = Array.isArray(res);
      console.log('[DynamicTable] isArrayResult:', isArrayResult);
      let resultItems: Recordable[] = isArrayResult ? res : get(res, listField);
      const resultTotal: number = isArrayResult ? res.length : Number(get(res, totalField));
      console.log('[DynamicTable] Extracted resultItems:', resultItems);
      console.log('[DynamicTable] Extracted resultTotal:', resultTotal);

      // 確保 resultItems 始終是數組
      if (!Array.isArray(resultItems)) {
        warn(`表格數據格式錯誤：期望數組，但得到 ${typeof resultItems}`);
        console.error('[DynamicTable] resultItems is not an array:', resultItems);
        resultItems = [];
      }

      if (enablePagination && resultTotal) {
        const { current = 1, pageSize = tableConfig.defaultPageSize } = pagination;
        const currentTotalPage = Math.ceil(resultTotal / pageSize);
        if (current > currentTotalPage) {
          updatePagination({
            current: currentTotalPage,
          });
          return await fetchData(params);
        }
      }
      console.log('[DynamicTable] Setting tableData.value to:', resultItems);
      tableData.value = resultItems;
      updatePagination({ total: ~~resultTotal });
      console.log('[DynamicTable] Updated pagination total:', ~~resultTotal);
      if (queryParams[pageField]) {
        updatePagination({ current: queryParams[pageField] || 1 });
      }
      console.log('[DynamicTable] Final tableData.value:', tableData.value);
      return tableData;
    }
    catch (error) {
      console.error('[DynamicTable] fetchData error:', error);
      warn(`表格查询出错：${error}`);
      emit('fetch-error', error);
      tableData.value = [];
      updatePagination({ total: 0 });
    }
    finally {
      loadingRef.value = false;
    }
  });

  /**
   * @description 刷新表格
   */
  const reload = (resetPageIndex = false) => {
    const pagination = unref(paginationRef);
    if (Object.is(resetPageIndex, true) && isObject(pagination)) {
      pagination.current = 1;
    }
    emit('reload');
    return fetchData();
  };

  /**
   * @description 分页改变
   */
  const handleTableChange = async (...rest: OnChangeCallbackParams) => {
    const [pagination, filters, sorter] = rest;
    const { sortFn, filterFn } = props;

    if (searchFormRef.value) {
      await searchFormRef.value.validate();
    }
    updatePagination(pagination);

    const params: Recordable = {};
    if (sorter && isFunction(sortFn)) {
      const sortInfo = sortFn(sorter);
      searchState.sortInfo = sortInfo;
      params.sortInfo = sortInfo;
    }

    if (filters && isFunction(filterFn)) {
      const filterInfo = filterFn(filters);
      searchState.filterInfo = filterInfo;
      params.filterInfo = filterInfo;
    }

    await fetchData({});
    emit('change', ...rest);
  };

  // dataIndex 可以为 a.b.c
  // const getDataIndexVal = (dataIndex, record) => dataIndex.split('.').reduce((pre, curr) => pre[curr], record)

  /**
   * 获取表格列key
   */
  const getColumnKey = (column: TableColumn) => {
    return (column?.key || column?.dataIndex) as string;
  };

  /** 编辑表单验证失败回调 */
  const handleEditFormValidate: FormProps['onValidate'] = (name, status, errorMsgs) => {
    // console.log('errorInfo', editFormErrorMsgs);
    const key = Array.isArray(name) ? name.join('.') : name;
    if (status) {
      editFormErrorMsgs.value.delete(key);
    }
    else {
      editFormErrorMsgs.value.set(key, errorMsgs);
    }
  };

  /** 更新表格分页信息 */
  const updatePagination = (info: Pagination = paginationRef.value) => {
    if (isBoolean(info)) {
      paginationRef.value = info;
    }
    else if (isObject(paginationRef.value)) {
      paginationRef.value = {
        ...paginationRef.value,
        ...info,
      };
    }
  };
  /** 表格无限滚动 */
  const onInfiniteScroll = (
    callback: UseInfiniteScrollParams[1],
    options?: UseInfiniteScrollParams[2],
  ) => {
    const el = getCurrentInstance()?.proxy?.$el.querySelector('.ant-table-body');
    useInfiniteScroll(el, callback, options);
  };

  /**
   * @description当外部需要动态改变搜索表单的值或选项时，需要调用此方法获取dynamicFormRef实例
   */
  const getSearchFormRef = () => searchFormRef.value;

  return {
    ...editableMethods,
    ...expandMethods,
    setProps,
    handleSubmit,
    handleTableChange,
    getColumnKey,
    fetchData,
    getSearchFormRef,
    reload,
    onInfiniteScroll,
    handleEditFormValidate,
  };
};
