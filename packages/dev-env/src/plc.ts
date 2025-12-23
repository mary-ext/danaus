import { Client as PlcClient } from '@did-plc/lib';
import * as plc from '@did-plc/server';
import getPort from 'get-port';

import type { PlcConfig } from './types.ts';

export class TestPlc implements AsyncDisposable {
	constructor(
		public url: string,
		public port: number,
		public server: plc.PlcServer,
	) {}

	static async create(cfg: PlcConfig = {}): Promise<TestPlc> {
		let db: plc.PlcDatabase;
		if (cfg.dbPostgresUrl) {
			const pgDb = plc.Database.postgres({ url: cfg.dbPostgresUrl, schema: cfg.dbPostgresSchema });
			await pgDb.migrateToLatestOrThrow();
			db = pgDb;
		} else {
			db = plc.Database.mock();
		}

		const port = cfg.port ?? (await getPort());
		const url = `http://localhost:${port}`;
		const server = plc.PlcServer.create({ db, port, ...cfg });
		await server.start();
		return new TestPlc(url, port, server);
	}

	get ctx(): plc.AppContext {
		return this.server.ctx;
	}

	getClient(): PlcClient {
		return new PlcClient(this.url);
	}

	async dispose(): Promise<void> {
		await this.server.destroy();
	}

	async [Symbol.asyncDispose]() {
		await this.dispose();
	}
}
