import { writeCarStream } from '@atcute/car';
import { toBytes, type Bytes } from '@atcute/cbor';
import * as CID from '@atcute/cid';
import type { Did, Handle } from '@atcute/lexicons';
import { concat } from '@atcute/uint8array';

import { AccountStatus } from '#app/accounts/types.ts';
import type { RepoCommitEvent } from '#app/actors/repo/side-effects.ts';

import type {
	AccountEvt,
	CommitEvt,
	IdentityEvt,
	RepoSeqEventType,
	SeqEvt,
	StoredAccount,
	StoredCommit,
	StoredIdentity,
	StoredMessage,
	StoredSync,
} from './types.ts';

/**
 * sequencer insert payload.
 */
export interface SequencerInsert {
	did: Did;
	eventType: RepoSeqEventType;
	event: StoredMessage;
	blocks: Uint8Array | null;
	sequencedAt: Date;
}

/**
 * format a commit event for sequencing.
 * @param event repo commit event
 * @returns sequencer insert payload
 */
export const formatCommitEvent = async (event: RepoCommitEvent): Promise<SequencerInsert> => {
	const blocks = await buildCar(event.commitCid, event.blocks);

	const ops: CommitEvt['ops'] = event.ops.map((op): CommitEvt['ops'][number] => {
		const cid = op.cid ? cidLinkFromString(op.cid) : null;
		const prev = op.prev ? cidLinkFromString(op.prev) : undefined;

		return {
			action: op.action,
			path: op.path,
			cid: cid,
			prev: prev,
		};
	});

	const message: StoredCommit = {
		$type: 'com.atproto.sync.subscribeRepos#commit',
		repo: event.did,
		commit: cidLinkFromString(event.commitCid),
		rev: event.rev,
		since: event.since,
		blocks: null,
		ops: ops,
		prevData: event.prevData ? cidLinkFromString(event.prevData) : undefined,
		rebase: false,
		tooBig: false,
		blobs: [],
	};

	return {
		did: event.did,
		eventType: 'commit',
		event: message,
		blocks: blocks,
		sequencedAt: event.now,
	};
};

/**
 * format a sync event for sequencing.
 * @param did repo did
 * @param rev commit rev
 * @param commitCid commit cid
 * @param blocks commit block map
 * @param now event timestamp
 * @returns sequencer insert payload
 */
export const formatSyncEvent = async (
	did: Did,
	rev: string,
	commitCid: string,
	blocks: Map<string, Uint8Array>,
	now: Date = new Date(),
): Promise<SequencerInsert> => {
	const car = await buildCar(commitCid, blocks);

	const message: StoredSync = {
		$type: 'com.atproto.sync.subscribeRepos#sync',
		did: did,
		rev: rev,
		blocks: null,
	};

	return {
		did: did,
		eventType: 'sync',
		event: message,
		blocks: car,
		sequencedAt: now,
	};
};

/**
 * format an identity event for sequencing.
 * @param did repo did
 * @param handle updated handle
 * @param now event timestamp
 * @returns sequencer insert payload
 */
export const formatIdentityEvent = (did: Did, handle?: Handle, now: Date = new Date()): SequencerInsert => {
	const message: StoredIdentity = {
		$type: 'com.atproto.sync.subscribeRepos#identity',
		did: did,
		...(handle ? { handle: handle } : {}),
	};

	return {
		did: did,
		eventType: 'identity',
		event: message,
		blocks: null,
		sequencedAt: now,
	};
};

/**
 * format an account event for sequencing.
 * @param did repo did
 * @param status account status
 * @param now event timestamp
 * @returns sequencer insert payload
 */
export const formatAccountEvent = (
	did: Did,
	status: AccountStatus,
	now: Date = new Date(),
): SequencerInsert => {
	const active = status === AccountStatus.Active;
	const message: StoredAccount = {
		$type: 'com.atproto.sync.subscribeRepos#account',
		did: did,
		active: active,
		...(active ? {} : { status: status }),
	};

	return {
		did: did,
		eventType: 'account',
		event: message,
		blocks: null,
		sequencedAt: now,
	};
};

/**
 * convert a stored message into a sequenced event.
 * @param eventType stored event type
 * @param seq sequence number
 * @param sequencedAt sequencing time
 * @param event stored message
 * @param blocks stored blocks
 * @returns sequenced event
 */
export const toSeqEvt = (
	eventType: RepoSeqEventType,
	seq: number,
	sequencedAt: Date | number | string,
	event: StoredMessage,
	blocks: Uint8Array | null,
): SeqEvt => {
	const time = toIsoTime(sequencedAt);

	if (eventType === 'commit') {
		// oxlint-disable-next-line no-unsafe-type-assertion -- discriminated by eventType
		const payload = event as StoredCommit;
		return {
			type: 'commit',
			seq: seq,
			time: time,
			evt: {
				...payload,
				blocks: requireBlocks(eventType, blocks),
			},
		};
	}

	if (eventType === 'sync') {
		// oxlint-disable-next-line no-unsafe-type-assertion -- discriminated by eventType
		const payload = event as StoredSync;
		return {
			type: 'sync',
			seq: seq,
			time: time,
			evt: {
				...payload,
				blocks: requireBlocks(eventType, blocks),
			},
		};
	}

	if (eventType === 'identity') {
		return {
			type: 'identity',
			seq: seq,
			time: time,
			// oxlint-disable-next-line no-unsafe-type-assertion -- discriminated by eventType
			evt: event as IdentityEvt,
		};
	}

	return {
		type: 'account',
		seq: seq,
		time: time,
		// oxlint-disable-next-line no-unsafe-type-assertion -- discriminated by eventType
		evt: event as AccountEvt,
	};
};

const buildCar = async (rootCid: string, blocks: Map<string, Uint8Array>): Promise<Uint8Array> => {
	const root = CID.fromString(rootCid);
	const roots = [CID.toCidLink(root)];

	const rootBlock = blocks.get(rootCid);
	if (!rootBlock) {
		throw new Error(`missing root block for ${rootCid}`);
	}

	const entries = function* () {
		for (const [cid, data] of blocks) {
			const parsed = CID.fromString(cid);
			yield {
				cid: parsed.bytes,
				data: data,
			};
		}
	};

	const chunks: Uint8Array[] = [];
	let size = 0;
	for await (const chunk of writeCarStream(roots, entries())) {
		chunks.push(chunk);
		size += chunk.length;
	}

	return concat(chunks, size);
};

const cidLinkFromString = (cid: string): CID.CidLink => {
	return CID.toCidLink(CID.fromString(cid));
};

const requireBlocks = (eventType: 'commit' | 'sync', blocks: Uint8Array | null): Bytes => {
	if (!blocks) {
		throw new Error(`missing blocks for ${eventType} event`);
	}
	return toBytes(blocks);
};

const toIsoTime = (value: Date | number | string): string => {
	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date(value).toISOString();
};
