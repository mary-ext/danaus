import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useId } from '../components/id.tsx';

import { DialogContext, type DialogContextValue } from './utils/dialog-context.tsx';

const root = cva({
	base: [
		'fixed inset-0 m-0 h-dvh max-h-dvh w-dvw max-w-dvw',
		'border-none p-0',
		'bg-transparent',
		'overflow-visible',
		// reset dialog defaults
		'open:flex open:items-center open:justify-center',
		// backdrop
		'backdrop:bg-background-overlay',
	],
});

const backdrop = cva({
	base: ['absolute inset-0 z-0'],
});

export interface DialogProps {
	id: string;
	class?: string;
	children?: Child;
}

/**
 * dialog root component wrapping native `<dialog>` element
 * @param props.id unique identifier for invoker command targeting
 * @param props.class additional CSS classes
 */
const Dialog = (props: DialogProps) => {
	const { id, class: className, children } = props;

	const titleId = useId();

	const contextValue: DialogContextValue = {
		dialogId: id,
		titleId,
	};

	return (
		<DialogContext.Provider value={contextValue}>
			<dialog id={id} aria-labelledby={titleId} class={root({ className })}>
				<button
					type="button"
					tabindex={-1}
					aria-hidden="true"
					commandfor={id}
					command="close"
					class={backdrop()}
				/>
				{children}
			</dialog>
		</DialogContext.Provider>
	);
};

export default Dialog;
