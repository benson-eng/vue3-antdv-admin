<template>
  <div>
    <DynamicTable
      row-key="id"
      header-title="定时任务"
      :data-request="Api.systemTask.taskList"
      :columns="columns"
      :scroll="{ x: 2000 }"
      bordered
    >
      <template #toolbar>
        <a-button
          type="primary"
          :disabled="!$auth('system:task:create')"
          @click="openTaskModal({})"
        >
          新增
        </a-button>
      </template>
      <template #expandedRowRender="{ record }">
        <Descriptions :column="1">
          <Descriptions.Item label="任務編號"># {{ record.id }}</Descriptions.Item>
          <Descriptions.Item label="執行次數">
            {{ record.limit > 0 ? `僅 ${record.limit} 次` : '無次數限制' }}
          </Descriptions.Item>
          <Descriptions.Item v-if="record.type === 1" label="执行间隔">
            每{{ record.every }}毫秒执行一次
          </Descriptions.Item>
          <Descriptions.Item v-else label="Cron表达式">
            <Tooltip>
              <template #title>秒 分 小時 日期 月份 星期 年(可選)</template>
              {{ record.cron }}
            </Tooltip>
          </Descriptions.Item>
          <Descriptions.Item v-if="record.type === 0" label="執行時間段">
            <span>{{ parseExecTime(record) }}</span>
          </Descriptions.Item>
          <Descriptions.Item label="執行操作">
            <Popconfirm
              title="確認手動執行一次該任務嗎?"
              :disabled="!$auth('system:task:once')"
              @confirm="handleOnce(record)"
            >
              <a-button type="link" size="small" :disabled="!$auth('system:task:once')">
                <template #icon><ToolOutlined /></template>僅一次
              </a-button>
            </Popconfirm>
            <Popconfirm
              title="確認運行該任務嗎?"
              :disabled="!$auth('system:task:start') || !(record.status === 0)"
              @confirm="handleStart(record)"
            >
              <a-button
                type="link"
                size="small"
                :disabled="!$auth('system:task:start') || !(record.status === 0)"
              >
                <template #icon><CaretRightOutlined /></template>運行
              </a-button>
            </Popconfirm>
            <Popconfirm
              title="確認停止該任務嗎?"
              :disabled="!$auth('system:task:stop') || !(record.status === 1)"
              @confirm="handleStop(record)"
            >
              <a-button
                type="link"
                size="small"
                :disabled="!$auth('system:task:stop') || !(record.status === 1)"
              >
                <template #icon><PoweroffOutlined /></template>停止
              </a-button>
            </Popconfirm>
          </Descriptions.Item>
        </Descriptions>
      </template>
    </DynamicTable>
  </div>
</template>

<script lang="ts" setup>
  import { ToolOutlined, CaretRightOutlined, PoweroffOutlined } from '@ant-design/icons-vue';
  import { Descriptions, Tooltip, Popconfirm } from 'ant-design-vue';
  import { baseColumns } from './columns';
  import { taskSchemas } from './formSchemas';
  import type { TableListItem, TableColumnItem } from './columns';
  import { useTable } from '@/components/core/dynamic-table';
  import { useFormModal } from '@/hooks/useModal/';
  import Api from '@/api/';

  defineOptions({
    name: 'SystemScheduleTask',
  });

  const [DynamicTable, dynamicTableInstance] = useTable({
    search: false,
    size: 'small',
  });

  const [showModal] = useFormModal();

  const reload = () => dynamicTableInstance?.reload();

  /**
   * @description 打开新增/编辑弹窗
   */
  const openTaskModal = async (record: Partial<TableListItem>) => {
    const [formRef] = await showModal({
      modalProps: {
        title: `${record.id ? '编辑' : '新增'}任务`,
        width: 640,
        onFinish: async (values) => {
          const params = {
            ...values,
            id: record.id,
          };
          console.log('新增/编辑任务', params);
          if (record.id) {
            await Api.systemTask.taskUpdate({ id: record.id }, params);
          } else {
            await Api.systemTask.taskCreate(params);
          }
          reload();
        },
      },
      formProps: {
        labelWidth: 100,
        schemas: taskSchemas,
      },
    });

    // 如果是编辑的话，需要获取任务详情
    if (record.id) {
      const data = await Api.systemTask.taskInfo({ id: record.id });

      formRef?.setFieldsValue({
        ...record,
        ...data,
      });
    }
  };

  const delRowConfirm = async (id: number) => {
    await Api.systemTask.taskDelete({ id });
    reload();
  };

  const handleOnce = async (record: TableListItem) => {
    await Api.systemTask.taskOnce({ id: record.id });
    reload();
  };

  const handleStart = async (record: TableListItem) => {
    await Api.systemTask.taskStart({ id: record.id });
    reload();
  };

  const handleStop = async (record: TableListItem) => {
    await Api.systemTask.taskStop({ id: record.id });
    reload();
  };

  const parseExecTime = (record: TableListItem) => {
    if (!record.startTime && !record.endTime) {
      return '无时段限制';
    }
    if (!record.startTime && record.endTime) {
      return `无开始时间限制 - ${record.endTime}`;
    }
    if (record.startTime && !record.endTime) {
      return `${record.startTime} - 长期有效`;
    }
    return `${record.startTime} - ${record.endTime}`;
  };

  const columns: TableColumnItem[] = [
    ...baseColumns,
    {
      title: '操作',
      width: 220,
      dataIndex: 'ACTION',

      fixed: 'right',
      actions: ({ record }) => [
        {
          label: '编辑',
          auth: {
            perm: 'system:task:update',
            effect: 'disable',
          },
          onClick: () => openTaskModal(record),
        },
        {
          label: '删除',
          auth: 'system:task:delete',
          popConfirm: {
            title: '你确定要删除吗？',
            onConfirm: () => delRowConfirm(record.id),
          },
        },
      ],
    },
  ];
</script>
