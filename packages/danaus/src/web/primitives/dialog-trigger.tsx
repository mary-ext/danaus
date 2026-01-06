import { cloneElement } from 'hono/jsx';
import type { JSX } from 'hono/jsx/jsx-runtime';

import { useDialogContext } from './utils/dialog-context.tsx';

export interface DialogTriggerProps {
	children: JSX.Element;
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
