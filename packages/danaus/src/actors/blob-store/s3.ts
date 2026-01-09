import { S3Client } from 'bun';

import type { Did } from '@atcute/lexicons';

import { nanoid } from 'nanoid';

import type { S3BlobStoreConfig } from '#app/config.ts';

import type { BlobStore } from './types';

export class S3BlobStore implements BlobStore {
	readonly did: Did;

	private readonly client: S3Client;

	constructor(did: Did, config: S3BlobStoreConfig) {
		this.did = did;

		this.client = new S3Client({
			bucket: config.bucket,
			region: config.region ?? undefined,
			endpoint: config.endpoint ?? undefined,
			accessKeyId: config.credentials?.accessKeyId ?? undefined,
			secretAccessKey: config.credentials?.secretAccessKey ?? undefined,
		});
	}

	static factory(config: S3BlobStoreConfig): (did: Did) => S3BlobStore {
		return (did: Did) => {
			return new S3BlobStore(did, config);
		};
	}

	private getTempPath(key: string): string {
		return `tmp/${this.did}/${key}`;
	}

	private getStoredPath(cid: string): string {
		return `blocks/${this.did}/${cid}`;
	}

	async putTemp(stream: ReadableStream<Uint8Array>): Promise<string> {
		const tempKey = nanoid();

		const temp = this.client.file(this.getTempPath(tempKey));
		const writer = temp.writer();

		for await (const chunk of stream) {
			writer.write(chunk);
		}

		await writer.end();

		return tempKey;
	}

	async putPermanent(cid: string, data: Request): Promise<void> {
		const file = this.client.file(this.getStoredPath(cid));
		await file.write(data);
	}

	async makePermanent(tempKey: string, cid: string): Promise<void> {
		const temp = this.client.file(this.getTempPath(tempKey));
		const stored = this.client.file(this.getStoredPath(cid));

		if (await stored.exists()) {
			await temp.delete();
			return;
		}

		await stored.write(temp);
		await temp.delete();
	}

	async hasTemp(tempKey: string): Promise<boolean> {
		const temp = this.client.file(this.getTempPath(tempKey));

		return await temp.exists();
	}

	async hasPermanent(cid: string): Promise<boolean> {
		const file = this.client.file(this.getStoredPath(cid));

		return await file.exists();
	}

	async getBlob(cid: string): Promise<Blob> {
		const file = this.client.file(this.getStoredPath(cid));

		return file;
	}

	async delete(cid: string): Promise<void> {
		const file = this.client.file(this.getStoredPath(cid));

		await file.delete();
	}

	async deleteMany(cid: string[]): Promise<void> {
		const set = new Set(cid);

		await Promise.all(Array.from(set, (cid) => this.delete(cid)));
	}
}
