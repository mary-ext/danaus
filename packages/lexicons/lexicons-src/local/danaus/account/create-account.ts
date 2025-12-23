import { document, object, procedure, required, string } from '@atcute/lexicon-doc/builder';

export default document({
	id: 'local.danaus.account.createAccount',
	defs: {
		main: procedure({
			description: `create a new local account.`,
			input: {
				encoding: 'application/json',
				schema: object({
					properties: {
						handle: required(string({ format: 'handle', description: `account handle` })),
						email: required(string({ description: `account email` })),
						password: required(string({ description: `account password` })),

						inviteCode: string({
							description: `invite code`,
						}),

						recoveryKey: string({
							format: 'did',
							description: `recovery key to be included in the did:plc identity`,
						}),
					},
				}),
			},
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						did: required(string({ format: 'did' })),
					},
				}),
			},
		}),
	},
});
