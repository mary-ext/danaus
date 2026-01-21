import { ValidationError } from '@atcute/lexicons/validations';
import * as TID from '@atcute/tid';
import { InvalidRequestError } from '@atcute/xrpc-server';

import type { RepoWriteOp } from '#app/actors/repo/types.ts';

import type { LexiconCache } from './cache.ts';

/**
 * validate record writes against lexicon schemas.
 *
 * @param lexiconCache lexicon cache for resolving schemas
 * @param writes array of write operations
 * @param validate validation mode:
 *   - `true`: require validation, fail if lexicon cannot be resolved
 *   - `false`: skip validation entirely
 *   - `undefined` (default): validate if lexicon is known, skip if not
 * @throws InvalidRequestError with `InvalidRecord` if validation fails
 * @throws InvalidRequestError with `UnresolvableLexicon` if validate=true and lexicon cannot be resolved
 */
export const validateRecordWrites = async (
	lexiconCache: LexiconCache,
	writes: RepoWriteOp[],
	validate: boolean | undefined,
): Promise<void> => {
	// skip if validation is disabled
	if (validate === false) {
		return;
	}

	// skip if lexicon resolution is disabled
	if (!lexiconCache.enabled) {
		if (validate === true) {
			throw new InvalidRequestError({
				error: 'UnresolvableLexicon',
				description: `lexicon resolution is disabled`,
			});
		}

		return;
	}

	const ops = writes.filter((write) => write.action === 'create' || write.action === 'update');

	if (ops.length === 0) {
		return;
	}

	// fallback TID for validating key format when rkey not provided
	const tid = TID.now();

	// validate each write
	await Promise.all(
		ops.map(async (write) => {
			const validator = await lexiconCache.getRecordValidator(write.collection);

			if (!validator) {
				// lexicon not found
				if (validate === true) {
					throw new InvalidRequestError({
						error: 'UnresolvableLexicon',
						description: `could not resolve lexicon for ${write.collection}`,
					});
				}

				// validate=undefined: skip if lexicon not known
				return;
			}

			try {
				validator.parse({ key: write.rkey ?? tid, object: write.record });
			} catch (err) {
				if (err instanceof ValidationError) {
					throw new InvalidRequestError({
						error: 'InvalidRecord',
						description: `record failed validation: ${err.message}`,
					});
				}

				throw err;
			}
		}),
	);
};
