import { createHash } from 'node:crypto';

import { ComAtprotoRepoUploadBlob } from '@atcute/atproto';
import * as CID from '@atcute/cid';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import { isNotNull } from 'drizzle-orm';

import { t } from '#app/actors/db/index.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.repo.uploadBlob` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const uploadBlob = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, authVerifier, config } = context;

	router.addProcedure(ComAtprotoRepoUploadBlob, {
		async handler({ request }) {
			const auth = await authVerifier.authorization(request, {
				checkDeactivated: true,
				checkTakedown: true,
			});

			const mimeType = request.headers.get('content-type') ?? 'application/octet-stream';

			const blobStore = actorManager.resources.createBlobStore(auth.did);

			const [{ digest, size }, tempKey] = await Promise.all([
				hashBlob(request.clone() as Request, config.service.blobs.maxUploadSize),
				blobStore.putTemp(request),
			]);

			const cid = CID.toString(CID.fromDigest(CID.CODEC_RAW, digest));

			const metadata = await actorManager.transact(auth.did, async (store) => {
				const found = store.blob.getBlobMetadata(cid);

				if (found !== null && found.takedownRef !== null) {
					throw new InvalidRequestError({
						error: 'BlobTakedown',
						description: `blob has been taken down, cannot reupload`,
					});
				}

				store.db
					.insert(t.blob)
					.values({
						cid: cid,
						created_at: new Date(),
						mime_type: mimeType,
						size: size,
						temp_key: tempKey,
					})
					.onConflictDoUpdate({
						target: t.blob.cid,
						set: {
							temp_key: tempKey,
						},
						setWhere: isNotNull(t.blob.cid),
					})
					.run();

				return {
					cid: cid,
					mimeType: mimeType,
					size: size,
				};
			});

			return json({
				blob: {
					$type: 'blob',
					ref: { $link: metadata.cid },
					mimeType: metadata.mimeType,
					size: metadata.size,
				},
			});
		},
	});
};

const hashBlob = async (request: Request, maxSize: number): Promise<{ digest: Uint8Array; size: number }> => {
	const hasher = createHash('sha256');
	let size = 0;

	for await (const chunk of request.body!) {
		size += chunk.length;

		if (size > maxSize) {
			throw new InvalidRequestError({
				error: 'BlobTooLarge',
				description: `blob exceeds upload size limit`,
			});
		}

		hasher.update(chunk);
	}

	return { digest: new Uint8Array(hasher.digest()), size };
};
