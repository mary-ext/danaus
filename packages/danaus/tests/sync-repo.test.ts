import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import {
	ComAtprotoRepoDeleteRecord,
	ComAtprotoRepoPutRecord,
	ComAtprotoSyncGetBlob,
	ComAtprotoSyncGetBlocks,
	ComAtprotoSyncGetRecord,
	ComAtprotoSyncGetRepo,
} from '@atcute/atproto';
import type { AppBskyFeedPost } from '@atcute/bluesky';
import { fromUint8Array } from '@atcute/car';
import * as CID from '@atcute/cid';
import { Client, ok } from '@atcute/client';
import { parseCanonicalResourceUri, type Blob, type Cid, type Did, type Nsid } from '@atcute/lexicons';
import type { AtprotoDid, ResourceUri } from '@atcute/lexicons/syntax';
import { verifyRecord } from '@atcute/repo';

import { SeedClient, TestNetworkNoAppView } from '#app/test/index.ts';

const parseCanonicalUri = (uri: string) => {
	const result = parseCanonicalResourceUri(uri);
	if (!result.ok) {
		throw new Error(`invalid at-uri: ${uri}`);
	}

	return result.value;
};

describe('core sync and repo', () => {
	let network: TestNetworkNoAppView;
	let client: Client;
	let sc: SeedClient;
	let did: Did;
	let record: AppBskyFeedPost.Main;
	let recordUri: ResourceUri;
	let recordCid: Cid;
	let recordCollection: Nsid;
	let recordRkey: string;

	beforeAll(async () => {
		network = await TestNetworkNoAppView.create();
		client = network.pds.getClient();
		sc = network.getSeedClient();
		await sc.createAccount('alice', {
			email: 'alice@test.com',
			handle: 'alice.test',
			password: 'alice-pass',
		});

		did = sc.dids.alice!;
		record = {
			$type: 'app.bsky.feed.post',
			text: 'hello from sync tests',
			createdAt: new Date().toISOString(),
		};

		const created = await sc.createRecord(did, 'app.bsky.feed.post', record);
		recordUri = created.uri;
		recordCid = created.cid;
		const parsed = parseCanonicalUri(recordUri);
		recordCollection = parsed.collection;
		recordRkey = parsed.rkey;
	});

	afterAll(async () => {
		if (network) {
			await network.close();
		}
	});

	it('sync.getRecord returns a proof containing the record', async () => {
		const res = await ok(
			client.call(ComAtprotoSyncGetRecord, {
				as: 'bytes',
				params: {
					did,
					collection: recordCollection,
					rkey: recordRkey,
				},
			}),
		);

		const { record: found, cid } = await verifyRecord({
			did: did as AtprotoDid,
			collection: recordCollection,
			rkey: recordRkey,
			carBytes: res,
		});

		expect(cid).toBe(recordCid);
		expect((found as AppBskyFeedPost.Main).text).toBe(record.text);
	});

	it('sync.getRepo includes the created record', async () => {
		const res = await ok(
			client.call(ComAtprotoSyncGetRepo, {
				as: 'bytes',
				params: {
					did,
				},
			}),
		);

		const { record: found, cid } = await verifyRecord({
			did: did as AtprotoDid,
			collection: recordCollection,
			rkey: recordRkey,
			carBytes: res,
		});

		expect(cid).toBe(recordCid);
		expect((found as AppBskyFeedPost.Main).text).toBe(record.text);
	});

	it('sync.getBlocks returns requested blocks', async () => {
		const recordRes = await ok(
			client.call(ComAtprotoSyncGetRecord, {
				as: 'bytes',
				params: {
					did,
					collection: recordCollection,
					rkey: recordRkey,
				},
			}),
		);

		const recordCar = fromUint8Array(recordRes);
		const recordBlocks = new Map<string, Uint8Array>();
		for (const entry of recordCar) {
			const cid = CID.toString(entry.cid);
			recordBlocks.set(cid, entry.bytes);
		}

		const cids = Array.from(recordBlocks.keys());
		const blocksRes = await ok(
			client.call(ComAtprotoSyncGetBlocks, {
				as: 'bytes',
				params: {
					did,
					cids,
				},
			}),
		);

		const blocksCar = fromUint8Array(blocksRes);
		const blocks = new Map<string, Uint8Array>();
		for (const entry of blocksCar) {
			const cid = CID.toString(entry.cid);
			blocks.set(cid, entry.bytes);
		}

		expect(blocks.size).toBe(recordBlocks.size);
		for (const [cid, bytes] of recordBlocks) {
			const received = blocks.get(cid);
			if (!received) {
				throw new Error(`missing block for ${cid}`);
			}

			expect(received).toEqual(bytes);
		}
	});

	it('repo.putRecord updates an existing record', async () => {
		const updated: AppBskyFeedPost.Main = {
			...record,
			text: 'updated post text',
		};

		const putRes = await ok(
			client.call(ComAtprotoRepoPutRecord, {
				input: {
					repo: did,
					collection: recordCollection,
					rkey: recordRkey,
					record: updated,
				},
				headers: sc.getHeaders(did),
			}),
		);

		expect(putRes.uri).toBe(recordUri);

		const carRes = await ok(
			client.call(ComAtprotoSyncGetRecord, {
				as: 'bytes',
				params: {
					did,
					collection: recordCollection,
					rkey: recordRkey,
				},
			}),
		);

		const { record: found, cid } = await verifyRecord({
			did: did as AtprotoDid,
			collection: recordCollection,
			rkey: recordRkey,
			carBytes: carRes,
		});

		expect(cid).toBe(putRes.cid);
		expect((found as AppBskyFeedPost.Main).text).toBe(updated.text);

		recordCid = putRes.cid;
		record = updated;
	});

	it('repo.deleteRecord removes the record', async () => {
		await ok(
			client.call(ComAtprotoRepoDeleteRecord, {
				input: {
					repo: did,
					collection: recordCollection,
					rkey: recordRkey,
				},
				headers: sc.getHeaders(did),
			}),
		);

		const attempt = ok(
			client.call(ComAtprotoSyncGetRecord, {
				as: 'bytes',
				params: {
					did,
					collection: recordCollection,
					rkey: recordRkey,
				},
			}),
		);

		await expect(attempt).rejects.toThrow('RecordNotFound');
	});

	it('repo.uploadBlob stores data for sync.getBlob', async () => {
		const bytes = new TextEncoder().encode('blob payload');
		const blob = await sc.uploadBlob(did, bytes, 'text/plain');

		await sc.post(did, 'blob post', undefined, [{ image: blob, alt: 'blob' }]);

		const blobRes = await ok(
			client.call(ComAtprotoSyncGetBlob, {
				as: 'bytes',
				params: {
					did,
					cid: (blob as Blob).ref.$link,
				},
			}),
		);

		expect(blobRes).toEqual(bytes);
	});
});
