import type { JSXNode } from '@oomfware/jsx';

import { cva, type VariantProps } from 'cva';

const root = cva({
	base: [
		'pt-2',
		// stacked on small containers, inline row on larger
		'flex flex-col gap-2',
		'@sm/dialog-body:flex-row @sm/dialog-body:items-center',
	],
	variants: {
		position: {
			start: '@sm/dialog-body:justify-start',
			end: '@sm/dialog-body:justify-end',
		},
	},
});

export interface DialogActionsProps extends VariantProps<typeof root> {
	class?: string;
	children?: JSXNode;
}

/**
 * footer container for dialog action buttons
 * @param props.position alignment of actions ('start' or 'end')
 * @param props.class additional CSS classes
 */
const DialogActions = (props: DialogActionsProps) => {
	const { position = 'end', class: className, children } = props;

	return <div class={root({ position, className })}>{children}</div>;
};

export default DialogActions;
