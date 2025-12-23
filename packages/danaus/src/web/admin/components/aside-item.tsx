import { cva } from 'cva';
import type { Child } from 'hono/jsx';
import { useRequestContext } from 'hono/jsx-renderer';

const root = cva({
	base: [
		'relative ml-2 flex gap-2 rounded-md px-2 py-2',
		'text-base-300 font-medium text-neutral-foreground-2 no-underline',
		'outline-2 -outline-offset-2 outline-transparent',
		'transition duration-100 ease-fluent',
		'hover:bg-subtle-background-hover',
		'active:bg-subtle-background-active',
		'focus-visible:z-10 focus-visible:outline-stroke-focus-2',
	],
});

const indicator = cva({
	base: 'absolute -left-1.5 h-5 w-1 rounded-md bg-compound-brand-background',
});

export interface AsideItemProps {
	href: string;
	/** whether to match the path exactly (default: false) */
	exact?: boolean;
	icon?: Child;
	children?: Child;
}

/**
 * navigation item for the admin sidebar
 * @param props.href the path to link to
 * @param props.exact whether to match the path exactly
 * @param props.icon optional icon to display
 */
const AsideItem = (props: AsideItemProps) => {
	const { href, exact = false, icon, children } = props;

	const c = useRequestContext();
	const currentPath = c.req.path;
	const isActive = exact ? currentPath === href : currentPath.startsWith(href);

	return (
		<a href={href} class={root()} aria-current={isActive}>
			{isActive && <span class={indicator()} />}

			{icon !== undefined && <span class="grid size-5 place-items-center text-[20px]">{icon}</span>}

			{children}
		</a>
	);
};

export default AsideItem;
