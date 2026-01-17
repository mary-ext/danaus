import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

const root = cva({
	base: ['pr-3', 'text-base-300'],
});

export interface MessageBarBodyProps {
	class?: string;
	children?: JSXNode;
}

/**
 * body content container for message bar
 * @param props.class additional CSS classes
 */
const MessageBarBody = (props: MessageBarBodyProps) => {
	const { class: className, children } = props;

	return <span class={root({ className })}>{children}</span>;
};

export default MessageBarBody;
