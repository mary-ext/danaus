import * as v from 'valibot';

import {
	did,
	didKey,
	email,
	hostname,
	isHostnameSuffix,
	port,
	str,
	strbool,
	strint,
	strlist,
	url,
} from './utils/schema';

const envSchema = v.object({
	PDS_VERSION: v.optional(str),
	PDS_DEV_MODE: v.optional(strbool),

	PDS_LOG_LEVEL: v.optional(v.picklist(['trace', 'debug', 'info', 'warning', 'error', 'fatal'])),
	PDS_LOG_JSON: v.optional(strbool),

	PDS_PORT: v.optional(port),
	PDS_HOSTNAME: v.optional(hostname),

	PDS_SERVICE_DID: v.optional(did),
	PDS_SERVICE_NAME: v.optional(str),
	PDS_PUBLIC_ASSETS_DIRECTORY: v.optional(str),

	PDS_HOME_URL: v.optional(url),
	PDS_LOGO_URL: v.optional(url),
	PDS_PRIVACY_POLICY_URL: v.optional(url),
	PDS_SUPPORT_URL: v.optional(url),
	PDS_TERMS_OF_SERVICE_URL: v.optional(url),
	PDS_CONTACT_EMAIL_ADDRESS: v.optional(email),

	PDS_REPO_IMPORT_ACCEPTING: v.optional(strbool),
	PDS_REPO_IMPORT_SIZE_LIMIT: v.optional(strint),
	PDS_BLOB_UPLOAD_SIZE_LIMIT: v.optional(strint),

	PDS_DATA_DIRECTORY: v.optional(str),
	PDS_SQLITE_DISABLE_WAL_AUTO_CHECKPOINT: v.optional(strbool),
	PDS_ACCOUNT_DB_LOCATION: v.optional(str),
	PDS_SEQUENCER_DB_LOCATION: v.optional(str),
	PDS_IDENTITY_CACHE_DB_LOCATION: v.optional(str),

	PDS_ACTOR_STORE_DIRECTORY: v.optional(str),

	PDS_BLOBSTORE_S3_BUCKET: v.optional(str),
	PDS_BLOBSTORE_S3_REGION: v.optional(str),
	PDS_BLOBSTORE_S3_ENDPOINT: v.optional(str),
	PDS_BLOBSTORE_S3_FORCE_PATH_STYLE: v.optional(strbool),
	PDS_BLOBSTORE_S3_ACCESS_KEY_ID: v.optional(str),
	PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY: v.optional(str),
	PDS_BLOBSTORE_S3_UPLOAD_TIMEOUT: v.optional(strint),

	PDS_BLOBSTORE_DISK_LOCATION: v.optional(str),
	PDS_BLOBSTORE_DISK_TEMP_LOCATION: v.optional(str),

	PDS_IDENTITY_PLC_URL: v.optional(url),
	PDS_IDENTITY_PLC_RECOVERY_KEY: v.optional(didKey),
	PDS_IDENTITY_CACHE_STALE_TTL: v.optional(strint),
	PDS_IDENTITY_CACHE_MAX_TTL: v.optional(strint),
	PDS_IDENTITY_RESOLVER_TIMEOUT: v.optional(strint),
	PDS_SERVICE_HANDLE_DOMAINS: v.optional(
		v.pipe(
			strlist,
			v.everyItem((item) => isHostnameSuffix(item), `must be a valid service handle domain`),
		),
	),

	PDS_SUBSCRIPTION_BUFFER_LIMIT: v.optional(strint),
	PDS_REPO_BACKFILL_LIMIT_MS: v.optional(strint),

	PDS_CRAWLERS: v.optional(
		v.pipe(
			strlist,
			v.everyItem((item) => URL.canParse(item), `must be a valid crawler URL`),
		),
	),

	PDS_DPOP_SECRET: v.optional(str),
	PDS_JWT_SECRET: v.optional(str),
	PDS_ADMIN_PASSWORD: v.optional(str),

	PDS_REGISTRATION: v.optional(v.picklist(['open', 'invite-only', 'none'])),

	PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX: v.optional(str),

	PDS_EMAIL_SMTP_URL: v.optional(url),
	PDS_EMAIL_FROM_ADDRESS: v.optional(email),
});

export const readAppEnvironment = (env: Record<string, string | undefined>) => {
	return v.parse(envSchema, env);
};

export type AppEnvironment = ReturnType<typeof readAppEnvironment>;
