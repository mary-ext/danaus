import { cva } from 'cva';
import type { Child } from 'hono/jsx';

import { useFieldContext } from './utils/field-context.tsx';

const root = cva({
	base: 'text-base-300 font-medium text-neutral-foreground-1',
});

const requiredIndicator = cva({
	base: 'pl-1 text-status-danger-foreground-1',
});

export interface LabelProps {
	for?: string;
	required?: boolean;
	class?: string;
	children?: Child;
}

const Label = (props: LabelProps) => {
	const { for: forProp, required, class: className, children } = props;

	const fieldContext = useFieldContext(null);
	const htmlFor = forProp ?? fieldContext?.inputId;

	return (
		<label for={htmlFor} class={root({ className })}>
			{children}

			{required && (
				<>
					<span class={requiredIndicator()} aria-hidden="true">
						*
					</span>
					<span class="sr-only">(required)</span>
				</>
			)}
		</label>
	);
};

export default Label;
