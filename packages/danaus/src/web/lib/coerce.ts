export const coerceToInteger = (input: string): number | null => {
	const val = +input;
	if (!Number.isSafeInteger(val) || val < 0) {
		return null;
	}

	return val;
};
