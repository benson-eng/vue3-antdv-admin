import type { ComputedRef, Ref } from 'vue';
import type { TableColumnItem } from './columns';
import { computed, ref, unref, watch } from 'vue';

/**
 * 表格配置 Hook
 * 統一計算：
 * - 可見欄位
 * - 固定寬度總和
 * - scroll.x 決策
 */
export function useTableConfig(
  allColumns: TableColumnItem[] | Ref<TableColumnItem[]> | ComputedRef<TableColumnItem[]>,
) {
  /**
   * 獲取欄位的唯一 key
   */
  function getColumnKey(column: TableColumnItem): string {
    return (column.dataIndex as string) || (column.key as string) || '';
  }

  // 可見欄位的 key 列表（由列設置維護）
  const allColumnsRef = computed(() => unref(allColumns));
  const visibleColumnKeys = ref<Set<string>>(
    new Set(allColumnsRef.value.map(col => getColumnKey(col))),
  );

  // 當 allColumns 變化時，同步更新 visibleColumnKeys（新增的欄位預設可見）
  watch(
    allColumnsRef,
    (newColumns) => {
      const currentKeys = new Set(visibleColumnKeys.value);
      const newKeys = new Set(newColumns.map(col => getColumnKey(col)));

      // 保留現有的可見欄位，新增的欄位也加入可見列表
      const mergedKeys = new Set([...currentKeys, ...newKeys]);
      visibleColumnKeys.value = mergedKeys;
    },
    { deep: false },
  );

  /**
   * 計算可見欄位
   */
  const visibleColumns = computed<TableColumnItem[]>(() => {
    return allColumnsRef.value.filter((col) => {
      const key = getColumnKey(col);
      return visibleColumnKeys.value.has(key);
    });
  });

  /**
   * 計算固定寬度欄位的總和（僅計算可見欄位）
   */
  const fixedWidthSum = computed<number>(() => {
    return visibleColumns.value.reduce((sum, col) => {
      // 只有非 flexible 且明確指定 width 的欄位才計入固定寬度
      if (!col.flexible && typeof col.width === 'number') {
        return sum + col.width;
      }
      return sum;
    }, 0);
  });

  /**
   * 檢查是否存在 flexible 欄位（僅檢查可見欄位）
   */
  const hasFlexibleColumn = computed<boolean>(() => {
    return visibleColumns.value.some(col => col.flexible === true);
  });

  /**
   * 計算 scroll.x
   * 規則：
   * 1. 若存在任一 flexible 欄位，scroll.x 必須為 '100%'（讓表格自適應容器寬度）
   * 2. 若全為固定欄位：
   *    - 固定寬度總和 > 0：使用固定寬度總和（加上緩衝空間），讓表格內部滾動
   *    - 固定寬度總和 = 0：返回 undefined，讓表格自適應容器
   * 3. 所有計算基於目前可見欄位，不使用 DOM、MutationObserver、setTimeout
   *
   * 防呆處理：
   * - 初始進入頁面時，若有 flexible 欄位則為 '100%'，確保不會出現橫向 scrollbar
   * - 關閉欄位到 1~2 欄時，若有 flexible 欄位則自適應容器；若只剩固定欄位且總和很小，也會自適應
   * - 欄位數增加時，只有當全為固定欄位且總和 > 0 時，才會設置固定寬度，觸發內部滾動
   */
  const scrollX = computed<number | '100%' | undefined>(() => {
    // 若存在任一 flexible 欄位，必須返回 '100%'
    // 原因：flexible 欄位會自動適應容器寬度，不需要固定寬度，也不會產生橫向 scrollbar
    if (hasFlexibleColumn.value) {
      return '100%';
    }

    // 若全為固定欄位，檢查固定寬度總和
    const fixedSum = fixedWidthSum.value;

    // 如果固定寬度總和 > 0，使用固定寬度總和（加上緩衝空間）
    // 原因：當所有欄位都是固定寬度時，需要設置 scroll.x 為固定值，讓表格內部可以滾動
    // 這樣當固定寬度總和超過容器寬度時，表格內部會出現橫向滾動條
    if (fixedSum > 0) {
      // 加上緩衝空間，確保不會出現跑版
      return fixedSum + 50;
    }

    // 如果沒有固定寬度欄位（或固定寬度總和為 0），返回 undefined
    // 原因：讓表格自適應容器寬度，不會產生橫向 scrollbar
    // 這種情況通常發生在：所有可見欄位都是 flexible，或沒有可見欄位
    return undefined;
  });

  /**
   * 更新可見欄位
   */
  function updateVisibleColumns(keys: string[]) {
    visibleColumnKeys.value = new Set(keys);
  }

  /**
   * 設置單個欄位的可見性
   */
  function setColumnVisible(key: string, visible: boolean) {
    const newSet = new Set(visibleColumnKeys.value);
    if (visible) {
      newSet.add(key);
    }
    else {
      newSet.delete(key);
    }
    visibleColumnKeys.value = newSet;
  }

  /**
   * 重置為所有欄位可見
   */
  function resetVisibleColumns() {
    visibleColumnKeys.value = new Set(allColumnsRef.value.map(col => getColumnKey(col)));
  }

  return {
    // 狀態
    visibleColumnKeys: computed(() => Array.from(visibleColumnKeys.value)),
    visibleColumns,
    fixedWidthSum,
    scrollX,

    // 方法
    updateVisibleColumns,
    setColumnVisible,
    resetVisibleColumns,
  };
}
