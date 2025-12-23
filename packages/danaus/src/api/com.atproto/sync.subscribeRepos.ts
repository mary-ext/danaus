import { ComAtprotoSyncSubscribeRepos } from '@atcute/atproto';
import { InvalidRequestError, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';
import { Outbox } from '#app/sequencer/outbox.ts';

/**
 * register the `com.atproto.sync.subscribeRepos` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const subscribeRepos = (router: XRPCRouter, context: AppContext) => {
	const { sequencer, config } = context;

	router.addSubscription(ComAtprotoSyncSubscribeRepos, {
		async *handler({ params, signal }) {
			const { cursor } = params;
			const outbox = new Outbox(sequencer, { maxBufferSize: config.subscription.maxBuffer });

			const backfillCutoff = Date.now() - config.subscription.repoBackfillLimitMs;

			let outboxCursor: number | undefined = undefined;
			if (cursor !== undefined) {
				const lastSeq = sequencer.lastSeq();
				if (cursor > lastSeq) {
					throw new InvalidRequestError({ error: 'FutureCursor', description: `cursor in the future` });
				}

				const next = sequencer.next(cursor);
				if (next && next.sequenced_at.valueOf() < backfillCutoff) {
					yield {
						$type: 'com.atproto.sync.subscribeRepos#info',
						name: 'OutdatedCursor',
						message: `requested cursor exceeded limit. possibly missing events`,
					};

					const startEvt = sequencer.earliestAfterTime(new Date(backfillCutoff));
					outboxCursor = startEvt?.seq ? startEvt.seq - 1 : undefined;
				} else {
					outboxCursor = cursor;
				}
			}

			for await (const event of outbox.events(outboxCursor, signal)) {
				switch (event.type) {
					case 'commit': {
						yield {
							$type: 'com.atproto.sync.subscribeRepos#commit',
							seq: event.seq,
							time: event.time,
							...event.evt,
						};

						break;
					}

					case 'sync': {
						yield {
							$type: 'com.atproto.sync.subscribeRepos#sync',
							seq: event.seq,
							time: event.time,
							...event.evt,
						};

						break;
					}

					case 'identity': {
						yield {
							$type: 'com.atproto.sync.subscribeRepos#identity',
							seq: event.seq,
							time: event.time,
							...event.evt,
						};

						break;
					}

					case 'account': {
						yield {
							$type: 'com.atproto.sync.subscribeRepos#account',
							seq: event.seq,
							time: event.time,
							...event.evt,
						};

						break;
					}
				}
			}
		},
	});
};
