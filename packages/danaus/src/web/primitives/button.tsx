import { cva, type VariantProps } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: [
		'inline-flex appearance-none items-center justify-center gap-2 overflow-hidden align-middle select-none',
		'text-base-300 font-medium',
		'rounded-md border',
		'min-w-24 px-3 py-1.25',
		'outline-2 -outline-offset-2 outline-transparent',
		'transition duration-100 ease-fluent',
		'disabled:cursor-not-allowed',
	],
	variants: {
		variant: {
			default: [
				'border-neutral-stroke-1 bg-neutral-background-1 text-neutral-foreground-1',
				'hover:border-neutral-stroke-1-hover hover:bg-neutral-background-1-hover hover:text-neutral-foreground-1-hover',
				'active:border-neutral-stroke-1-active active:bg-neutral-background-1-active active:text-neutral-foreground-1-active',
				'focus-visible:outline-stroke-focus-2',
				'disabled:border-neutral-stroke-disabled disabled:bg-neutral-background-disabled disabled:text-neutral-foreground-disabled',
			],
			primary: [
				'border-transparent bg-brand-background text-neutral-foreground-on-brand',
				'hover:bg-brand-background-hover',
				'active:bg-brand-background-active',
				'focus-visible:outline-stroke-focus-2',
				'disabled:bg-neutral-background-disabled disabled:text-neutral-foreground-disabled',
			],
			outlined: [
				'border-neutral-stroke-1 text-neutral-foreground-1',
				'hover:border-neutral-stroke-1-hover',
				'active:border-neutral-stroke-1-active',
				'focus-visible:outline-stroke-focus-2',
				'disabled:border-neutral-stroke-disabled disabled:text-neutral-foreground-disabled',
			],
			subtle: [
				'border-transparent bg-subtle-background text-neutral-foreground-2',
				'hover:bg-subtle-background-hover hover:text-neutral-foreground-2-hover',
				'active:bg-subtle-background-active active:text-neutral-foreground-2-active',
				'focus-visible:outline-stroke-focus-2',
				'disabled:bg-transparent disabled:text-neutral-foreground-disabled',
			],
		},
	},
});

export interface ButtonProps extends VariantProps<typeof root> {
	type?: 'submit' | 'button';
	href?: string;
	disabled?: boolean;
	label?: string;
	/** invoker command target element id */
	commandfor?: string;
	/** invoker command action */
	command?: string;
	class?: string;
	children?: Child;
}

const Button = (props: ButtonProps) => {
	const {
		type = 'button',
		href,
		disabled,
		variant = 'default',
		label,
		commandfor,
		command,
		class: className,
		children,
	} = props;

	if (href !== undefined) {
		return (
			<a href={href} class={root({ variant, className })}>
				{children}
			</a>
		);
	}

	return (
		<button
			type={type}
			disabled={disabled}
			aria-label={label}
			commandfor={commandfor}
			command={command}
			class={root({ variant, className })}
		>
			{children}
		</button>
	);
};

export default Button;
