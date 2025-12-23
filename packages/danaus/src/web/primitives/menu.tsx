import { useId, type Child } from 'hono/jsx';

import { MenuContext, type MenuContextValue } from './utils/menu-context.tsx';

export interface MenuProps {
	id?: string;
	children?: Child;
}

/**
 * menu context provider for coordinating trigger and popover,
 * sets the --anchor CSS variable for anchor positioning
 * @param props.id unique identifier for invoker command targeting
 */
const Menu = (props: MenuProps) => {
	const { id = useId(), children } = props;

	const contextValue: MenuContextValue = {
		menuId: id,
	};

	return (
		<MenuContext.Provider value={contextValue}>
			<div class="contents" style={{ '--anchor': `--menu-${id}` }}>
				{children}
			</div>
		</MenuContext.Provider>
	);
};

export default Menu;
