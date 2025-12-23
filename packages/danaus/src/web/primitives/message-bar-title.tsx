import { cva } from 'cva';
import type { Child } from 'hono/jsx';

const root = cva({
	base: ['mr-1', 'text-base-300 font-semibold'],
});

export interface MessageBarTitleProps {
	class?: string;
	children?: Child;
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
