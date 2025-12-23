import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

import type {} from '@atcute/lexicons/ambient';

import * as LocalDanausLegacyAuthDefs from './defs.js';

const _mainSchema = /*#__PURE__*/ v.procedure('local.danaus.legacyAuth.createAppPassword', {
	params: null,
	input: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			/**
			 * human-readable name for the app password
			 * @minLength 1
			 * @maxLength 128
			 */
			name: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [/*#__PURE__*/ v.stringLength(1, 128)]),
			get privilege() {
				return LocalDanausLegacyAuthDefs.privilegeSchema;
			},
		}),
	},
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			get details() {
				return LocalDanausLegacyAuthDefs.appPasswordSchema;
			},
			/**
			 * the generated app password (only shown once)
			 */
			secret: /*#__PURE__*/ v.string(),
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
		'local.danaus.legacyAuth.createAppPassword': mainSchema;
	}
}
