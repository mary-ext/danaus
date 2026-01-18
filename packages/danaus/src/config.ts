import { createSecretKey, type KeyObject } from 'node:crypto';
import * as path from 'node:path';

import { Secp256k1PrivateKeyExportable, type PrivateKey } from '@atcute/crypto';
import type { AtprotoAudience, Did, Nsid } from '@atcute/lexicons/syntax';

import type { AppEnvironment } from './environment';
import { DAY, HOUR, SECOND } from './utils/times';

export interface ServiceConfig {
	version: string;
	devMode: boolean;

	port: number;
	hostname: string;

	did: Did;
	publicUrl: string;
	publicAssetsDirectory: string;

	imports: {
		accepting: boolean;
		maxSize: number | null;
	};

	blobs: {
		maxUploadSize: number;
	};

	registration: 'open' | 'invite-only' | 'none';

	branding: {
		name: string;
		logoUrl: string | null;
		homeUrl: string | null;
		supportUrl: string | null;
		termsOfServiceUrl: string | null;
		privacyPolicyUrl: string | null;
		contactEmailAddress: string | null;
	};
}

export interface DatabaseConfig {
	accountDbLocation: string;
	sequencerDbLocation: string;
	identityCacheDbLocation: string;
	walAutoCheckpointDisabled: boolean;
}

export interface ActorStoreConfig {
	directory: string;
	walAutoCheckpointDisabled: boolean;
}

export interface S3BlobStoreConfig {
	provider: 's3';
	bucket: string;
	region: string | null;
	endpoint: string | null;
	forcePathStyle: boolean;
	uploadTimeoutMs: number;
	credentials: {
		accessKeyId: string;
		secretAccessKey: string;
	} | null;
}

export interface DiskBlobStoreConfig {
	provider: 'disk';
	directory: string;
	tempDirectory: string | null;
}

export type BlobStoreConfig = S3BlobStoreConfig | DiskBlobStoreConfig;

export interface IdentityConfig {
	plcDirectoryUrl: string;
	resolverTimeoutMs: number;
	cacheStaleTtlMs: number;
	cacheMaxTtlMs: number;
	plcRecoveryKey: Did<'key'> | null;
	serviceHandleDomains: string[];
}

export interface SecretsConfig {
	adminPassword: string | null;
	dpopSecret: string | null;
	jwtKey: KeyObject;
	plcRotationKey: PrivateKey;
}

export interface SubscriptionConfig {
	crawlers: string[];
	maxBuffer: number;
	repoBackfillLimitMs: number;
}

export interface EmailConfig {
	smtpUrl: string;
	fromAddress: string;
}

export interface ProxyTargetConfig {
	/** redirect to another audience */
	to?: AtprotoAudience;
	/** exclude these NSIDs from proxying */
	exclude?: Nsid[];
}

export interface ProxyConfig {
	/** per-audience proxy configuration */
	targets: Map<AtprotoAudience, ProxyTargetConfig>;
}

export interface AppConfig {
	service: ServiceConfig;
	database: DatabaseConfig;
	actorStore: ActorStoreConfig;
	blobStore: BlobStoreConfig;
	identity: IdentityConfig;
	secrets: SecretsConfig;
	subscription: SubscriptionConfig;
	email: EmailConfig | null;
	proxy: ProxyConfig;
}

export const toAppConfig = async (env: AppEnvironment): Promise<AppConfig> => {
	const locate = (name: string) => {
		return env.PDS_DATA_DIRECTORY ? path.join(env.PDS_DATA_DIRECTORY, name) : name;
	};

	const hostname = env.PDS_HOSTNAME ?? 'localhost';

	let service: ServiceConfig;
	{
		const port = env.PDS_PORT ?? 2583;

		service = {
			version: env.PDS_VERSION ?? `unknown`,
			devMode: env.PDS_DEV_MODE ?? false,

			port: port,
			hostname: hostname,

			did: env.PDS_SERVICE_DID ?? `did:web:${hostname}`,
			publicUrl: hostname === 'localhost' ? `http://localhost:${port}` : `https://${hostname}`,
			publicAssetsDirectory: path.resolve(env.PDS_PUBLIC_ASSETS_DIRECTORY ?? 'public'),

			imports: {
				accepting: env.PDS_REPO_IMPORT_ACCEPTING ?? true,
				maxSize: env.PDS_REPO_IMPORT_SIZE_LIMIT ?? null,
			},
			blobs: {
				// defaults to 100 MiB
				maxUploadSize: env.PDS_BLOB_UPLOAD_SIZE_LIMIT ?? 100 * 1024 * 1024,
			},

			registration: env.PDS_REGISTRATION ?? 'invite-only',

			branding: {
				name: env.PDS_SERVICE_NAME ?? `${hostname} PDS`,
				logoUrl: env.PDS_LOGO_URL ?? null,
				homeUrl: env.PDS_HOME_URL ?? null,
				supportUrl: env.PDS_SUPPORT_URL ?? null,
				termsOfServiceUrl: env.PDS_TERMS_OF_SERVICE_URL ?? null,
				privacyPolicyUrl: env.PDS_PRIVACY_POLICY_URL ?? null,
				contactEmailAddress: env.PDS_CONTACT_EMAIL_ADDRESS ?? null,
			},
		};
	}

	let database: DatabaseConfig;
	{
		database = {
			accountDbLocation: env.PDS_ACCOUNT_DB_LOCATION ?? locate('account.db'),
			sequencerDbLocation: env.PDS_SEQUENCER_DB_LOCATION ?? locate('sequencer.db'),
			identityCacheDbLocation: env.PDS_IDENTITY_CACHE_DB_LOCATION ?? locate('identity-cache.db'),
			walAutoCheckpointDisabled: env.PDS_SQLITE_DISABLE_WAL_AUTO_CHECKPOINT ?? false,
		};
	}

	let actorStore: ActorStoreConfig;
	{
		actorStore = {
			directory: env.PDS_DATA_DIRECTORY ?? locate('actors'),
			walAutoCheckpointDisabled: env.PDS_SQLITE_DISABLE_WAL_AUTO_CHECKPOINT ?? false,
		};
	}

	let blobStore: BlobStoreConfig | undefined;
	{
		if (
			env.PDS_BLOBSTORE_S3_BUCKET !== undefined ||
			env.PDS_BLOBSTORE_S3_REGION !== undefined ||
			env.PDS_BLOBSTORE_S3_ENDPOINT !== undefined ||
			env.PDS_BLOBSTORE_S3_FORCE_PATH_STYLE !== undefined ||
			env.PDS_BLOBSTORE_S3_UPLOAD_TIMEOUT !== undefined ||
			env.PDS_BLOBSTORE_S3_ACCESS_KEY_ID !== undefined ||
			env.PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY !== undefined
		) {
			if (env.PDS_BLOBSTORE_S3_BUCKET === undefined) {
				throw new Error(`PDS_BLOBSTORE_S3_BUCKET must be configured`);
			}

			if (blobStore !== undefined) {
				throw new Error(
					`PDS_BLOBSTORE_S3_BUCKET and PDS_BLOBSTORE_DISK_LOCATION can't be configured together`,
				);
			}

			let credentials: S3BlobStoreConfig['credentials'] = null;
			if (env.PDS_BLOBSTORE_S3_ACCESS_KEY_ID || env.PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY) {
				if (!env.PDS_BLOBSTORE_S3_ACCESS_KEY_ID || !env.PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY) {
					throw new Error(
						`PDS_BLOBSTORE_S3_ACCESS_KEY_ID and PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY must be configured together`,
					);
				}

				credentials = {
					accessKeyId: env.PDS_BLOBSTORE_S3_ACCESS_KEY_ID,
					secretAccessKey: env.PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY,
				};
			}

			blobStore = {
				provider: 's3',
				bucket: env.PDS_BLOBSTORE_S3_BUCKET,
				region: env.PDS_BLOBSTORE_S3_REGION ?? null,
				endpoint: env.PDS_BLOBSTORE_S3_ENDPOINT ?? null,
				forcePathStyle: env.PDS_BLOBSTORE_S3_FORCE_PATH_STYLE ?? false,
				uploadTimeoutMs: env.PDS_BLOBSTORE_S3_UPLOAD_TIMEOUT ?? 20 * SECOND,
				credentials: credentials,
			};
		}

		if (env.PDS_BLOBSTORE_DISK_LOCATION !== undefined || env.PDS_BLOBSTORE_DISK_TEMP_LOCATION !== undefined) {
			if (env.PDS_BLOBSTORE_DISK_LOCATION === undefined) {
				throw new Error(`PDS_BLOBSTORE_DISK_LOCATION must be configured`);
			}

			if (blobStore !== undefined) {
				throw new Error(
					`PDS_BLOBSTORE_S3_BUCKET and PDS_BLOBSTORE_DISK_LOCATION can't be configured together`,
				);
			}

			blobStore = {
				provider: 'disk',
				directory: env.PDS_BLOBSTORE_DISK_LOCATION,
				tempDirectory: env.PDS_BLOBSTORE_DISK_TEMP_LOCATION ?? null,
			};
		}

		if (blobStore === undefined) {
			throw new Error(`either PDS_BLOBSTORE_S3_BUCKET or PDS_BLOBSTORE_DISK_LOCATION must be configured`);
		}
	}

	let identity: IdentityConfig;
	{
		let serviceHandleDomains = env.PDS_SERVICE_HANDLE_DOMAINS ?? [];
		if (serviceHandleDomains.length === 0) {
			if (hostname === 'localhost') {
				serviceHandleDomains = [`.test`];
			} else {
				serviceHandleDomains = [`.${hostname}`];
			}
		}

		identity = {
			plcDirectoryUrl: env.PDS_IDENTITY_PLC_URL ?? `https://plc.directory`,
			cacheMaxTtlMs: env.PDS_IDENTITY_CACHE_MAX_TTL ?? DAY,
			cacheStaleTtlMs: env.PDS_IDENTITY_CACHE_STALE_TTL ?? HOUR,
			resolverTimeoutMs: env.PDS_IDENTITY_RESOLVER_TIMEOUT ?? 3 * SECOND,
			plcRecoveryKey: env.PDS_IDENTITY_PLC_RECOVERY_KEY ?? null,
			serviceHandleDomains: serviceHandleDomains,
		};
	}

	let secrets: SecretsConfig;
	{
		let jwtKey: KeyObject;
		{
			const raw = env.PDS_JWT_SECRET;
			if (!raw) {
				throw new Error(`PDS_JWT_SECRET must be configured`);
			}

			jwtKey = createSecretKey(Buffer.from(raw));
		}

		let plcRotationKey: PrivateKey;
		{
			const raw = env.PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX;
			if (!raw) {
				throw new Error(`PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX must be configured`);
			}

			plcRotationKey = await Secp256k1PrivateKeyExportable.importRaw(Buffer.from(raw, 'hex'));
		}

		secrets = {
			adminPassword: env.PDS_ADMIN_PASSWORD ?? null,
			dpopSecret: env.PDS_DPOP_SECRET ?? null,
			jwtKey: jwtKey,
			plcRotationKey: plcRotationKey,
		};
	}

	let subscription: SubscriptionConfig;
	{
		subscription = {
			crawlers: env.PDS_CRAWLERS ?? [],
			maxBuffer: env.PDS_SUBSCRIPTION_BUFFER_LIMIT ?? 500,
			repoBackfillLimitMs: env.PDS_REPO_BACKFILL_LIMIT_MS ?? DAY,
		};
	}

	let email: EmailConfig | null = null;
	if (env.PDS_EMAIL_SMTP_URL || env.PDS_EMAIL_FROM_ADDRESS) {
		if (!env.PDS_EMAIL_SMTP_URL || !env.PDS_EMAIL_FROM_ADDRESS) {
			throw new Error(`PDS_EMAIL_SMTP_URL and PDS_EMAIL_FROM_ADDRESS must be configured together`);
		}

		email = {
			smtpUrl: env.PDS_EMAIL_SMTP_URL,
			fromAddress: env.PDS_EMAIL_FROM_ADDRESS,
		};
	}

	return {
		service,
		database,
		actorStore,
		blobStore,
		identity,
		secrets,
		subscription,
		email,
		proxy: {
			targets: new Map(),
		},
	};
};
