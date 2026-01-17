import { cloneElement, type JSXElement } from '@oomfware/jsx';

import { useDialogContext } from './utils/context.tsx';

export interface DialogTriggerProps {
	children: JSXElement;
}

const DialogTrigger = (props: DialogTriggerProps) => {
	const { children } = props;
	const { dialogId } = useDialogContext();

	return cloneElement(children, {
		commandfor: dialogId,
		command: 'show-modal',
	});
};

export default DialogTrigger;
