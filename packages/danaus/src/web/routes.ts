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
		show: '/account/login',
		mfa: {
			index: '/account/login/mfa',
			totp: '/account/login/mfa/totp',
			webauthn: '/account/login/mfa/webauthn',
			recovery: '/account/login/mfa/recovery',
		},

		// sudo is located here just so we can share some parts with the MFA page
		sudo: {
			index: '/account/sudo',
			totp: '/account/sudo/totp',
			webauthn: '/account/sudo/webauthn',
			recovery: '/account/sudo/recovery',
			password: '/account/sudo/password',
		},
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
