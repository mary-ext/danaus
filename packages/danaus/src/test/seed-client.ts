import fs from 'node:fs/promises';

import {
	ComAtprotoRepoCreateRecord,
	ComAtprotoRepoPutRecord,
	ComAtprotoRepoUploadBlob,
	ComAtprotoServerCreateSession,
} from '@atcute/atproto';
import type {
	AppBskyActorProfile,
	AppBskyEmbedImages,
	AppBskyEmbedRecord,
	AppBskyFeedLike,
	AppBskyFeedPost,
	AppBskyFeedRepost,
	AppBskyGraphBlock,
	AppBskyGraphFollow,
	AppBskyGraphList,
	AppBskyGraphVerification,
} from '@atcute/bluesky';
import { Client, ok, simpleFetchHandler } from '@atcute/client';
import type {
	$type,
	CanonicalResourceUri,
	Cid,
	Did,
	Handle,
	InferInput,
	Nsid,
	ResourceUri,
} from '@atcute/lexicons';
import type { Records } from '@atcute/lexicons/ambient';
import { LocalDanausAccountCreateAccount } from '@kelinci/danaus-lexicons';

import { AppPasswordPrivilege } from '#app/accounts/db/schema.ts';

import type { TestNetworkNoAppView } from './test-network.ts';

export type BlobRef = ComAtprotoRepoUploadBlob.$output['blob'];

/** image reference */
export type ImageRef = {
	image: BlobRef;
	alt: string;
};

/** account info stored by seed client */
export interface SeedAccount {
	did: Did;
	handle: Handle;
	email: string;
	password: string;
	appPassword: string;
	accessJwt: string;
	refreshJwt: string;
}

/** record reference */
export interface RecordRef {
	uri: CanonicalResourceUri;
	cid: Cid;
}

/**
 * seed client for creating test data.
 */
export class SeedClient {
	accounts: Record<string, SeedAccount> = {};
	dids: Record<string, Did> = {};

	profiles: Record<string, { ref: RecordRef; record: AppBskyActorProfile.Main }> = {};
	follows: Record<string, Record<string, RecordRef>> = {};
	blocks: Record<string, Record<string, RecordRef>> = {};
	posts: Record<string, { text: string; ref: RecordRef; quote?: RecordRef }[]> = {};
	replies: Record<string, { text: string; ref: RecordRef }[]> = {};
	likes: Record<string, Record<string, RecordRef>> = {};
	reposts: Record<string, RecordRef[]> = {};
	lists: Record<string, Record<string, { ref: RecordRef; items: Record<string, RecordRef> }>> = {};
	feedgens: Record<string, Record<string, { ref: RecordRef; items: Record<string, RecordRef> }>> = {};
	starterpacks: Record<
		string,
		Record<
			string,
			{
				ref: RecordRef;
				name: string;
				list: RecordRef;
				feeds: string[];
			}
		>
	> = {};
	verifications: Record<string, Record<string, RecordRef>> = {};

	private client: Client;

	constructor(
		public network: TestNetworkNoAppView,
		private adminAuth: string,
	) {
		this.client = new Client({ handler: simpleFetchHandler({ service: network.pds.url }) });
	}

	/**
	 * create an account, app password, and legacy session.
	 * @param shortName short name for referencing this account
	 * @param params account creation params
	 * @returns account info
	 */
	async createAccount(
		shortName: string,
		params: {
			handle: Handle;
			email: string;
			password: string;
			recoveryKey?: Did;
			appPasswordName?: string;
			appPasswordPrivilege?: AppPasswordPrivilege;
		},
	): Promise<SeedAccount> {
		const { did } = await ok(
			this.client.call(LocalDanausAccountCreateAccount, {
				input: {
					handle: params.handle,
					email: params.email,
					password: params.password,
					recoveryKey: params.recoveryKey,
				},
				headers: { authorization: this.adminAuth },
			}),
		);

		const { secret: appPassword } = await this.network.pds.ctx.legacyAuthManager.createAppPassword({
			did: did,
			name: params.appPasswordName ?? 'seed password',
			privilege: params.appPasswordPrivilege ?? AppPasswordPrivilege.Full,
		});

		const session = await ok(
			this.client.call(ComAtprotoServerCreateSession, {
				input: {
					identifier: params.handle,
					password: appPassword,
				},
			}),
		);

		const account: SeedAccount = {
			did: session.did,
			handle: session.handle,
			email: params.email,
			password: params.password,
			appPassword: appPassword,
			accessJwt: session.accessJwt,
			refreshJwt: session.refreshJwt,
		};

		this.dids[shortName] = account.did;
		this.accounts[account.did] = account;

		return account;
	}

	/**
	 * upload a blob for later embedding in records.
	 * @param by did of the uploader
	 * @param bytes blob bytes
	 * @param mimeType blob mime type
	 * @returns blob reference
	 */
	async uploadBlob(by: Did, bytes: Uint8Array, mimeType: string): Promise<BlobRef> {
		const data = await ok(
			this.client.call(ComAtprotoRepoUploadBlob, {
				input: bytes,
				encoding: mimeType,
				headers: this.getHeaders(by),
			}),
		);

		return data.blob;
	}

	/**
	 * upload a file and return a blob reference.
	 * @param by did of the uploader
	 * @param filePath path to the file
	 * @param mimeType blob mime type
	 * @returns blob reference
	 */
	async uploadFile(by: Did, filePath: string, mimeType: string): Promise<BlobRef> {
		const bytes = await fs.readFile(filePath);
		return await this.uploadBlob(by, bytes, mimeType);
	}

	/**
	 * create a profile record.
	 * @param by did of the profile owner
	 * @param displayName display name
	 * @param description profile description
	 * @param selfLabels self labels
	 * @param joinedViaStarterPack starter pack record
	 * @param avatar avatar blob ref
	 * @param overrides record overrides
	 */
	async createProfile(
		by: Did,
		displayName?: string,
		description?: string,
		selfLabels?: string[],
		joinedViaStarterPack?: RecordRef,
		avatar?: BlobRef,
		overrides?: Partial<AppBskyActorProfile.Main>,
	): Promise<{ ref: RecordRef; record: AppBskyActorProfile.Main }> {
		const record: AppBskyActorProfile.Main = {
			$type: 'app.bsky.actor.profile',
			createdAt: new Date().toISOString(),
			displayName: displayName,
			description: description,
			avatar: avatar,
			labels: {
				$type: 'com.atproto.label.defs#selfLabels',
				values: selfLabels ? selfLabels.map((val) => ({ val })) : [],
			},
			joinedViaStarterPack: joinedViaStarterPack,
			...overrides,
		};

		const data = await ok(
			this.client.call(ComAtprotoRepoPutRecord, {
				input: {
					repo: by,
					collection: 'app.bsky.actor.profile',
					rkey: 'self',
					record,
				},
				headers: this.getHeaders(by),
			}),
		);

		const ref: RecordRef = { uri: data.uri as CanonicalResourceUri, cid: data.cid as Cid };

		this.profiles[by] = { ref, record };

		return this.profiles[by];
	}

	/**
	 * follow an account.
	 * @param from did of the follower
	 * @param to did of the followed
	 * @param overrides record overrides
	 */
	async follow(from: Did, to: Did, overrides?: Partial<AppBskyGraphFollow.Main>): Promise<RecordRef> {
		const ref = await this.createRecord(from, 'app.bsky.graph.follow', {
			$type: 'app.bsky.graph.follow',
			subject: to,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.follows[from] ??= {};
		this.follows[from][to] = ref;
		return ref;
	}

	/**
	 * block an account.
	 * @param from did of the blocker
	 * @param to did of the blocked
	 * @param overrides record overrides
	 */
	async block(from: Did, to: Did, overrides?: Partial<AppBskyGraphBlock.Main>): Promise<RecordRef> {
		const ref = await this.createRecord(from, 'app.bsky.graph.block', {
			$type: 'app.bsky.graph.block',
			subject: to,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.blocks[from] ??= {};
		this.blocks[from][to] = ref;
		return ref;
	}

	/**
	 * create a post record.
	 * @param by did of the author
	 * @param text post text
	 * @param facets richtext facets
	 * @param images image embeds
	 * @param quote quoted record
	 * @param overrides record overrides
	 */
	async post(
		by: Did,
		text: string,
		facets?: AppBskyFeedPost.Main['facets'],
		images?: ImageRef[],
		quote?: RecordRef,
		overrides?: Partial<AppBskyFeedPost.Main>,
	): Promise<{ text: string; ref: RecordRef; quote?: RecordRef }> {
		const imageEmbed: $type.enforce<AppBskyEmbedImages.Main> | undefined = images
			? {
					$type: 'app.bsky.embed.images',
					images,
				}
			: undefined;
		const recordEmbed: $type.enforce<AppBskyEmbedRecord.Main> | undefined = quote
			? {
					$type: 'app.bsky.embed.record',
					record: { uri: quote.uri, cid: quote.cid },
				}
			: undefined;

		const embed: AppBskyFeedPost.Main['embed'] =
			imageEmbed && recordEmbed
				? {
						$type: 'app.bsky.embed.recordWithMedia',
						record: recordEmbed,
						media: imageEmbed,
					}
				: recordEmbed
					? recordEmbed
					: imageEmbed;

		const record: AppBskyFeedPost.Main = {
			$type: 'app.bsky.feed.post',
			text,
			createdAt: new Date().toISOString(),
			facets: facets,
			embed: embed,
			...overrides,
		};

		const ref = await this.createRecord(by, 'app.bsky.feed.post', record);

		this.posts[by] ??= [];
		const post = { text, ref, quote };
		this.posts[by].push(post);
		return post;
	}

	/**
	 * create a reply record.
	 * @param by did of the author
	 * @param root root record
	 * @param parent parent record
	 * @param text reply text
	 * @param facets richtext facets
	 * @param overrides record overrides
	 */
	async reply(
		by: Did,
		root: RecordRef,
		parent: RecordRef,
		text: string,
		facets?: AppBskyFeedPost.Main['facets'],
		overrides?: Partial<AppBskyFeedPost.Main>,
	): Promise<{ text: string; ref: RecordRef }> {
		const record: AppBskyFeedPost.Main = {
			$type: 'app.bsky.feed.post',
			text,
			reply: {
				root: root,
				parent: parent,
			},
			createdAt: new Date().toISOString(),
			facets: facets,
			...overrides,
		};

		const ref = await this.createRecord(by, 'app.bsky.feed.post', record);

		this.replies[by] ??= [];
		const reply = { text, ref };
		this.replies[by].push(reply);
		return reply;
	}

	/**
	 * create a like record.
	 * @param by did of the liker
	 * @param subject record to like
	 * @param overrides record overrides
	 */
	async like(by: Did, subject: RecordRef, overrides?: Partial<AppBskyFeedLike.Main>): Promise<RecordRef> {
		const ref = await this.createRecord(by, 'app.bsky.feed.like', {
			$type: 'app.bsky.feed.like',
			subject: subject,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.likes[by] ??= {};
		this.likes[by][subject.uri] = ref;
		return ref;
	}

	/**
	 * create a repost record.
	 * @param by did of the reposter
	 * @param subject record to repost
	 * @param overrides record overrides
	 */
	async repost(by: Did, subject: RecordRef, overrides?: Partial<AppBskyFeedRepost.Main>): Promise<RecordRef> {
		const ref = await this.createRecord(by, 'app.bsky.feed.repost', {
			$type: 'app.bsky.feed.repost',
			subject: subject,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.reposts[by] ??= [];
		this.reposts[by].push(ref);
		return ref;
	}

	/**
	 * create a list record.
	 * @param by did of the creator
	 * @param name list name
	 * @param purpose list purpose
	 * @param overrides record overrides
	 */
	async createList(
		by: Did,
		name: string,
		purpose: 'mod' | 'curate' | 'reference',
		overrides?: Partial<AppBskyGraphList.Main>,
	): Promise<RecordRef> {
		const listPurpose =
			purpose === 'mod'
				? 'app.bsky.graph.defs#modlist'
				: purpose === 'curate'
					? 'app.bsky.graph.defs#curatelist'
					: 'app.bsky.graph.defs#referencelist';

		const ref = await this.createRecord(by, 'app.bsky.graph.list', {
			$type: 'app.bsky.graph.list',
			name,
			purpose: listPurpose,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.lists[by] ??= {};
		this.lists[by][ref.uri] = { ref, items: {} };
		return ref;
	}

	/**
	 * add an item to a list.
	 * @param by did of the creator
	 * @param subject did to add
	 * @param list list record
	 */
	async addToList(by: Did, subject: Did, list: RecordRef): Promise<RecordRef> {
		const ref = await this.createRecord(by, 'app.bsky.graph.listitem', {
			$type: 'app.bsky.graph.listitem',
			subject,
			list: list.uri,
			createdAt: new Date().toISOString(),
		});

		const found = (this.lists[by] ?? {})[list.uri];
		if (found) {
			found.items[subject] = ref;
		}

		return ref;
	}

	/**
	 * create a feed generator record.
	 * @param by did of the creator
	 * @param feedDid feed did
	 * @param name feed name
	 */
	async createFeedGen(by: Did, feedDid: Did, name: string): Promise<RecordRef> {
		const ref = await this.createRecord(by, 'app.bsky.feed.generator', {
			$type: 'app.bsky.feed.generator',
			did: feedDid,
			displayName: name,
			createdAt: new Date().toISOString(),
		});

		this.feedgens[by] ??= {};
		this.feedgens[by][ref.uri] = { ref, items: {} };
		return ref;
	}

	/**
	 * create a starter pack record.
	 * @param by did of the creator
	 * @param name starter pack name
	 * @param actors list of dids
	 * @param feeds list of feed uris
	 */
	async createStarterPack(by: Did, name: string, actors: Did[], feeds?: ResourceUri[]): Promise<RecordRef> {
		const list = await this.createList(by, 'n/a', 'reference');
		for (const did of actors) {
			await this.addToList(by, did, list);
		}

		const ref = await this.createRecord(by, 'app.bsky.graph.starterpack', {
			$type: 'app.bsky.graph.starterpack',
			name,
			list: list.uri,
			feeds: feeds?.map((uri) => ({ uri })),
			createdAt: new Date().toISOString(),
		});

		this.starterpacks[by] ??= {};
		this.starterpacks[by][ref.uri] = {
			ref,
			name,
			list,
			feeds: feeds ?? [],
		};

		return ref;
	}

	/**
	 * create a verification record.
	 * @param by did of the verifier
	 * @param subject did of the subject
	 * @param handle handle of the subject
	 * @param displayName display name
	 * @param overrides record overrides
	 */
	async verify(
		by: Did,
		subject: Did,
		handle: Handle,
		displayName: string,
		overrides?: Partial<AppBskyGraphVerification.Main>,
	): Promise<RecordRef> {
		const ref = await this.createRecord(by, 'app.bsky.graph.verification', {
			$type: 'app.bsky.graph.verification',
			subject,
			handle,
			displayName,
			createdAt: new Date().toISOString(),
			...overrides,
		});

		this.verifications[by] ??= {};
		this.verifications[by][subject] = ref;
		return ref;
	}

	/**
	 * create a record using the standard repo endpoint.
	 * @param did record owner
	 * @param collection record collection
	 * @param record record value
	 * @param rkey optional record key
	 */
	async createRecord<TCollection extends keyof Records & string>(
		did: Did,
		collection: TCollection,
		record: InferInput<Records[TCollection]>,
		rkey?: string,
	): Promise<RecordRef> {
		const data = await ok(
			this.client.call(ComAtprotoRepoCreateRecord, {
				input: {
					repo: did,
					collection: collection as Nsid,
					record,
					rkey,
				},
				headers: this.getHeaders(did),
			}),
		);

		return {
			uri: data.uri as CanonicalResourceUri,
			cid: data.cid as Cid,
		};
	}

	/**
	 * get bearer auth headers for a did.
	 * @param did account did
	 */
	getHeaders(did: Did): { authorization: string } {
		return SeedClient.getHeaders(this.accounts[did]!.accessJwt);
	}

	/**
	 * get bearer auth headers for a jwt.
	 * @param jwt access token
	 */
	static getHeaders(jwt: string): { authorization: string } {
		return { authorization: `Bearer ${jwt}` };
	}
}

/**
 * create a small set of seed users.
 * @param sc seed client
 */
export const usersSeed = async (sc: SeedClient): Promise<SeedClient> => {
	await sc.createAccount('alice', users.alice);
	await sc.createAccount('bob', users.bob);
	await sc.createAccount('carol', users.carol);
	await sc.createAccount('dan', users.dan);

	await sc.createProfile(
		sc.dids.alice!,
		users.alice.displayName,
		users.alice.description,
		users.alice.selfLabels,
	);
	await sc.createProfile(sc.dids.bob!, users.bob.displayName, users.bob.description, users.bob.selfLabels);

	return sc;
};

interface UserDecl {
	email: string;
	handle: Handle;
	password: string;
	displayName: string | undefined;
	description: string | undefined;
	selfLabels: string[] | undefined;
}

const users = {
	alice: {
		email: 'alice@test.com',
		handle: 'alice.test',
		password: 'alice-pass',
		displayName: 'ali',
		description: 'its me!',
		selfLabels: ['self-label-a', 'self-label-b'],
	},
	bob: {
		email: 'bob@test.com',
		handle: 'bob.test',
		password: 'bob-pass',
		displayName: 'bobby',
		description: 'hi im bob label_me',
		selfLabels: undefined,
	},
	carol: {
		email: 'carol@test.com',
		handle: 'carol.test',
		password: 'carol-pass',
		displayName: undefined,
		description: undefined,
		selfLabels: undefined,
	},
	dan: {
		email: 'dan@test.com',
		handle: 'dan.test',
		password: 'dan-pass',
		displayName: undefined,
		description: undefined,
		selfLabels: undefined,
	},
} satisfies Record<string, UserDecl>;
