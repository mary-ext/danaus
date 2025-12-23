import type { IconProps } from './_types.ts';

const ExclamationCircleOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
			<path d="M12 8V12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			<circle cx="12" cy="15.7996" r="1.2" fill="currentColor" />
		</svg>
	);
};

export default ExclamationCircleOutlined;
