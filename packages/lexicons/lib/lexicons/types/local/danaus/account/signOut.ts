import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure('local.danaus.account.signOut', {
	params: null,
	input: null,
	output: null,
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}

declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		'local.danaus.account.signOut': mainSchema;
	}
}
