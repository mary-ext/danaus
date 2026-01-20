import type { JSXNode } from '@oomfware/jsx';

export interface DialogBodyProps {
	class?: string;
	children?: JSXNode;
}

/**
 * grid layout container for dialog content structure
 * @param props.class additional CSS classes
 */
const DialogBody = (props: DialogBodyProps) => {
	const { class: className, children } = props;

	return <div class={['@container/dialog-body', 'grid gap-2 p-6', className]}>{children}</div>;
};

export default DialogBody;
