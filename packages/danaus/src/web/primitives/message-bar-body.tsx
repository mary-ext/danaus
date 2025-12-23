import { cva } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: ['pr-3', 'text-base-300'],
});

export interface MessageBarBodyProps {
	class?: string;
	children?: Child;
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
