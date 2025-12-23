import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useMenuContext } from './utils/menu-context.tsx';

const root = cva({
	base: [
		'm-0 box-border w-max max-w-75 min-w-35 overflow-x-hidden rounded-md border border-transparent bg-neutral-background-1 p-1 text-neutral-foreground-1 shadow-16',
		'anchored anchored-bottom-span-left try-flip-y',
	],
});

export interface MenuPopoverProps {
	class?: string;
	children?: Child;
}

/**
 * menu popover surface using the Popover API with CSS anchor positioning
 */
const MenuPopover = (props: MenuPopoverProps) => {
	const { class: className, children } = props;
	const { menuId } = useMenuContext();

	return (
		<div id={menuId} popover="auto" class={root({ className })}>
			{children}
		</div>
	);
};

export default MenuPopover;
