import * as CBOR from '@atcute/cbor';
import * as CID from '@atcute/cid';
import type { PrivateKey } from '@atcute/crypto';
import type { Did } from '@atcute/lexicons';
import { isCommit, type Commit } from '@atcute/repo';

/**
 * decode and validate a commit block.
 * @param bytes commit bytes
 * @returns commit object
 */
export const decodeCommit = (bytes: Uint8Array): Commit => {
	const decoded = CBOR.decode(bytes);
	if (!isCommit(decoded)) {
		throw new Error(`invalid commit block`);
	}

	return decoded;
};

export interface EncodeCommitOptions {
	did: Did;
	data: string;
	rev: string;
	signingKey: PrivateKey;
}

export interface EncodedCommit {
	commit: Commit;
	bytes: Uint8Array;
	cid: string;
}

/**
 * build and sign a repo commit.
 * @param options commit data
 * @returns commit block info
 */
export const encodeCommit = async (options: EncodeCommitOptions): Promise<EncodedCommit> => {
	const unsigned = {
		version: 3 as const,
		did: options.did,
		data: { $link: options.data },
		rev: options.rev,
		prev: null,
	};

	const sig = await options.signingKey.sign(CBOR.encode(unsigned));
	const commit: Commit = {
		...unsigned,
		sig: CBOR.toBytes(sig),
	};

	const bytes = CBOR.encode(commit);
	const cid = CID.toString(await CID.create(0x71, bytes));

	return { commit, bytes, cid };
};
