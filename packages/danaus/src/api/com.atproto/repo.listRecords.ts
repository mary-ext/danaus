import { ComAtprotoRepoListRecords } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { RepoRecordEntry } from '#app/actors/repo/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.listRecords` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const listRecords = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager } = context;

	router.addQuery(ComAtprotoRepoListRecords, {
		async handler({ params }) {
			const { repo, collection, limit, cursor, reverse } = params;

			const did = accountManager.getAccountDid(repo);
			if (!did) {
				throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
			}

			const records = await actorManager.read(did, (store) => {
				return store.repo.listRecords(collection, {
					limit: limit,
					reverse: reverse,
					cursor: cursor,
					includeRecords: true,
				});
			});

			const output = records.map((record) => {
				// oxlint-disable-next-line no-unsafe-type-assertion -- includeRecords guarantees RepoRecordEntry
				const entry = record as RepoRecordEntry;
				return {
					uri: entry.uri,
					cid: entry.cid,
					// oxlint-disable-next-line no-unsafe-type-assertion -- CBOR-decoded record
					value: entry.record as Record<string, unknown>,
				};
			});

			// oxlint-disable-next-line no-unsafe-type-assertion -- same as above
			const last = records.at(-1) as RepoRecordEntry | undefined;
			const nextCursor = last ? last.uri.split('/').pop() : undefined;

			return json({
				records: output,
				cursor: nextCursor,
			});
		},
	});
};
