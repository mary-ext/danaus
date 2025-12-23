import { document, object, params, query, ref, required, string, union } from '@atcute/lexicon-doc/builder';

import { repoBlobRef, repoRef, statusAttr } from './defs.ts';

const subject = union({
	refs: [repoRef, repoBlobRef, ref({ ref: 'com.atproto.repo.strongRef' })],
});

export default document({
	id: 'local.danaus.admin.getSubjectStatus',
	defs: {
		main: query({
			description: 'get the admin status of a subject',
			parameters: params({
				properties: {
					did: string({ format: 'did' }),
					uri: string({ format: 'at-uri' }),
					blob: string({ format: 'cid' }),
				},
			}),
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						subject: required(subject),
						takedown: statusAttr,
						deactivated: statusAttr,
					},
				}),
			},
		}),
	},
});
