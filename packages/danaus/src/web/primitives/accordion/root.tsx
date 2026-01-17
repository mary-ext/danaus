import type { JSXNode } from '@oomfware/jsx';

export interface AccordionProps {
	class?: string;
	children?: JSXNode;
}

/**
 * accordion container component
 */
const Accordion = (props: AccordionProps) => {
	const { class: className, children } = props;

	return <div class={className}>{children}</div>;
};

export default Accordion;
