import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import CheckCircle2Solid from '../../icons/central/check-circle-2-solid.tsx';
import CircleInfoSolid from '../../icons/central/circle-info-solid.tsx';
import CircleXSolid from '../../icons/central/circle-x-solid.tsx';
import ExclamationTriangleSolid from '../../icons/central/exclamation-triangle-solid.tsx';

import {
	MessageBarContext,
	type MessageBarContextValue,
	type MessageBarIntent,
	type MessageBarLayout,
} from './utils/context.tsx';

const getIntentIcon = (intent: MessageBarIntent): JSXNode => {
	switch (intent) {
		case 'info':
			return <CircleInfoSolid size={20} />;
		case 'warning':
			return <ExclamationTriangleSolid size={20} />;
		case 'error':
			return <CircleXSolid size={20} />;
		case 'success':
			return <CheckCircle2Solid size={20} />;
	}
};

const root = cva({
	base: ['grid', 'min-h-9', 'rounded-md border pl-3'],
	variants: {
		intent: {
			info: 'border-neutral-stroke-1 bg-neutral-background-3',
			success: 'border-status-success-border-1 bg-status-success-background-1',
			warning: 'border-status-warning-border-1 bg-status-warning-background-1',
			error: 'border-status-danger-border-1 bg-status-danger-background-1',
		},
		layout: {
			singleline: [
				'items-center',
				'grid-cols-[auto_1fr_auto_auto]',
				'[grid-template-areas:"icon_body_secondaryActions_actions"]',
			],
			multiline: [
				'items-start py-2',
				'grid-cols-[auto_1fr_auto]',
				'[grid-template-areas:"icon_body_actions"_"secondaryActions_secondaryActions_secondaryActions"]',
			],
		},
	},
});

const iconStyle = cva({
	base: ['mr-2', 'flex items-center', 'text-base-500'],
	variants: {
		intent: {
			info: 'text-neutral-foreground-3',
			success: 'text-status-success-foreground-1',
			warning: 'text-status-warning-foreground-3',
			error: 'text-status-danger-foreground-1',
		},
	},
});

export interface MessageBarProps {
	/**
	 * intent of the message bar
	 * @default 'info'
	 */
	intent?: MessageBarIntent;
	/** layout of the message bar */
	layout: MessageBarLayout;
	/** optional icon to display */
	icon?: JSXNode;
	class?: string;
	children?: JSXNode;
}

/**
 * message bar component for displaying inline messages
 * @param props.intent the intent/severity of the message
 * @param props.layout the layout of the message bar
 * @param props.icon optional icon to display
 * @param props.class additional CSS classes
 */
const MessageBar = (props: MessageBarProps) => {
	const { intent = 'info', layout, icon, class: className, children } = props;

	const contextValue: MessageBarContextValue = { intent, layout };
	const renderedIcon = icon ?? getIntentIcon(intent);

	return (
		<MessageBarContext.Provider value={contextValue}>
			<div role="group" aria-live="polite" class={root({ intent, layout, className })}>
				<span class={iconStyle({ intent })}>{renderedIcon}</span>

				{children}
			</div>
		</MessageBarContext.Provider>
	);
};

export default MessageBar;
