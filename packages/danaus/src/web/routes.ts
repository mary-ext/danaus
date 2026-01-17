import { route } from '@oomfware/fetch-router';

export const routes = route({
	home: '/',

	assets: '/assets/*path',

	admin: {
		dashboard: '/admin',
		accounts: {
			index: '/admin/accounts',
			create: '/admin/accounts/new',
		},
	},

	// login routes
	login: {
		index: '/account/login',
		passkey: {
			challenge: '/account/login/passkey',
		},
	},

	// verification routes - handles both MFA login (?token) and sudo (session-based)
	verify: {
		index: '/account/verify',
		totp: '/account/verify/totp',
		webauthn: '/account/verify/webauthn',
		recovery: '/account/verify/recovery',
		password: '/account/verify/password',
	},

	// account routes - all require session
	account: {
		overview: '/account',
		appPasswords: '/account/app-passwords',
		security: {
			overview: '/account/security',
			totp: {
				register: '/account/security/totp/register',
				remove: '/account/security/totp/:id/remove',
			},
			webauthn: {
				register: '/account/security/webauthn/register',
				remove: '/account/security/webauthn/:id/remove',
			},
			recovery: {
				show: '/account/security/recovery',
				regenerate: '/account/security/recovery/regenerate',
				remove: '/account/security/recovery/remove',
			},
		},
	},

	oauth: {
		authorize: '/oauth/authorize',
	},
});
