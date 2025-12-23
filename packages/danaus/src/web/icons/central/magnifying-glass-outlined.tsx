import type { IconProps } from './_types.ts';

const MagnifyingGlassOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M11 18C14.866 18 18 14.866 18 11C18 7.13401 14.866 4 11 4C7.13401 4 4 7.13401 4 11C4 14.866 7.13401 18 11 18Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
			<path d="M20 20L16.05 16.05" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	);
};

export default MagnifyingGlassOutlined;
