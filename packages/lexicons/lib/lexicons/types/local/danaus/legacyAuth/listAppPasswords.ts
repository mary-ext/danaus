import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

import type {} from '@atcute/lexicons/ambient';

import * as LocalDanausLegacyAuthDefs from './defs.js';

const _mainSchema = /*#__PURE__*/ v.query('local.danaus.legacyAuth.listAppPasswords', {
	params: null,
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			get passwords() {
				return /*#__PURE__*/ v.array(LocalDanausLegacyAuthDefs.appPasswordSchema);
			},
		}),
	},
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}
export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}

declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		'local.danaus.legacyAuth.listAppPasswords': mainSchema;
	}
}
