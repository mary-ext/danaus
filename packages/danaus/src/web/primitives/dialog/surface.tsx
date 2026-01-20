import type { JSXNode } from '@oomfware/jsx';

import { useDialogContext } from './utils/context.tsx';

export interface DialogSurfaceProps {
	size?: 'small' | 'medium';
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
		<dialog
			id={dialogId}
			aria-labelledby={titleId}
			class={[
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
			]}
		>
			<div
				class={[
					'relative z-10',
					'box-border',
					'w-full',
					'max-h-[calc(100dvh-48px)]',
					// rounded top on mobile, all corners on larger screens
					'rounded-t-xl sm:rounded-xl',
					'bg-neutral-background-1 text-neutral-foreground-1',
					'shadow-64',

					size === 'small' && 'max-w-120',
					size === 'medium' && 'max-w-150',
				]}
			>
				{children}
			</div>

			<button
				type="button"
				tabindex={-1}
				aria-hidden="true"
				commandfor={dialogId}
				command="close"
				class="absolute inset-0 z-0"
			/>
		</dialog>
	);
};

export default DialogSurface;
