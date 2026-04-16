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

			const { stream, result } = hashingStream(request.body, config.service.blobs.maxUploadSize);

			const tempKey = await blobStore.putTemp(stream);

			const { digest, size: hashSize } = await result;

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
						size: hashSize,
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
					size: hashSize,
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

interface HashingStreamResult {
	stream: ReadableStream<Uint8Array>;
	result: Promise<{ digest: Uint8Array; size: number }>;
}

/**
 * create a passthrough stream that hashes data as it flows through.
 * uses pull-based reading to work with bun's stream implementation.
 * @param input input stream
 * @param maxSize maximum allowed size
 * @returns passthrough stream and promise for digest and size
 */
const hashingStream = (input: ReadableStream<Uint8Array>, maxSize: number): HashingStreamResult => {
	const hasher = createHash('sha256');
	let size = 0;

	const { promise: result, resolve, reject } = Promise.withResolvers<{ digest: Uint8Array; size: number }>();

	let reader: ReadableStreamDefaultReader<Uint8Array>;

	const stream = new ReadableStream<Uint8Array>({
		start() {
			// oxlint-disable-next-line no-unsafe-type-assertion -- ReadableStream reader type mismatch
			reader = input.getReader() as any;
		},
		async pull(controller) {
			try {
				const { done, value } = await reader.read();

				if (done) {
					resolve({ digest: new Uint8Array(hasher.digest()), size });
					controller.close();
					return;
				}

				size += value.length;

				if (size > maxSize) {
					const err = new InvalidRequestError({
						error: 'BlobTooLarge',
						description: `blob exceeds upload size limit`,
					});
					reject(err);
					controller.error(new Error('blob too large'));
					void reader.cancel();
					return;
				}

				hasher.update(value);
				controller.enqueue(value);
			} catch (err) {
				reject(err);
				controller.error(err);
			}
		},
		cancel() {
			void reader.cancel();
		},
	});

	return { stream, result };
};
