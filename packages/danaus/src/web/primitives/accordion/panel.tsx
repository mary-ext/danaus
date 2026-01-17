import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: 'px-3 pb-3',
});

export interface AccordionPanelProps {
	class?: string;
	children?: JSXNode;
}

/**
 * accordion panel component for content within accordion item
 */
const AccordionPanel = (props: AccordionPanelProps) => {
	const { class: className, children } = props;

	return <div class={root({ className })}>{children}</div>;
};

export default AccordionPanel;
