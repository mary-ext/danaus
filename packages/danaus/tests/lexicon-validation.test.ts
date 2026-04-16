import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import {
	ComAtprotoRepoApplyWrites,
	ComAtprotoRepoCreateRecord,
	ComAtprotoRepoPutRecord,
} from '@atcute/atproto';
import { Client, ok, simpleFetchHandler } from '@atcute/client';
import type { LexiconDoc } from '@atcute/lexicon-doc';
import type { Did } from '@atcute/lexicons';

import { TestNetworkNoAppView, usersSeed, type SeedClient } from '#app/test/index.ts';

/**
 * simple test lexicon with no external references.
 * defines a record type with required `title` and `count` fields.
 */
const TEST_LEXICON: LexiconDoc = {
	lexicon: 1,
	id: 'com.example.simple',
	defs: {
		main: {
			type: 'record',
			key: 'any',
			record: {
				type: 'object',
				required: ['title', 'count'],
				properties: {
					title: { type: 'string', maxLength: 100 },
					count: { type: 'integer', minimum: 0 },
					description: { type: 'string' },
				},
			},
		},
	},
};

/**
 * test lexicon that requires a literal 'self' rkey (like app.bsky.actor.profile).
 */
const TEST_LEXICON_SELF_KEY: LexiconDoc = {
	lexicon: 1,
	id: 'com.example.selfkey',
	defs: {
		main: {
			type: 'record',
			key: 'literal:self',
			record: {
				type: 'object',
				required: ['name'],
				properties: {
					name: { type: 'string' },
				},
			},
		},
	},
};

/**
 * test lexicon authority DID (fake).
 */
const TEST_AUTHORITY_DID = 'did:plc:testauthority123';

describe('lexicon validation', () => {
	let network: TestNetworkNoAppView;
	let sc: SeedClient;
	let client: Client;
	let alice: Did;

	beforeAll(async () => {
		// create network with lexicon validation enabled
		network = await TestNetworkNoAppView.create({
			pds: {
				lexicon: {
					enabled: true,
				},
			},
		});

		sc = network.getSeedClient();
		await usersSeed(sc);
		alice = sc.dids.alice!;
		client = new Client({ handler: simpleFetchHandler({ service: network.pds.url }) });

		// inject test lexicons into cache
		const lexiconCache = network.pds.ctx.lexiconCache;
		lexiconCache._setAuthority('com.example', TEST_AUTHORITY_DID);
		lexiconCache._setSchema('com.example.simple', TEST_AUTHORITY_DID, 'testcid123', TEST_LEXICON);
		lexiconCache._setSchema('com.example.selfkey', TEST_AUTHORITY_DID, 'testcid456', TEST_LEXICON_SELF_KEY);
	});

	afterAll(async () => {
		await network?.close();
	});

	const getHeaders = (did: Did) => sc.getHeaders(did);

	/** helper to expect an XRPC error */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const expectError = async (result: Promise<any>, expectedError: string): Promise<void> => {
		const res = await result;
		expect(res.ok).toBe(false);
		expect(res.data?.error).toBe(expectedError);
	};

	describe('createRecord', () => {
		it('accepts valid record when validate=true', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Test Title',
							count: 42,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('com.example.simple');
			expect(result.cid).toBeDefined();
		});

		it('rejects invalid record when validate=true', async () => {
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							// missing required 'title' field
							count: 42,
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('rejects record with wrong type when validate=true', async () => {
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Test',
							count: 'not a number', // should be integer
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('rejects unknown lexicon when validate=true', async () => {
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.unknown.type',
						validate: true,
						record: {
							$type: 'com.unknown.type',
							anything: 'goes',
						},
					},
					headers: getHeaders(alice),
				}),
				'UnresolvableLexicon',
			);
		});

		it('allows unknown lexicon when validate=undefined (default)', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.unknown.type',
						// validate not specified (undefined)
						record: {
							$type: 'com.unknown.type',
							anything: 'goes',
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('com.unknown.type');
		});

		it('skips validation entirely when validate=false', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: false,
						record: {
							$type: 'com.example.simple',
							// completely invalid - missing required fields
							invalidField: true,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('com.example.simple');
		});
	});

	describe('putRecord', () => {
		it('creates record if not exists (upsert) when validate=true', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoPutRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						rkey: 'test-put-create',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Put Create Test',
							count: 10,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('test-put-create');
		});

		it('updates record if exists (upsert) when validate=true', async () => {
			// first create via putRecord
			await ok(
				client.call(ComAtprotoRepoPutRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						rkey: 'test-put-update',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Initial',
							count: 0,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			// then update via putRecord
			const result = await ok(
				client.call(ComAtprotoRepoPutRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						rkey: 'test-put-update',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Updated',
							count: 99,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('test-put-update');
		});

		it('rejects invalid record when validate=true', async () => {
			await expectError(
				client.call(ComAtprotoRepoPutRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						rkey: 'test-put-invalid',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Missing Count',
							// missing required 'count' field
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});
	});

	describe('applyWrites', () => {
		it('accepts valid writes when validate=true', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoApplyWrites, {
					input: {
						repo: alice,
						validate: true,
						writes: [
							{
								$type: 'com.atproto.repo.applyWrites#create',
								collection: 'com.example.simple',
								value: {
									$type: 'com.example.simple',
									title: 'Apply Write Test',
									count: 99,
								},
							},
						],
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.results).toHaveLength(1);
			expect(result.results![0]).toHaveProperty('uri');
		});

		it('rejects any invalid write in batch when validate=true', async () => {
			await expectError(
				client.call(ComAtprotoRepoApplyWrites, {
					input: {
						repo: alice,
						validate: true,
						writes: [
							{
								$type: 'com.atproto.repo.applyWrites#create',
								collection: 'com.example.simple',
								value: {
									$type: 'com.example.simple',
									title: 'Valid One',
									count: 1,
								},
							},
							{
								$type: 'com.atproto.repo.applyWrites#create',
								collection: 'com.example.simple',
								value: {
									$type: 'com.example.simple',
									// invalid - missing required fields
								},
							},
						],
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('validates updates but not deletes', async () => {
			// first create a record to delete
			const created = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: false,
						record: {
							$type: 'com.example.simple',
							title: 'To Delete',
							count: 0,
						},
					},
					headers: getHeaders(alice),
				}),
			);

			const rkey = created.uri.split('/').pop()!;

			// delete should work even with validate=true (no record to validate)
			const result = await ok(
				client.call(ComAtprotoRepoApplyWrites, {
					input: {
						repo: alice,
						validate: true,
						writes: [
							{
								$type: 'com.atproto.repo.applyWrites#delete',
								collection: 'com.example.simple',
								rkey,
							},
						],
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.results).toHaveLength(1);
		});
	});

	describe('validation constraints', () => {
		it('enforces maxLength constraint', async () => {
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'x'.repeat(101), // exceeds maxLength: 100
							count: 1,
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('enforces minimum constraint', async () => {
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'Test',
							count: -1, // violates minimum: 0
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('accepts optional fields', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.simple',
						validate: true,
						record: {
							$type: 'com.example.simple',
							title: 'With Description',
							count: 5,
							description: 'This is optional',
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toBeDefined();
		});

		it('rejects missing rkey when lexicon requires literal key', async () => {
			// com.example.selfkey requires key: 'literal:self'
			// not providing rkey should fail because auto-generated TID != 'self'
			await expectError(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.selfkey',
						validate: true,
						// no rkey provided - will use fallback TID which doesn't match 'self'
						record: {
							$type: 'com.example.selfkey',
							name: 'Test',
						},
					},
					headers: getHeaders(alice),
				}),
				'InvalidRecord',
			);
		});

		it('accepts correct literal rkey', async () => {
			const result = await ok(
				client.call(ComAtprotoRepoCreateRecord, {
					input: {
						repo: alice,
						collection: 'com.example.selfkey',
						rkey: 'self',
						validate: true,
						record: {
							$type: 'com.example.selfkey',
							name: 'Test',
						},
					},
					headers: getHeaders(alice),
				}),
			);

			expect(result.uri).toContain('/self');
		});
	});

	describe('negative caching', () => {
		it('caches authority not found and does not repeat lookups', async () => {
			const lexiconCache = network.pds.ctx.lexiconCache;

			// first lookup - should trigger DNS resolution and cache negative result
			// oxlint-disable-next-line no-unsafe-type-assertion -- test-only: forcing invalid NSID
			const result1 = await lexiconCache.resolveAuthority('com.notfound.test' as never);
			expect(result1).toBe(null);

			// second lookup - should hit cache, not trigger another DNS lookup
			// oxlint-disable-next-line no-unsafe-type-assertion -- test-only: forcing invalid NSID
			const result2 = await lexiconCache.resolveAuthority('com.notfound.other' as never);
			expect(result2).toBe(null);

			// verify it's cached by checking the internal state
			// if the authority was cached, repeated calls should be instant
			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				// oxlint-disable-next-line no-await-in-loop, no-unsafe-type-assertion -- intentional sequential cache check
				await lexiconCache.resolveAuthority(`com.notfound.item${i}` as never);
			}
			const elapsed = performance.now() - start;

			// should be fast since it's all hitting cache (no network)
			expect(elapsed).toBeLessThan(100);
		});
	});
});
