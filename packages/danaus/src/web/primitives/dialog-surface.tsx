import { cva } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
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
	class?: string;
	children?: Child;
}

/**
 * visual container for dialog content
 * @param props.class additional CSS classes
 */
const DialogSurface = (props: DialogSurfaceProps) => {
	const { class: className, children } = props;

	return <div class={root({ className })}>{children}</div>;
};

export default DialogSurface;
