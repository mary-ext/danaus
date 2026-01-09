import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import { useId } from '../components/id.tsx';

import { useRadioGroupContext } from './radio-group.tsx';

const root = cva({
	base: [
		'group/radio relative inline-flex select-none',
		'has-focus-visible:rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-stroke-focus-2',
	],
});

const input = cva({
	base: 'peer absolute top-0 left-0 m-0 h-full w-8 cursor-pointer opacity-0 disabled:cursor-default',
});

const indicator = cva({
	base: [
		'relative flex shrink-0 items-center justify-center',
		'pointer-events-none m-2 h-4 w-4 overflow-hidden rounded-full border',
	],
	variants: {
		variant: {
			unchecked: [
				'peer-checked:hidden',
				'border-neutral-stroke-accessible',
				'group-hover/radio:border-neutral-stroke-accessible-hover',
				'group-active/radio:border-neutral-stroke-accessible-active',
				// disabled
				'peer-disabled:border-neutral-stroke-disabled',
			],
			checked: [
				'hidden peer-checked:flex',
				'border-compound-brand-stroke text-compound-brand-foreground-1',
				'group-hover/radio:border-compound-brand-stroke-hover group-hover/radio:text-compound-brand-foreground-1-hover',
				'group-active/radio:border-compound-brand-stroke-active group-active/radio:text-compound-brand-foreground-1-active',
				// disabled
				'peer-disabled:border-neutral-stroke-disabled peer-disabled:text-neutral-foreground-disabled',
			],
		},
	},
});

const dot = cva({
	base: 'h-2.5 w-2.5 rounded-full bg-current',
});

const label = cva({
	base: [
		'-my-0.5 self-center p-2 pl-1 text-base-300',
		// unchecked
		'cursor-pointer text-neutral-foreground-3',
		'group-hover/radio:text-neutral-foreground-2',
		'group-active/radio:text-neutral-foreground-1',
		// checked
		'peer-checked:text-neutral-foreground-1',
		// disabled
		'peer-disabled:cursor-default peer-disabled:text-neutral-foreground-disabled',
	],
});

export interface RadioProps {
	value: string;
	disabled?: boolean;
	class?: string;
	children?: JSXNode;
}

const Radio = (props: RadioProps) => {
	const { value, disabled: disabledProp = false, class: className, children } = props;

	const inputId = useId();
	const context = useRadioGroupContext();

	const isDisabled = disabledProp || context.disabled;
	const isChecked = context.value === value;
	const shouldAutofocus = context.consumeAutofocus();

	return (
		<span class={root({ className })}>
			<input
				type="radio"
				id={inputId}
				name={context.name}
				value={value}
				checked={isChecked}
				disabled={isDisabled}
				autofocus={shouldAutofocus}
				class={input()}
			/>

			<span class={indicator({ variant: 'unchecked' })} />
			<span class={indicator({ variant: 'checked' })}>
				<span class={dot()} />
			</span>

			{children && (
				<label for={inputId} class={label()}>
					{children}
				</label>
			)}
		</span>
	);
};

export default Radio;
