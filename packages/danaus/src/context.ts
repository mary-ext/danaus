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

import { AccountManager } from './accounts/manager';
import { DiskBlobStore } from './actors/blob-store/disk';
import { S3BlobStore } from './actors/blob-store/s3';
import { ActorManager } from './actors/manager';
import { AuthVerifier } from './auth/verifier';
import type { AppConfig } from './config';
import { Crawlers } from './crawlers';
import { Sequencer } from './sequencer/sequencer';

export interface AppContext {
	config: AppConfig;

	handleResolver: HandleResolver;
	didDocumentResolver: DidDocumentResolver<'plc' | 'web'>;
	plcClient: PlcClient;

	accountManager: AccountManager;
	actorManager: ActorManager;
	authVerifier: AuthVerifier;

	sequencer: Sequencer;
}

export const createAppContext = (config: AppConfig): AppContext => {
	const handleResolver = new CompositeHandleResolver({
		strategy: 'race',
		methods: {
			http: new WellKnownHandleResolver(),
			dns: new NodeDnsHandleResolver(),
		},
	});

	const didDocumentResolver = new CompositeDidDocumentResolver({
		methods: {
			plc: new PlcDidDocumentResolver({ apiUrl: config.identity.plcDirectoryUrl }),
			web: new WebDidDocumentResolver(),
		},
	});

	const plcClient = new PlcClient({
		serviceUrl: config.identity.plcDirectoryUrl,
	});

	const accountManager = new AccountManager({
		location: config.database.accountDbLocation,
		walAutocheckpointDisabled: config.database.walAutoCheckpointDisabled,

		serviceDid: config.service.did,
		serviceHandleDomains: config.identity.serviceHandleDomains,

		handleResolver: handleResolver,

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

	return {
		config: config,

		handleResolver: handleResolver,
		didDocumentResolver: didDocumentResolver,
		plcClient: plcClient,

		accountManager: accountManager,
		actorManager: actorManager,
		authVerifier: authVerifier,

		sequencer: sequencer,
	};
};
