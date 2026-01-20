import { cn, type JSXNode } from '@oomfware/jsx';

import type { InvokerCommand } from '../utils/types.ts';

export interface MenuItemProps {
	type?: 'submit' | 'button';
	href?: string;
	disabled?: boolean;
	/** invoker command target element id */
	commandfor?: string;
	/** invoker command action */
	command?: InvokerCommand;
	class?: string;
	children?: JSXNode;
}

/**
 * menu item component, renders as a link when href is provided
 */
const MenuItem = (props: MenuItemProps) => {
	const { type = 'button', href, disabled, commandfor, command, class: className, children } = props;

	const classes = cn([
		'flex items-center gap-1 rounded-md px-2 py-1.5 text-left select-none',
		'text-base-300 text-neutral-foreground-2',
		'outline-2 -outline-offset-2 outline-transparent',
		'transition',
		'hover:bg-neutral-background-1-hover hover:text-neutral-foreground-2-hover',
		'focus-visible:outline-stroke-focus-2',
		'active:bg-neutral-background-1-active',

		className,
	]);

	if (href !== undefined) {
		return (
			<a href={href} class={classes}>
				{children}
			</a>
		);
	}

	return (
		<button type={type} disabled={disabled} commandfor={commandfor} command={command} class={classes}>
			{children}
		</button>
	);
};

export default MenuItem;
