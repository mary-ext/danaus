import type { JSXNode } from '@oomfware/jsx';

export interface MenuListProps {
	class?: string;
	children?: JSXNode;
}

/**
 * container for menu items with proper spacing
 */
const MenuList = (props: MenuListProps) => {
	const { class: className, children } = props;

	return <div class={['flex flex-col gap-0.5', className]}>{children}</div>;
};

export default MenuList;
