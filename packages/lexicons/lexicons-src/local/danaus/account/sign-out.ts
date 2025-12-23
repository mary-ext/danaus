import { document, procedure } from '@atcute/lexicon-doc/builder';

export default document({
	id: 'local.danaus.account.signOut',
	defs: {
		main: procedure({
			description: 'sign out of the current web session',
		}),
	},
});
