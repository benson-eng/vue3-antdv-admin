<script lang="ts" setup>
import type { UnwrapRef } from 'vue';
import type { TableColumn } from '../../types/column';
import {
  DragOutlined,
  SettingOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
} from '@ant-design/icons-vue';
import { Divider, Popover, Tooltip } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';
import { computed, nextTick, ref, toRaw, unref, watch } from 'vue';
import Checkbox from '@/components/basic/check-box/index.vue';
import { useI18n } from '@/hooks/useI18n';
import { useSortable } from '@/hooks/useSortable';
import { isNil } from '@/utils/is';
import { useTableContext } from '../../hooks/useTableContext';
import { ColumnKeyFlag } from '../../types/column';

const { t } = useI18n();
const { tableProps, innerColumns, setProps, getColumnKey } = useTableContext();

let inited = false;
const defaultColumns = toRaw(
  innerColumns.value?.filter(n => n.dataIndex !== ColumnKeyFlag.INDEX),
);
const defaultShowIndex = !!tableProps.showIndex;
const defaultBordered = tableProps.bordered;
const tableColumns = ref<TableColumn[]>([]);

const checkAll = computed<boolean>({
  get() {
    // @ts-ignore
    return tableColumns.value.length > 0 && tableColumns.value.every(n => !n.hideInTable);
  },
  set(value) {
    tableColumns.value.forEach(item => (item.hideInTable = !value));
  },
});

const checkIndex = ref(defaultShowIndex);
const checkBordered = ref(tableProps.bordered);
const columnListRef = ref<HTMLDivElement>();

/**
 * 初始化选中状态
 */
const initCheckStatus = () => {
  tableColumns.value = cloneDeep(defaultColumns) as UnwrapRef<TableColumn[]>;
  checkIndex.value = defaultShowIndex;
  checkBordered.value = defaultBordered;
  tableColumns.value.forEach(item => (item.hideInTable ??= false));
};
initCheckStatus();

const indeterminate = computed(() => {
  return (
    tableColumns.value.length > 0
    && tableColumns.value.some(n => n.hideInTable)
    && tableColumns.value.some(n => !n.hideInTable)
  );
});

watch(
  tableColumns,
  (columns) => {
    setProps({ columns });
  },
  {
    deep: true,
  },
);
/**
 * 設置序號列
 */
const handleIndexCheckChange = (e) => {
  setProps({ showIndex: e.target.checked });
};
  /**
   * 設置邊框
   */
const handleBorderedCheckChange = (e) => {
  setProps({ bordered: e.target.checked });
};

const handleColumnFixed = (item: TableColumn, dir: 'left' | 'right') => {
  const key = getColumnKey(item);

  const toggled = toggleFixedOnly(
    tableColumns.value,
    key,
    dir,
  );

  tableColumns.value = sortByFixedZones(toggled);
};

function sortByFixedZones(columns: TableColumn[]) {
  const left: TableColumn[] = [];
  const normal: TableColumn[] = [];
  const right: TableColumn[] = [];

  columns.forEach((col) => {
    if (col.fixed === 'left') {
      left.push(col);
    }
    else if (col.fixed === 'right') {
      right.push(col);
    }
    else {
      normal.push(col);
    }
  });

  return [...left, ...normal, ...right];
}
function toggleFixedOnly(
  columns: TableColumn[],
  targetKey: string,
  dir: 'left' | 'right',
) {
  return columns.map((col) => {
    if (getColumnKey(col) !== targetKey) {
      return col;
    }

    // 點同一方向 = 取消 fixed
    if (col.fixed === dir) {
      return { ...col, fixed: undefined };
    }

    // 切換成指定方向
    return { ...col, fixed: dir };
  });
}

async function handleVisibleChange() {
  if (inited) { return; }
  await nextTick();
  const columnListEl = unref(columnListRef);
  if (!columnListEl) { return; }

  // Drag and drop sort
  const { initSortable } = useSortable(columnListEl, {
    handle: '.table-column-drag-icon',
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex === newIndex) { return; }

      const columns = [...tableColumns.value];

      const moved = {
        ...columns[oldIndex],
        fixed: undefined, // ✅ 關鍵：拖曳 = 取消 fixed
      };

      columns.splice(oldIndex, 1);
      columns.splice(newIndex, 0, moved);

      tableColumns.value = columns;
    },

  });
  initSortable();
  inited = true;
}

const reset = () => {
  initCheckStatus();
  setProps({ showIndex: defaultShowIndex, bordered: defaultBordered });
};
</script>

<template>
  <Tooltip placement="top">
    <template #title>
      <span>{{ t('component.table.settingColumn') }}</span>
    </template>
    <Popover
      placement="bottomLeft"
      trigger="click"
      overlay-class-name="cloumn-list"
      @open-change="handleVisibleChange"
    >
      <template #title>
        <div class="popover-title">
          <Checkbox v-model:checked="checkAll" :indeterminate="indeterminate">
            {{ t('component.table.settingColumnShow') }}
          </Checkbox>
          <Checkbox v-model:checked="checkIndex" @change="handleIndexCheckChange">
            {{ t('component.table.settingIndexColumnShow') }}
          </Checkbox>
          <Checkbox v-model:checked="checkBordered" @change="handleBorderedCheckChange">
            {{ t('component.table.settingBordered') }}
          </Checkbox>
          <a-button size="small" type="link" @click="reset">
            {{ t('common.resetText') }}
          </a-button>
        </div>
      </template>
      <template #content>
        <div ref="columnListRef">
          <template v-for="item in tableColumns" :key="getColumnKey(item)">
            <div class="check-item">
              <div style="padding: 4px 16px 8px 0">
                <DragOutlined class="table-column-drag-icon cursor-move pr-6px" />
                <Checkbox
                  v-model:checked="item.hideInTable"
                  :true-value="false"
                  :false-value="true"
                >
                  {{ item.title }}
                </Checkbox>
              </div>
              <div class="column-fixed">
                <Tooltip placement="bottomLeft" :mouse-leave-delay="0.4">
                  <template #title>
                    {{ t('component.table.settingFixedLeft') }}
                  </template>
                  <VerticalRightOutlined
                    class="fixed-left"
                    :class="{ active: item.fixed === 'left' }"
                    @click="handleColumnFixed(item, 'left')"
                  />
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip placement="bottomLeft" :mouse-leave-delay="0.4">
                  <template #title>
                    {{ t('component.table.settingFixedRight') }}
                  </template>
                  <VerticalLeftOutlined
                    class="fixed-right"
                    :class="{ active: item.fixed === 'right' }"
                    @click="handleColumnFixed(item, 'right')"
                  />
                </Tooltip>
              </div>
            </div>
          </template>
        </div>
      </template>
      <SettingOutlined />
    </Popover>
  </Tooltip>
</template>

<style lang="less" scoped>
  .check-item {
  @apply flex justify-between;
}

.column-fixed {
  .fixed-right,
  .fixed-left {
    &.active,
    &:hover {
      color: #1890ff;
    }
  }
}
</style>
