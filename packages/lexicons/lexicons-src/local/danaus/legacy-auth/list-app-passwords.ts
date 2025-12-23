import { array, document, object, query, required } from '@atcute/lexicon-doc/builder';

import { appPassword } from './defs.ts';

export default document({
	id: 'local.danaus.legacyAuth.listAppPasswords',
	defs: {
		main: query({
			description: 'list all app passwords for the current account',
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						passwords: required(array({ items: appPassword })),
					},
				}),
			},
		}),
	},
});
