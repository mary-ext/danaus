import type { Child } from 'hono/jsx';

export interface AccordionProps {
	class?: string;
	children?: Child;
}

/**
 * accordion container component
 */
const Accordion = (props: AccordionProps) => {
	const { class: className, children } = props;

	return <div class={className}>{children}</div>;
};

export default Accordion;
