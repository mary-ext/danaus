import { cloneElement, type JSXElement } from '@oomfware/jsx';

import { cx } from 'cva';

import { useMenuContext } from './utils/context.tsx';

export interface MenuTriggerProps {
	children: JSXElement;
}

/**
 * clones the child element and adds invoker command attributes to toggle the menu popover,
 * also sets anchor positioning via the `anchor` utility class
 */
const MenuTrigger = (props: MenuTriggerProps) => {
	const { children } = props;
	const { menuId } = useMenuContext();

	const childProps = children.props as Record<string, unknown>;

	return cloneElement(children, {
		commandfor: menuId,
		command: 'toggle-popover',
		class: cx('anchor', childProps?.class as string | undefined),
	});
};

export default MenuTrigger;
