import { parseCanonicalResourceUri, type CanonicalResourceUri } from '@atcute/lexicons';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAdminUpdateSubjectStatus } from '@kelinci/danaus-lexicons';

import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.admin.updateSubjectStatus` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const updateSubjectStatus = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager, authVerifier, sequencer } = context;

	router.addProcedure(LocalDanausAdminUpdateSubjectStatus, {
		async handler({ input, request }) {
			await authVerifier.admin(request);

			const { subject, takedown, deactivated } = input;

			const isRecord = 'uri' in subject;
			const isBlob = !isRecord && 'cid' in subject;

			if (takedown) {
				if (isRecord) {
					const parsed = parseCanonicalResourceUri(subject.uri);
					if (!parsed.ok) {
						throw new InvalidRequestError({ error: 'InvalidRequest', description: parsed.error });
					}

					const recordUri =
						`at://${parsed.value.repo}/${parsed.value.collection}/${parsed.value.rkey}` as CanonicalResourceUri;
					await actorManager.transact(parsed.value.repo, async (store) => {
						const existing = store.record.getRecord(recordUri);
						if (!existing) {
							throw new InvalidRequestError({
								error: 'RecordNotFound',
								description: `record not found`,
							});
						}

						store.record.updateRecordTakedownStatus(recordUri, takedown);
					});
				} else if (isBlob) {
					await actorManager.transact(subject.did, async (store) => {
						const metadata = store.blob.getBlobMetadata(subject.cid);
						if (!metadata) {
							throw new InvalidRequestError({
								error: 'BlobNotFound',
								description: `blob not found`,
							});
						}

						store.blob.updateBlobTakedownStatus(subject.cid, takedown);
					});
				} else {
					const account = accountManager.getAccount(subject.did, {
						includeDeactivated: true,
						includeTakenDown: true,
					});
					if (!account) {
						throw new InvalidRequestError({
							error: 'NotFound',
							description: `account not found`,
						});
					}

					accountManager.updateAccountTakedownStatus(subject.did, takedown);
				}
			}

			if (deactivated) {
				if (isRecord || isBlob) {
					throw new InvalidRequestError({
						error: 'InvalidRequest',
						description: `deactivated is only valid for accounts`,
					});
				}

				const account = accountManager.getAccount(subject.did, {
					includeDeactivated: true,
					includeTakenDown: true,
				});
				if (!account) {
					throw new InvalidRequestError({
						error: 'NotFound',
						description: `account not found`,
					});
				}

				accountManager.updateAccountDeactivatedStatus(subject.did, deactivated);
			}

			if (!isRecord && !isBlob) {
				const status = accountManager.getAccountStatus(subject.did);
				await sequencer.emitAccount(subject.did, status);
			}

			return json({
				subject: subject,
				takedown: takedown,
			});
		},
	});
};
