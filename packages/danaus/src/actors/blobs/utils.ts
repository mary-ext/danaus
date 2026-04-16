import { isBlob, isBytes, isCidLink, isLegacyBlob } from '@atcute/lexicons/interfaces';

export interface BlobReference {
	cid: string;
}

export const findBlobReferences = (
	record: unknown,
	map: Map<string, BlobReference> = new Map(),
	layer = 0,
): Map<string, BlobReference> => {
	if (record === null || typeof record !== 'object') {
		return map;
	}

	if (layer > 32) {
		return map;
	}

	if (Array.isArray(record)) {
		for (let idx = 0, len = record.length; idx < len; idx++) {
			const val = record[idx];
			findBlobReferences(val, map, layer + 1);
		}

		return map;
	}

	if (isBlob(record)) {
		const cid = record.ref.$link;
		map.set(cid, { cid: cid });

		return map;
	}

	if (isLegacyBlob(record) || isBytes(record) || isCidLink(record)) {
		return map;
	}

	for (const key in record) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- recursive record traversal
		const value = (record as any)[key];
		findBlobReferences(value, map, layer + 1);
	}

	return map;
};
