import { document, object, procedure, required, string } from '@atcute/lexicon-doc/builder';

export default document({
	id: 'local.danaus.legacyAuth.deleteAppPassword',
	defs: {
		main: procedure({
			description: 'delete an app password by name',
			input: {
				encoding: 'application/json',
				schema: object({
					properties: {
						name: required(string({ description: 'name of the app password to delete' })),
					},
				}),
			},
		}),
	},
});
