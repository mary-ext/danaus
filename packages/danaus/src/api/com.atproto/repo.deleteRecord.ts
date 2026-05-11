import { ComAtprotoRepoDeleteRecord } from '@atcute/atproto';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.deleteRecord` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const deleteRecord = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier } = context;

	router.addProcedure(ComAtprotoRepoDeleteRecord, {
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
				throw new InvalidRequestError({ error: 'RepoNotFound', message: `repository not found` });
			}

			if (account.did !== auth.did) {
				throw new AuthRequiredError({ error: 'InvalidToken', message: `invalid repository credentials` });
			}

			const result = await actorManager.transact(account.did, (store) => {
				return store.repo.applyWrites(
					[
						{
							action: 'delete',
							collection: input.collection,
							rkey: input.rkey,
							swapRecord: input.swapRecord ?? undefined,
						},
					],
					{
						swapCommit: input.swapCommit ?? undefined,
					},
				);
			});

			return json({
				commit: {
					cid: result.commit.cid,
					rev: result.commit.rev,
				},
			});
		},
	});
};
