import type { IconProps } from './_types.ts';

const ChevronDownSmallOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M8 10L11.2929 13.2929C11.6834 13.6834 12.3166 13.6834 12.7071 13.2929L16 10"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default ChevronDownSmallOutlined;
