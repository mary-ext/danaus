import { ComAtprotoRepoPutRecord } from '@atcute/atproto';
import type { CanonicalResourceUri } from '@atcute/lexicons';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { RepoWriteOp } from '#app/actors/repo/types.ts';
import type { AppContext } from '#app/context.ts';
import { validateRecordWrites } from '#app/lexicon/validate-writes.ts';

/**
 * register the `com.atproto.repo.putRecord` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const putRecord = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier, lexiconCache } = context;

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

			const uri = `at://${account.did}/${input.collection}/${input.rkey}` as CanonicalResourceUri;

			// validate before transaction (validation doesn't depend on create vs update)
			const writes: RepoWriteOp[] = [
				{
					action: 'create', // placeholder - actual action determined in transaction
					collection: input.collection,
					rkey: input.rkey,
					swapRecord: input.swapRecord,
					record: input.record,
				},
			];

			await validateRecordWrites(lexiconCache, writes, input.validate);

			// check if record exists and write in same transaction (upsert behavior)
			const result = await actorManager.transact(account.did, (store) => {
				const exists = store.record.getRecord(uri) !== null;
				const action = exists ? 'update' : 'create';

				return store.repo.applyWrites(
					[
						{
							action,
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
