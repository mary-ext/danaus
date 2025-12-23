import type { BlockMap, ReadonlyBlockStore } from '@atcute/mst';

import { inArray } from 'drizzle-orm';

import type { ActorDbConnection } from '../actor-store-types';
import { t } from '../db';

/**
 * read-only block store backed by repo_block.
 */
export class SqlRepoReadonlyBlockStore implements ReadonlyBlockStore {
	protected readonly db: ActorDbConnection;

	/**
	 * create a repo block store.
	 * @param db actor database handle or transaction
	 */
	constructor(db: ActorDbConnection) {
		this.db = db;
	}

	async get(cid: string): Promise<Uint8Array<ArrayBuffer> | null> {
		const row = this.db
			.select({ content: t.repoBlock.content })
			.from(t.repoBlock)
			.where(inArray(t.repoBlock.cid, [cid]))
			.get();

		const content = row?.content;
		return content ? new Uint8Array(content) : null;
	}

	async getMany(cids: string[]): Promise<{ found: BlockMap; missing: string[] }> {
		const found: BlockMap = new Map();
		if (cids.length === 0) {
			return { found, missing: [] };
		}

		const rows = this.db
			.select({ cid: t.repoBlock.cid, content: t.repoBlock.content })
			.from(t.repoBlock)
			.where(inArray(t.repoBlock.cid, cids))
			.all();

		for (const row of rows) {
			found.set(row.cid, new Uint8Array(row.content));
		}

		const missing = cids.filter((cid) => !found.has(cid));

		return { found, missing };
	}

	async has(cid: string): Promise<boolean> {
		const row = this.db
			.select({ cid: t.repoBlock.cid })
			.from(t.repoBlock)
			.where(inArray(t.repoBlock.cid, [cid]))
			.get();

		return row !== undefined;
	}
}
