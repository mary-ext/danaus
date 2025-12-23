export const chunked = <T>(array: T[], size: number): T[][] => {
	const chunks: T[][] = [];

	for (let i = 0, il = array.length; i < il; i += size) {
		chunks.push(array.slice(i, i + size));
	}

	return chunks;
};

export const mapDefined = <T, R>(array: T[], mapper: (value: T, index: number) => R | undefined): R[] => {
	const len = array.length;
	const mapped: R[] = [];

	let idx = 0;
	let temp: R | undefined;

	for (; idx < len; idx++) {
		if ((temp = mapper(array[idx]!, idx)) !== undefined) {
			mapped.push(temp);
		}
	}

	return mapped;
};
