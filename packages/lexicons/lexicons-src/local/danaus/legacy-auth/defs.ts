import { document, object, required, string } from '@atcute/lexicon-doc/builder';

/** privilege level for app passwords */
export const privilege = string({
	description:
		'privilege level for app passwords. limited restricts access to certain endpoints, privileged grants broader access, full grants the same access as the main password',
	knownValues: ['limited', 'privileged', 'full'],
});

/** app password metadata (password value not included) */
export const appPassword = object({
	properties: {
		name: required(string({ description: 'human-readable name for the app password' })),
		privilege: required(privilege),
		createdAt: required(string({ format: 'datetime' })),
	},
});

export default document({
	id: 'local.danaus.legacyAuth.defs',
	defs: {
		privilege,
		appPassword,
	},
});
