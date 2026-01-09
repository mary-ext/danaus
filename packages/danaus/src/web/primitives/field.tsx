import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import { useId } from '../components/id.tsx';
import CheckCircle2Solid from '../icons/central/check-circle-2-solid.tsx';
import ExclamationCircleSolid from '../icons/central/exclamation-circle-solid.tsx';
import ExclamationTriangleSolid from '../icons/central/exclamation-triangle-solid.tsx';

import Label from './label.tsx';
import { FieldContext, type ValidationStatus } from './utils/field-context.tsx';

const root = cva({
	base: 'block',
});

const inner = cva({
	base: 'flex flex-col gap-2',
});

const header = cva({
	base: 'flex flex-col gap-1',
});

const description = cva({
	base: 'text-base-300 wrap-break-word text-neutral-foreground-3',
});

const control = cva({
	base: 'flex flex-col gap-2',
});

const hint = cva({
	base: 'text-base-200 text-neutral-foreground-3',
});

const validationMessage = cva({
	base: 'flex gap-1 text-base-200',
	variants: {
		status: {
			error: 'text-status-danger-foreground-1',
			warning: 'text-status-warning-foreground-3',
			success: 'text-status-success-foreground-1',
			none: 'text-neutral-foreground-3',
		},
	},
});

const validationMessageIcon = cva({
	base: 'my-0.5 grid h-3 w-3 place-items-center',
});

const validationMessageText = cva({
	base: '',
	variants: {
		muted: {
			true: 'text-neutral-foreground-3',
		},
	},
});

export interface FieldProps {
	required?: boolean;
	validationStatus?: ValidationStatus;
	label?: JSXNode;
	description?: JSXNode;
	hint?: JSXNode;
	validationMessageText?: JSXNode;
	validationMessageIcon?: JSXNode;
	class?: string;
	children?: JSXNode;
}

const Field = (props: FieldProps) => {
	const {
		required = false,
		validationStatus: validationStatusProp,
		label: labelContent,
		description: descriptionContent,
		hint: hintContent,
		validationMessageText: validationMessageContent,
		validationMessageIcon: validationMessageIconContent,
		class: className,
		children,
	} = props;

	const inputId = useId();
	const descriptionId = useId();
	const hintId = useId();
	const validationMessageId = useId();

	const effectiveStatus: ValidationStatus | undefined =
		validationStatusProp !== undefined
			? validationStatusProp
			: validationMessageContent
				? 'error'
				: undefined;

	const contextValue = {
		inputId,
		descriptionId,
		hintId,
		validationMessageId,
		required,
		validationStatus: effectiveStatus,
	};

	const renderValidationIcon = () => {
		if (validationMessageIconContent) {
			return validationMessageIconContent;
		}
		if (effectiveStatus === 'error') {
			return <ExclamationCircleSolid size={12} />;
		}
		if (effectiveStatus === 'warning') {
			return <ExclamationTriangleSolid size={12} />;
		}
		if (effectiveStatus === 'success') {
			return <CheckCircle2Solid size={12} />;
		}
		return null;
	};

	return (
		<FieldContext.Provider value={contextValue}>
			<div class={root({ className })}>
				<div class={inner()}>
					{(labelContent || descriptionContent) && (
						<div class={header()}>
							{labelContent && <Label required={required}>{labelContent}</Label>}

							{descriptionContent && (
								<p id={descriptionId} class={description()}>
									{descriptionContent}
								</p>
							)}
						</div>
					)}

					<div class={control()}>
						{children}

						{hintContent && (
							<p id={hintId} class={hint()}>
								{hintContent}
							</p>
						)}

						{validationMessageContent && effectiveStatus && (
							<p
								id={validationMessageId}
								role={effectiveStatus === 'error' ? 'alert' : undefined}
								class={validationMessage({ status: effectiveStatus })}
							>
								<span class={validationMessageIcon()}>{renderValidationIcon()}</span>

								<span class={validationMessageText({ muted: effectiveStatus !== 'error' })}>
									{validationMessageContent}
								</span>
							</p>
						)}
					</div>
				</div>
			</div>
		</FieldContext.Provider>
	);
};

export default Field;
