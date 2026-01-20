import type { JSXNode } from '@oomfware/jsx';

import { useMenuContext } from './utils/context.tsx';

export interface MenuPopoverProps {
	class?: string;
	children?: JSXNode;
}

/**
 * menu popover surface using the Popover API with CSS anchor positioning
 */
const MenuPopover = (props: MenuPopoverProps) => {
	const { class: className, children } = props;
	const { menuId } = useMenuContext();

	return (
		<div
			id={menuId}
			popover="auto"
			class={[
				'm-0 box-border w-max max-w-75 min-w-35 overflow-x-hidden rounded-md border border-transparent bg-neutral-background-1 p-1 text-neutral-foreground-1 shadow-16',
				'anchored anchored-bottom-span-left try-flip-y',
				// entry/exit animations (slides down from anchor)
				'popover-animate popover-slide-down',

				className,
			]}
		>
			{children}
		</div>
	);
};

export default MenuPopover;
