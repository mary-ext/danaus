import { createContext, use } from '@oomfware/jsx';

export interface DialogContextValue {
	dialogId: string;
	titleId: string;
}

export const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * returns the dialog context, or null if not within a dialog
 * @param fallback value to return if not within a dialog
 */
export const useDialogContext: {
	(fallback: null): DialogContextValue | null;
	(fallback?: DialogContextValue): DialogContextValue;
} = (fallback?: DialogContextValue | null): any => {
	const context = use(DialogContext);
	if (context === null) {
		if (fallback !== undefined) {
			return fallback;
		}

		throw new Error(`expected useDialogContext() to be used under <Dialog>`);
	}

	return context;
};
