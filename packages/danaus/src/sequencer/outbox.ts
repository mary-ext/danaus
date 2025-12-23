import { XRPCSubscriptionError } from '@atcute/xrpc-server';

import { AsyncBufferFullError, on } from './async-buffer';
import type { Sequencer } from './sequencer';
import type { SeqEvt } from './types';

/**
 * outbox configuration options.
 */
export interface OutboxOptions {
	maxBufferSize: number;
}

const BACKFILL_PAGE_SIZE = 500;

/**
 * sequencer outbox with push-pull semantics.
 */
export class Outbox {
	private maxBufferSize: number;

	/**
	 * create an outbox.
	 * @param sequencer sequencer instance
	 * @param options outbox options
	 */
	constructor(
		public sequencer: Sequencer,
		options: Partial<OutboxOptions> = {},
	) {
		const { maxBufferSize = 500 } = options;
		this.maxBufferSize = maxBufferSize;
	}

	/**
	 * stream sequenced events.
	 * @param backfillCursor cursor to backfill from
	 * @param signal abort signal
	 * @returns async iterator of events
	 */
	async *events(backfillCursor: number | undefined, signal: AbortSignal): AsyncGenerator<SeqEvt> {
		let lastBackfillSeq = -1;
		let caughtUp = backfillCursor === undefined;

		// consumer is backfilling, dump everything we have
		if (!caughtUp) {
			while (true) {
				const events = this.sequencer.requestSeqRange({
					earliestSeq: lastBackfillSeq > -1 ? lastBackfillSeq : backfillCursor,
					limit: BACKFILL_PAGE_SIZE,
				});

				if (events.length === 0) {
					break;
				}

				yield* events;

				signal.throwIfAborted();

				lastBackfillSeq = events.at(-1)!.seq;

				// stop when we're within half a page of the sequencer
				const lastSeq = this.sequencer.lastSeq();

				if (lastSeq - lastBackfillSeq < BACKFILL_PAGE_SIZE / 2) {
					break;
				}
			}

			signal.throwIfAborted();
		}

		// start listening to the sequencer
		const tail = on(this.sequencer.events, 'event', { signal, maxSize: this.maxBufferSize });

		// ensure we're truly caught up
		if (!caughtUp) {
			const events = this.sequencer.requestSeqRange({
				earliestSeq: lastBackfillSeq > -1 ? lastBackfillSeq : backfillCursor,
			});

			if (events.length > 0) {
				yield* events;

				signal.throwIfAborted();

				lastBackfillSeq = events.at(-1)!.seq;
			}
		}

		// start tailing
		try {
			for await (const [event] of tail) {
				if (!caughtUp) {
					// we're tailing now, but we still have to omit previous events
					if (event.seq <= lastBackfillSeq) {
						continue;
					}

					caughtUp = true;
				}

				yield event;
			}
		} catch (err) {
			if (err instanceof AsyncBufferFullError) {
				throw new XRPCSubscriptionError({
					error: 'ConsumerTooSlow',
					description: `stream consumer too slow`,
				});
			}

			throw err;
		}
	}
}
