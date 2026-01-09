import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: ['mr-1', 'text-base-300 font-semibold'],
});

export interface MessageBarTitleProps {
	class?: string;
	children?: JSXNode;
}

/**
 * title component for message bar, renders inline before body text
 * @param props.class additional CSS classes
 */
const MessageBarTitle = (props: MessageBarTitleProps) => {
	const { class: className, children } = props;

	return <span class={root({ className })}>{children}</span>;
};

export default MessageBarTitle;
