import type {} from '@atcute/lexicons';

import * as v from '@atcute/lexicons/validations';

const _repoBlobRefSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.defs#repoBlobRef')),
	cid: /*#__PURE__*/ v.cidString(),
	did: /*#__PURE__*/ v.didString(),
	recordUri: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
});
const _repoRefSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.defs#repoRef')),
	did: /*#__PURE__*/ v.didString(),
});
const _statusAttrSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('local.danaus.admin.defs#statusAttr')),
	applied: /*#__PURE__*/ v.boolean(),
	ref: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
});

type repoBlobRef$schematype = typeof _repoBlobRefSchema;
type repoRef$schematype = typeof _repoRefSchema;
type statusAttr$schematype = typeof _statusAttrSchema;

export interface repoBlobRefSchema extends repoBlobRef$schematype {}
export interface repoRefSchema extends repoRef$schematype {}
export interface statusAttrSchema extends statusAttr$schematype {}

export const repoBlobRefSchema = _repoBlobRefSchema as repoBlobRefSchema;
export const repoRefSchema = _repoRefSchema as repoRefSchema;
export const statusAttrSchema = _statusAttrSchema as statusAttrSchema;

export interface RepoBlobRef extends v.InferInput<typeof repoBlobRefSchema> {}
export interface RepoRef extends v.InferInput<typeof repoRefSchema> {}
export interface StatusAttr extends v.InferInput<typeof statusAttrSchema> {}
