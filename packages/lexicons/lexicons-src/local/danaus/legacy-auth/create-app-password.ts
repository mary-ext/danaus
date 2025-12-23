import { document, object, procedure, required, string } from '@atcute/lexicon-doc/builder';

import { appPassword, privilege } from './defs.ts';

export default document({
	id: 'local.danaus.legacyAuth.createAppPassword',
	defs: {
		main: procedure({
			description: 'create a new app password for the current account',
			input: {
				encoding: 'application/json',
				schema: object({
					properties: {
						name: required(
							string({
								description: 'human-readable name for the app password',
								minLength: 1,
								maxLength: 128,
							}),
						),
						privilege: required(privilege),
					},
				}),
			},
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						details: required(appPassword),
						secret: required(string({ description: 'the generated app password (only shown once)' })),
					},
				}),
			},
		}),
	},
});
