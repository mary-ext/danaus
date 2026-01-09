import { createContext, use } from '@oomfware/jsx';

export type ValidationStatus = 'error' | 'warning' | 'success' | 'none';

export interface FieldContextValue {
	inputId: string;
	descriptionId: string;
	hintId: string;
	validationMessageId: string;
	required: boolean;
	validationStatus?: ValidationStatus;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export const useFieldContext: {
	(fallback: null): FieldContextValue | null;
	(fallback?: FieldContextValue): FieldContextValue;
} = (fallback?: FieldContextValue | null): any => {
	const context = use(FieldContext);
	if (context === null) {
		if (fallback !== undefined) {
			return fallback;
		}

		throw new Error(`expected useFieldContext() to be used under <Field>`);
	}

	return context;
};
