import type { JSXNode } from '@oomfware/jsx';

export interface AccordionPanelProps {
	class?: string;
	children?: JSXNode;
}

/**
 * accordion panel component for content within accordion item
 */
const AccordionPanel = (props: AccordionPanelProps) => {
	const { class: className, children } = props;

	return <div class={['px-3 pb-3', className]}>{children}</div>;
};

export default AccordionPanel;
