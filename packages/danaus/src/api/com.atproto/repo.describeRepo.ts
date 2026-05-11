import { ComAtprotoRepoDescribeRepo } from '@atcute/atproto';
import type { AtprotoDid } from '@atcute/lexicons/syntax';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.describeRepo` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const describeRepo = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, didDocumentResolver, handleResolver } = context;

	router.addQuery(ComAtprotoRepoDescribeRepo, {
		async handler({ params }) {
			const { repo } = params;

			const account = accountManager.getAccount(repo, {
				includeDeactivated: true,
				includeTakenDown: true,
			});
			if (!account) {
				throw new InvalidRequestError({
					error: 'RepoNotFound',
					message: `repository not found`,
				});
			}

			if (account.takedown_ref) {
				throw new InvalidRequestError({
					error: 'RepoTakendown',
					message: `repository has been taken down`,
				});
			}

			if (account.deactivated_at) {
				throw new InvalidRequestError({
					error: 'RepoDeactivated',
					message: `repository has been deactivated`,
				});
			}

			let didDoc: unknown;
			try {
				// oxlint-disable-next-line no-unsafe-type-assertion -- DID is known to be atproto
				didDoc = await didDocumentResolver.resolve(account.did as AtprotoDid);
			} catch {
				throw new InvalidRequestError({
					error: 'DidNotResolved',
					message: `could not resolve did document`,
				});
			}

			const handle = account.handle ?? 'handle.invalid';
			let handleIsCorrect = false;
			if (account.handle) {
				try {
					const resolved = await handleResolver.resolve(account.handle, { noCache: true });
					handleIsCorrect = resolved === account.did;
				} catch {
					handleIsCorrect = false;
				}
			}

			const collections = await actorManager.read(account.did, (store) => store.record.listCollections());

			return json({
				handle: handle,
				did: account.did,
				// oxlint-disable-next-line no-unsafe-type-assertion -- DID document from resolver
				didDoc: didDoc as Record<string, unknown>,
				collections: collections,
				handleIsCorrect: handleIsCorrect,
			});
		},
	});
};
