import type { JSXNode } from '@oomfware/jsx';

import { useFieldContext } from './utils/field-context.tsx';

export interface InputProps {
	type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
	name?: string;
	value?: string;
	placeholder?: string;
	disabled?: boolean;
	autofocus?: boolean;
	autocomplete?: string;
	inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
	pattern?: string;
	minlength?: number;
	maxlength?: number;
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
		inputmode,
		pattern,
		minlength,
		maxlength,
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
			<span
				class={[
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

					hasContentBefore && 'pl-2.5',
					hasContentAfter && 'pr-2.5',

					className,
				]}
			>
				{contentBefore && (
					<span class="box-border flex items-center text-neutral-foreground-3">{contentBefore}</span>
				)}

				<input
					id={inputId}
					type={type}
					name={name}
					value={value}
					placeholder={placeholder}
					autofocus={autofocus}
					autocomplete={autocomplete}
					inputmode={inputmode}
					pattern={pattern}
					minlength={minlength}
					maxlength={maxlength}
					required={required ?? fieldContext?.required}
					aria-describedby={ariaDescribedBy}
					aria-invalid={fieldContext?.validationStatus === 'error' ? true : undefined}
					class={[
						'h-full grow',
						'box-border',
						'border-none outline-none',
						'bg-transparent',
						'px-2.5',
						'min-w-0',
						'text-current',
						'placeholder:text-neutral-foreground-3 placeholder:opacity-100',
						'group-disabled/input:placeholder:text-current',

						hasContentBefore && 'pl-2',
						hasContentAfter && 'pr-2',
					]}
				/>

				{contentAfter && (
					<span class="box-border flex items-center text-neutral-foreground-3">{contentAfter}</span>
				)}
			</span>
		</fieldset>
	);
};

export default Input;
