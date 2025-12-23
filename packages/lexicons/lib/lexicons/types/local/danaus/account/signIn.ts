import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure('local.danaus.account.signIn', {
	params: null,
	input: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			/**
			 * handle, email, or did of the account
			 */
			identifier: /*#__PURE__*/ v.string(),
			/**
			 * account password
			 */
			password: /*#__PURE__*/ v.string(),
			/**
			 * extend session duration (1 year instead of 1 week)
			 */
			remember: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
		}),
	},
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			did: /*#__PURE__*/ v.didString(),
			handle: /*#__PURE__*/ v.handleString(),
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
		'local.danaus.account.signIn': mainSchema;
	}
}
