import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import { useFieldContext } from './utils/field-context.tsx';

const root = cva({
	base: [
		'relative inline-flex flex-nowrap align-middle',
		'gap-0.5',
		'transition duration-100',
		'box-border',
		'outline-2 -outline-offset-2 outline-transparent',
		'border border-neutral-stroke-1',
		'rounded-md',
		'bg-neutral-background-1',
		'h-8 min-w-0',
		'text-base-300 text-neutral-foreground-1',
		// enabled states
		'group-not-disabled/input:hover:border-neutral-stroke-1-hover',
		'group-not-disabled/input:active:border-neutral-stroke-1-active',
		'group-not-disabled/input:has-focus-visible:outline-compound-brand-stroke',
		// disabled states
		'group-disabled/input:border-neutral-stroke-disabled group-disabled/input:bg-transparent group-disabled/input:text-neutral-foreground-disabled',
	],
	variants: {
		hasContentBefore: {
			true: 'pl-2.5',
		},
		hasContentAfter: {
			true: 'pr-2.5',
		},
	},
});

const input = cva({
	base: [
		'h-full grow',
		'box-border',
		'border-none outline-none',
		'bg-transparent',
		'px-2.5',
		'min-w-0',
		'text-current',
		'placeholder:text-neutral-foreground-3 placeholder:opacity-100',
		'group-disabled/input:placeholder:text-current',
	],
	variants: {
		hasContentBefore: {
			true: 'pl-2',
		},
		hasContentAfter: {
			true: 'pr-2',
		},
	},
});

const content = cva({
	base: 'box-border flex items-center text-neutral-foreground-3',
});

export interface InputProps {
	type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
	name?: string;
	value?: string;
	placeholder?: string;
	disabled?: boolean;
	autofocus?: boolean;
	autocomplete?: string;
	required?: boolean;
	contentBefore?: JSXNode;
	contentAfter?: JSXNode;
	class?: string;
}

const Input = (props: InputProps) => {
	const {
		type = 'text',
		name,
		value,
		placeholder,
		disabled = false,
		autofocus = false,
		autocomplete,
		required,
		contentBefore,
		contentAfter,
		class: className,
	} = props;

	const fieldContext = useFieldContext(null);

	const inputId = fieldContext?.inputId;
	const ariaDescribedBy = fieldContext
		? `${fieldContext.descriptionId} ${fieldContext.hintId} ${fieldContext.validationMessageId}`
		: undefined;

	const hasContentBefore = !!contentBefore;
	const hasContentAfter = !!contentAfter;

	return (
		<fieldset disabled={disabled} class="group/input contents">
			<span class={root({ hasContentBefore, hasContentAfter, className })}>
				{contentBefore && <span class={content()}>{contentBefore}</span>}

				<input
					id={inputId}
					type={type}
					name={name}
					value={value}
					placeholder={placeholder}
					autofocus={autofocus}
					autocomplete={autocomplete}
					required={required ?? fieldContext?.required}
					aria-describedby={ariaDescribedBy}
					aria-invalid={fieldContext?.validationStatus === 'error' ? true : undefined}
					class={input({ hasContentBefore, hasContentAfter })}
				/>

				{contentAfter && <span class={content()}>{contentAfter}</span>}
			</span>
		</fieldset>
	);
};

export default Input;
