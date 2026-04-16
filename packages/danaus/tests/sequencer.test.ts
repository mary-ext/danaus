import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';

import { fromUint8Array } from '@atcute/car';
import * as CID from '@atcute/cid';
import type { Did } from '@atcute/lexicons';

import { asc, gt } from 'drizzle-orm';

import type { AppContext } from '#app/context.ts';
import { t } from '#app/sequencer/db/index.ts';
import { formatSyncEvent } from '#app/sequencer/events.ts';
import { Outbox } from '#app/sequencer/outbox.ts';
import type { SeqEvt } from '#app/sequencer/types.ts';
import { TestNetworkNoAppView, usersSeed, type SeedClient } from '#app/test/index.ts';

const randomBase32 = (length: number): string => {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
	let out = '';
	for (let i = 0; i < length; i++) {
		out += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return out;
};

const toIso = (value: Date | number | string): string => {
	return new Date(value).toISOString();
};

const normalizeRow = (row: {
	seq: number;
	did: string;
	event_type: string;
	event: unknown;
	invalidated: number;
	sequenced_at: Date | number | string;
}) => {
	return {
		seq: row.seq,
		did: row.did,
		event_type: row.event_type,
		event: row.event,
		invalidated: row.invalidated,
		sequenced_at: toIso(row.sequenced_at),
	};
};

const toStoredMessage = (evt: SeqEvt): SeqEvt['evt'] | (SeqEvt['evt'] & { blocks: null }) => {
	if (evt.type === 'commit' || evt.type === 'sync') {
		// oxlint-disable-next-line no-unsafe-type-assertion -- discriminated union narrowing
		return { ...evt.evt, blocks: null } as SeqEvt['evt'] & { blocks: null };
	}

	return evt.evt;
};

const evtToDbRow = (evt: SeqEvt) => {
	const did = evt.type === 'commit' ? evt.evt.repo : evt.evt.did;
	// oxlint-disable-next-line no-unsafe-type-assertion -- JSON round-trip preserves shape
	const event = JSON.parse(JSON.stringify(toStoredMessage(evt))) as typeof evt.evt;
	return {
		seq: evt.seq,
		did: did,
		event_type: evt.type,
		event: event,
		invalidated: 0,
		sequenced_at: evt.time,
	};
};

const bailableWait = (ms: number) => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let resolve: (() => void) | undefined;

	const wait = new Promise<void>((res) => {
		resolve = res;
		timeout = setTimeout(res, ms);
	});

	const bail = () => {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}

		resolve?.();
	};

	return { wait: () => wait, bail };
};

const readFromGenerator = async <T>(
	generator: AsyncIterable<T>,
	shouldStop: (evt?: T) => Promise<boolean> | boolean,
	waitFor: Promise<unknown> = Promise.resolve(),
	limit = Number.MAX_SAFE_INTEGER,
): Promise<T[]> => {
	const events: T[] = [];
	let bail: (() => void) | undefined;
	let hasBroke = false;

	const awaitDone = async (): Promise<boolean> => {
		if (await shouldStop(events.at(-1))) {
			return true;
		}

		const bailable = bailableWait(20);
		await bailable.wait();
		bail = bailable.bail;

		if (hasBroke) {
			return false;
		}

		return await awaitDone();
	};

	const breakOn = new Promise<void>((resolve) => {
		waitFor.then(() => {
			awaitDone().then(() => resolve());
		});
	});

	try {
		const iterator = generator[Symbol.asyncIterator]();
		while (events.length < limit) {
			// oxlint-disable-next-line no-await-in-loop -- sequential event consumption
			const maybeEvent = await Promise.race([iterator.next(), breakOn]);
			if (!maybeEvent) {
				break;
			}

			const event = maybeEvent;
			if (event.done) {
				break;
			}

			events.push(event.value);
		}
	} finally {
		hasBroke = true;
		bail?.();
	}

	return events;
};

describe('sequencer', () => {
	let network: TestNetworkNoAppView;
	let ctx: AppContext;
	let sc: SeedClient;
	let alice: Did;
	let bob: Did;

	let totalEvts = 0;
	let lastSeen = 0;

	beforeAll(async () => {
		network = await TestNetworkNoAppView.create();
		ctx = network.pds.ctx;
		sc = network.getSeedClient();
		await usersSeed(sc);
		alice = sc.dids.alice!;
		bob = sc.dids.bob!;
		// 18 events in users seed (4 accounts + 2 profiles).
		totalEvts = 18;
	});

	beforeEach(async () => {
		await network.processAll();
	});

	afterAll(async () => {
		if (network) {
			await network.close();
		}
	});

	const randomPost = async (by: Did) => sc.post(by, randomBase32(8));

	const createPosts = async (count: number): Promise<void> => {
		for (let i = 0; i < count; i++) {
			if (i % 2 === 0) {
				// oxlint-disable-next-line no-await-in-loop -- sequential post creation
				await randomPost(alice);
			} else {
				// oxlint-disable-next-line no-await-in-loop
				await randomPost(bob);
			}
		}
	};

	const loadFromDb = (cursor: number) => {
		return ctx.sequencer.db
			.select({
				seq: t.repoSeq.seq,
				did: t.repoSeq.did,
				event_type: t.repoSeq.event_type,
				event: t.repoSeq.event,
				invalidated: t.repoSeq.invalidated,
				sequenced_at: t.repoSeq.sequenced_at,
			})
			.from(t.repoSeq)
			.where(gt(t.repoSeq.seq, cursor))
			.orderBy(asc(t.repoSeq.seq))
			.all();
	};

	const caughtUp = () => {
		return async (evt?: SeqEvt) => {
			const lastEvt = ctx.sequencer.lastSeq();
			if (!lastEvt) {
				return true;
			}
			const last = evt?.seq ?? 0;
			return last >= lastEvt;
		};
	};

	it.serial('sends to outbox', async () => {
		const count = 20;
		totalEvts += count;
		await createPosts(count);

		const outbox = new Outbox(ctx.sequencer);
		const controller = new AbortController();
		const events = await readFromGenerator(outbox.events(-1, controller.signal), caughtUp());
		controller.abort();

		expect(events.length).toBe(totalEvts);

		const fromDb = loadFromDb(-1).map(normalizeRow);
		expect(events.map(evtToDbRow).map(normalizeRow)).toEqual(fromDb);

		lastSeen = events.at(-1)?.seq ?? lastSeen;
	});

	it.serial('handles cut over', async () => {
		const count = 20;
		totalEvts += count;

		const outbox = new Outbox(ctx.sequencer);
		const controller = new AbortController();
		const createPromise = createPosts(count);
		const [events] = await Promise.all([
			readFromGenerator(outbox.events(-1, controller.signal), caughtUp(), createPromise),
			createPromise,
		]);
		controller.abort();

		expect(events.length).toBe(totalEvts);

		const fromDb = loadFromDb(-1).map(normalizeRow);
		expect(events.map(evtToDbRow).map(normalizeRow)).toEqual(fromDb);

		lastSeen = events.at(-1)?.seq ?? lastSeen;
	});

	it.serial('only gets events after cursor', async () => {
		const count = 20;
		totalEvts += count;

		const outbox = new Outbox(ctx.sequencer);
		const controller = new AbortController();
		const createPromise = createPosts(count);
		const [events] = await Promise.all([
			readFromGenerator(outbox.events(lastSeen, controller.signal), caughtUp(), createPromise),
			createPromise,
		]);
		controller.abort();

		expect(events.length).toBe(count);

		const fromDb = loadFromDb(lastSeen).map(normalizeRow);
		expect(events.map(evtToDbRow).map(normalizeRow)).toEqual(fromDb);

		lastSeen = events.at(-1)?.seq ?? lastSeen;
	});

	it.serial('buffers events that are not being read', async () => {
		const count = 20;
		totalEvts += count;

		const outbox = new Outbox(ctx.sequencer);
		const controller = new AbortController();
		const createPromise = createPosts(count);
		const generator = outbox.events(lastSeen, controller.signal);
		const [firstPart] = await Promise.all([
			readFromGenerator(generator, caughtUp(), createPromise, 5),
			createPromise,
		]);
		const secondPart = await readFromGenerator(generator, caughtUp(), createPromise);
		controller.abort();

		const events = [...firstPart, ...secondPart];
		expect(events.length).toBe(count);

		const fromDb = loadFromDb(lastSeen).map(normalizeRow);
		expect(events.map(evtToDbRow).map(normalizeRow)).toEqual(fromDb);

		lastSeen = events.at(-1)?.seq ?? lastSeen;
	});

	it.serial('errors when buffer is overloaded', async () => {
		const count = 20;
		totalEvts += count;

		const outbox = new Outbox(ctx.sequencer, { maxBufferSize: 5 });
		const controller = new AbortController();
		const generator = outbox.events(lastSeen, controller.signal);
		const createPromise = createPosts(count);

		const overloadBuffer = async () => {
			await Promise.all([readFromGenerator(generator, caughtUp(), createPromise, 5), createPromise]);
			await Bun.sleep(500);
			await readFromGenerator(generator, caughtUp(), createPromise);
		};

		expect(overloadBuffer()).rejects.toThrow('stream consumer too slow');

		await createPromise;
		controller.abort();

		const fromDb = loadFromDb(lastSeen).map(normalizeRow);
		lastSeen = fromDb.at(-1)?.seq ?? lastSeen;
	});

	it.serial('handles many open connections', async () => {
		const count = 20;
		const outboxes: Array<{ outbox: Outbox; controller: AbortController }> = [];
		for (let i = 0; i < 50; i++) {
			outboxes.push({ outbox: new Outbox(ctx.sequencer), controller: new AbortController() });
		}
		const createPromise = createPosts(count);
		const readOutboxes = Promise.all(
			outboxes.map(({ outbox, controller }) =>
				readFromGenerator(outbox.events(lastSeen, controller.signal), caughtUp(), createPromise),
			),
		);
		const [results] = await Promise.all([readOutboxes, createPromise]);

		const fromDb = loadFromDb(lastSeen).map(normalizeRow);
		for (let i = 0; i < 50; i++) {
			const events = results[i] ?? [];
			expect(events.length).toBe(count);
			expect(events.map(evtToDbRow).map(normalizeRow)).toEqual(fromDb);
		}

		for (const { controller } of outboxes) {
			controller.abort();
		}

		lastSeen = results[0]?.at(-1)?.seq ?? lastSeen;
	});

	it.serial('root block must be returned in sync event', async () => {
		const syncData = await ctx.actorManager.read(sc.dids.alice!, async (store) => {
			const root = store.repo.getRoot();
			if (!root) {
				throw new Error('missing repo root');
			}
			const blocks = store.repo.getBlocksByCid([root.cid]);
			return {
				cid: root.cid,
				rev: root.rev,
				blocks,
			};
		});

		const insert = await formatSyncEvent(sc.dids.alice!, syncData.rev, syncData.cid, syncData.blocks);
		if (!insert.blocks) {
			throw new Error('missing sync blocks');
		}

		const reader = fromUint8Array(insert.blocks);
		expect(reader.roots.length).toBe(1);
		const root = reader.roots[0];
		if (!root) {
			throw new Error('missing car root');
		}
		expect(root.$link).toBe(syncData.cid);

		const entries = Array.from(reader);
		expect(entries.length).toBe(1);
		const entry = entries[0];
		if (!entry) {
			throw new Error('missing car entry');
		}
		expect(CID.toString(entry.cid)).toBe(syncData.cid);
	});
});
