import { nextTick, ref, unref } from 'vue';
import { omit } from 'lodash-es';
import { useModal } from './useModal';
import type { SchemaFormProps } from '@/components/core/schema-form';
import type { FormModalProps } from './types';
import { SchemaForm } from '@/components/core/schema-form';

interface ShowModalProps<T extends object = Recordable> {
  modalProps: FormModalProps<T>;
  formProps: Partial<SchemaFormProps<T>>;
}

export function useFormModal<T extends object = Recordable>() {
  const [ModalRender] = useModal();

  const showModal = async <P extends object = T>({ modalProps, formProps }: ShowModalProps<P>) => {
    const formRef = ref<InstanceType<typeof SchemaForm>>();

    const onCancel = (e: MouseEvent) => {
      // formRef.value?.resetFields();
      modalProps?.onCancel?.(e);
    };

    const onOk = async () => {
      // const values = (formRef?.formModel || {}) as any;
      try {
        const values = await formRef.value?.submit();
        await onSubmit(values);
      } catch (error) {
        modalProps?.onFail?.({} as any);
        return Promise.reject(error);
      }
    };

    const onSubmit = async (values) => {
      await modalProps?.onFinish?.(values);
      // formRef.value?.resetFields();
      ModalRender.hide();
    };

    await ModalRender.show({
      destroyOnClose: true,
      ...omit(modalProps, ['onFinish', 'onFail']),
      onCancel,
      onOk,
      content: () => {
        const _formProps = Object.assign({}, { showActionButtonGroup: false }, formProps);

        return (
          <div>
            {/* Trap inputs 用於阻止瀏覽器自動填充（Step 5） */}
            <input
              type="text"
              autocomplete="username"
              name="fake-username"
              style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
            />
            <input
              type="password"
              autocomplete="current-password"
              name="fake-password"
              style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}
              tabIndex={-1}
            />
            <SchemaForm ref={formRef} {..._formProps}></SchemaForm>
          </div>
        );
      },
    });

    await nextTick();

    return [unref(formRef)] as const;
  };

  return [showModal, ModalRender] as const;
}
