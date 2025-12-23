import { createSecretKey } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Client, simpleFetchHandler } from '@atcute/client';
import { Secp256k1PrivateKeyExportable } from '@atcute/crypto';

import getPort from 'get-port';

import type { AppConfig, ProxyConfig, ServiceConfig } from '#app/config.ts';
import { PdsServer } from '#app/pds-server.ts';

import { ADMIN_PASSWORD, JWT_SECRET } from './const.ts';

const DEFAULT_HOSTNAME = 'localhost';
const DEFAULT_HANDLE_DOMAINS = ['.test', '.example'];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface TestPdsConfig extends Partial<AppConfig> {
	plcUrl: string;
	port?: number;
	/** persistent data directory; uses temp directory if not provided */
	dataDirectory?: string;
}

/**
 * test pds wrapper for dev env.
 */
export class TestPds implements AsyncDisposable {
	constructor(
		public url: string,
		public port: number,
		public server: PdsServer,
		private disposables: AsyncDisposableStack,
	) {}

	/**
	 * create and start a test pds instance.
	 * @param cfg pds config overrides
	 * @returns test pds instance
	 */
	static async create(cfg: TestPdsConfig): Promise<TestPds> {
		await using stack = new AsyncDisposableStack();

		const port = cfg.port ?? cfg.service?.port ?? (await getPort());
		const hostname = cfg.service?.hostname ?? DEFAULT_HOSTNAME;
		const publicUrl =
			cfg.service?.publicUrl ??
			(hostname === 'localhost' ? `http://localhost:${port}` : `https://${hostname}`);

		const rootDir = cfg.dataDirectory ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'danaus-')));
		const blobDir = path.join(rootDir, 'blobs');
		const blobTempDir = path.join(rootDir, 'blobs-temp');

		await fs.mkdir(rootDir, { recursive: true });
		await fs.mkdir(blobDir, { recursive: true });
		await fs.mkdir(blobTempDir, { recursive: true });

		const plcRotationKey = await Secp256k1PrivateKeyExportable.createKeypair();

		const service: ServiceConfig = {
			version: 'test',
			devMode: true,
			port: port,
			hostname: hostname,
			did: cfg.service?.did ?? `did:web:${hostname}`,
			publicUrl: publicUrl,
			imports: {
				accepting: true,
				maxSize: null,
			},
			blobs: {
				maxUploadSize: 100 * 1024 * 1024,
			},
			invites: {
				required: false,
			},
			branding: {
				name: `${hostname} PDS`,
				logoUrl: null,
				homeUrl: null,
				supportUrl: null,
				termsOfServiceUrl: null,
				privacyPolicyUrl: null,
				contactEmailAddress: null,
			},
			...cfg.service,
		};

		const proxy: ProxyConfig = {
			targets: new Map(),
			...cfg.proxy,
		};

		const config: AppConfig = {
			service,
			database: {
				accountDbLocation: path.join(rootDir, 'account.db'),
				sequencerDbLocation: path.join(rootDir, 'sequencer.db'),
				identityCacheDbLocation: path.join(rootDir, 'identity-cache.db'),
				walAutoCheckpointDisabled: false,
				...cfg.database,
			},
			actorStore: {
				directory: rootDir,
				walAutoCheckpointDisabled: false,
				...cfg.actorStore,
			},
			blobStore: cfg.blobStore ?? {
				provider: 'disk',
				directory: blobDir,
				tempDirectory: blobTempDir,
			},
			identity: {
				plcDirectoryUrl: cfg.plcUrl,
				resolverTimeoutMs: 3000,
				cacheStaleTtlMs: HOUR,
				cacheMaxTtlMs: DAY,
				plcRecoveryKey: null,
				serviceHandleDomains: DEFAULT_HANDLE_DOMAINS,
				...cfg.identity,
			},
			secrets: {
				adminPassword: ADMIN_PASSWORD,
				dpopSecret: null,
				jwtKey: createSecretKey(Buffer.from(JWT_SECRET)),
				plcRotationKey: plcRotationKey,
				...cfg.secrets,
			},
			subscription: {
				crawlers: [],
				maxBuffer: 500,
				repoBackfillLimitMs: DAY,
				...cfg.subscription,
			},
			email: cfg.email ?? null,
			proxy,
		};

		const server = new PdsServer({ config });
		stack.use(server);
		await server.start();

		return new TestPds(publicUrl, port, server, stack.move());
	}

	get ctx() {
		return this.server.context!;
	}

	getClient(): Client {
		return new Client({ handler: simpleFetchHandler({ service: this.url }) });
	}

	adminAuth(): string {
		return 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');
	}

	adminAuthHeaders() {
		return { authorization: this.adminAuth() };
	}

	async dispose(): Promise<void> {
		await this.disposables.disposeAsync();
	}

	async [Symbol.asyncDispose]() {
		await this.dispose();
	}

	/**
	 * process background work.
	 */
	async processAll(): Promise<void> {
		// no background queue yet.
	}

	/**
	 * close the server and release resources.
	 */
	async close(): Promise<void> {
		await this.dispose();
	}
}
