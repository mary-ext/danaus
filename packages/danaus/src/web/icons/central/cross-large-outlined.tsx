import type { IconProps } from './_types.ts';

const CrossLargeOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path d="M5 5L19 19M19 5L5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	);
};

export default CrossLargeOutlined;
