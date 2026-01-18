import type { KeyObject } from 'node:crypto';

import type { Did } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { createLegacySessionTokens, type LegacySessionTokens } from '#app/auth/legacy-tokens.ts';
import { AuthScope } from '#app/auth/scopes.ts';
import { DAY, HOUR } from '#app/utils/times.ts';
import { generateAppPassword } from '#app/utils/token.ts';

import { t, type AccountDb } from './db';
import { AppPasswordPrivilege } from './db/schema';
import type { Account, AccountManager } from './manager';
import { hashPassword, verifyPassword } from './passwords';

const LEGACY_ACCESS_TTL_MS = 2 * HOUR;
const LEGACY_REFRESH_TTL_MS = 90 * DAY;
const LEGACY_REFRESH_GRACE_TTL_MS = 2 * HOUR;

export const MAX_APP_PASSWORDS = 25;

export type AppPassword = typeof t.appPassword.$inferSelect;
export type LegacySession = typeof t.legacySession.$inferSelect;

interface LegacyAuthManagerOptions {
	db: AccountDb;
	jwtKey: KeyObject;
	serviceDid: Did;
	accountManager: AccountManager;
}

interface CreateAppPasswordOptions {
	did: Did;
	name: string;
	privilege: AppPasswordPrivilege;
}

interface CreateLegacySessionOptions {
	did: Did;
	appPassword: AppPassword;
	sessionId?: string;
	now?: Date;
}

export class LegacyAuthManager {
	readonly #db: AccountDb;
	readonly #jwtKey: KeyObject;
	readonly #serviceDid: Did;
	readonly #accountManager: AccountManager;

	constructor(options: LegacyAuthManagerOptions) {
		this.#db = options.db;
		this.#jwtKey = options.jwtKey;
		this.#serviceDid = options.serviceDid;
		this.#accountManager = options.accountManager;
	}

	// #region app passwords

	/**
	 * create a new app password for an account.
	 * @param options app password options
	 * @returns app password details and secret
	 */
	async createAppPassword(
		options: CreateAppPasswordOptions,
	): Promise<{ appPassword: AppPassword; secret: string }> {
		const existing = this.#db.select().from(t.appPassword).where(eq(t.appPassword.did, options.did)).all();

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

		const inserted = this.#db
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
		const rows = this.#db.select().from(t.appPassword).where(eq(t.appPassword.did, did)).all();

		return rows;
	}

	/**
	 * delete an app password by name.
	 * @param did account did
	 * @param name app password name
	 */
	deleteAppPassword(did: Did, name: string): void {
		this.#db
			.delete(t.appPassword)
			.where(and(eq(t.appPassword.did, did), eq(t.appPassword.name, name)))
			.run();
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
		const account = this.#accountManager.resolveAccount(identifier, {
			includeDeactivated: true,
			includeTakenDown: true,
		});
		if (!account) {
			return null;
		}

		const appPassword = await this.#findAppPasswordMatch(account.did, password);
		if (!appPassword) {
			return null;
		}

		return { account, appPassword };
	}

	async #findAppPasswordMatch(did: Did, password: string): Promise<AppPassword | null> {
		const rows = this.#db.select().from(t.appPassword).where(eq(t.appPassword.did, did)).all();

		for (const row of rows) {
			const valid = await verifyPassword(password, row.password_hash);
			if (valid) {
				return row;
			}
		}

		return null;
	}

	// #endregion

	// #region legacy sessions

	/**
	 * create a legacy refresh session and jwt pair.
	 * @param options legacy session options
	 * @returns legacy session jwt pair
	 */
	async createLegacySession(options: CreateLegacySessionOptions): Promise<LegacySessionTokens> {
		const now = options.now ?? new Date();
		const expiresAt = new Date(now.getTime() + LEGACY_REFRESH_TTL_MS);
		const sessionId = options.sessionId ?? nanoid(24);

		const inserted = this.#db
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

		return await this.#issueLegacyTokens({
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
		const session = this.#db.select().from(t.legacySession).where(eq(t.legacySession.id, sessionId)).get();
		if (!session) {
			return null;
		}

		const now = new Date();
		if (session.expires_at <= now) {
			this.#db.delete(t.legacySession).where(eq(t.legacySession.id, sessionId)).run();
			return null;
		}

		return session;
	}

	/**
	 * delete a legacy session by id.
	 * @param sessionId legacy session id
	 */
	deleteLegacySession(sessionId: string): void {
		this.#db.delete(t.legacySession).where(eq(t.legacySession.id, sessionId)).run();
	}

	/**
	 * rotate a legacy refresh token and return new tokens.
	 * @param sessionId legacy session id
	 * @returns session jwt pair
	 */
	async rotateLegacyRefresh(sessionId: string): Promise<LegacySessionTokens> {
		const row = this.#db
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
		this.#db
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

		const success = this.#db.transaction((tx) => {
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

		return await this.#issueLegacyTokens({
			did: row.did,
			privilege: row.privilege,
			sessionId: nextId,
			now: now,
		});
	}

	#scopeForPrivilege(privilege: AppPasswordPrivilege): AuthScope {
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

	async #issueLegacyTokens(options: {
		did: Did;
		privilege: AppPasswordPrivilege;
		sessionId: string;
		now: Date;
	}): Promise<LegacySessionTokens> {
		return await createLegacySessionTokens(
			{
				did: options.did,
				scope: this.#scopeForPrivilege(options.privilege),
				serviceDid: this.#serviceDid,
				jwtKey: this.#jwtKey,
				issuedAt: options.now.getTime(),
				expiresInMs: LEGACY_ACCESS_TTL_MS,
			},
			{
				did: options.did,
				serviceDid: this.#serviceDid,
				jwtKey: this.#jwtKey,
				sessionId: options.sessionId,
				issuedAt: options.now.getTime(),
				expiresInMs: LEGACY_REFRESH_TTL_MS,
			},
		);
	}

	// #endregion
}
