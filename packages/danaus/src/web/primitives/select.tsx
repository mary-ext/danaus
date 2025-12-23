import { cva } from 'cva';

import ChevronDownMediumOutlined from '../icons/central/chevron-down-medium-outlined.tsx';

import { useFieldContext } from './utils/field-context.tsx';

const root = cva({
	base: [
		'relative inline-flex flex-nowrap items-center overflow-hidden',
		'transition duration-100',
		'box-border',
		'outline-2 -outline-offset-2 outline-transparent',
		'border border-neutral-stroke-1',
		'rounded-md',
		'bg-neutral-background-1',
		'h-8 min-w-0',
		'text-base-300 text-neutral-foreground-1',
		// enabled states
		'group-not-disabled/select:hover:border-neutral-stroke-1-hover',
		'group-not-disabled/select:active:border-neutral-stroke-1-active',
		'group-not-disabled/select:has-focus-visible:outline-compound-brand-stroke',
		// disabled states
		'group-disabled/select:border-neutral-stroke-disabled group-disabled/select:bg-transparent group-disabled/select:text-neutral-foreground-disabled',
	],
});

const select = cva({
	base: [
		'appearance-none',
		'h-full grow',
		'box-border',
		'border-none outline-none',
		'bg-neutral-background-1',
		'pr-8 pl-2.5',
		'min-w-0',
		'cursor-pointer',
		'text-neutral-foreground-1',
		'group-disabled/select:cursor-not-allowed group-disabled/select:bg-transparent',
	],
});

const icon = cva({
	base: [
		'absolute right-2.5',
		'pointer-events-none',
		'text-neutral-stroke-accessible',
		'group-disabled/select:text-neutral-foreground-disabled',
	],
});

export interface SelectOption<T extends string = string> {
	value: T;
	label: string;
	disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
	name?: string;
	value?: T;
	disabled?: boolean;
	required?: boolean;
	options: SelectOption<T>[];
	class?: string;
}

const Select = <T extends string = string>(props: SelectProps<T>) => {
	const { name, value, disabled = false, required, options, class: className } = props;

	const fieldContext = useFieldContext(null);

	const selectId = fieldContext?.inputId;
	const ariaDescribedBy = fieldContext
		? `${fieldContext.descriptionId} ${fieldContext.hintId} ${fieldContext.validationMessageId}`
		: undefined;

	return (
		<fieldset disabled={disabled} class="group/select contents">
			<span class={root({ className })}>
				<select
					id={selectId}
					name={name}
					value={value}
					required={required ?? fieldContext?.required}
					aria-describedby={ariaDescribedBy}
					aria-invalid={fieldContext?.validationStatus === 'error' ? true : undefined}
					class={select()}
				>
					{options.map((opt) => (
						<option value={opt.value} disabled={opt.disabled}>
							{opt.label}
						</option>
					))}
				</select>

				<span class={icon()}>
					<ChevronDownMediumOutlined size={16} />
				</span>
			</span>
		</fieldset>
	);
};

export default Select;
