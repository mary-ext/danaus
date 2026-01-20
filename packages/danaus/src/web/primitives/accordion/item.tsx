import type { JSXNode } from '@oomfware/jsx';

export interface AccordionItemProps {
	/** whether the accordion item is open by default */
	open?: boolean;
	/** group name for exclusive accordion behavior (only one open at a time) */
	name?: string;
	class?: string;
	children?: JSXNode;
}

/**
 * accordion item component using native `<details>` element
 */
const AccordionItem = (props: AccordionItemProps) => {
	const { open = false, name, class: className, children } = props;

	return (
		<details open={open} name={name} class={['group/accordion-item', className]}>
			{children}
		</details>
	);
};

export default AccordionItem;
