import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: ['grid gap-2', '@container/dialog-body'],
});

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

	return <div class={root({ className })}>{children}</div>;
};

export default DialogBody;
