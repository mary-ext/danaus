import { PlcClient } from '@atcute/did-plc';
import {
	CompositeDidDocumentResolver,
	CompositeHandleResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver,
	type DidDocumentResolver,
	type HandleResolver,
} from '@atcute/identity-resolver';
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node';
import { NodeDnsLexiconAuthorityResolver } from '@atcute/lexicon-resolver-node';

import { getAccountDb, type AccountDb } from './accounts/db';
import { InviteCodeManager } from './accounts/invite-codes';
import { LegacyAuthManager } from './accounts/legacy-auth';
import { AccountManager } from './accounts/manager';
import { MfaManager } from './accounts/mfa';
import { WebSessionManager } from './accounts/web-sessions';
import { DiskBlobStore } from './actors/blob-store/disk';
import { S3BlobStore } from './actors/blob-store/s3';
import { ActorManager } from './actors/manager';
import { AuthVerifier } from './auth/verifier';
import { BackgroundQueue } from './background';
import type { AppConfig } from './config';
import { Crawlers } from './crawlers';
import { CachedDidDocumentResolver } from './identity/cached-did-document-resolver';
import { CachedHandleResolver } from './identity/cached-handle-resolver';
import { IdentityCache } from './identity/manager';
import { LexiconCache } from './lexicon/cache';
import { createServiceProxy, type ServiceProxy } from './proxy/index';
import { Sequencer } from './sequencer/sequencer';

export interface AppContext {
	config: AppConfig;

	backgroundQueue: BackgroundQueue;
	identityCache: IdentityCache;
	lexiconCache: LexiconCache;

	handleResolver: HandleResolver;
	didDocumentResolver: DidDocumentResolver<'plc' | 'web'>;
	plcClient: PlcClient;

	accountDb: AccountDb;
	accountManager: AccountManager;
	inviteCodeManager: InviteCodeManager;
	mfaManager: MfaManager;
	legacyAuthManager: LegacyAuthManager;
	webSessionManager: WebSessionManager;

	actorManager: ActorManager;
	authVerifier: AuthVerifier;

	sequencer: Sequencer;

	/** service proxy for forwarding requests to atproto-proxy targets */
	proxy: ServiceProxy;
}

export const createAppContext = (config: AppConfig): AppContext => {
	const backgroundQueue = new BackgroundQueue();

	const identityCache = new IdentityCache({
		location: config.database.identityCacheDbLocation,
		walAutoCheckpointDisabled: config.database.walAutoCheckpointDisabled,
		backgroundQueue: backgroundQueue,
	});

	const baseHandleResolver = new CompositeHandleResolver({
		strategy: 'race',
		methods: {
			http: new WellKnownHandleResolver(),
			dns: new NodeDnsHandleResolver(),
		},
	});

	const handleResolver = new CachedHandleResolver({
		cache: identityCache,
		resolver: baseHandleResolver,
	});

	const baseDidDocumentResolver = new CompositeDidDocumentResolver({
		methods: {
			plc: new PlcDidDocumentResolver({ apiUrl: config.identity.plcDirectoryUrl }),
			web: new WebDidDocumentResolver(),
		},
	});

	const didDocumentResolver = new CachedDidDocumentResolver({
		cache: identityCache,
		resolver: baseDidDocumentResolver,
	});

	const lexiconAuthorityResolver = new NodeDnsLexiconAuthorityResolver({
		nameservers: config.lexicon.nameservers ?? undefined,
	});

	const lexiconCache = new LexiconCache({
		location: config.lexicon.cacheDbLocation,
		walAutoCheckpointDisabled: config.database.walAutoCheckpointDisabled,
		backgroundQueue: backgroundQueue,
		authorityResolver: lexiconAuthorityResolver,
		didDocumentResolver: didDocumentResolver,
		staleTtl: config.lexicon.cacheStaleTtlMs,
		maxTtl: config.lexicon.cacheMaxTtlMs,
		enabled: config.lexicon.enabled,
	});

	const plcClient = new PlcClient({
		serviceUrl: config.identity.plcDirectoryUrl,
	});

	const accountDb = getAccountDb(
		config.database.accountDbLocation,
		config.database.walAutoCheckpointDisabled,
	);

	const accountManager = new AccountManager({
		db: accountDb,
		serviceHandleDomains: config.identity.serviceHandleDomains,
		handleResolver: handleResolver,
	});

	const inviteCodeManager = new InviteCodeManager({
		db: accountDb,
	});

	const mfaManager = new MfaManager({
		db: accountDb,
	});

	const legacyAuthManager = new LegacyAuthManager({
		db: accountDb,
		jwtKey: config.secrets.jwtKey,
		serviceDid: config.service.did,
		accountManager: accountManager,
	});

	const webSessionManager = new WebSessionManager({
		db: accountDb,
		jwtKey: config.secrets.jwtKey,
	});

	const crawlers = new Crawlers(config.service.hostname, config.subscription.crawlers);

	const sequencer = new Sequencer({
		location: config.database.sequencerDbLocation,
		walAutoCheckpointDisabled: config.database.walAutoCheckpointDisabled,
		crawlers: crawlers,
	});

	const blobStoreCreator =
		config.blobStore.provider === 's3'
			? S3BlobStore.factory(config.blobStore)
			: DiskBlobStore.factory(config.blobStore);

	const actorManager = new ActorManager(config.actorStore, {
		createBlobStore: blobStoreCreator,
		sequencer: sequencer,
	});

	const authVerifier = new AuthVerifier({
		accountManager: accountManager,
		serviceDid: config.service.did,
		adminPassword: config.secrets.adminPassword,
		jwtKey: config.secrets.jwtKey,
		didDocumentResolver: didDocumentResolver,
	});

	const proxy = createServiceProxy({
		targets: config.proxy.targets,
		authVerifier: authVerifier,
		actorManager: actorManager,
		didDocumentResolver: didDocumentResolver,
	});

	return {
		config: config,

		backgroundQueue: backgroundQueue,
		identityCache: identityCache,
		lexiconCache: lexiconCache,

		handleResolver: handleResolver,
		didDocumentResolver: didDocumentResolver,
		plcClient: plcClient,

		accountDb: accountDb,
		accountManager: accountManager,
		inviteCodeManager: inviteCodeManager,
		mfaManager: mfaManager,
		legacyAuthManager: legacyAuthManager,
		webSessionManager: webSessionManager,

		actorManager: actorManager,
		authVerifier: authVerifier,

		sequencer: sequencer,

		proxy: proxy,
	};
};
