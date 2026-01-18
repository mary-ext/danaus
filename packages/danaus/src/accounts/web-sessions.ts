import type { KeyObject } from 'node:crypto';

import type { Did } from '@atcute/lexicons';

import { eq, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { createWebSessionToken } from '#app/auth/web.ts';
import { DAY } from '#app/utils/times.ts';

import { t, type AccountDb } from './db';

const WEB_SESSION_TTL_MS = 7 * DAY;
const WEB_SESSION_LONG_TTL_MS = 365 * DAY;
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUDO_MODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type WebSession = typeof t.webSession.$inferSelect;
export type VerifyChallenge = typeof t.verifyChallenge.$inferSelect;

interface WebSessionManagerOptions {
	db: AccountDb;
	jwtKey: KeyObject;
}

interface CreateWebSessionOptions {
	did: Did;
	remember: boolean;
	userAgent: string | undefined;
	ip: string | undefined;
}

export class WebSessionManager {
	readonly #db: AccountDb;
	readonly #jwtKey: KeyObject;

	constructor(options: WebSessionManagerOptions) {
		this.#db = options.db;
		this.#jwtKey = options.jwtKey;
	}

	// #region web sessions

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

		const inserted = this.#db
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

		const token = createWebSessionToken(this.#jwtKey, id);

		return { session: inserted, token: token };
	}

	/**
	 * get a web session by id.
	 * @param sessionId session id
	 * @returns web session or null if expired/not found
	 */
	getWebSession(sessionId: string): WebSession | null {
		const session = this.#db.select().from(t.webSession).where(eq(t.webSession.id, sessionId)).get();
		if (!session) {
			return null;
		}

		const now = new Date();
		if (session.expires_at <= now) {
			this.#db.delete(t.webSession).where(eq(t.webSession.id, sessionId)).run();
			return null;
		}

		return session;
	}

	/**
	 * delete a web session.
	 * @param sessionId session id
	 */
	deleteWebSession(sessionId: string): void {
		this.#db.delete(t.webSession).where(eq(t.webSession.id, sessionId)).run();
	}

	// #endregion

	// #region sudo mode

	/**
	 * elevate a session to sudo mode.
	 * @param sessionId the session id
	 */
	elevateSession(sessionId: string): void {
		this.#db.update(t.webSession).set({ sudo_at: new Date() }).where(eq(t.webSession.id, sessionId)).run();
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

		this.#db
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
		const existing = this.#db
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
			this.#db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, existing.token)).run();
		}

		const token = nanoid(32);
		const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

		const inserted = this.#db
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
		const challenge = this.#db
			.select()
			.from(t.verifyChallenge)
			.where(eq(t.verifyChallenge.token, token))
			.get();

		if (!challenge) {
			return null;
		}

		const now = new Date();
		if (challenge.expires_at <= now) {
			this.#db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, token)).run();
			return null;
		}

		return challenge;
	}

	/**
	 * delete a verification challenge.
	 * @param token the token
	 */
	deleteVerifyChallenge(token: string): void {
		this.#db.delete(t.verifyChallenge).where(eq(t.verifyChallenge.token, token)).run();
	}

	/**
	 * clean up expired verification challenges.
	 */
	cleanupExpiredVerifyChallenges(): void {
		const now = new Date();
		this.#db.delete(t.verifyChallenge).where(lte(t.verifyChallenge.expires_at, now)).run();
	}

	/**
	 * set the WebAuthn challenge on an existing verification challenge.
	 * @param token verify challenge token
	 * @param webauthnChallenge base64url WebAuthn challenge
	 */
	setVerifyChallengeWebAuthn(token: string, webauthnChallenge: string): void {
		this.#db
			.update(t.verifyChallenge)
			.set({ webauthn_challenge: webauthnChallenge })
			.where(eq(t.verifyChallenge.token, token))
			.run();
	}

	// #endregion
}
