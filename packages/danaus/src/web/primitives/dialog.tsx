import type { Child } from 'hono/jsx';

import { useId } from '../components/id.tsx';

import { DialogContext, type DialogContextValue } from './utils/dialog-context.tsx';

export interface DialogProps {
	id?: string;
	children?: Child;
}

/**
 * dialog root component wrapping native `<dialog>` element
 * @param props.id unique identifier for invoker command targeting
 * @param props.class additional CSS classes
 */
const Dialog = (props: DialogProps) => {
	const { id = useId(), children } = props;

	const contextValue: DialogContextValue = {
		dialogId: id,
		titleId: useId(),
	};

	return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
};

export default Dialog;
