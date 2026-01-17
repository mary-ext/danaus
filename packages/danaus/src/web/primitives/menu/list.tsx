import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: ['flex flex-col gap-0.5'],
});

export interface MenuListProps {
	class?: string;
	children?: JSXNode;
}

/**
 * container for menu items with proper spacing
 */
const MenuList = (props: MenuListProps) => {
	const { class: className, children } = props;

	return <div class={root({ className })}>{children}</div>;
};

export default MenuList;
