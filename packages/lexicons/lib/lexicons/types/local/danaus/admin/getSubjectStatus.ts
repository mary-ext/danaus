import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

import type {} from '@atcute/lexicons/ambient';

import * as ComAtprotoRepoStrongRef from '@atcute/atproto/types/repo/strongRef';

import * as LocalDanausAdminDefs from './defs.js';

const _mainSchema = /*#__PURE__*/ v.query('local.danaus.admin.getSubjectStatus', {
	params: /*#__PURE__*/ v.object({
		blob: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
		did: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.didString()),
		uri: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
	}),
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			get deactivated() {
				return /*#__PURE__*/ v.optional(LocalDanausAdminDefs.statusAttrSchema);
			},
			get subject() {
				return /*#__PURE__*/ v.variant([
					ComAtprotoRepoStrongRef.mainSchema,
					LocalDanausAdminDefs.repoBlobRefSchema,
					LocalDanausAdminDefs.repoRefSchema,
				]);
			},
			get takedown() {
				return /*#__PURE__*/ v.optional(LocalDanausAdminDefs.statusAttrSchema);
			},
		}),
	},
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema['params']> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}

declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		'local.danaus.admin.getSubjectStatus': mainSchema;
	}
}
