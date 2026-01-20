import type {} from '@atcute/lexicons';
import type {} from '@atcute/lexicons/ambient';
import * as v from '@atcute/lexicons/validations';

const _accountStatsSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.getStats#accountStats')),
	active: /*#__PURE__*/ v.integer(),
	deactivated: /*#__PURE__*/ v.integer(),
	deleteScheduled: /*#__PURE__*/ v.integer(),
	takendown: /*#__PURE__*/ v.integer(),
	total: /*#__PURE__*/ v.integer(),
});
const _inviteCodeStatsSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.getStats#inviteCodeStats')),
	available: /*#__PURE__*/ v.integer(),
	disabled: /*#__PURE__*/ v.integer(),
	total: /*#__PURE__*/ v.integer(),
	used: /*#__PURE__*/ v.integer(),
});
const _mainSchema = /*#__PURE__*/ v.query('local.danaus.admin.getStats', {
	params: null,
	output: {
		type: 'lex',
		schema: /*#__PURE__*/ v.object({
			get accounts() {
				return accountStatsSchema;
			},
			get inviteCodes() {
				return inviteCodeStatsSchema;
			},
			get sequencer() {
				return sequencerStatsSchema;
			},
		}),
	},
});
const _sequencerStatsSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.getStats#sequencerStats')),
	invalidatedEvents: /*#__PURE__*/ v.integer(),
	lastSeq: /*#__PURE__*/ v.integer(),
	totalEvents: /*#__PURE__*/ v.integer(),
});

type accountStats$schematype = typeof _accountStatsSchema;
type inviteCodeStats$schematype = typeof _inviteCodeStatsSchema;
type main$schematype = typeof _mainSchema;
type sequencerStats$schematype = typeof _sequencerStatsSchema;

export interface accountStatsSchema extends accountStats$schematype {}
export interface inviteCodeStatsSchema extends inviteCodeStats$schematype {}
export interface mainSchema extends main$schematype {}
export interface sequencerStatsSchema extends sequencerStats$schematype {}

export const accountStatsSchema = _accountStatsSchema as accountStatsSchema;
export const inviteCodeStatsSchema = _inviteCodeStatsSchema as inviteCodeStatsSchema;
export const mainSchema = _mainSchema as mainSchema;
export const sequencerStatsSchema = _sequencerStatsSchema as sequencerStatsSchema;

export interface AccountStats extends v.InferInput<typeof accountStatsSchema> {}
export interface InviteCodeStats extends v.InferInput<typeof inviteCodeStatsSchema> {}
export interface SequencerStats extends v.InferInput<typeof sequencerStatsSchema> {}

export interface $params {}
export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}

declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		'local.danaus.admin.getStats': mainSchema;
	}
}
