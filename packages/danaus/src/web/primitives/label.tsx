import type { JSXNode } from '@oomfware/jsx';

import { useFieldContext } from './utils/field-context.tsx';

export interface LabelProps {
	for?: string;
	required?: boolean;
	class?: string;
	children?: JSXNode;
}

const Label = (props: LabelProps) => {
	const { for: forProp, required, class: className, children } = props;

	const fieldContext = useFieldContext(null);
	const htmlFor = forProp ?? fieldContext?.inputId;

	return (
		<label for={htmlFor} class={['text-base-300 font-medium text-neutral-foreground-1', className]}>
			{children}

			{required && (
				<>
					<span class="pl-1 text-status-danger-foreground-1" aria-hidden="true">
						*
					</span>
					<span class="sr-only">(required)</span>
				</>
			)}
		</label>
	);
};

export default Label;
