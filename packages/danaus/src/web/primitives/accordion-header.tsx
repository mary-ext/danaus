import type { JSXNode } from '@oomfware/jsx';

import { cva } from 'cva';

import ChevronDownSmallOutlined from '../icons/central/chevron-down-small-outlined.tsx';

const root = cva({
	base: [
		'flex w-full cursor-pointer list-none items-center',
		'm-0 rounded-md border-0',
		'bg-transparent text-neutral-foreground-1',
		'outline-2 -outline-offset-2 outline-transparent',
		'focus-visible:outline-stroke-focus-2',
		// hide default marker
		'[&::-webkit-details-marker]:hidden',
	],
	variants: {
		size: {
			small: 'min-h-8 text-base-200',
			medium: 'min-h-11 text-base-300',
			large: 'min-h-11 text-base-400',
			'extra-large': 'min-h-11 text-base-500',
		},
		expandIconPosition: {
			// padding: 0 12px 0 10px
			start: 'pr-3 pl-2.5',
			// padding: 0 10px 0 12px (reversed)
			end: 'pr-2.5 pl-3',
		},
	},
	defaultVariants: {
		size: 'medium',
		expandIconPosition: 'start',
	},
});

const expandIconStyle = cva({
	base: ['flex shrink-0 items-center', 'leading-base-500 text-base-500'],
	variants: {
		position: {
			start: 'pr-2',
			end: 'shrink grow basis-0 justify-end pl-2',
		},
	},
});

const iconStyle = cva({
	base: 'leading-base-500 flex shrink-0 items-center pr-2 text-base-500',
});

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
		<summary class={root({ size, expandIconPosition, className })}>
			{expandIconPosition === 'start' && (
				<span class={expandIconStyle({ position: 'start' })}>
					<ChevronDownSmallOutlined size={20} />
				</span>
			)}

			{icon && <span class={iconStyle()}>{icon}</span>}

			{children}

			{expandIconPosition === 'end' && (
				<span class={expandIconStyle({ position: 'end' })}>
					<ChevronDownSmallOutlined size={20} />
				</span>
			)}
		</summary>
	);
};

export default AccordionHeader;
