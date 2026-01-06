import { cloneElement } from 'hono/jsx';
import type { JSX } from 'hono/jsx/jsx-runtime';

import { useDialogContext } from './utils/dialog-context.tsx';

export interface DialogCloseProps {
	children: JSX.Element;
}

const DialogClose = (props: DialogCloseProps) => {
	const { children } = props;
	const { dialogId } = useDialogContext();

	return cloneElement(children, {
		commandfor: dialogId,
		command: 'close',
	});
};

export default DialogClose;
