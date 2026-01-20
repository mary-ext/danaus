import type { JSXNode } from '@oomfware/jsx';

import { useMessageBarContext } from './utils/context.tsx';

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

	return (
		<div
			class={[
				'flex items-center gap-3 pr-3',
				'[grid-area:secondaryActions]',
				layout === 'multiline' && 'mt-2 mb-1.5 justify-end',
			]}
		>
			{children}
		</div>
	);
};

export default MessageBarActions;
