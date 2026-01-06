import type { Child } from 'hono/jsx';

export interface AccordionItemProps {
	/** whether the accordion item is open by default */
	open?: boolean;
	/** group name for exclusive accordion behavior (only one open at a time) */
	name?: string;
	class?: string;
	children?: Child;
}

/**
 * accordion item component using native `<details>` element
 */
const AccordionItem = (props: AccordionItemProps) => {
	const { open = false, name, class: className, children } = props;

	return (
		<details open={open} name={name} class={`group/accordion-item${className ? ` ${className}` : ''}`}>
			{children}
		</details>
	);
};

export default AccordionItem;
