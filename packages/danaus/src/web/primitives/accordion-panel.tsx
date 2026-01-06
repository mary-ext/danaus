import { cva } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: 'px-3 pb-3',
});

export interface AccordionPanelProps {
	class?: string;
	children?: Child;
}

/**
 * accordion panel component for content within accordion item
 */
const AccordionPanel = (props: AccordionPanelProps) => {
	const { class: className, children } = props;

	return <div class={root({ className })}>{children}</div>;
};

export default AccordionPanel;
