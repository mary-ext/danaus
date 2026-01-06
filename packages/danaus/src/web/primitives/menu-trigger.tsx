import { cx } from 'cva';
import { cloneElement } from 'hono/jsx';
import type { JSX } from 'hono/jsx/jsx-runtime';

import { useMenuContext } from './utils/menu-context.tsx';

export interface MenuTriggerProps {
	children: JSX.Element;
}

/**
 * clones the child element and adds invoker command attributes to toggle the menu popover,
 * also sets anchor positioning via the `anchor` utility class
 */
const MenuTrigger = (props: MenuTriggerProps) => {
	const { children } = props;
	const { menuId } = useMenuContext();

	const childProps = (children as any).props as Record<string, unknown> | undefined;

	return cloneElement(children, {
		commandfor: menuId,
		command: 'toggle-popover',
		class: cx('anchor', childProps?.class as string | undefined),
	});
};

export default MenuTrigger;
