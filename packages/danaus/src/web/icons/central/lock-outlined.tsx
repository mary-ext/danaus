import type { IconProps } from './_types.ts';

const LockOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M5 12C5 10.8954 5.89543 10 7 10H17C18.1046 10 19 10.8954 19 12V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V12Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M16 9.5V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V9.5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M12 14V17"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default LockOutlined;
