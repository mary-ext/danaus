import type { IconProps } from './_types.ts';

const UsbOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M10 6V7M14 6V7M4 10H20V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V10ZM6 3H18V10H6V3Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default UsbOutlined;
