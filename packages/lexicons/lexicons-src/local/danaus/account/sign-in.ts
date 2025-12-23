import { boolean, document, object, procedure, required, string } from '@atcute/lexicon-doc/builder';

export default document({
	id: 'local.danaus.account.signIn',
	defs: {
		main: procedure({
			description: 'sign in to the web interface with email/handle and password',
			input: {
				encoding: 'application/json',
				schema: object({
					properties: {
						identifier: required(string({ description: 'handle, email, or did of the account' })),
						password: required(string({ description: 'account password' })),
						remember: boolean({ description: 'extend session duration (1 year instead of 1 week)' }),
					},
				}),
			},
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						did: required(string({ format: 'did' })),
						handle: required(string({ format: 'handle' })),
					},
				}),
			},
			errors: [{ name: 'InvalidCredentials', description: 'invalid identifier or password' }],
		}),
	},
});
