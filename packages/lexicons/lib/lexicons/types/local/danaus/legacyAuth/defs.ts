import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

const _appPasswordSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.legacyAuth.defs#appPassword')),
	createdAt: /*#__PURE__*/ v.datetimeString(),
	/**
	 * human-readable name for the app password
	 */
	name: /*#__PURE__*/ v.string(),
	get privilege() {
		return privilegeSchema;
	},
});
const _privilegeSchema = /*#__PURE__*/ v.string<'full' | 'limited' | 'privileged' | (string & {})>();

type appPassword$schematype = typeof _appPasswordSchema;
type privilege$schematype = typeof _privilegeSchema;

export interface appPasswordSchema extends appPassword$schematype {}
export interface privilegeSchema extends privilege$schematype {}

export const appPasswordSchema = _appPasswordSchema as appPasswordSchema;
export const privilegeSchema = _privilegeSchema as privilegeSchema;

export interface AppPassword extends v.InferInput<typeof appPasswordSchema> {}
export type Privilege = v.InferInput<typeof privilegeSchema>;
