import type { IconProps } from './_types.ts';

const ShieldOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M20 7.17737C20 6.32338 19.4578 5.56361 18.6502 5.286L12.6502 3.2235C12.2288 3.07866 11.7712 3.07866 11.3498 3.22349L5.34984 5.286C4.54224 5.56361 4 6.32338 4 7.17737V11.9123C4 16.8848 8 19 12 21.1579C16 19 20 16.8848 20 11.9123V7.17737Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="square"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default ShieldOutlined;
