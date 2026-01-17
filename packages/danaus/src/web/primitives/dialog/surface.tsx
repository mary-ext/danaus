import type { JSXNode } from '@oomfware/jsx';

import { cva, type VariantProps } from 'cva';

import { useDialogContext } from './utils/context.tsx';

const root = cva({
	base: [
		'fixed inset-0 m-0 h-dvh max-h-dvh w-dvw max-w-dvw',
		'border-none p-0',
		'bg-transparent',
		'overflow-visible',
		'open:flex',
		// bottom-aligned on mobile, centered on larger screens
		'items-end justify-center',
		'sm:items-center',
		// backdrop
		'backdrop:bg-background-overlay',
		// entry/exit animations
		'dialog-animate dialog-backdrop-animate',
	],
});

const backdrop = cva({
	base: ['absolute inset-0 z-0'],
});

const surface = cva({
	base: [
		'relative z-10',
		'box-border',
		'w-full',
		'max-h-[calc(100dvh-48px)]',
		// rounded top on mobile, all corners on larger screens
		'rounded-t-xl sm:rounded-xl',
		'bg-neutral-background-1 text-neutral-foreground-1',
		'shadow-64',
	],
	variants: {
		size: {
			small: 'max-w-120',
			medium: 'max-w-150',
		},
	},
});

export interface DialogSurfaceProps extends VariantProps<typeof surface> {
	children?: JSXNode;
}

/**
 * visual container for dialog content
 * @param props.size dialog width ('small' or 'medium')
 */
const DialogSurface = (props: DialogSurfaceProps) => {
	const { size = 'small', children } = props;

	const { dialogId, titleId } = useDialogContext();

	return (
		<dialog id={dialogId} aria-labelledby={titleId} class={root()}>
			<div class={surface({ size })}>{children}</div>

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
