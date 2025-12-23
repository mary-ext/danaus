/**
 * updates an existing element or inserts a new one if not found
 * @param array the array to upsert into
 * @param predicate type guard to find the existing element
 * @param value the value to insert or update with
 * @returns a new array with the upserted element
 */
export const upsert = <T, S extends T>(array: T[], predicate: (item: T) => item is S, value: S): T[] => {
	const index = array.findIndex(predicate);
	if (index === -1) {
		return [...array, value];
	}

	return array.with(index, value);
};
