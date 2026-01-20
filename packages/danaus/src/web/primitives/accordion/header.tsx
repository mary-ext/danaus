import type { JSXNode } from '@oomfware/jsx';

import ChevronDownSmallOutlined from '../../icons/central/chevron-down-small-outlined.tsx';

export interface AccordionHeaderProps {
	size?: 'small' | 'medium' | 'large' | 'extra-large';
	expandIconPosition?: 'start' | 'end';
	/** slot for custom icon before the text */
	icon?: JSXNode;
	class?: string;
	children?: JSXNode;
}

/**
 * accordion header component using native `<summary>` element
 */
const AccordionHeader = (props: AccordionHeaderProps) => {
	const { size = 'medium', expandIconPosition = 'start', icon, class: className, children } = props;

	return (
		<summary
			class={[
				'flex w-full cursor-pointer list-none items-center',
				'm-0 rounded-md border-0',
				'bg-transparent text-neutral-foreground-1',
				'outline-2 -outline-offset-2 outline-transparent',
				'focus-visible:outline-stroke-focus-2',
				// hide default marker
				'[&::-webkit-details-marker]:hidden',

				size === 'small' && 'min-h-8 text-base-200',
				size === 'medium' && 'min-h-11 text-base-300',
				size === 'large' && 'min-h-11 text-base-400',
				size === 'extra-large' && 'min-h-11 text-base-500',

				expandIconPosition === 'start' && 'pr-3 pl-2.5',
				expandIconPosition === 'end' && 'pr-2.5 pl-3',

				className,
			]}
		>
			{expandIconPosition === 'start' && (
				<span class={['flex shrink-0 items-center', 'leading-base-500 text-base-500', 'pr-2']}>
					<ChevronDownSmallOutlined size={20} />
				</span>
			)}

			{icon && <span class="leading-base-500 flex shrink-0 items-center pr-2 text-base-500">{icon}</span>}

			{children}

			{expandIconPosition === 'end' && (
				<span
					class={[
						'flex shrink-0 items-center',
						'leading-base-500 text-base-500',
						'shrink grow basis-0 justify-end pl-2',
					]}
				>
					<ChevronDownSmallOutlined size={20} />
				</span>
			)}
		</summary>
	);
};

export default AccordionHeader;
