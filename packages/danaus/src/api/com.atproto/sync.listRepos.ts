import { ComAtprotoSyncListRepos } from '@atcute/atproto';
import type { Did } from '@atcute/lexicons';
import { json, type XRPCRouter } from '@atcute/xrpc-server';

import { formatAccountStatus } from '#app/accounts/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.sync.listRepos` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const listRepos = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager } = context;

	router.addQuery(ComAtprotoSyncListRepos, {
		async handler({ params }) {
			const { limit, cursor } = params;

			const { accounts, cursor: nextCursor } = accountManager.listAccounts({
				limit: limit,
				cursor: cursor,
				includeDeactivated: true,
				includeTakenDown: true,
			});

			const repos: Array<{
				did: Did;
				head: string;
				rev: string;
				active?: boolean;
				status?: string;
			}> = [];

			for (const account of accounts) {
				// oxlint-disable-next-line no-await-in-loop -- sequential per-account reads
				const root = await actorManager.read(account.did, (store) => store.repo.getRoot());
				if (!root) {
					continue;
				}

				const { active, status } = formatAccountStatus(account);

				repos.push({
					did: account.did,
					head: root.cid,
					rev: root.rev,
					active: active,
					status: status,
				});
			}

			return json({
				repos: repos,
				cursor: nextCursor,
			});
		},
	});
};
