import { toAppConfig, type AppConfig } from './config.ts';
import { readAppEnvironment, type AppEnvironment } from './environment.ts';

export { PdsServer, type PdsServerOptions } from './pds-server.ts';

export type {
	ActorStoreConfig,
	AppConfig,
	BlobStoreConfig,
	DatabaseConfig,
	DiskBlobStoreConfig,
	EmailConfig,
	IdentityConfig,
	ProxyConfig,
	ProxyTargetConfig,
	S3BlobStoreConfig,
	SecretsConfig,
	ServiceConfig,
	SubscriptionConfig,
} from './config.ts';

export type ServerConfig = AppConfig;
export type ServerEnvironment = AppEnvironment;

/**
 * build app config from environment values.
 * @param env environment values
 * @returns resolved app config
 */
export const envToConfig = async (env: Record<string, string | undefined>): Promise<AppConfig> => {
	return await toAppConfig(readAppEnvironment(env));
};
