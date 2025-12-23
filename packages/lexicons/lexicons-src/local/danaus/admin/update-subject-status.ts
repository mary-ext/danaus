import { document, object, procedure, ref, required, union } from '@atcute/lexicon-doc/builder';

const subject = union({
	refs: [
		ref({ ref: 'local.danaus.admin.defs#repoRef' }),
		ref({ ref: 'com.atproto.repo.strongRef' }),
		ref({ ref: 'local.danaus.admin.defs#repoBlobRef' }),
	],
});

export default document({
	id: 'local.danaus.admin.updateSubjectStatus',
	defs: {
		main: procedure({
			description: 'update the admin status of a subject',
			input: {
				encoding: 'application/json',
				schema: object({
					properties: {
						subject: required(subject),
						takedown: ref({ ref: 'local.danaus.admin.defs#statusAttr' }),
						deactivated: ref({ ref: 'local.danaus.admin.defs#statusAttr' }),
					},
				}),
			},
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						subject: required(subject),
						takedown: ref({ ref: 'local.danaus.admin.defs#statusAttr' }),
					},
				}),
			},
		}),
	},
});
