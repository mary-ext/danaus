import type { JSXNode } from '@oomfware/jsx';

import { useId } from '../components/id.tsx';
import CheckCircle2Solid from '../icons/central/check-circle-2-solid.tsx';
import ExclamationCircleSolid from '../icons/central/exclamation-circle-solid.tsx';
import ExclamationTriangleSolid from '../icons/central/exclamation-triangle-solid.tsx';

import Label from './label.tsx';
import { FieldContext, type ValidationStatus } from './utils/field-context.tsx';

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
		<FieldContext value={contextValue}>
			<div class={['block', className]}>
				<div class="flex flex-col gap-2">
					{(labelContent || descriptionContent) && (
						<div class="flex flex-col gap-1">
							{labelContent && <Label required={required}>{labelContent}</Label>}

							{descriptionContent && (
								<p id={descriptionId} class="text-base-300 wrap-break-word text-neutral-foreground-3">
									{descriptionContent}
								</p>
							)}
						</div>
					)}

					<div class="flex flex-col gap-2">
						{children}

						{hintContent && (
							<p id={hintId} class="text-base-200 text-neutral-foreground-3">
								{hintContent}
							</p>
						)}

						{validationMessageContent && effectiveStatus && (
							<p
								id={validationMessageId}
								role={effectiveStatus === 'error' ? 'alert' : undefined}
								class={[
									'flex gap-1 text-base-200',

									effectiveStatus === 'error' && 'text-status-danger-foreground-1',
									effectiveStatus === 'warning' && 'text-status-warning-foreground-3',
									effectiveStatus === 'success' && 'text-status-success-foreground-1',
									effectiveStatus === 'none' && 'text-neutral-foreground-3',
								]}
							>
								<span class="my-0.5 grid h-3 w-3 place-items-center">{renderValidationIcon()}</span>

								<span class={[effectiveStatus !== 'error' && 'text-neutral-foreground-3']}>
									{validationMessageContent}
								</span>
							</p>
						)}
					</div>
				</div>
			</div>
		</FieldContext>
	);
};

export default Field;
