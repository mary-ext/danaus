import { ComAtprotoRepoApplyWrites } from '@atcute/atproto';
import type { CanonicalResourceUri, Nsid, RecordKey } from '@atcute/lexicons';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { RepoWriteOp } from '#app/actors/repo/types.ts';
import type { AppContext } from '#app/context.ts';

type WriteInput = {
	$type?: string;
	collection: Nsid;
	rkey?: RecordKey;
	value?: unknown;
};

type WriteResult =
	| { $type: 'com.atproto.repo.applyWrites#deleteResult' }
	| { $type: 'com.atproto.repo.applyWrites#createResult'; uri: CanonicalResourceUri; cid: string }
	| { $type: 'com.atproto.repo.applyWrites#updateResult'; uri: CanonicalResourceUri; cid: string };

/**
 * register the `com.atproto.repo.applyWrites` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const applyWrites = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier } = context;

	router.addProcedure(ComAtprotoRepoApplyWrites, {
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

			const writes = (input.writes as WriteInput[]).map((write): RepoWriteOp => {
				switch (write.$type) {
					case 'com.atproto.repo.applyWrites#create':
						return {
							action: 'create',
							collection: write.collection,
							rkey: write.rkey,
							record: write.value,
						};
					case 'com.atproto.repo.applyWrites#update':
						return {
							action: 'update',
							collection: write.collection,
							rkey: write.rkey,
							record: write.value,
						};
					case 'com.atproto.repo.applyWrites#delete':
						return {
							action: 'delete',
							collection: write.collection,
							rkey: write.rkey,
						};
				}

				if ('value' in write && write.value !== undefined) {
					if (write.rkey === undefined) {
						return {
							action: 'create',
							collection: write.collection,
							rkey: write.rkey,
							record: write.value,
						};
					}

					throw new InvalidRequestError({
						error: 'InvalidWrite',
						description: `ambiguous write action without $type`,
					});
				}

				return {
					action: 'delete',
					collection: write.collection,
					rkey: write.rkey,
				};
			});

			const result = await actorManager.transact(account.did, (store) => {
				return store.repo.applyWrites(writes, {
					swapCommit: input.swapCommit ?? undefined,
					validateBlobs: input.validate ?? true,
				});
			});

			const results: WriteResult[] = result.results.map((write) => {
				if (write.action === 'delete') {
					return {
						$type: 'com.atproto.repo.applyWrites#deleteResult',
					};
				}

				if (!write.cid) {
					throw new InvalidRequestError({ error: 'InvalidRecord', description: `record write failed` });
				}

				return {
					$type:
						write.action === 'create'
							? 'com.atproto.repo.applyWrites#createResult'
							: 'com.atproto.repo.applyWrites#updateResult',
					uri: write.uri,
					cid: write.cid,
				};
			});

			return json({
				commit: {
					cid: result.commit.cid,
					rev: result.commit.rev,
				},
				results: results,
			});
		},
	});
};
