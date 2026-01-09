import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import { useMessageBarContext } from './utils/message-bar-context.tsx';

const root = cva({
	base: ['flex items-center gap-3 pr-3', '[grid-area:secondaryActions]'],
	variants: {
		layout: {
			singleline: [],
			multiline: ['mt-2 mb-1.5 justify-end'],
		},
	},
});

export interface MessageBarActionsProps {
	class?: string;
	children?: JSXNode;
}

/**
 * actions container for message bar buttons
 * @param props.class additional CSS classes
 */
const MessageBarActions = (props: MessageBarActionsProps) => {
	const { class: className, children } = props;
	const { layout } = useMessageBarContext();

	return <div class={root({ layout, className })}>{children}</div>;
};

export default MessageBarActions;
