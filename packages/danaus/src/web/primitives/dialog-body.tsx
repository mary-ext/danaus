import { cva } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: [
		'box-border',
		'grid gap-2',
		'grid-cols-[1fr_1fr_auto]',
		// mobile-first: extra row for stacked actions
		'grid-rows-[auto_1fr_auto_auto] sm:grid-rows-[auto_1fr_auto]',
	],
});

export interface DialogBodyProps {
	class?: string;
	children?: Child;
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
