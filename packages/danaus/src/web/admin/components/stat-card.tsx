import { cva } from 'cva';

const root = cva({
	base: ['flex flex-col gap-1 rounded-lg border border-neutral-stroke-2 bg-neutral-background-1 p-3'],
});

const label = cva({
	base: 'text-base-200 text-neutral-foreground-3',
});

const value = cva({
	base: 'text-base-500 font-semibold text-neutral-foreground-1',
});

export interface StatCardProps {
	label: string;
	value: number;
}

/**
 * displays a stat with a label and numeric value
 * @param props.label the stat label
 * @param props.value the stat value
 */
const StatCard = (props: StatCardProps) => {
	return (
		<div class={root()}>
			<span class={label()}>{props.label}</span>
			<span class={value()}>{props.value.toLocaleString()}</span>
		</div>
	);
};

export default StatCard;
