import type { CanonicalResourceUri, Nsid, RecordKey } from '@atcute/lexicons';

/**
 * record index upsert data.
 */
export interface RecordIndexUpsert {
	uri: CanonicalResourceUri;
	collection: Nsid;
	rkey: RecordKey;
	cid: string;
	rev: string;
	created_at: Date;
}
