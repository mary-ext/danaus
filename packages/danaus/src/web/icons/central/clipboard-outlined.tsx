import type { IconProps } from './_types.ts';

const ClipboardOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M15 5H17C18.1046 5 19 5.89543 19 7V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V7C5 5.89543 5.89543 5 7 5H9M15 5V7H9V5M15 5C15 3.89543 14.1046 3 13 3H11C9.89543 3 9 3.89543 9 5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default ClipboardOutlined;
