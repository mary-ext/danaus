import http from 'node:http';

import { Client, simpleFetchHandler } from '@atcute/client';

import * as bsky from '@atproto/bsky';
import { Secp256k1Keypair } from '@atproto/crypto';
import type { IdResolver } from '@atproto/identity';
import getPort from 'get-port';

import { ADMIN_PASSWORD, EXAMPLE_LABELER } from './const.ts';
import type { BskyConfig } from './types.ts';

/**
 * mock handle resolution to go through the PDS's /.well-known/atproto-did endpoint.
 * @param idResolver resolver to patch
 * @param pdsUrl pds base url
 * @param serviceHandleDomains handle domains to intercept
 */
const mockHandleResolver = (idResolver: IdResolver, pdsUrl: string, serviceHandleDomains: string[]) => {
	const origResolve = idResolver.handle.resolve.bind(idResolver.handle);
	const parsedPdsUrl = new URL(pdsUrl);

	idResolver.handle.resolve = async (handle: string) => {
		const isPdsHandle = serviceHandleDomains.some((domain) => handle.endsWith(domain));
		if (!isPdsHandle) {
			return origResolve(handle);
		}

		return new Promise<string | undefined>((resolve) => {
			const req = http.request(
				{
					hostname: parsedPdsUrl.hostname,
					port: parsedPdsUrl.port,
					path: '/.well-known/atproto-did',
					method: 'GET',
					headers: { host: handle },
				},
				(res) => {
					if (res.statusCode !== 200) {
						res.resume();
						resolve(undefined);
						return;
					}

					let data = '';
					res.setEncoding('utf8');
					res.on('data', (chunk) => (data += chunk));
					res.on('end', () => resolve(data));
				},
			);

			req.on('error', () => resolve(undefined));
			req.end();
		});
	};
};

export class TestBsky implements AsyncDisposable {
	constructor(
		public url: string,
		public port: number,
		public db: bsky.Database,
		public server: bsky.BskyAppView,
		public dataplane: bsky.DataPlaneServer,
		public bsync: bsky.MockBsync,
		public sub: bsky.RepoSubscription,
		public serverDid: string,
		private disposables: AsyncDisposableStack,
	) {}

	static async create(cfg: BskyConfig): Promise<TestBsky> {
		await using stack = new AsyncDisposableStack();

		const serviceKeypair = cfg.privateKey
			? await Secp256k1Keypair.import(cfg.privateKey)
			: await Secp256k1Keypair.create();

		const port = cfg.port ?? (await getPort());
		const url = `http://localhost:${port}`;

		// use did:web - the bsky server serves /.well-known/did.json automatically
		const serverDid = `did:web:localhost%3A${port}`;

		// database - shared across server, ingester, and indexer to share pool
		const db = new bsky.Database({
			url: cfg.dbPostgresUrl,
			schema: cfg.dbPostgresSchema,
			poolSize: 10,
		});
		stack.defer(() => db.close());

		// dataplane
		const dataplanePort = await getPort();
		const dataplane = await bsky.DataPlaneServer.create(db, dataplanePort, cfg.plcUrl);
		stack.defer(() => dataplane.destroy());

		// bsync mock
		const bsyncPort = await getPort();
		const bsyncMock = await bsky.MockBsync.create(db, bsyncPort);
		stack.defer(() => bsyncMock.destroy());

		// server config
		const config = new bsky.ServerConfig({
			version: 'unknown',
			port,
			didPlcUrl: cfg.plcUrl,
			publicUrl: 'https://bsky.public.url',
			serverDid,
			alternateAudienceDids: [],
			dataplaneUrls: [`http://localhost:${dataplanePort}`],
			dataplaneHttpVersion: '1.1',
			bsyncUrl: `http://localhost:${bsyncPort}`,
			bsyncHttpVersion: '1.1',
			modServiceDid: cfg.modServiceDid ?? 'did:example:invalidMod',
			labelsFromIssuerDids: [EXAMPLE_LABELER],
			bigThreadUris: new Set(),
			maxThreadParents: cfg.maxThreadParents ?? 50,
			disableSsrfProtection: true,
			searchTagsHide: new Set(),
			threadTagsBumpDown: new Set(),
			threadTagsHide: new Set(),
			visibilityTagHide: '',
			visibilityTagRankPrefix: '',
			debugFieldAllowedDids: new Set(),
			...cfg,
			adminPasswords: [ADMIN_PASSWORD],
			etcdHosts: [],
		});

		// run migrations - separate db in case migration changes connection state
		const migrationDb = new bsky.Database({
			url: cfg.dbPostgresUrl,
			schema: cfg.dbPostgresSchema,
		});
		if (cfg.migration) {
			await migrationDb.migrateToOrThrow(cfg.migration);
		} else {
			await migrationDb.migrateToLatestOrThrow();
		}
		await migrationDb.close();

		// api server
		const server = bsky.BskyAppView.create({
			config,
			signingKey: serviceKeypair,
		});
		stack.defer(() => server.destroy());

		// subscription to PDS firehose
		const sub = new bsky.RepoSubscription({
			service: cfg.repoProvider,
			db,
			idResolver: dataplane.idResolver,
		});
		stack.defer(() => sub.destroy());

		// mock handle resolution to go through the PDS
		{
			const pdsUrl = `http://localhost:${cfg.pdsPort}`;
			const serviceHandleDomains = cfg.serviceHandleDomains ?? ['.test'];

			mockHandleResolver(dataplane.idResolver, pdsUrl, serviceHandleDomains);
			mockHandleResolver(server.ctx.idResolver, pdsUrl, serviceHandleDomains);
		}

		await server.start();
		sub.start();

		return new TestBsky(url, port, db, server, dataplane, bsyncMock, sub, serverDid, stack.move());
	}

	get ctx(): bsky.AppContext {
		return this.server.ctx;
	}

	adminAuth(): string {
		const [password] = this.ctx.cfg.adminPasswords;
		return 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');
	}

	adminAuthHeaders() {
		return { authorization: this.adminAuth() };
	}

	getClient(): Client {
		return new Client({ handler: simpleFetchHandler({ service: this.url }) });
	}

	async dispose(): Promise<void> {
		await this.disposables.disposeAsync();
	}

	async [Symbol.asyncDispose]() {
		await this.dispose();
	}
}
