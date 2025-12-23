import { boolean, document, object, required, string } from '@atcute/lexicon-doc/builder';

export const statusAttr = object({
	properties: {
		applied: required(boolean()),
		ref: string(),
	},
});

export const repoRef = object({
	properties: {
		did: required(string({ format: 'did' })),
	},
});

export const repoBlobRef = object({
	properties: {
		did: required(string({ format: 'did' })),
		cid: required(string({ format: 'cid' })),
		recordUri: string({ format: 'at-uri' }),
	},
});

export default document({
	id: 'local.danaus.admin.defs',
	defs: {
		statusAttr: statusAttr,
		repoRef: repoRef,
		repoBlobRef: repoBlobRef,
	},
});
