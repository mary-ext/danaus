import type { IconProps } from './_types.ts';

const PasskeysOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M18 11C16.3431 11 15 12.3431 15 14C15 15.2107 15.7172 16.254 16.75 16.728V20.2597C16.75 20.4116 16.819 20.5552 16.9377 20.6501L17.6877 21.2501C17.8703 21.3962 18.1297 21.3962 18.3123 21.2501L19.0623 20.6501C19.181 20.5552 19.25 20.4116 19.25 20.2597V19.427L18.5 18.75L19.25 18V16.728C20.2828 16.254 21 15.2107 21 14C21 12.3431 19.6569 11 18 11ZM17 14C17 13.4477 17.4477 13 18 13C18.5523 13 19 13.4477 19 14C19 14.5523 18.5523 15 18 15C17.4477 15 17 14.5523 17 14Z"
				fill="currentColor"
			/>
			<path
				d="M12.0011 13C8.60997 13 6.03711 15.0143 4.9836 17.8629C4.5748 18.9682 5.51944 20 6.69796 20H14.0011M15.5011 6.5C15.5011 8.433 13.9341 10 12.0011 10C10.0681 10 8.50112 8.433 8.50112 6.5C8.50112 4.567 10.0681 3 12.0011 3C13.9341 3 15.5011 4.567 15.5011 6.5Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};

export default PasskeysOutlined;
