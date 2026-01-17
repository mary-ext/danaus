import { cloneElement, type JSXElement } from '@oomfware/jsx';

import { useDialogContext } from './utils/context.tsx';

export interface DialogCloseProps {
	children: JSXElement;
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
