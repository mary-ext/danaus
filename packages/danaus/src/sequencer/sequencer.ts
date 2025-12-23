import { EventEmitter } from 'node:events';

import type { Did, Handle } from '@atcute/lexicons';

import { and, asc, desc, eq, gt, gte, lte, notInArray, sql } from 'drizzle-orm';

import { AccountStatus } from '#app/accounts/types.ts';
import type { RepoCommitEvent, RepoSequencer } from '#app/actors/repo/side-effects.ts';
import type { Crawlers } from '#app/crawlers.ts';

import { getSequencerDb, t, type SequencerDb } from './db';
import {
	formatAccountEvent,
	formatCommitEvent,
	formatIdentityEvent,
	formatSyncEvent,
	toSeqEvt,
	type SequencerInsert,
} from './events';
import type { RepoSeqEventType, SeqEvt } from './types';

type RepoSeqRow = typeof t.repoSeq.$inferSelect;

export interface SequencerOptions {
	location: string;
	walAutoCheckpointDisabled: boolean;
	crawlers: Crawlers;
}

/**
 * options for sequence range queries.
 */
export interface SeqRangeOptions {
	earliestSeq?: number;
	latestSeq?: number;
	earliestTime?: Date | string;
	limit?: number;
}

type SequencerEvents = {
	event: [SeqEvt];
	close: [];
};

/**
 * repo sequencer with push-pull support.
 */
export class Sequencer implements RepoSequencer {
	readonly db: SequencerDb;
	readonly crawlers: Crawlers;

	private _lastSeq: number | undefined;

	readonly events = new EventEmitter<SequencerEvents>();

	/**
	 * create a sequencer.
	 * @param options sequencer options
	 */
	constructor(options: SequencerOptions) {
		this.db = getSequencerDb(options.location, options.walAutoCheckpointDisabled);
		this.crawlers = options.crawlers;

		this.events.setMaxListeners(100);
	}

	/**
	 * ensure last seen is set and return it.
	 * @returns last seen sequence
	 */
	lastSeq(): number {
		if (this._lastSeq === undefined) {
			const row = this.db.select().from(t.repoSeq).orderBy(desc(t.repoSeq.seq)).limit(1).get();

			this._lastSeq = row ? row.seq : 0;
		}

		return this._lastSeq;
	}

	/**
	 * get sequencer statistics.
	 * @returns sequencer stats
	 */
	getStats(): { lastSeq: number; totalEvents: number; invalidatedEvents: number } {
		const totalEvents =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.repoSeq)
				.get()?.count ?? 0;
		const invalidatedEvents =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.repoSeq)
				.where(eq(t.repoSeq.invalidated, 1))
				.get()?.count ?? 0;

		return {
			lastSeq: this.lastSeq(),
			totalEvents: totalEvents,
			invalidatedEvents: invalidatedEvents,
		};
	}

	/**
	 * get the next row after a cursor.
	 * @param cursor sequence cursor
	 * @returns next row
	 */
	next(cursor: number): RepoSeqRow | null {
		const row = this.db
			.select()
			.from(t.repoSeq)
			.where(gt(t.repoSeq.seq, cursor))
			.orderBy(asc(t.repoSeq.seq))
			.limit(1)
			.get();

		return row ?? null;
	}

	/**
	 * find the earliest row after a given time.
	 * @param time earliest time
	 * @returns earliest row
	 */
	earliestAfterTime(time: Date | string): RepoSeqRow | null {
		const row = this.db
			.select()
			.from(t.repoSeq)
			.where(gte(t.repoSeq.sequenced_at, normalizeTime(time)))
			.orderBy(asc(t.repoSeq.sequenced_at))
			.limit(1)
			.get();

		return row ?? null;
	}

	/**
	 * request a range of sequenced events.
	 * @param options range options
	 * @returns sequenced events
	 */
	requestSeqRange(options: SeqRangeOptions): SeqEvt[] {
		const { earliestSeq, latestSeq, earliestTime, limit } = options;

		const query = this.db
			.select()
			.from(t.repoSeq)
			.where((f) => {
				return and(
					eq(f.invalidated, 0),
					earliestSeq !== undefined ? gt(f.seq, earliestSeq) : undefined,
					latestSeq !== undefined ? lte(f.seq, latestSeq) : undefined,
					earliestTime !== undefined ? gte(f.sequenced_at, normalizeTime(earliestTime)) : undefined,
				);
			})
			.orderBy(asc(t.repoSeq.seq));

		const rows = limit !== undefined ? query.limit(limit).all() : query.all();

		if (rows.length === 0) {
			return [];
		}

		return rows.map((row) => rowToSeqEvt(row));
	}

	/**
	 * record a repo commit event.
	 * @param event commit event
	 */
	async recordCommit(event: RepoCommitEvent): Promise<void> {
		await this.emitCommit(event);
	}

	/**
	 * sequence a commit event.
	 * @param event commit event
	 * @returns sequence number
	 */
	async emitCommit(event: RepoCommitEvent): Promise<number> {
		const insert = await formatCommitEvent(event);
		return this.sequenceEvt(insert);
	}

	/**
	 * sequence a sync event.
	 * @param did repo did
	 * @param rev commit rev
	 * @param commitCid commit cid
	 * @param blocks commit blocks
	 * @returns sequence number
	 */
	async emitSync(did: Did, rev: string, commitCid: string, blocks: Map<string, Uint8Array>): Promise<number> {
		const insert = await formatSyncEvent(did, rev, commitCid, blocks);
		return this.sequenceEvt(insert);
	}

	/**
	 * sequence an identity event.
	 * @param did repo did
	 * @param handle updated handle
	 * @returns sequence number
	 */
	async emitIdentity(did: Did, handle?: Handle): Promise<number> {
		const insert = formatIdentityEvent(did, handle);
		return this.sequenceEvt(insert);
	}

	/**
	 * sequence an account event.
	 * @param did repo did
	 * @param status account status
	 * @returns sequence number
	 */
	async emitAccount(did: Did, status: AccountStatus): Promise<number> {
		const insert = formatAccountEvent(did, status);
		return this.sequenceEvt(insert);
	}

	/**
	 * delete all events for a did.
	 * @param did repo did
	 * @param excludingSeqs sequences to keep
	 */
	deleteAllForUser(did: Did, excludingSeqs: number[] = []): void {
		this.db
			.delete(t.repoSeq)
			.where(
				and(
					eq(t.repoSeq.did, did),
					excludingSeqs.length > 0 ? notInArray(t.repoSeq.seq, excludingSeqs) : undefined,
				),
			)
			.run();
	}

	private sequenceEvt(insert: SequencerInsert): number {
		const row = this.db
			.insert(t.repoSeq)
			.values({
				did: insert.did,
				event_type: insert.eventType,
				event: insert.event,
				blocks: insert.blocks ? Buffer.from(insert.blocks) : null,
				invalidated: 0,
				sequenced_at: insert.sequencedAt,
			})
			.returning({
				seq: t.repoSeq.seq,
				sequenced_at: t.repoSeq.sequenced_at,
			})
			.get();

		if (!row) {
			throw new Error(`failed to insert sequencer event`);
		}

		this._lastSeq = row.seq;

		const seqEvt = toSeqEvt(insert.eventType, row.seq, row.sequenced_at, insert.event, insert.blocks);
		this.events.emit('event', seqEvt);

		this.crawlers.notifyOfUpdate();

		return row.seq;
	}
}

const rowToSeqEvt = (row: RepoSeqRow): SeqEvt => {
	return toSeqEvt(
		row.event_type as RepoSeqEventType,
		row.seq,
		row.sequenced_at,
		row.event,
		row.blocks ? new Uint8Array(row.blocks) : null,
	);
};

const normalizeTime = (time: Date | string): Date => {
	return time instanceof Date ? time : new Date(time);
};
