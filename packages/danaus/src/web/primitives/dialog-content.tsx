import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: ['min-h-8 overflow-y-auto', 'text-base-300'],
});

export interface DialogContentProps {
	class?: string;
	children?: JSXNode;
}

/**
 * scrollable content area for dialog body
 * @param props.class additional CSS classes
 */
const DialogContent = (props: DialogContentProps) => {
	const { class: className, children } = props;

	return <div class={root({ className })}>{children}</div>;
};

export default DialogContent;
