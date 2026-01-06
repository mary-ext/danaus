import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useDialogContext } from './utils/dialog-context';

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

const surface = cva({
	base: [
		'relative z-10',
		'box-border',
		'max-h-[calc(100dvh-48px)]',
		'p-6',
		'rounded-xl',
		'bg-neutral-background-1 text-neutral-foreground-1',
		'shadow-64',
		// mobile-first: full width on mobile, constrained on larger
		'max-w-full sm:max-w-150',
	],
});

export interface DialogSurfaceProps {
	children?: Child;
}

/**
 * visual container for dialog content
 * @param props.class additional CSS classes
 */
const DialogSurface = (props: DialogSurfaceProps) => {
	const { children } = props;

	const { dialogId, titleId } = useDialogContext();

	return (
		<dialog id={dialogId} aria-labelledby={titleId} class={root()}>
			<div class={surface()}>{children}</div>

			<button
				type="button"
				tabindex={-1}
				aria-hidden="true"
				commandfor={dialogId}
				command="close"
				class={backdrop()}
			/>
		</dialog>
	);
};

export default DialogSurface;
