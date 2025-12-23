import { writeCarStream } from '@atcute/car';
import * as CID from '@atcute/cid';
import type { Did } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import type { Account, AccountManager } from '#app/accounts/manager.ts';
import {
	AuthCredentialsType,
	type AccessOutput,
	type AdminTokenOutput,
	type OAuthOutput,
	type UnauthenticatedOutput,
} from '#app/auth/verifier.ts';

type OptionalAuth = AccessOutput | OAuthOutput | AdminTokenOutput | UnauthenticatedOutput;

/**
 * check whether the auth is for the requested did or admin.
 * @param auth auth credentials
 * @param did repo did
 * @returns true when auth is admin or matches the repo did
 */
export const isUserOrAdmin = (auth: OptionalAuth, did: Did): boolean => {
	if (auth.type === AuthCredentialsType.AdminToken) {
		return true;
	}

	if (
		(auth.type === AuthCredentialsType.Access || auth.type === AuthCredentialsType.OAuth) &&
		auth.did === did
	) {
		return true;
	}

	return false;
};

/**
 * ensure a repo can be accessed for sync endpoints.
 * @param accountManager account manager
 * @param did repo did
 * @param isAdminOrSelf true when request is from repo owner or admin
 * @returns account info
 */
export const assertRepoAvailability = (
	accountManager: AccountManager,
	did: Did,
	isAdminOrSelf: boolean,
): Account => {
	const account = accountManager.getAccount(did, {
		includeDeactivated: true,
		includeTakenDown: true,
	});

	if (!account) {
		throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
	}

	if (!isAdminOrSelf) {
		if (account.takedown_ref) {
			throw new InvalidRequestError({
				error: 'RepoTakendown',
				description: `repository has been taken down`,
			});
		}

		if (account.deactivated_at) {
			throw new InvalidRequestError({
				error: 'RepoDeactivated',
				description: `repository has been deactivated`,
			});
		}
	}

	return account;
};

/**
 * build a car stream from block data.
 * @param roots root cids
 * @param blocks block map
 * @returns readable car stream
 */
export const carStreamFromBlocks = (
	roots: string[],
	blocks: Map<string, Uint8Array>,
): AsyncIterable<Uint8Array> => {
	return writeCarStream(
		roots.map((cid) => CID.toCidLink(CID.fromString(cid))),
		Array.from(blocks, ([cid, data]) => {
			return {
				cid: CID.fromString(cid).bytes,
				data: data,
			};
		}),
	);
};
