import { ComAtprotoSyncGetRecord } from '@atcute/atproto';
import { findRpathAndBuildProof, MemoryBlockStore, NodeStore, OverlayBlockStore } from '@atcute/mst';
import { InvalidRequestError, type XRPCRouter } from '@atcute/xrpc-server';

import { SqlRepoReadonlyBlockStore } from '#app/actors/repo/block-store.ts';
import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, carStreamFromBlocks, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.getRecord` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getRecord = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncGetRecord, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request);
			const { did, collection, rkey } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));

			const result = await actorManager.read(did, async (store) => {
				const root = store.repo.getRoot();
				if (!root) {
					throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
				}

				const nodeStore = new NodeStore(
					new OverlayBlockStore(new MemoryBlockStore(), new SqlRepoReadonlyBlockStore(store.db)),
				);
				const path = `${collection}/${rkey}`;
				const [recordLink, proofCids] = await findRpathAndBuildProof(nodeStore, root.commit.data.$link, path);
				if (!recordLink) {
					throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
				}

				const blocks = new Map<string, Uint8Array>();
				blocks.set(root.cid, root.bytes);

				for (const cid of proofCids) {
					if (blocks.has(cid)) {
						continue;
					}

					// oxlint-disable-next-line no-await-in-loop -- sequential node fetching
					const node = await nodeStore.get(cid);
					// oxlint-disable-next-line no-await-in-loop
					blocks.set(cid, await node.serialize());
				}

				const recordCid = recordLink.$link;
				const recordBytes = store.repo.getBlocksByCid([recordCid]).get(recordCid);
				if (!recordBytes) {
					throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
				}

				blocks.set(recordCid, recordBytes);

				return { rootCid: root.cid, blocks: blocks };
			});

			const stream = carStreamFromBlocks([result.rootCid], result.blocks);

			return new Response(stream, {
				headers: {
					'content-type': 'application/vnd.ipld.car',
				},
			});
		},
	});
};
