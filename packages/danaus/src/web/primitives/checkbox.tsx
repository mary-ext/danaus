import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useId } from '../components/id.tsx';
import CheckmarkIcon from '../icons/central/checkmark-1-solid.tsx';

import { useFieldContext } from './utils/field-context.tsx';

const root = cva({
	base: [
		'group/checkbox relative inline-flex max-w-fit cursor-pointer align-middle select-none',
		'has-focus-visible:rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-stroke-focus-2',
		// unchecked text
		'text-neutral-foreground-3',
		'hover:text-neutral-foreground-2',
		'active:text-neutral-foreground-1',
		// checked text
		'has-checked:text-neutral-foreground-1',
		// disabled
		'has-disabled:cursor-default has-disabled:text-neutral-foreground-disabled',
	],
});

const input = cva({
	base: 'peer absolute top-0 m-0 h-8 w-8 cursor-pointer opacity-0',
	variants: {
		labelPosition: {
			before: 'right-0',
			after: 'left-0',
		},
	},
});

const indicator = cva({
	base: [
		'flex shrink-0 items-center justify-center self-start',
		'pointer-events-none m-2 h-4 w-4 overflow-hidden rounded-sm border',
	],
	variants: {
		variant: {
			unchecked: [
				'peer-checked:hidden',
				'border-neutral-stroke-accessible',
				'group-hover/checkbox:border-neutral-stroke-accessible-hover',
				'group-active/checkbox:border-neutral-stroke-accessible-active',
				// disabled
				'peer-disabled:border-neutral-stroke-disabled',
			],
			checked: [
				'hidden peer-checked:flex',
				'border-compound-brand-background bg-compound-brand-background text-neutral-foreground-inverted',
				'group-hover/checkbox:border-compound-brand-background-hover group-hover/checkbox:bg-compound-brand-background-hover',
				'group-active/checkbox:border-compound-brand-background-active group-active/checkbox:bg-compound-brand-background-active',
				// disabled
				'peer-disabled:border-neutral-stroke-disabled peer-disabled:bg-transparent peer-disabled:text-neutral-foreground-disabled',
			],
		},
	},
});

const label = cva({
	base: '-my-0.5 self-center p-2 text-base-300',
	variants: {
		labelPosition: {
			before: 'pr-1',
			after: 'pl-1',
		},
	},
});

export interface CheckboxProps {
	name?: string;
	value?: string;
	checked?: boolean;
	disabled?: boolean;
	labelPosition?: 'before' | 'after';
	class?: string;
	children?: Child;
}

const Checkbox = (props: CheckboxProps) => {
	const {
		name,
		value,
		checked = false,
		disabled = false,
		labelPosition = 'after',
		class: className,
		children,
	} = props;

	const fieldContext = useFieldContext(null);

	const inputId = useId();
	const fallbackName = useId();

	const ariaDescribedBy = fieldContext
		? `${fieldContext.descriptionId} ${fieldContext.hintId} ${fieldContext.validationMessageId}`
		: undefined;

	return (
		<span class={root({ className })}>
			<input
				type="checkbox"
				id={inputId}
				name={name ?? fallbackName}
				value={value}
				checked={checked}
				disabled={disabled}
				aria-describedby={ariaDescribedBy}
				aria-invalid={fieldContext?.validationStatus === 'error' ? true : undefined}
				class={input({ labelPosition })}
			/>

			{labelPosition === 'before' && children && (
				<label for={inputId} class={label({ labelPosition })}>
					{children}
				</label>
			)}

			<span class={indicator({ variant: 'unchecked' })} />
			<span class={indicator({ variant: 'checked' })}>
				<CheckmarkIcon size={12} />
			</span>

			{labelPosition === 'after' && children && (
				<label for={inputId} class={label({ labelPosition })}>
					{children}
				</label>
			)}
		</span>
	);
};

export default Checkbox;
