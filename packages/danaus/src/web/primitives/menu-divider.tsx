import { cva } from 'cva';

const root = cva({
	base: ['-mx-1.25 my-1 w-auto border-b border-neutral-stroke-2'],
});

export interface MenuDividerProps {
	class?: string;
}

/**
 * horizontal divider for separating menu item groups
 */
const MenuDivider = (props: MenuDividerProps) => {
	const { class: className } = props;

	return <div role="separator" class={root({ className })} />;
};

export default MenuDivider;
