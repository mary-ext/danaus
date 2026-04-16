import { parseCanonicalResourceUri, type CanonicalResourceUri } from '@atcute/lexicons';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAdminGetSubjectStatus } from '@kelinci/danaus-lexicons';

import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.admin.getSubjectStatus` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getSubjectStatus = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier } = context;

	router.addQuery(LocalDanausAdminGetSubjectStatus, {
		async handler({ params, request }) {
			await authVerifier.admin(request);

			const { did, uri, blob } = params;
			let body: LocalDanausAdminGetSubjectStatus.$output | null = null;

			if (blob) {
				if (!did) {
					throw new InvalidRequestError({
						error: 'InvalidRequest',
						description: `did is required when requesting blob status`,
					});
				}

				const takedown = await actorManager.read(did, (store) => store.blob.getBlobTakedownStatus(blob));

				if (takedown) {
					body = {
						subject: {
							$type: 'local.danaus.admin.defs#repoBlobRef',
							did: did,
							cid: blob,
						},
						takedown: takedown,
					};
				}
			} else if (uri) {
				const parsed = parseCanonicalResourceUri(uri);
				if (!parsed.ok) {
					throw new InvalidRequestError({ error: 'InvalidRequest', description: parsed.error });
				}

				const recordUri: CanonicalResourceUri = `at://${parsed.value.repo}/${parsed.value.collection}/${parsed.value.rkey}`;
				const { takedown, cid } = await actorManager.read(parsed.value.repo, (store) => {
					return {
						takedown: store.record.getRecordTakedownStatus(recordUri),
						cid: store.record.getCurrentRecordCid(recordUri),
					};
				});

				if (cid && takedown) {
					body = {
						subject: {
							$type: 'com.atproto.repo.strongRef',
							uri: recordUri,
							cid: cid,
						},
						takedown: takedown,
					};
				}
			} else if (did) {
				const status = accountManager.getAccountAdminStatus(did);
				if (status) {
					body = {
						subject: {
							$type: 'local.danaus.admin.defs#repoRef',
							did: did,
						},
						takedown: status.takedown,
						deactivated: status.deactivated,
					};
				}
			} else {
				throw new InvalidRequestError({
					error: 'InvalidRequest',
					description: `no subject provided`,
				});
			}

			if (!body) {
				throw new InvalidRequestError({ error: 'NotFound', description: `subject not found` });
			}

			return json(body);
		},
	});
};
