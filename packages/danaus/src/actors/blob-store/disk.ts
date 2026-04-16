import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import * as path from 'node:path';

import type { Did } from '@atcute/lexicons';

import { nanoid } from 'nanoid';

import type { DiskBlobStoreConfig } from '#app/config.ts';
import { blobStoreLogger } from '#app/logger.ts';
import { isErrnoException } from '#app/utils/errors.ts';

import type { BlobStore } from './types';

export class DiskBlobStore implements BlobStore {
	readonly did: Did;

	private readonly directory: string;
	private readonly tempDirectory: string;

	constructor(did: Did, config: DiskBlobStoreConfig) {
		this.did = did;

		this.directory = path.join(config.directory, did);
		this.tempDirectory = path.join(config.tempDirectory ?? path.join(config.directory, 'temp'), did);
	}

	static factory(config: DiskBlobStoreConfig): (did: Did) => DiskBlobStore {
		return (did: Did) => {
			return new DiskBlobStore(did, config);
		};
	}

	private getTempPath(key: string): string {
		return path.join(this.tempDirectory, key);
	}

	private getStoredPath(cid: string): string {
		return path.join(this.directory, cid);
	}

	async putTemp(stream: ReadableStream<Uint8Array>): Promise<string> {
		const tempKey = nanoid();
		const tempPath = this.getTempPath(tempKey);

		await mkdir(this.tempDirectory, { recursive: true });

		const file = Bun.file(tempPath);
		const writer = file.writer();

		for await (const chunk of stream) {
			void writer.write(chunk);
		}

		await writer.end();

		return tempKey;
	}

	async putPermanent(cid: string, data: Request): Promise<void> {
		const file = Bun.file(this.getStoredPath(cid));
		await file.write(data);
	}

	async makePermanent(tempKey: string, cid: string): Promise<void> {
		const tempPath = this.getTempPath(tempKey);
		const storedPath = this.getStoredPath(cid);

		const temp = Bun.file(tempPath);
		const stored = Bun.file(storedPath);

		if (await stored.exists()) {
			try {
				await temp.delete();
			} catch (err) {
				if (isErrnoException(err) && err.code === 'ENOENT') {
					return;
				}

				blobStoreLogger.error('could not delete file from temp storage', { err, tmpPath: tempPath });
				throw err;
			}

			return;
		}

		await mkdir(this.directory, { recursive: true });

		try {
			await rename(tempPath, storedPath);
		} catch (err) {
			blobStoreLogger.warn('rename failed, falling back to copy', { err, tempPath, storedPath });
			await copyFile(tempPath, storedPath);
			await rm(tempPath, { force: true });
		}
	}

	async hasTemp(tempKey: string): Promise<boolean> {
		const temp = Bun.file(this.getTempPath(tempKey));

		return await temp.exists();
	}

	async hasPermanent(cid: string): Promise<boolean> {
		const file = Bun.file(this.getStoredPath(cid));

		return await file.exists();
	}

	async getBlob(cid: string): Promise<Blob> {
		const file = Bun.file(this.getStoredPath(cid));

		return file;
	}

	async delete(cid: string): Promise<void> {
		await rm(this.getStoredPath(cid), { force: true });
	}

	async deleteMany(cid: string[]): Promise<void> {
		const set = new Set(cid);

		await Promise.all(Array.from(set, (c) => this.delete(c)));
	}

	async deleteAll(): Promise<void> {
		await rm(this.directory, { recursive: true, force: true });
		await rm(this.tempDirectory, { recursive: true, force: true });
	}
}
