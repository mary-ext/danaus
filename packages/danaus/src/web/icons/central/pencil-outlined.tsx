import type { IconProps } from './_types.ts';

const PencilOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M18.4142 3.91415L20.0858 5.58573C20.8668 6.36678 20.8668 7.63311 20.0858 8.41416L18 10.4999L7.79289 20.7071C7.60536 20.8946 7.351 20.9999 7.08579 20.9999H3V16.9142C3 16.6489 3.10536 16.3946 3.29289 16.2071L13.5 5.99994L15.5858 3.91416C16.3668 3.13311 17.6332 3.13311 18.4142 3.91415Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M13.5 6L18 10.5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default PencilOutlined;
