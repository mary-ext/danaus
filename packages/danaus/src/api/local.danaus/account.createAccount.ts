import type { AppBskyActorProfile } from '@atcute/bluesky';
import { Secp256k1PrivateKeyExportable, type PrivateKeyExportable } from '@atcute/crypto';
import {
	deriveDidFromGenesisOp,
	signOperation,
	validateIncomingOp,
	type UnsignedOperation,
} from '@atcute/did-plc';
import { isKeyDid } from '@atcute/identity';
import type { Did, Handle } from '@atcute/lexicons';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAccountCreateAccount } from '@kelinci/danaus-lexicons';

import * as v from 'valibot';

import { verifyPasswordConstraints } from '#app/accounts/passwords.ts';
import { AccountStatus } from '#app/accounts/types.ts';
import { AuthCredentialsType } from '#app/auth/verifier.ts';
import type { AppContext } from '#app/context.ts';

const emailSchema = v.pipe(v.string(), v.email());

// #region XRPC handler
export const createAccount = (router: XRPCRouter, context: AppContext) => {
	const { inviteCodeManager, authVerifier } = context;

	router.addProcedure(LocalDanausAccountCreateAccount, {
		async handler({ input, request }) {
			const auth = await authVerifier.adminOptional(request);
			const isAdmin = auth.type === AuthCredentialsType.AdminToken;

			// public signup path: check invite code if required
			if (!isAdmin) {
				if (context.config.service.invites.required) {
					if (!input.inviteCode) {
						throw new InvalidRequestError({
							error: 'InvalidInviteCode',
							description: 'invite code required',
						});
					}

					inviteCodeManager.ensureInviteIsAvailable(input.inviteCode);
				}
			}

			const { did } = await provisionAccount(context, {
				handle: input.handle,
				email: input.email,
				password: input.password,
				recoveryKey: input.recoveryKey,
			});

			// record invite code usage for public signups
			if (!isAdmin && input.inviteCode) {
				inviteCodeManager.recordInviteUse(input.inviteCode, did);
			}

			return json({ did });
		},
	});
};
// #endregion

// #region account provisioning
export interface CreateAccountParams {
	handle: Handle;
	email: string;
	password: string;
	recoveryKey?: string;
}

export interface CreateAccountResult {
	did: Did<'plc'>;
}

/**
 * provisions a new account with the given parameters
 * @param ctx app context
 * @param params account creation parameters
 * @returns the created account's DID
 * @throws InvalidRequestError for validation failures
 */
export const provisionAccount = async (
	ctx: AppContext,
	params: CreateAccountParams,
): Promise<CreateAccountResult> => {
	const { accountManager, actorManager, didDocumentResolver, plcClient, sequencer } = ctx;

	if (!v.is(emailSchema, params.email)) {
		throw new InvalidRequestError({ error: 'InvalidEmail', description: `invalid email address` });
	}

	if (params.recoveryKey !== undefined && !isKeyDid(params.recoveryKey)) {
		throw new InvalidRequestError({ error: 'InvalidRecoveryKey', description: `invalid recovery key` });
	}

	verifyPasswordConstraints(params.password);

	const handle = await accountManager.validateHandle(params.handle);

	const accountByHandle = accountManager.getAccount(handle);
	if (accountByHandle !== null) {
		throw new InvalidRequestError({
			error: 'HandleTaken',
			description: `handle already taken by another account`,
		});
	}

	const accountByEmail = accountManager.getAccountByEmail(params.email);
	if (accountByEmail !== null) {
		throw new InvalidRequestError({
			error: 'EmailTaken',
			description: `email already taken by another account`,
		});
	}

	const signingKey = await Secp256k1PrivateKeyExportable.createKeypair();
	const { did, plcOp } = await createGenesisOp(ctx, params, signingKey);

	await actorManager.create(did, signingKey);

	try {
		const { commitEvent } = await actorManager.transact(did, (store) => {
			const profile: AppBskyActorProfile.Main = {
				$type: 'app.bsky.actor.profile',
				displayName: handle,
				createdAt: new Date().toISOString(),
			};

			return store.repo.createRepo(
				[
					{
						action: 'create',
						collection: 'app.bsky.actor.profile',
						rkey: 'self',
						record: profile,
					},
				],
				{ emitSequencer: false },
			);
		});

		await plcClient.submitOperation(did, plcOp);

		// confirm that it has been created successfully
		await didDocumentResolver.resolve(did, { noCache: true });

		await accountManager.createAccount({
			did: did,
			email: params.email,
			handle: params.handle,
			password: params.password,
		});

		await sequencer.emitIdentity(did, handle);
		await sequencer.emitAccount(did, AccountStatus.Active);
		await sequencer.emitCommit(commitEvent);
		await sequencer.emitSync(did, commitEvent.rev, commitEvent.commitCid, commitEvent.blocks);
	} catch (err) {
		await actorManager.destroy(did);
		throw err;
	}

	return { did };
};
// #endregion

// #region PLC operations
const createGenesisOp = async (
	context: AppContext,
	params: CreateAccountParams,
	keypair: PrivateKeyExportable,
) => {
	const [pdsRotationKey, userKey] = await Promise.all([
		context.config.secrets.plcRotationKey.exportPublicKey('did'),
		keypair.exportPublicKey('did'),
	]);

	const rotationKeys: Did<'key'>[] = [pdsRotationKey];

	if (context.config.identity.plcRecoveryKey !== null) {
		rotationKeys.unshift(context.config.identity.plcRecoveryKey);
	}

	if (params.recoveryKey !== undefined) {
		rotationKeys.unshift(params.recoveryKey as Did<'key'>);
	}

	const unsignedOp: UnsignedOperation = {
		type: 'plc_operation',
		alsoKnownAs: [`at://${params.handle}`],
		prev: null,
		rotationKeys: rotationKeys,
		services: {
			atproto_pds: {
				type: 'AtprotoPersonalDataServer',
				endpoint: context.config.service.publicUrl,
			},
		},
		verificationMethods: {
			atproto: userKey,
		},
	};

	const plcOp = await signOperation(unsignedOp, context.config.secrets.plcRotationKey);
	const did = await deriveDidFromGenesisOp(plcOp);

	validateIncomingOp(plcOp);

	return { did, plcOp };
};
// #endregion
