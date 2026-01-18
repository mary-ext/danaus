import type { Did } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { t, type AccountDb } from './db';
import { PreferredMfa, WebAuthnCredentialType } from './db/schema';
import { generateBackupCodes, MAX_TOTP_CREDENTIALS, verifyTotpCode } from './totp';
import { MAX_WEBAUTHN_CREDENTIALS, WEBAUTHN_CHALLENGE_TTL_MS } from './webauthn';

export type TotpCredential = typeof t.totpCredential.$inferSelect;
export type BackupCode = typeof t.recoveryCode.$inferSelect;
export type WebauthnCredential = typeof t.webauthnCredential.$inferSelect;
export type WebauthnRegistrationChallenge = typeof t.webauthnRegistrationChallenge.$inferSelect;

/** WebAuthn credential type for MFA status */
export type WebAuthnType = false | 'security-key' | 'passkey' | 'mixed';

/** MFA status for an account */
export interface MfaStatus {
	/** preferred MFA method */
	preferred: PreferredMfa;
	/** has TOTP credentials */
	hasTotp: boolean;
	/** WebAuthn credential type(s) registered */
	webAuthnType: WebAuthnType;
	/** has recovery codes */
	hasRecoveryCodes: boolean;
}

interface MfaManagerOptions {
	db: AccountDb;
}

interface CreateTotpCredentialOptions {
	did: Did;
	name?: string;
	secret: Uint8Array;
	lastUsedCounter: number;
}

interface CreateWebAuthnCredentialOptions {
	did: Did;
	type: WebAuthnCredentialType;
	name?: string;
	credentialId: string;
	publicKey: Uint8Array;
	counter: number;
	transports?: AuthenticatorTransportFuture[];
}

export class MfaManager {
	readonly #db: AccountDb;

	constructor(options: MfaManagerOptions) {
		this.#db = options.db;
	}

	// #region TOTP credentials

	/**
	 * create a TOTP credential for an account.
	 * @param options TOTP credential options
	 * @returns created credential
	 */
	createTotpCredential(options: CreateTotpCredentialOptions): TotpCredential {
		const count = this.#countTotpCredentials(options.did);
		if (count >= MAX_TOTP_CREDENTIALS) {
			throw new InvalidRequestError({
				error: 'TooManyTotpCredentials',
				description: `cannot have more than ${MAX_TOTP_CREDENTIALS} authenticators`,
			});
		}

		const name = options.name?.trim() || this.generateTotpName(options.did);

		// check for duplicate name
		const existing = this.#db
			.select()
			.from(t.totpCredential)
			.where(and(eq(t.totpCredential.did, options.did), eq(t.totpCredential.name, name)))
			.get();

		if (existing) {
			throw new InvalidRequestError({
				error: 'DuplicateTotpName',
				description: `an authenticator with this name already exists`,
			});
		}

		const inserted = this.#db
			.insert(t.totpCredential)
			.values({
				did: options.did,
				name: name,
				secret: Buffer.from(options.secret),
				created_at: new Date(),
				last_used_counter: options.lastUsedCounter,
			})
			.returning()
			.get();

		if (!inserted) {
			throw new Error(`failed to create TOTP credential`);
		}

		this.#syncPreferredMfa(options.did);

		return inserted;
	}

	/**
	 * list TOTP credentials for an account.
	 * @param did account did
	 * @returns TOTP credentials
	 */
	listTotpCredentials(did: Did): TotpCredential[] {
		return this.#db.select().from(t.totpCredential).where(eq(t.totpCredential.did, did)).all();
	}

	/**
	 * get a TOTP credential by id.
	 * @param did account did
	 * @param id credential id
	 * @returns TOTP credential or null
	 */
	getTotpCredential(did: Did, id: number): TotpCredential | null {
		const credential = this.#db
			.select()
			.from(t.totpCredential)
			.where(and(eq(t.totpCredential.did, did), eq(t.totpCredential.id, id)))
			.get();

		return credential ?? null;
	}

	/**
	 * delete a TOTP credential.
	 * @param did account did
	 * @param id credential id
	 */
	deleteTotpCredential(did: Did, id: number): void {
		this.#db
			.delete(t.totpCredential)
			.where(and(eq(t.totpCredential.did, did), eq(t.totpCredential.id, id)))
			.run();

		this.#syncPreferredMfa(did);
	}

	/**
	 * verify a TOTP code against any of the account's credentials.
	 * updates last_used_counter on successful verification to prevent replay attacks.
	 * @param did account did
	 * @param code the code to verify
	 * @returns true if the code is valid for any credential
	 */
	async verifyAccountTotpCode(did: Did, code: string): Promise<boolean> {
		const credentials = this.listTotpCredentials(did);

		for (const credential of credentials) {
			const counter = await verifyTotpCode(credential.secret, code, credential.last_used_counter);

			if (counter !== null) {
				// update last_used_counter to prevent replay attacks
				this.#db
					.update(t.totpCredential)
					.set({ last_used_counter: counter })
					.where(eq(t.totpCredential.id, credential.id))
					.run();

				return true;
			}
		}

		return false;
	}

	/**
	 * generate a unique name for a new TOTP credential.
	 * @param did account did
	 * @returns generated name like "Authenticator" or "Authenticator 2"
	 */
	generateTotpName(did: Did): string {
		const existing = this.listTotpCredentials(did);
		const baseName = 'Authenticator';

		if (existing.length === 0) {
			return baseName;
		}

		// find the next available number
		const existingNames = new Set(existing.map((c) => c.name));
		let num = 2;
		while (existingNames.has(`${baseName} ${num}`)) {
			num++;
		}

		return `${baseName} ${num}`;
	}

	#countTotpCredentials(did: Did): number {
		return (
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.totpCredential)
				.where(eq(t.totpCredential.did, did))
				.get()?.count ?? 0
		);
	}

	// #endregion

	// #region recovery codes

	/**
	 * generate and store recovery codes for an account.
	 * deletes any existing codes first.
	 * @param did account did
	 */
	generateRecoveryCodes(did: Did): void {
		const codes = generateBackupCodes();
		const now = new Date();

		this.#db.transaction((tx) => {
			tx.delete(t.recoveryCode).where(eq(t.recoveryCode.did, did)).run();

			for (const code of codes) {
				tx.insert(t.recoveryCode)
					.values({
						did: did,
						code: code,
						created_at: now,
					})
					.run();
			}
		});
	}

	/**
	 * get all unused recovery codes for an account.
	 * @param did account did
	 * @returns array of unused codes
	 */
	getRecoveryCodes(did: Did): string[] {
		return this.#db
			.select({ code: t.recoveryCode.code })
			.from(t.recoveryCode)
			.where(and(eq(t.recoveryCode.did, did), isNull(t.recoveryCode.used_at)))
			.all()
			.map((row) => row.code);
	}

	/**
	 * get count of unused recovery codes.
	 * @param did account did
	 * @returns number of unused codes
	 */
	getRecoveryCodeCount(did: Did): number {
		return (
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.recoveryCode)
				.where(and(eq(t.recoveryCode.did, did), isNull(t.recoveryCode.used_at)))
				.get()?.count ?? 0
		);
	}

	/**
	 * verify and consume a recovery code.
	 * @param did account did
	 * @param code the code to verify
	 * @returns true if the code was valid and consumed
	 */
	consumeRecoveryCode(did: Did, code: string): boolean {
		const result = this.#db
			.update(t.recoveryCode)
			.set({ used_at: new Date() })
			.where(and(eq(t.recoveryCode.did, did), eq(t.recoveryCode.code, code), isNull(t.recoveryCode.used_at)))
			.returning()
			.get();

		return result != null;
	}

	/**
	 * delete all recovery codes for an account.
	 * @param did account did
	 */
	deleteRecoveryCodes(did: Did): void {
		this.#db.delete(t.recoveryCode).where(eq(t.recoveryCode.did, did)).run();
	}

	// #endregion

	// #region WebAuthn credentials

	/**
	 * create a WebAuthn credential for an account.
	 * @param options credential options
	 * @returns created credential
	 */
	createWebAuthnCredential(options: CreateWebAuthnCredentialOptions): WebauthnCredential {
		const count = this.#countWebAuthnCredentials(options.did);
		if (count >= MAX_WEBAUTHN_CREDENTIALS) {
			throw new InvalidRequestError({
				error: 'TooManyWebAuthnCredentials',
				description: `cannot have more than ${MAX_WEBAUTHN_CREDENTIALS} security keys`,
			});
		}

		const name = options.name?.trim() || this.generateWebAuthnName(options.did, options.type);

		// check for duplicate name
		const existing = this.#db
			.select()
			.from(t.webauthnCredential)
			.where(and(eq(t.webauthnCredential.did, options.did), eq(t.webauthnCredential.name, name)))
			.get();

		if (existing) {
			throw new InvalidRequestError({
				error: 'DuplicateWebAuthnName',
				description: `a credential with this name already exists`,
			});
		}

		// check for duplicate credential ID
		const existingCredId = this.#db
			.select()
			.from(t.webauthnCredential)
			.where(eq(t.webauthnCredential.credential_id, options.credentialId))
			.get();

		if (existingCredId) {
			throw new InvalidRequestError({
				error: 'DuplicateCredentialId',
				description: `this security key is already registered`,
			});
		}

		const inserted = this.#db
			.insert(t.webauthnCredential)
			.values({
				did: options.did,
				type: options.type,
				name: name,
				credential_id: options.credentialId,
				public_key: Buffer.from(options.publicKey),
				counter: options.counter,
				transports: options.transports,
				created_at: new Date(),
			})
			.returning()
			.get();

		if (!inserted) {
			throw new Error(`failed to create WebAuthn credential`);
		}

		// sync preferred MFA (only for security keys, not passkeys)
		if (options.type === WebAuthnCredentialType.SecurityKey) {
			this.#syncPreferredMfa(options.did);
		}

		return inserted;
	}

	/**
	 * list WebAuthn credentials for an account.
	 * @param did account did
	 * @returns WebAuthn credentials
	 */
	listWebAuthnCredentials(did: Did): WebauthnCredential[] {
		return this.#db.select().from(t.webauthnCredential).where(eq(t.webauthnCredential.did, did)).all();
	}

	/**
	 * list WebAuthn credentials for an account filtered by type.
	 * @param did account did
	 * @param type credential type
	 * @returns WebAuthn credentials of the specified type
	 */
	listWebAuthnCredentialsByType(did: Did, type: WebAuthnCredentialType): WebauthnCredential[] {
		return this.#db
			.select()
			.from(t.webauthnCredential)
			.where(and(eq(t.webauthnCredential.did, did), eq(t.webauthnCredential.type, type)))
			.all();
	}

	/**
	 * get a WebAuthn credential by id.
	 * @param did account did
	 * @param id credential id
	 * @returns WebAuthn credential or null
	 */
	getWebAuthnCredential(did: Did, id: number): WebauthnCredential | null {
		const credential = this.#db
			.select()
			.from(t.webauthnCredential)
			.where(and(eq(t.webauthnCredential.did, did), eq(t.webauthnCredential.id, id)))
			.get();

		return credential ?? null;
	}

	/**
	 * get a WebAuthn credential by credential ID.
	 * @param credentialId base64url credential ID
	 * @returns WebAuthn credential or null
	 */
	getWebAuthnCredentialByCredentialId(credentialId: string): WebauthnCredential | null {
		const credential = this.#db
			.select()
			.from(t.webauthnCredential)
			.where(eq(t.webauthnCredential.credential_id, credentialId))
			.get();

		return credential ?? null;
	}

	/**
	 * delete a WebAuthn credential.
	 * @param did account did
	 * @param id credential id
	 */
	deleteWebAuthnCredential(did: Did, id: number): void {
		this.#db
			.delete(t.webauthnCredential)
			.where(and(eq(t.webauthnCredential.did, did), eq(t.webauthnCredential.id, id)))
			.run();

		this.#syncPreferredMfa(did);
	}

	/**
	 * update the counter for a WebAuthn credential.
	 * @param id credential id
	 * @param counter new counter value
	 */
	updateWebAuthnCredentialCounter(id: number, counter: number): void {
		this.#db.update(t.webauthnCredential).set({ counter }).where(eq(t.webauthnCredential.id, id)).run();
	}

	/**
	 * generate a unique name for a new WebAuthn credential.
	 * @param did account did
	 * @param type credential type
	 * @returns generated name like "Security Key" or "Security Key 2"
	 */
	generateWebAuthnName(did: Did, type: WebAuthnCredentialType): string {
		const existing = this.listWebAuthnCredentialsByType(did, type);
		const baseName = type === WebAuthnCredentialType.SecurityKey ? 'Security Key' : 'Passkey';

		if (existing.length === 0) {
			return baseName;
		}

		// find the next available number
		const existingNames = new Set(existing.map((c) => c.name));
		let num = 2;
		while (existingNames.has(`${baseName} ${num}`)) {
			num++;
		}

		return `${baseName} ${num}`;
	}

	#countWebAuthnCredentials(did: Did): number {
		return (
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.webauthnCredential)
				.where(eq(t.webauthnCredential.did, did))
				.get()?.count ?? 0
		);
	}

	#getWebAuthnType(did: Did): WebAuthnType {
		const credentials = this.#db
			.select({ type: t.webauthnCredential.type })
			.from(t.webauthnCredential)
			.where(eq(t.webauthnCredential.did, did))
			.all();

		if (credentials.length === 0) {
			return false;
		}

		const hasSecurityKey = credentials.some((c) => c.type === WebAuthnCredentialType.SecurityKey);
		const hasPasskey = credentials.some((c) => c.type === WebAuthnCredentialType.Passkey);

		if (hasSecurityKey && hasPasskey) {
			return 'mixed';
		}
		return hasPasskey ? 'passkey' : 'security-key';
	}

	// #endregion

	// #region WebAuthn registration challenges

	/**
	 * create a WebAuthn registration challenge.
	 * @param did account did
	 * @param challenge base64url challenge
	 * @returns token for retrieving the challenge
	 */
	createWebAuthnRegistrationChallenge(did: Did, challenge: string): string {
		const token = nanoid(32);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS);

		this.#db
			.insert(t.webauthnRegistrationChallenge)
			.values({
				token: token,
				did: did,
				challenge: challenge,
				created_at: now,
				expires_at: expiresAt,
			})
			.run();

		return token;
	}

	/**
	 * get a WebAuthn registration challenge by token.
	 * @param token the token
	 * @returns WebAuthn challenge or null if expired/not found
	 */
	getWebAuthnRegistrationChallenge(token: string): WebauthnRegistrationChallenge | null {
		const challenge = this.#db
			.select()
			.from(t.webauthnRegistrationChallenge)
			.where(eq(t.webauthnRegistrationChallenge.token, token))
			.get();

		if (!challenge) {
			return null;
		}

		const now = new Date();
		if (challenge.expires_at <= now) {
			this.#db
				.delete(t.webauthnRegistrationChallenge)
				.where(eq(t.webauthnRegistrationChallenge.token, token))
				.run();
			return null;
		}

		return challenge;
	}

	/**
	 * delete a WebAuthn registration challenge.
	 * @param token the token
	 */
	deleteWebAuthnRegistrationChallenge(token: string): void {
		this.#db
			.delete(t.webauthnRegistrationChallenge)
			.where(eq(t.webauthnRegistrationChallenge.token, token))
			.run();
	}

	/**
	 * clean up expired WebAuthn registration challenges.
	 */
	cleanupExpiredWebAuthnRegistrationChallenges(): void {
		const now = new Date();
		this.#db
			.delete(t.webauthnRegistrationChallenge)
			.where(lte(t.webauthnRegistrationChallenge.expires_at, now))
			.run();
	}

	// #endregion

	// #region passkey login challenges

	/**
	 * create a passkey login challenge for passwordless authentication.
	 * @param challenge base64url challenge string
	 */
	createPasskeyLoginChallenge(challenge: string): void {
		const now = new Date();
		const expiresAt = new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS);

		this.#db
			.insert(t.passkeyLoginChallenge)
			.values({
				challenge: challenge,
				created_at: now,
				expires_at: expiresAt,
			})
			.run();
	}

	/**
	 * consume a passkey login challenge (delete and return if valid).
	 * @param challenge base64url challenge string
	 * @returns true if challenge was valid and consumed
	 */
	consumePasskeyLoginChallenge(challenge: string): boolean {
		const now = new Date();

		// clean up expired challenges
		this.#db.delete(t.passkeyLoginChallenge).where(lte(t.passkeyLoginChallenge.expires_at, now)).run();

		// try to delete the challenge (returns the deleted row if it existed)
		const result = this.#db
			.delete(t.passkeyLoginChallenge)
			.where(eq(t.passkeyLoginChallenge.challenge, challenge))
			.returning()
			.get();

		return result != null;
	}

	// #endregion

	// #region MFA status

	/**
	 * get MFA status for an account.
	 * @param did account did
	 * @returns MFA status with preferred method and available methods, or null if no MFA configured
	 */
	getMfaStatus(did: Did): MfaStatus | null {
		const account = this.#db
			.select({ preferred_mfa: t.account.preferred_mfa })
			.from(t.account)
			.where(eq(t.account.did, did))
			.get();

		if (!account || account.preferred_mfa == null) {
			return null;
		}

		return {
			preferred: account.preferred_mfa,
			hasTotp: this.#countTotpCredentials(did) > 0,
			webAuthnType: this.#getWebAuthnType(did),
			hasRecoveryCodes: this.getRecoveryCodeCount(did) > 0,
		};
	}

	/**
	 * sync preferred_mfa to reflect current MFA credentials.
	 * - if null and credentials exist → set to first available type
	 * - if set but that type has no credentials → switch to another type or clear
	 */
	#syncPreferredMfa(did: Did): void {
		const account = this.#db
			.select({ preferred_mfa: t.account.preferred_mfa })
			.from(t.account)
			.where(eq(t.account.did, did))
			.get();

		if (!account) {
			return;
		}

		const hasTotp = this.#countTotpCredentials(did) > 0;
		const hasWebAuthn = this.#countWebAuthnCredentials(did) > 0;

		// check if current preference is still valid
		if (account.preferred_mfa === PreferredMfa.Totp && hasTotp) {
			return;
		}
		if (account.preferred_mfa === PreferredMfa.WebAuthn && hasWebAuthn) {
			return;
		}

		// need to set or switch: prefer the type that was just added (TOTP first for backwards compat)
		let newPreferred: PreferredMfa | null = null;
		if (hasTotp) {
			newPreferred = PreferredMfa.Totp;
		} else if (hasWebAuthn) {
			newPreferred = PreferredMfa.WebAuthn;
		}

		if (newPreferred !== account.preferred_mfa) {
			this.#db.update(t.account).set({ preferred_mfa: newPreferred }).where(eq(t.account.did, did)).run();
		}
	}

	// #endregion
}
