import type {} from '@atcute/lexicons';
import type {} from '@atcute/lexicons/ambient';
import * as v from '@atcute/lexicons/validations';

const _mainSchema = /*#__PURE__*/ v.procedure('local.danaus.account.createAccount', {
	params: null,
	input: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			/**
			 * account email
			 */
			email: /*#__PURE__*/ v.string(),
			/**
			 * account handle
			 */
			handle: /*#__PURE__*/ v.handleString(),
			/**
			 * invite code
			 */
			inviteCode: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
			/**
			 * account password
			 */
			password: /*#__PURE__*/ v.string(),
			/**
			 * recovery key to be included in the did:plc identity
			 */
			recoveryKey: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.didString()),
		}),
	},
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			did: /*#__PURE__*/ v.didString(),
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
		'local.danaus.account.createAccount': mainSchema;
	}
}
