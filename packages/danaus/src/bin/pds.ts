import path from 'node:path';

import type { AtprotoAudience } from '@atcute/lexicons/syntax';
import { BSKY_PORT, PDS_PORT } from '@danaus/dev-env';

import type { ProxyTargetConfig } from '#app/config.ts';
import { TestPds } from '#app/test/test-pds.ts';

// stable rotation key for dev environment (persisted DIDs expect this key)
const DEV_PLC_ROTATION_KEY = '3f916c70dc69e4c5e83877f013325b11ecac31742e6a42f5c4fb240d0703d9d5';

const DATA_DIR = path.resolve('data/pds');
const PLC_URL = process.env.PLC_URL ?? 'http://localhost:2582';

const run = async () => {
	console.log(`
┌──────────────────────────────────┐
│  danaus PDS                      │
└──────────────────────────────────┘
`);

	const targets = new Map<AtprotoAudience, ProxyTargetConfig>();

	targets.set('did:web:api.bsky.app#bsky_appview', {
		to: `did:web:localhost%3A${BSKY_PORT}#bsky_appview`,
		exclude: ['app.bsky.actor.getPreferences', 'app.bsky.actor.putPreferences'],
	});

	const pds = await TestPds.create({
		plcUrl: PLC_URL,
		port: PDS_PORT,
		dataDirectory: DATA_DIR,
		plcRotationKey: DEV_PLC_ROTATION_KEY,
		proxy: {
			targets: targets,
		},
	});

	console.log(`📁 Data directory: ${DATA_DIR}`);
	console.log(`🌞 PDS http://localhost:${pds.port}`);

	const shutdown = async () => {
		console.log('\nshutting down...');
		await pds.close();
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
};

run().catch((err) => {
	console.error('fatal error:', err);
	process.exit(1);
});
