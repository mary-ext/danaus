import { ComAtprotoRepoGetRecord } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.getRecord` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getRecord = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager } = context;

	router.addQuery(ComAtprotoRepoGetRecord, {
		async handler({ params }) {
			const { repo, collection, rkey, cid } = params;

			const did = accountManager.getAccountDid(repo);
			if (!did) {
				throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
			}

			const record = await actorManager.read(did, (store) => store.repo.getRecord(collection, rkey));
			if (!record) {
				throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
			}

			if (cid && record.cid !== cid) {
				throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
			}

			return json({
				uri: record.uri,
				cid: record.cid,
				value: record.record as Record<string, unknown>,
			});
		},
	});
};
