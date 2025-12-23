import type * as bsky from '@atproto/bsky';

export type PlcConfig = {
	port?: number;
	version?: string;
	dbPostgresUrl?: string;
	dbPostgresSchema?: string;
};

export type BskyConfig = Partial<bsky.ServerConfig> & {
	plcUrl: string;
	repoProvider: string;
	dbPostgresUrl: string;
	dbPostgresSchema: string;
	redisHost: string;
	pdsPort: number;
	serviceHandleDomains?: string[];
	migration?: string;
	privateKey?: string;
};
