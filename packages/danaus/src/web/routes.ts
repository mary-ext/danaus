import { route } from '@oomfware/fetch-router';

export const routes = route({
	home: '/',

	admin: {
		dashboard: '/admin',
		accounts: {
			index: '/admin/accounts',
			create: '/admin/accounts/new',
		},
	},

	// login is separate - no session required
	login: '/account/login',

	// account routes - all require session
	account: {
		overview: '/account',
		appPasswords: '/account/app-passwords',
		security: '/account/security',
	},

	oauth: {
		authorize: '/oauth/authorize',
	},
});
