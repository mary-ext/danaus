import { createContext, use, type JSXNode } from '@oomfware/jsx';

export interface IdContextValue {
	count: number;
}

export const IdContext = createContext<IdContextValue | null>(null);

export const useId = (): string => {
	const context = use(IdContext);
	if (context === null) {
		throw new Error(`expected useId() to be used under <IdProvider>`);
	}

	return `:${context.count++}:`;
};

export interface IdProviderProps {
	children?: JSXNode;
}

export const IdProvider = (props: IdProviderProps) => {
	return <IdContext.Provider value={{ count: 0 }}>{props.children}</IdContext.Provider>;
};
