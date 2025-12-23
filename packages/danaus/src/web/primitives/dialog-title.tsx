import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useDialogContext } from './utils/dialog-context.tsx';

const root = cva({
	base: [
		'm-0',
		'text-base-500 font-semibold',
		// grid position: row 1, col 1-2 (leaves col 3 for action)
		'col-start-1 col-end-3 row-start-1 row-end-1',
	],
	variants: {
		hasAction: {
			false: 'col-end-4',
		},
	},
});

const action = cva({
	base: [
		// grid position: row 1, col 3
		'col-start-3 row-start-1 row-end-1',
		'self-start justify-self-end',
	],
});

export interface DialogTitleProps {
	/** optional action element (e.g., close button) */
	action?: Child;
	class?: string;
	children?: Child;
}

/**
 * dialog header with title text and optional action
 * @param props.action optional action element for the title row
 * @param props.class additional CSS classes
 */
const DialogTitle = (props: DialogTitleProps) => {
	const { action: actionSlot, class: className, children } = props;

	const context = useDialogContext(null);
	const hasAction = actionSlot !== undefined;

	return (
		<>
			<h2 id={context?.titleId} class={root({ hasAction, className })}>
				{children}
			</h2>

			{actionSlot && <div class={action()}>{actionSlot}</div>}
		</>
	);
};

export default DialogTitle;
