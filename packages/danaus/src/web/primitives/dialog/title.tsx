import type { JSXNode } from '@oomfware/jsx';

import { useDialogContext } from './utils/context.tsx';

export interface DialogTitleProps {
	/** optional action element (e.g., close button) */
	action?: JSXNode;
	class?: string;
	children?: JSXNode;
}

/**
 * dialog header with title text and optional action
 * @param props.action optional action element for the title row
 * @param props.class additional CSS classes
 */
const DialogTitle = (props: DialogTitleProps) => {
	const { action: actionSlot, class: className, children } = props;

	const context = useDialogContext(null);

	return (
		<div class={['m-0 flex items-start gap-2', 'text-base-500 font-semibold', className]}>
			<h2 id={context?.titleId} class="m-0 grow">
				{children}
			</h2>

			{actionSlot && <div class="ml-auto shrink-0">{actionSlot}</div>}
		</div>
	);
};

export default DialogTitle;
