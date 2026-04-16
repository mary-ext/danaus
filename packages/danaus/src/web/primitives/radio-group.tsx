import { createContext, use, type JSXNode } from '@oomfware/jsx';

import { useId } from '../components/id.tsx';

export interface RadioGroupContextValue {
	name: string;
	value?: string;
	disabled: boolean;
	autofocus: boolean;
	consumeAutofocus: () => boolean;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export const useRadioGroupContext = () => {
	const context = use(RadioGroupContext);
	if (context === null) {
		throw new Error('<Radio> must be used under <RadioGroup>');
	}

	return context;
};

export interface RadioGroupProps {
	name?: string;
	value?: string;
	disabled?: boolean;
	autofocus?: boolean;
	class?: string;
	children?: JSXNode;
}

const RadioGroup = (props: RadioGroupProps) => {
	const { name, value, disabled = false, autofocus = false, class: className, children } = props;

	const fallbackName = useId();
	let autofocusConsumed = false;

	const contextValue: RadioGroupContextValue = {
		name: name ?? fallbackName,
		value,
		disabled,
		autofocus,
		consumeAutofocus: () => {
			if (autofocus && !autofocusConsumed) {
				autofocusConsumed = true;
				return true;
			}
			return false;
		},
	};

	return (
		<RadioGroupContext value={contextValue}>
			<fieldset class={`flex flex-col items-start ${className ?? ''}`}>{children}</fieldset>
		</RadioGroupContext>
	);
};

export default RadioGroup;
