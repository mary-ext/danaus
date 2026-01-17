import type { KeyObject } from 'node:crypto';

import { DidNotFoundError, InvalidResolvedHandleError, type HandleResolver } from '@atcute/identity-resolver';
import type { ActorIdentifier, Did, Handle } from '@atcute/lexicons';
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { InvalidRequestError, UpstreamFailureError } from '@atcute/xrpc-server';

import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { and, asc, eq, gt, inArray, isNotNull, isNull, like, lte, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { createLegacySessionTokens, type LegacySessionTokens } from '#app/auth/legacy-tokens.ts';
import { AuthScope } from '#app/auth/scopes.ts';
import { createWebSessionToken } from '#app/auth/web.ts';
import { TimeKeyset } from '#app/utils/keyset.ts';
import { DAY, HOUR } from '#app/utils/times.ts';
import { generateAppPassword, generateInviteCode } from '#app/utils/token.ts';

import { getAccountDb, t, type AccountDb } from './db';
import { AppPasswordPrivilege, EmailTokenPurpose, PreferredMfa, WebAuthnCredentialType } from './db/schema';
import { isServiceDomain, isValidTld } from './handle';
import { hashPassword, verifyPassword } from './passwords';
import { generateBackupCodes, MAX_TOTP_CREDENTIALS, verifyTotpCode } from './totp';
import { AccountStatus, formatAccountStatus } from './types';
import { MAX_WEBAUTHN_CREDENTIALS, WEBAUTHN_CHALLENGE_TTL_MS } from './webauthn';

const WEB_SESSION_TTL_MS = 7 * DAY;
const WEB_SESSION_LONG_TTL_MS = 365 * DAY;
const LEGACY_ACCESS_TTL_MS = 2 * HOUR;
const LEGACY_REFRESH_TTL_MS = 90 * DAY;
const LEGACY_REFRESH_GRACE_TTL_MS = 2 * HOUR;
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUDO_MODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_APP_PASSWORDS = 25;

export type Account = typeof t.account.$inferSelect;
export type AppPassword = typeof t.appPassword.$inferSelect;
export type LegacySession = typeof t.legacySession.$inferSelect;
export type WebSession = typeof t.webSession.$inferSelect;
export type InviteCode = typeof t.inviteCode.$inferSelect;
export type InviteCodeUse = typeof t.inviteCodeUse.$inferSelect;
export type TotpCredential = typeof t.totpCredential.$inferSelect;
export type BackupCode = typeof t.recoveryCode.$inferSelect;
export type VerifyChallenge = typeof t.verifyChallenge.$inferSelect;
export type WebauthnCredential = typeof t.webauthnCredential.$inferSelect;
export type WebauthnChallenge = typeof t.webauthnChallenge.$inferSelect;

/** MFA status for an account */
export interface MfaStatus {
	/** preferred MFA method */
	preferred: PreferredMfa;
	/** has TOTP credentials */
	hasTotp: boolean;
	/** has WebAuthn security keys */
	hasWebAuthn: boolean;
	/** has recovery codes */
	hasRecoveryCodes: boolean;
}

export interface InviteCodeWithUses extends InviteCode {
	uses: InviteCodeUse[];
}

const accountKeyset = new TimeKeyset<Did>(isDid);
const inviteCodeKeyset = new TimeKeyset();

interface AccountManagerOptions {
	location: string;
	walAutocheckpointDisabled: boolean;

	serviceDid: Did;
	serviceHandleDomains: string[];

	handleResolver: HandleResolver;

	jwtKey: KeyObject;
}

export class AccountManager implements Disposable {
	private readonly db: AccountDb;

	private readonly serviceDid: Did;
	private readonly serviceHandleDomains: string[];

	private readonly handleResolver: HandleResolver;

	private readonly jwtKey: KeyObject;

	constructor(options: AccountManagerOptions) {
		this.db = getAccountDb(options.location, options.walAutocheckpointDisabled);

		this.serviceDid = options.serviceDid;
		this.serviceHandleDomains = options.serviceHandleDomains;

		this.handleResolver = options.handleResolver;

		this.jwtKey = options.jwtKey;
	}

	dispose() {
		this.db.$client.close();
	}
	[Symbol.dispose]() {
		this.dispose();
	}

	getAccount(actor: ActorIdentifier, options: AccountAvailabilityOptions = {}): Account | null {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.db
			.select()
			.from(t.account)
			.where((f) => {
				return and(
					isDid(actor) ? eq(f.did, actor) : eq(sql`lower(${f.handle})`, actor.toLowerCase() as Handle),
					!includeDeactivated ? isNull(f.deactivated_at) : undefined,
					!includeTakenDown ? isNull(f.takedown_ref) : undefined,
				);
			})
			.get();

		return found ?? null;
	}

	getAccounts(actors: Did[], options: AccountAvailabilityOptions = {}): Map<Did, Account> {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.db
			.select()
			.from(t.account)
			.where((f) => {
				return and(
					inArray(f.did, actors),
					!includeDeactivated ? isNull(f.deactivated_at) : undefined,
					!includeTakenDown ? isNull(f.takedown_ref) : undefined,
				);
			})
			.all();

		const map = new Map(found.map((acc) => [acc.did, acc]));

		return map;
	}

	/**
	 * list accounts with pagination.
	 * @param options list options
	 * @returns account list and cursor
	 */
	listAccounts(options: ListAccountsOptions = {}): { accounts: Account[]; cursor?: string } {
		const { limit = 500, cursor, query, includeDeactivated = false, includeTakenDown = false } = options;
		const parsed = accountKeyset.unpackOptional(cursor);

		// prepare search pattern for ilike matching
		const normalizedQuery = query?.trim().toLowerCase();
		const searchPattern = normalizedQuery ? `%${normalizedQuery}%` : null;

		const rows = this.db
			.select()
			.from(t.account)
			.where((f) => {
				return and(
					!includeDeactivated ? isNull(f.deactivated_at) : undefined,
					!includeTakenDown ? isNull(f.takedown_ref) : undefined,
					searchPattern
						? or(like(sql`lower(${f.handle})`, searchPattern), like(sql`lower(${f.email})`, searchPattern))
						: undefined,
					parsed
						? or(gt(f.created_at, parsed.time), and(eq(f.created_at, parsed.time), gt(f.did, parsed.key)))
						: undefined,
				);
			})
			.orderBy(asc(t.account.created_at), asc(t.account.did))
			.limit(limit + 1)
			.all();

		const hasMore = rows.length > limit;
		const accounts = hasMore ? rows.slice(0, limit) : rows;
		const last = accounts.at(-1);
		const nextCursor = hasMore && last ? accountKeyset.pack(last.created_at, last.did) : undefined;

		return { accounts, cursor: nextCursor };
	}

	/**
	 * get account statistics for admin dashboards.
	 * @returns account stats
	 */
	getAccountStats(): {
		total: number;
		active: number;
		deactivated: number;
		takendown: number;
		deleteScheduled: number;
	} {
		const total =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.get()?.count ?? 0;
		const active =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(and(isNull(t.account.takedown_ref), isNull(t.account.deactivated_at)))
				.get()?.count ?? 0;
		const deactivated =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(isNotNull(t.account.deactivated_at))
				.get()?.count ?? 0;
		const takendown =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(isNotNull(t.account.takedown_ref))
				.get()?.count ?? 0;
		const deleteScheduled =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(isNotNull(t.account.delete_at))
				.get()?.count ?? 0;

		return {
			total: total,
			active: active,
			deactivated: deactivated,
			takendown: takendown,
			deleteScheduled: deleteScheduled,
		};
	}

	getAccountByEmail(email: string, options: AccountAvailabilityOptions = {}): Account | null {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.db
			.select()
			.from(t.account)
			.where((f) => {
				return and(
					eq(sql`lower(${f.email})`, email.toLowerCase()),
					!includeDeactivated ? isNull(f.deactivated_at) : undefined,
					!includeTakenDown ? isNull(f.takedown_ref) : undefined,
				);
			})
			.get();

		return found ?? null;
	}

	getWebSession(sessionId: string): WebSession | null {
		const session = this.db.select().from(t.webSession).where(eq(t.webSession.id, sessionId)).get();
		if (!session) {
			return null;
		}

		const now = new Date();
		if (session.expires_at <= now) {
			this.db.delete(t.webSession).where(eq(t.webSession.id, sessionId)).run();
			return null;
		}

		return session;
	}

	isAccountActivated(did: Did): boolean {
		const account = this.getAccount(did, { includeDeactivated: true });
		if (account === null) {
			return false;
		}

		return account.deactivated_at !== null;
	}

	getAccountDid(actor: ActorIdentifier, options?: AccountAvailabilityOptions): Did | null {
		const account = this.getAccount(actor, options);
		if (account === null) {
			return null;
		}

		return account.did;
	}

	getAccountStatus(actor: ActorIdentifier): AccountStatus {
		const account = this.getAccount(actor, {
			includeDeactivated: true,
			includeTakenDown: true,
		});

		const result = formatAccountStatus(account);

		return result.active ? AccountStatus.Active : result.status;
	}

	/**
	 * get admin status attributes for an account.
	 * @param did account did
	 * @returns admin status or null
	 */
	getAccountAdminStatus(did: Did): {
		takedown: { applied: boolean; ref?: string };
		deactivated: { applied: boolean; ref?: string };
	} | null {
		const account = this.getAccount(did, { includeDeactivated: true, includeTakenDown: true });
		if (!account) {
			return null;
		}

		return {
			takedown: {
				applied: account.takedown_ref !== null,
				ref: account.takedown_ref ?? undefined,
			},
			deactivated: {
				applied: account.deactivated_at !== null,
			},
		};
	}

	async validateHandle(handle: Handle, options: ValidateHandleOptions = {}) {
		const { did } = options;

		// Normalize to lowercase
		handle = handle.toLowerCase() as Handle;

		if (!isValidTld(handle)) {
			throw new InvalidRequestError({
				error: 'InvalidHandle',
				description: `invalid or disallowed TLD in handle`,
			});
		}

		if (isServiceDomain(handle, this.serviceHandleDomains)) {
			const suffix = this.serviceHandleDomains.find((s) => handle.endsWith(s))!;
			const front = handle.slice(0, handle.length - suffix.length);

			if (front.includes('.')) {
				throw new InvalidRequestError({
					error: 'InvalidHandle',
					description: `invalid characters in handle`,
				});
			}

			// these length checks are unnecessary since it would've been handled by
			// isHandle() already but it's fine.
			if (front.length < 1) {
				throw new InvalidRequestError({
					error: 'InvalidHandle',
					description: `handle too short`,
				});
			}

			if (front.length > 63) {
				throw new InvalidRequestError({
					error: 'InvalidHandle',
					description: `handle too long`,
				});
			}
		} else {
			if (did == null) {
				throw new InvalidRequestError({
					error: 'UnsupportedDomain',
					description: `unsupported handle domain`,
				});
			}

			let resolvedDid: Did | undefined;
			jmp: try {
				resolvedDid = await this.handleResolver.resolve(handle, { noCache: true });
			} catch (err) {
				if (err instanceof DidNotFoundError) {
					break jmp;
				}

				if (err instanceof InvalidResolvedHandleError) {
					throw new UpstreamFailureError({
						description: `handle resolved to an invalid DID format`,
					});
				}

				throw new UpstreamFailureError({
					description: `handle could not be resolved`,
				});
			}

			if (resolvedDid !== undefined && resolvedDid !== did) {
				throw new InvalidRequestError({
					error: 'InvalidHandle',
					description: `handle does not resolve to account DID`,
				});
			}
		}

		return handle;
	}

	/**
	 * verify a main account password.
	 * @param identifier handle, did, or email
	 * @param password account password
	 * @returns account or null
	 */
	async verifyAccountPassword(identifier: string, password: string): Promise<Account | null> {
		const account = this.resolveIdentifier(identifier, {
			includeDeactivated: true,
			includeTakenDown: true,
		});
		if (!account) {
			return null;
		}

		const valid = await verifyPassword(password, account.password_hash);
		if (!valid) {
			return null;
		}

		return account;
	}

	/**
	 * verify identifier/password for legacy auth (app password only).
	 * @param identifier handle, did, or email
	 * @param password app password
	 * @returns legacy auth result or null
	 */
	async verifyLegacyCredentials(
		identifier: string,
		password: string,
	): Promise<{ account: Account; appPassword: AppPassword } | null> {
		const account = this.resolveIdentifier(identifier, {
			includeDeactivated: true,
			includeTakenDown: true,
		});
		if (!account) {
			return null;
		}

		const appPassword = await this.findAppPasswordMatch(account.did, password);
		if (!appPassword) {
			return null;
		}

		return { account, appPassword };
	}

	/**
	 * create a new account record.
	 * @param options account creation options
	 * @returns created account
	 */
	async createAccount(options: CreateAccountOptions): Promise<Account> {
		const handle = options.handle.toLowerCase() as Handle;
		const email = options.email.toLowerCase();

		const passwordHash = await hashPassword(options.password);

		const inserted = this.db
			.insert(t.account)
			.values({
				did: options.did,
				handle: handle,
				created_at: new Date(),
				password_hash: passwordHash,
				email: email,
			})
			.returning()
			.get();

		return inserted;
	}

	/**
	 * update account email address.
	 * @param options update options
	 */
	updateAccountEmail(options: { did: Did; email: string }): void {
		const email = options.email.toLowerCase();
		const existing = this.getAccountByEmail(email, {
			includeDeactivated: true,
			includeTakenDown: true,
		});

		if (existing && existing.did !== options.did) {
			throw new InvalidRequestError({
				error: 'EmailTaken',
				description: `email already taken by another account`,
			});
		}

		this.db.transaction((tx) => {
			tx.update(t.account)
				.set({ email: email, email_confirmed_at: null })
				.where(eq(t.account.did, options.did))
				.run();
			tx.delete(t.emailToken)
				.where(
					and(
						eq(t.emailToken.did, options.did),
						inArray(t.emailToken.purpose, [EmailTokenPurpose.EmailVerify, EmailTokenPurpose.EmailUpdate]),
					),
				)
				.run();
			return true;
		});
	}

	/**
	 * update account handle.
	 * @param did account did
	 * @param handle new handle
	 */
	updateAccountHandle(did: Did, handle: Handle): void {
		this.db
			.update(t.account)
			.set({ handle: handle.toLowerCase() as Handle })
			.where(eq(t.account.did, did))
			.run();
	}

	/**
	 * update account password and revoke sessions.
	 * @param options update options
	 */
	async updateAccountPassword(options: { did: Did; password: string }): Promise<void> {
		const passwordHash = await hashPassword(options.password);

		this.db.transaction((tx) => {
			tx.update(t.account).set({ password_hash: passwordHash }).where(eq(t.account.did, options.did)).run();
			tx.delete(t.legacySession).where(eq(t.legacySession.did, options.did)).run();
			tx.delete(t.webSession).where(eq(t.webSession.did, options.did)).run();
			tx.delete(t.emailToken)
				.where(
					and(eq(t.emailToken.did, options.did), eq(t.emailToken.purpose, EmailTokenPurpose.PasswordReset)),
				)
				.run();
			return true;
		});
	}

	/**
	 * update takedown status for an account.
	 * @param did account did
	 * @param takedown takedown status
	 */
	updateAccountTakedownStatus(did: Did, takedown: { applied: boolean; ref?: string }): void {
		const ref = takedown.applied ? (takedown.ref ?? 'admin') : null;

		this.db.update(t.account).set({ takedown_ref: ref }).where(eq(t.account.did, did)).run();

		if (takedown.applied) {
			this.db.delete(t.legacySession).where(eq(t.legacySession.did, did)).run();
			this.db.delete(t.webSession).where(eq(t.webSession.did, did)).run();
		}
	}

	/**
	 * update deactivated status for an account.
	 * @param did account did
	 * @param deactivated deactivated status
	 */
	updateAccountDeactivatedStatus(did: Did, deactivated: { applied: boolean }): void {
		this.db
			.update(t.account)
			.set({ deactivated_at: deactivated.applied ? new Date() : null })
			.where(eq(t.account.did, did))
			.run();
	}

	/**
	 * create a web session record.
	 * @param options web session options
	 * @returns session and signed token
	 */
	async createWebSession(options: CreateWebSessionOptions): Promise<{ session: WebSession; token: string }> {
		const now = new Date();
		const expiresAt = new Date(
			now.getTime() + (options.remember ? WEB_SESSION_LONG_TTL_MS : WEB_SESSION_TTL_MS),
		);
		const id = nanoid(44);

		const inserted = this.db
			.insert(t.webSession)
			.values({
				id: id,
				did: options.did,
				metadata: {
					userAgent: options.userAgent,
					ip: options.ip,
				},
				created_at: now,
				expires_at: expiresAt,
			})
			.returning()
			.get();

		if (!inserted) {
			throw new Error(`failed to create web session`);
		}

		const token = createWebSessionToken(this.jwtKey, id);

		return { session: inserted, token: token };
	}

	/**
	 * delete a web session.
	 * @param sessionId session id
	 */
	deleteWebSession(sessionId: string): void {
		this.db.delete(t.webSession).where(eq(t.webSession.id, sessionId)).run();
	}

	/**
	 * create a legacy refresh session and jwt pair.
	 * @param options legacy session options
	 * @returns legacy session jwt pair
	 */
	async createLegacySession(options: CreateLegacySessionOptions): Promise<LegacySessionTokens> {
		const now = options.now ?? new Date();
		const expiresAt = new Date(now.getTime() + LEGACY_REFRESH_TTL_MS);
		const sessionId = options.sessionId ?? nanoid(24);

		const inserted = this.db
			.insert(t.legacySession)
			.values({
				id: sessionId,
				did: options.did,
				appPasswordId: options.appPassword.id,
				created_at: now,
				expires_at: expiresAt,
				next_id: null,
			})
			.returning()
			.get();

		if (!inserted) {
			throw new Error(`failed to create legacy session`);
		}

		return await this.issueLegacyTokens({
			did: options.did,
			privilege: options.appPassword.privilege,
			sessionId: sessionId,
			now: now,
		});
	}

	/**
	 * fetch a legacy session by id.
	 * @param sessionId legacy session id
	 * @returns legacy session or null
	 */
	getLegacySession(sessionId: string): LegacySession | null {
		const session = this.db.select().from(t.legacySession).where(eq(t.legacySession.id, sessionId)).get();
		if (!session) {
			return null;
		}

		const now = new Date();
		if (session.expires_at <= now) {
			this.db.delete(t.legacySession).where(eq(t.legacySession.id, sessionId)).run();
			return null;
		}

		return session;
	}

	/**
	 * delete a legacy session by id.
	 * @param sessionId legacy session id
	 */
	deleteLegacySession(sessionId: string): void {
		this.db.delete(t.legacySession).where(eq(t.legacySession.id, sessionId)).run();
	}

	/**
	 * rotate a legacy refresh token and return new tokens.
	 * @param sessionId legacy session id
	 * @returns session jwt pair
	 */
	async rotateLegacyRefresh(sessionId: string): Promise<LegacySessionTokens> {
		const row = this.db
			.select({
				sessionId: t.legacySession.id,
				did: t.legacySession.did,
				expiresAt: t.legacySession.expires_at,
				appPasswordId: t.legacySession.appPasswordId,
				nextId: t.legacySession.next_id,
				privilege: t.appPassword.privilege,
			})
			.from(t.legacySession)
			.innerJoin(t.appPassword, eq(t.legacySession.appPasswordId, t.appPassword.id))
			.where(eq(t.legacySession.id, sessionId))
			.get();

		if (row === undefined) {
			throw new InvalidRequestError({
				error: 'InvalidToken',
				description: `refresh token is invalid`,
			});
		}

		const now = new Date();

		// tidy up all of the user's expired sessions
		this.db
			.delete(t.legacySession)
			.where(and(eq(t.legacySession.did, row.did), lte(t.legacySession.expires_at, now)))
			.run();

		if (row.expiresAt <= now) {
			throw new InvalidRequestError({
				error: 'ExpiredToken',
				description: `refresh token has expired`,
			});
		}

		const graceExpiresAt = new Date(now.getTime() + LEGACY_REFRESH_GRACE_TTL_MS);
		const shortenedExpiresAt = graceExpiresAt < row.expiresAt ? graceExpiresAt : row.expiresAt;

		const nextId = row.nextId ?? nanoid(24);

		const success = this.db.transaction((tx) => {
			const updateResult = tx
				.update(t.legacySession)
				.set({ next_id: nextId, expires_at: shortenedExpiresAt })
				.where(
					and(
						eq(t.legacySession.id, sessionId),
						or(isNull(t.legacySession.next_id), eq(t.legacySession.next_id, nextId)),
					),
				)
				.returning({ id: t.legacySession.id })
				.get();

			if (!updateResult) {
				return false;
			}

			const nextExpiresAt = new Date(now.getTime() + LEGACY_REFRESH_TTL_MS);
			tx.insert(t.legacySession)
				.values({
					id: nextId,
					did: row.did,
					appPasswordId: row.appPasswordId,
					created_at: now,
					expires_at: nextExpiresAt,
					next_id: null,
				})
				.onConflictDoNothing({ target: t.legacySession.id })
				.run();

			return true;
		});

		if (!success) {
			return await this.rotateLegacyRefresh(sessionId);
		}

		return await this.issueLegacyTokens({
			did: row.did,
			privilege: row.privilege,
			sessionId: nextId,
			now: now,
		});
	}

	/**
	 * create a new app password for an account.
	 * @param options app password options
	 * @returns app password details and secret
	 */
	async createAppPassword(
		options: CreateAppPasswordOptions,
	): Promise<{ appPassword: AppPassword; secret: string }> {
		const existing = this.db.select().from(t.appPassword).where(eq(t.appPassword.did, options.did)).all();

		if (existing.length >= MAX_APP_PASSWORDS) {
			throw new InvalidRequestError({
				error: 'TooManyAppPasswords',
				description: `cannot have more than ${MAX_APP_PASSWORDS} app passwords`,
			});
		}

		if (existing.some((row) => row.name === options.name)) {
			throw new InvalidRequestError({
				error: 'DuplicateAppPassword',
				description: `app password already exists`,
			});
		}

		const secret = generateAppPassword();
		const passwordHash = await hashPassword(secret);
		const now = new Date();

		const inserted = this.db
			.insert(t.appPassword)
			.values({
				did: options.did,
				name: options.name,
				privilege: options.privilege,
				password_hash: passwordHash,
				created_at: now,
			})
			.returning()
			.get();

		if (!inserted) {
			throw new Error(`failed to create app password`);
		}

		return { appPassword: inserted, secret: secret };
	}

	/**
	 * list app passwords for an account.
	 * @param did account did
	 * @returns app passwords
	 */
	listAppPasswords(did: Did): AppPassword[] {
		const rows = this.db.select().from(t.appPassword).where(eq(t.appPassword.did, did)).all();

		return rows;
	}

	/**
	 * delete an app password by name.
	 * @param did account did
	 * @param name app password name
	 */
	deleteAppPassword(did: Did, name: string): void {
		this.db
			.delete(t.appPassword)
			.where(and(eq(t.appPassword.did, did), eq(t.appPassword.name, name)))
			.run();
	}

	// #region invite codes

	/**
	 * create invite codes.
	 * @param count number of codes to create
	 * @param availableUses uses per code (0 for unlimited)
	 * @returns created invite codes
	 */
	createInviteCodes(count: number, availableUses: number): InviteCode[] {
		const now = new Date();
		const codes: InviteCode[] = [];

		for (let i = 0; i < count; i++) {
			const code = generateInviteCode();
			const inserted = this.db
				.insert(t.inviteCode)
				.values({
					code: code,
					available_uses: availableUses === 0 ? -1 : availableUses,
					disabled: false,
					created_at: now,
				})
				.returning()
				.get();

			if (inserted) {
				codes.push(inserted);
			}
		}

		return codes;
	}

	/**
	 * check if an invite code is available for use.
	 * @param code invite code
	 * @throws InvalidRequestError if code is not available
	 */
	ensureInviteIsAvailable(code: string): void {
		const invite = this.db.select().from(t.inviteCode).where(eq(t.inviteCode.code, code)).get();

		if (!invite || invite.disabled) {
			throw new InvalidRequestError({
				error: 'InvalidInviteCode',
				description: 'provided invite code not available',
			});
		}

		// -1 means unlimited uses
		if (invite.available_uses !== -1) {
			const uses =
				this.db
					.select({ count: sql<number>`count(*)` })
					.from(t.inviteCodeUse)
					.where(eq(t.inviteCodeUse.code, code))
					.get()?.count ?? 0;

			if (uses >= invite.available_uses) {
				throw new InvalidRequestError({
					error: 'InvalidInviteCode',
					description: 'provided invite code not available',
				});
			}
		}
	}

	/**
	 * record an invite code use.
	 * @param code invite code
	 * @param usedBy DID of the account that used the code
	 */
	recordInviteUse(code: string, usedBy: Did): void {
		this.db
			.insert(t.inviteCodeUse)
			.values({
				code: code,
				used_by: usedBy,
				used_at: new Date(),
			})
			.run();
	}

	/**
	 * get invite code details with usage.
	 * @param code invite code
	 * @returns invite code with uses or null
	 */
	getInviteCode(code: string): InviteCodeWithUses | null {
		const invite = this.db.select().from(t.inviteCode).where(eq(t.inviteCode.code, code)).get();

		if (!invite) {
			return null;
		}

		const uses = this.db.select().from(t.inviteCodeUse).where(eq(t.inviteCodeUse.code, code)).all();

		return { ...invite, uses };
	}

	/**
	 * list invite codes with pagination.
	 * @param options list options
	 * @returns invite codes and cursor
	 */
	listInviteCodes(options: ListInviteCodesOptions = {}): {
		codes: InviteCodeWithUses[];
		cursor?: string;
	} {
		const { limit = 50, cursor, includeDisabled = false, includeUsed = true } = options;
		const parsed = inviteCodeKeyset.unpackOptional(cursor);

		// paginate codes first in a CTE, then LEFT JOIN with uses
		const paginatedCodes = this.db.$with('paginated_codes').as(
			this.db
				.select()
				.from(t.inviteCode)
				.where((f) => {
					return and(
						!includeDisabled ? eq(f.disabled, false) : undefined,
						parsed
							? or(gt(f.created_at, parsed.time), and(eq(f.created_at, parsed.time), gt(f.code, parsed.key)))
							: undefined,
					);
				})
				.orderBy(asc(t.inviteCode.created_at), asc(t.inviteCode.code))
				.limit(limit),
		);

		const rows = this.db
			.with(paginatedCodes)
			.select({
				code: paginatedCodes.code,
				available_uses: paginatedCodes.available_uses,
				disabled: paginatedCodes.disabled,
				created_at: paginatedCodes.created_at,
				use: t.inviteCodeUse,
			})
			.from(paginatedCodes)
			.leftJoin(t.inviteCodeUse, eq(paginatedCodes.code, t.inviteCodeUse.code))
			.orderBy(asc(paginatedCodes.created_at), asc(paginatedCodes.code))
			.all();

		// group rows by invite code
		const codesMap = new Map<string, InviteCodeWithUses>();
		for (const row of rows) {
			let entry = codesMap.get(row.code);
			if (!entry) {
				entry = {
					code: row.code,
					available_uses: row.available_uses,
					disabled: row.disabled,
					created_at: row.created_at,
					uses: [],
				};
				codesMap.set(row.code, entry);
			}
			if (row.use) {
				entry.uses.push(row.use);
			}
		}

		const codes = [...codesMap.values()];

		// filter out fully used codes if requested
		const filtered = includeUsed
			? codes
			: codes.filter((c) => c.available_uses === -1 || c.uses.length < c.available_uses);

		const last = filtered.at(-1);
		const nextCursor = last ? inviteCodeKeyset.pack(last.created_at, last.code) : undefined;

		return { codes: filtered, cursor: nextCursor };
	}

	/**
	 * disable invite codes.
	 * @param codes list of invite codes to disable
	 */
	disableInviteCodes(codes: string[]): void {
		if (codes.length === 0) {
			return;
		}

		this.db.update(t.inviteCode).set({ disabled: true }).where(inArray(t.inviteCode.code, codes)).run();
	}

	/**
	 * get invite code statistics.
	 * @returns invite code stats
	 */
	getInviteCodeStats(): {
		total: number;
		available: number;
		disabled: number;
		used: number;
	} {
		const total =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.inviteCode)
				.get()?.count ?? 0;

		const disabled =
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.inviteCode)
				.where(eq(t.inviteCode.disabled, true))
				.get()?.count ?? 0;

		const used =
			this.db
				.select({ count: sql<number>`count(distinct ${t.inviteCodeUse.code})` })
				.from(t.inviteCodeUse)
				.get()?.count ?? 0;

		return {
			total: total,
			available: total - disabled,
			disabled: disabled,
			used: used,
		};
	}

	// #endregion

	// #region TOTP two-factor authentication

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
		const existing = this.db
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

		const inserted = this.db
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
		return this.db.select().from(t.totpCredential).where(eq(t.totpCredential.did, did)).all();
	}

	/**
	 * get a TOTP credential by id.
	 * @param did account did
	 * @param id credential id
	 * @returns TOTP credential or null
	 */
	getTotpCredential(did: Did, id: number): TotpCredential | null {
		const credential = this.db
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
		this.db
			.delete(t.totpCredential)
			.where(and(eq(t.totpCredential.did, did), eq(t.totpCredential.id, id)))
			.run();

		this.#syncPreferredMfa(did);
	}

	/**
	 * sync preferred_mfa to reflect current MFA credentials.
	 * - if null and credentials exist → set to first available type
	 * - if set but that type has no credentials → switch to another type or clear
	 */
	#syncPreferredMfa(did: Did): void {
		const account = this.db
			.select({ preferred_mfa: t.account.preferred_mfa })
			.from(t.account)
			.where(eq(t.account.did, did))
			.get();

		if (!account) {
			return;
		}

		const hasTotp = this.#countTotpCredentials(did) > 0;
		const hasWebAuthn = this.countWebAuthnCredentials(did) > 0;

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
			this.db.update(t.account).set({ preferred_mfa: newPreferred }).where(eq(t.account.did, did)).run();
		}
	}

	/**
	 * get MFA status for an account.
	 * @param did account did
	 * @returns MFA status with preferred method and available methods, or null if no MFA configured
	 */
	getMfaStatus(did: Did): MfaStatus | null {
		const account = this.db
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
			hasWebAuthn: this.countWebAuthnCredentials(did) > 0,
			hasRecoveryCodes: this.getRecoveryCodeCount(did) > 0,
		};
	}

	/**
	 * count TOTP credentials for an account.
	 * @param did account did
	 * @returns number of credentials
	 */
	#countTotpCredentials(did: Did): number {
		return (
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.totpCredential)
				.where(eq(t.totpCredential.did, did))
				.get()?.count ?? 0
		);
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
				this.db
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

	// #endregion

	// #region backup codes

	/**
	 * generate and store recovery codes for an account.
	 * deletes any existing codes first.
	 * @param did account did
	 */
	generateRecoveryCodes(did: Did): void {
		const codes = generateBackupCodes();
		const now = new Date();

		this.db.transaction((tx) => {
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
		return this.db
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
			this.db
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
		const result = this.db
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
		this.db.delete(t.recoveryCode).where(eq(t.recoveryCode.did, did)).run();
	}

	// #endregion

	// #region verification challenges

	/**
	 * create a verification challenge for MFA login (no session, creates one on success).
	 * @param did account did
	 * @param remember whether to create a long-lived session on success
	 * @returns token for the verify page
	 */
	createVerifyChallenge(did: Did, remember: boolean): string {
		const token = nanoid(32);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

		this.db
			.insert(t.verifyChallenge)
			.values({
				token: token,
				did: did,
				session_id: null,
				remember: remember,
				created_at: now,
				expires_at: expiresAt,
			})
			.run();

		return token;
	}

	/**
	 * create or get an existing sudo challenge for session elevation.
	 * @param sessionId the session to elevate
	 * @param did account did
	 * @returns the verify challenge row
	 */
	getOrCreateSudoChallenge(sessionId: string, did: Did): VerifyChallenge {
		// check for existing sudo challenge for this session
		const existing = this.db
			.select()
			.from(t.verifyChallenge)
			.where(eq(t.verifyChallenge.session_id, sessionId))
			.get();

		const now = new Date();

		if (existing && existing.expires_at > now) {
			return existing;
		}

		// delete expired challenge if it exists
		if (existing) {
			this.db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, existing.token)).run();
		}

		const token = nanoid(32);
		const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

		const inserted = this.db
			.insert(t.verifyChallenge)
			.values({
				token: token,
				did: did,
				session_id: sessionId,
				created_at: now,
				expires_at: expiresAt,
			})
			.returning()
			.get();

		return inserted;
	}

	/**
	 * get a verification challenge by token.
	 * @param token the token
	 * @returns verify challenge or null if expired/not found
	 */
	getVerifyChallenge(token: string): VerifyChallenge | null {
		const challenge = this.db
			.select()
			.from(t.verifyChallenge)
			.where(eq(t.verifyChallenge.token, token))
			.get();

		if (!challenge) {
			return null;
		}

		const now = new Date();
		if (challenge.expires_at <= now) {
			this.db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, token)).run();
			return null;
		}

		return challenge;
	}

	/**
	 * delete a verification challenge.
	 * @param token the token
	 */
	deleteVerifyChallenge(token: string): void {
		this.db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, token)).run();
	}

	/**
	 * clean up expired verification challenges.
	 */
	cleanupExpiredVerifyChallenges(): void {
		const now = new Date();
		this.db.delete(t.verifyChallenge).where(lte(t.verifyChallenge.expires_at, now)).run();
	}

	/**
	 * set the WebAuthn challenge on an existing verification challenge.
	 * @param token verify challenge token
	 * @param webauthnChallenge base64url WebAuthn challenge
	 */
	setVerifyChallengeWebAuthn(token: string, webauthnChallenge: string): void {
		this.db
			.update(t.verifyChallenge)
			.set({ webauthn_challenge: webauthnChallenge })
			.where(eq(t.verifyChallenge.token, token))
			.run();
	}

	// #endregion

	// #region sudo mode

	/**
	 * elevate a session to sudo mode.
	 * @param sessionId the session id
	 */
	elevateSession(sessionId: string): void {
		this.db.update(t.webSession).set({ sudo_at: new Date() }).where(eq(t.webSession.id, sessionId)).run();
	}

	/**
	 * check if a session is in sudo mode.
	 * @param session the session
	 * @returns true if session is elevated
	 */
	isSessionElevated(session: WebSession): boolean {
		if (session.sudo_at === null) {
			return false;
		}
		const now = Date.now();
		const elevatedAt = session.sudo_at.getTime();
		return now - elevatedAt < SUDO_MODE_TTL_MS;
	}

	// #endregion

	// #region WebAuthn credentials

	/**
	 * create a WebAuthn credential for an account.
	 * @param options credential options
	 * @returns created credential
	 */
	createWebAuthnCredential(options: CreateWebAuthnCredentialOptions): WebauthnCredential {
		const count = this.countWebAuthnCredentials(options.did);
		if (count >= MAX_WEBAUTHN_CREDENTIALS) {
			throw new InvalidRequestError({
				error: 'TooManyWebAuthnCredentials',
				description: `cannot have more than ${MAX_WEBAUTHN_CREDENTIALS} security keys`,
			});
		}

		const name = options.name?.trim() || this.generateWebAuthnName(options.did, options.type);

		// check for duplicate name
		const existing = this.db
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
		const existingCredId = this.db
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

		const inserted = this.db
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
		return this.db.select().from(t.webauthnCredential).where(eq(t.webauthnCredential.did, did)).all();
	}

	/**
	 * list WebAuthn credentials for an account filtered by type.
	 * @param did account did
	 * @param type credential type
	 * @returns WebAuthn credentials of the specified type
	 */
	listWebAuthnCredentialsByType(did: Did, type: WebAuthnCredentialType): WebauthnCredential[] {
		return this.db
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
		const credential = this.db
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
		const credential = this.db
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
		this.db
			.delete(t.webauthnCredential)
			.where(and(eq(t.webauthnCredential.did, did), eq(t.webauthnCredential.id, id)))
			.run();

		this.#syncPreferredMfa(did);
	}

	/**
	 * count WebAuthn credentials for an account.
	 * @param did account did
	 * @returns number of credentials
	 */
	countWebAuthnCredentials(did: Did): number {
		return (
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(t.webauthnCredential)
				.where(eq(t.webauthnCredential.did, did))
				.get()?.count ?? 0
		);
	}

	/**
	 * update the counter for a WebAuthn credential.
	 * @param id credential id
	 * @param counter new counter value
	 */
	updateWebAuthnCredentialCounter(id: number, counter: number): void {
		this.db.update(t.webauthnCredential).set({ counter }).where(eq(t.webauthnCredential.id, id)).run();
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

	// #endregion

	// #region WebAuthn registration challenges

	/**
	 * create a WebAuthn registration challenge.
	 * @param did account did
	 * @param challenge base64url challenge
	 * @returns token for retrieving the challenge
	 */
	createWebAuthnChallenge(did: Did, challenge: string): string {
		const token = nanoid(32);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS);

		this.db
			.insert(t.webauthnChallenge)
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
	getWebAuthnChallenge(token: string): WebauthnChallenge | null {
		const challenge = this.db
			.select()
			.from(t.webauthnChallenge)
			.where(eq(t.webauthnChallenge.token, token))
			.get();

		if (!challenge) {
			return null;
		}

		const now = new Date();
		if (challenge.expires_at <= now) {
			this.db.delete(t.webauthnChallenge).where(eq(t.webauthnChallenge.token, token)).run();
			return null;
		}

		return challenge;
	}

	/**
	 * delete a WebAuthn registration challenge.
	 * @param token the token
	 */
	deleteWebAuthnChallenge(token: string): void {
		this.db.delete(t.webauthnChallenge).where(eq(t.webauthnChallenge.token, token)).run();
	}

	/**
	 * clean up expired WebAuthn registration challenges.
	 */
	cleanupExpiredWebAuthnChallenges(): void {
		const now = new Date();
		this.db.delete(t.webauthnChallenge).where(lte(t.webauthnChallenge.expires_at, now)).run();
	}

	// #endregion

	async importAccount(_options: ImportAccountOptions) {}

	private resolveIdentifier(identifier: string, options: AccountAvailabilityOptions): Account | null {
		if (isDid(identifier) || isHandle(identifier)) {
			return this.getAccount(identifier as ActorIdentifier, options);
		}

		return this.getAccountByEmail(identifier, options);
	}

	private async findAppPasswordMatch(did: Did, password: string): Promise<AppPassword | null> {
		const rows = this.db.select().from(t.appPassword).where(eq(t.appPassword.did, did)).all();

		for (const row of rows) {
			const valid = await verifyPassword(password, row.password_hash);
			if (valid) {
				return row;
			}
		}

		return null;
	}

	private scopeForPrivilege(privilege: AppPasswordPrivilege): AuthScope {
		switch (privilege) {
			case AppPasswordPrivilege.Full:
				return AuthScope.Access;
			case AppPasswordPrivilege.Privileged:
				return AuthScope.AppPassPrivileged;
			case AppPasswordPrivilege.Limited:
				return AuthScope.AppPass;
		}

		throw new InvalidRequestError({
			error: 'InvalidAppPasswordPrivilege',
			description: `invalid app password privilege`,
		});
	}

	private async issueLegacyTokens(options: {
		did: Did;
		privilege: AppPasswordPrivilege;
		sessionId: string;
		now: Date;
	}): Promise<LegacySessionTokens> {
		return await createLegacySessionTokens(
			{
				did: options.did,
				scope: this.scopeForPrivilege(options.privilege),
				serviceDid: this.serviceDid,
				jwtKey: this.jwtKey,
				issuedAt: options.now.getTime(),
				expiresInMs: LEGACY_ACCESS_TTL_MS,
			},
			{
				did: options.did,
				serviceDid: this.serviceDid,
				jwtKey: this.jwtKey,
				sessionId: options.sessionId,
				issuedAt: options.now.getTime(),
				expiresInMs: LEGACY_REFRESH_TTL_MS,
			},
		);
	}
}

interface AccountAvailabilityOptions {
	includeTakenDown?: boolean;
	includeDeactivated?: boolean;
}

interface ListAccountsOptions extends AccountAvailabilityOptions {
	limit?: number;
	cursor?: string;
	query?: string;
}

interface ValidateHandleOptions {
	did?: Did;
}

interface CreateAccountOptions {
	did: Did;
	handle: Handle;
	email: string;
	password: string;
}

interface CreateWebSessionOptions {
	did: Did;
	remember: boolean;
	userAgent: string | undefined;
	ip: string | undefined;
}

interface CreateLegacySessionOptions {
	did: Did;
	appPassword: AppPassword;
	sessionId?: string;
	now?: Date;
}

interface CreateAppPasswordOptions {
	did: Did;
	name: string;
	privilege: AppPasswordPrivilege;
}

interface ImportAccountOptions {}

interface ListInviteCodesOptions {
	limit?: number;
	cursor?: string;
	includeDisabled?: boolean;
	includeUsed?: boolean;
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
