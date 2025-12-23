import { ComAtprotoRepoPutRecord } from '@atcute/atproto';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.putRecord` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const putRecord = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier } = context;

	router.addProcedure(ComAtprotoRepoPutRecord, {
		async handler({ input, request }) {
			const auth = await authVerifier.authorization(request, {
				// avoid checking for account twice.
				// checkDeactivated: true,
				// checkTakedown: true,
			});

			const account = accountManager.getAccount(input.repo, {
				includeDeactivated: true,
				includeTakenDown: true,
			});
			if (!account) {
				throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
			}

			if (account.did !== auth.did) {
				throw new AuthRequiredError({ error: 'InvalidToken', description: `invalid repository credentials` });
			}

			const result = await actorManager.transact(account.did, (store) => {
				return store.repo.applyWrites(
					[
						{
							action: 'update',
							collection: input.collection,
							rkey: input.rkey,
							swapRecord: input.swapRecord,
							record: input.record,
						},
					],
					{
						swapCommit: input.swapCommit ?? undefined,
						validateBlobs: input.validate ?? true,
					},
				);
			});

			const write = result.results[0];
			if (!write || !write.cid) {
				throw new InvalidRequestError({ error: 'InvalidRecord', description: `record write failed` });
			}

			return json({
				uri: write.uri,
				cid: write.cid,
				commit: {
					cid: result.commit.cid,
					rev: result.commit.rev,
				},
			});
		},
	});
};
