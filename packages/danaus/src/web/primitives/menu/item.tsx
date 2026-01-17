import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import type { InvokerCommand } from '../utils/types.ts';

const root = cva({
	base: [
		'flex items-center gap-1 rounded-md px-2 py-1.5 text-left select-none',
		'text-base-300 text-neutral-foreground-2',
		'outline-2 -outline-offset-2 outline-transparent',
		'transition',
		'hover:bg-neutral-background-1-hover hover:text-neutral-foreground-2-hover',
		'focus-visible:outline-stroke-focus-2',
		'active:bg-neutral-background-1-active',
	],
});

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

	if (href !== undefined) {
		return (
			<a href={href} class={root({ className })}>
				{children}
			</a>
		);
	}

	return (
		<button
			type={type}
			disabled={disabled}
			commandfor={commandfor}
			command={command}
			class={root({ className })}
		>
			{children}
		</button>
	);
};

export default MenuItem;
