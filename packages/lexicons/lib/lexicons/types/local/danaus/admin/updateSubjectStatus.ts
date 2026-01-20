import * as ComAtprotoRepoStrongRef from '@atcute/atproto/types/repo/strongRef';
import type {} from '@atcute/lexicons';
import type {} from '@atcute/lexicons/ambient';
import * as v from '@atcute/lexicons/validations';

import * as LocalDanausAdminDefs from './defs.js';

const _mainSchema = /*#__PURE__*/ v.procedure('local.danaus.admin.updateSubjectStatus', {
	params: null,
	input: {
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
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
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

export interface $params {}
export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}

declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		'local.danaus.admin.updateSubjectStatus': mainSchema;
	}
}
