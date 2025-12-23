import { createContext, useContext } from 'hono/jsx';

export type MessageBarIntent = 'info' | 'success' | 'warning' | 'error';
export type MessageBarLayout = 'singleline' | 'multiline';

export interface MessageBarContextValue {
	intent: MessageBarIntent;
	layout: MessageBarLayout;
}

export const MessageBarContext = createContext<MessageBarContextValue | null>(null);

/**
 * returns the message bar context, or null if not within a message bar
 * @param fallback value to return if not within a message bar
 */
export const useMessageBarContext: {
	(fallback: null): MessageBarContextValue | null;
	(fallback?: MessageBarContextValue): MessageBarContextValue;
} = (fallback?: MessageBarContextValue | null): any => {
	const context = useContext(MessageBarContext);
	if (context === null) {
		if (fallback !== undefined) {
			return fallback;
		}

		throw new Error(`expected useMessageBarContext() to be used under <MessageBar>`);
	}

	return context;
};
