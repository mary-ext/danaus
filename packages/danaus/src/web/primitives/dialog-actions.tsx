import { cva, type VariantProps } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: [
		'box-border',
		'h-fit',
		// grid position: row 3
		'row-start-3 row-end-3',
		// mobile-first: stacked on mobile, inline on larger
		'flex flex-col gap-2 justify-self-stretch',
		'sm:flex-row sm:justify-self-auto',
	],
	variants: {
		position: {
			start: ['col-start-1 col-end-4 row-start-3', 'sm:col-end-2 sm:justify-self-start'],
			end: ['col-start-1 col-end-4 row-start-4', 'sm:col-start-2 sm:row-start-3 sm:justify-self-end'],
		},
		fluid: {
			true: [],
		},
	},
	compoundVariants: [
		{
			position: 'start',
			fluid: true,
			class: 'sm:col-end-4',
		},
		{
			position: 'end',
			fluid: true,
			class: 'sm:col-start-1',
		},
	],
});

export interface DialogActionsProps extends VariantProps<typeof root> {
	class?: string;
	children?: Child;
}

/**
 * footer container for dialog action buttons
 * @param props.position alignment of actions ('start' or 'end')
 * @param props.fluid whether actions should span full width
 * @param props.class additional CSS classes
 */
const DialogActions = (props: DialogActionsProps) => {
	const { position = 'end', fluid = false, class: className, children } = props;

	return <div class={root({ position, fluid, className })}>{children}</div>;
};

export default DialogActions;
