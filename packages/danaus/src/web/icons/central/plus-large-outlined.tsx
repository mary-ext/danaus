import type { IconProps } from './_types.ts';

const PlusLargeOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M12 4V12M12 12V20M12 12H4M12 12H20"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	);
};

export default PlusLargeOutlined;
