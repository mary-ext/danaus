import { createContext, useContext } from 'hono/jsx';

export interface MenuContextValue {
	menuId: string;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

/**
 * returns the menu context, or null if not within a menu
 * @param fallback value to return if not within a menu
 */
export const useMenuContext: {
	(fallback: null): MenuContextValue | null;
	(fallback?: MenuContextValue): MenuContextValue;
} = (fallback?: MenuContextValue | null): any => {
	const context = useContext(MenuContext);
	if (context === null) {
		if (fallback !== undefined) {
			return fallback;
		}

		throw new Error(`expected useMenuContext() to be used under <Menu>`);
	}

	return context;
};
