import type { IconProps } from './_types.ts';

const PasswordOutlined = (props: IconProps) => {
	const { size = 24, class: className } = props;

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" class={className}>
			<path
				d="M20 16.8V7.2C20 6.07989 20 5.51984 19.782 5.09202C19.5903 4.71569 19.2843 4.40973 18.908 4.21799C18.4802 4 17.9201 4 16.8 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40973 4.40973 4.71569 4.21799 5.09202C4 5.51984 4 6.07989 4 7.2V16.8C4 17.9201 4 18.4802 4.21799 18.908C4.40973 19.2843 4.71569 19.5903 5.09202 19.782C5.51984 20 6.0799 20 7.2 20H16.8C17.9201 20 18.4802 20 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M16 9V15"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M8 11.125C8.48325 11.125 8.875 11.5168 8.875 12C8.875 12.4832 8.48325 12.875 8 12.875C7.51675 12.875 7.125 12.4832 7.125 12C7.125 11.5168 7.51675 11.125 8 11.125Z"
				fill="currentColor"
				stroke="currentColor"
				stroke-width="0.75"
			/>
			<path
				d="M12 11.125C12.4832 11.125 12.875 11.5168 12.875 12C12.875 12.4832 12.4832 12.875 12 12.875C11.5168 12.875 11.125 12.4832 11.125 12C11.125 11.5168 11.5168 11.125 12 11.125Z"
				fill="currentColor"
				stroke="currentColor"
				stroke-width="0.75"
			/>
		</svg>
	);
};

export default PasswordOutlined;
