import { DidNotFoundError, InvalidResolvedHandleError, type HandleResolver } from '@atcute/identity-resolver';
import type { ActorIdentifier, Did, Handle } from '@atcute/lexicons';
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { InvalidRequestError, UpstreamFailureError } from '@atcute/xrpc-server';

import { and, asc, eq, gt, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';

import { TimeKeyset } from '#app/utils/keyset.ts';

import { t, type AccountDb } from './db';
import { EmailTokenPurpose } from './db/schema';
import { isServiceDomain, isValidTld } from './handle';
import { hashPassword, verifyPassword } from './passwords';
import { AccountStatus, formatAccountStatus } from './types';

export type Account = typeof t.account.$inferSelect;

const accountKeyset = new TimeKeyset<Did>(isDid);

interface AccountManagerOptions {
	db: AccountDb;
	serviceHandleDomains: string[];
	handleResolver: HandleResolver;
}

export class AccountManager {
	readonly #db: AccountDb;
	readonly #serviceHandleDomains: string[];
	readonly #handleResolver: HandleResolver;

	constructor(options: AccountManagerOptions) {
		this.#db = options.db;
		this.#serviceHandleDomains = options.serviceHandleDomains;
		this.#handleResolver = options.handleResolver;
	}

	/**
	 * get an account by did or handle.
	 * @param actor did or handle
	 * @param options availability options
	 * @returns account or null
	 */
	getAccount(actor: ActorIdentifier, options: AccountAvailabilityOptions = {}): Account | null {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.#db
			.select()
			.from(t.account)
			.where((f) => {
				return and(
					// oxlint-disable-next-line no-unsafe-type-assertion -- branded type from toLowerCase
					isDid(actor) ? eq(f.did, actor) : eq(sql`lower(${f.handle})`, actor.toLowerCase() as Handle),
					!includeDeactivated ? isNull(f.deactivated_at) : undefined,
					!includeTakenDown ? isNull(f.takedown_ref) : undefined,
				);
			})
			.get();

		return found ?? null;
	}

	/**
	 * get multiple accounts by did.
	 * @param actors array of dids
	 * @param options availability options
	 * @returns map of did to account
	 */
	getAccounts(actors: Did[], options: AccountAvailabilityOptions = {}): Map<Did, Account> {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.#db
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

		const rows = this.#db
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
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.get()?.count ?? 0;
		const active =
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(and(isNull(t.account.takedown_ref), isNull(t.account.deactivated_at)))
				.get()?.count ?? 0;
		const deactivated =
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(isNotNull(t.account.deactivated_at))
				.get()?.count ?? 0;
		const takendown =
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.account)
				.where(isNotNull(t.account.takedown_ref))
				.get()?.count ?? 0;
		const deleteScheduled =
			this.#db
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

	/**
	 * get an account by email address.
	 * @param email email address
	 * @param options availability options
	 * @returns account or null
	 */
	getAccountByEmail(email: string, options: AccountAvailabilityOptions = {}): Account | null {
		const { includeDeactivated = false, includeTakenDown = false } = options;

		const found = this.#db
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

	/**
	 * get the did for an actor.
	 * @param actor did or handle
	 * @param options availability options
	 * @returns did or null
	 */
	getAccountDid(actor: ActorIdentifier, options?: AccountAvailabilityOptions): Did | null {
		const account = this.getAccount(actor, options);
		if (account === null) {
			return null;
		}

		return account.did;
	}

	/**
	 * get the status of an account.
	 * @param actor did or handle
	 * @returns account status
	 */
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

	/**
	 * check if an account is activated (not deactivated).
	 * @param did account did
	 * @returns true if activated
	 */
	isAccountActivated(did: Did): boolean {
		const account = this.getAccount(did, { includeDeactivated: true });
		if (account === null) {
			return false;
		}

		return account.deactivated_at === null;
	}

	/**
	 * resolve an identifier (handle, did, or email) to an account.
	 * @param identifier handle, did, or email
	 * @param options availability options
	 * @returns account or null
	 */
	resolveAccount(identifier: string, options: AccountAvailabilityOptions = {}): Account | null {
		if (isDid(identifier) || isHandle(identifier)) {
			return this.getAccount(identifier as ActorIdentifier, options);
		}

		return this.getAccountByEmail(identifier, options);
	}

	/**
	 * validate a handle for use.
	 * @param handle handle to validate
	 * @param options validation options
	 * @returns normalized handle
	 */
	async validateHandle(handle: Handle, options: ValidateHandleOptions = {}): Promise<Handle> {
		const { did } = options;

		// normalize to lowercase
		// oxlint-disable-next-line no-unsafe-type-assertion -- branded type from toLowerCase
		handle = handle.toLowerCase() as Handle;

		if (!isValidTld(handle)) {
			throw new InvalidRequestError({
				error: 'InvalidHandle',
				description: `invalid or disallowed TLD in handle`,
			});
		}

		if (isServiceDomain(handle, this.#serviceHandleDomains)) {
			const suffix = this.#serviceHandleDomains.find((s) => handle.endsWith(s))!;
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
				resolvedDid = await this.#handleResolver.resolve(handle, { noCache: true });
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
		const account = this.resolveAccount(identifier, {
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
	 * create a new account record.
	 * @param options account creation options
	 * @returns created account
	 */
	async createAccount(options: CreateAccountOptions): Promise<Account> {
		// oxlint-disable-next-line no-unsafe-type-assertion -- branded type from toLowerCase
		const handle = options.handle.toLowerCase() as Handle;
		const email = options.email.toLowerCase();

		const passwordHash = await hashPassword(options.password);

		const inserted = this.#db
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

		this.#db.transaction((tx) => {
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
		this.#db
			.update(t.account)
			// oxlint-disable-next-line no-unsafe-type-assertion -- branded type from toLowerCase
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

		this.#db.transaction((tx) => {
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

		this.#db.update(t.account).set({ takedown_ref: ref }).where(eq(t.account.did, did)).run();

		if (takedown.applied) {
			this.#db.delete(t.legacySession).where(eq(t.legacySession.did, did)).run();
			this.#db.delete(t.webSession).where(eq(t.webSession.did, did)).run();
		}
	}

	/**
	 * update deactivated status for an account.
	 * @param did account did
	 * @param deactivated deactivated status
	 */
	updateAccountDeactivatedStatus(did: Did, deactivated: { applied: boolean }): void {
		this.#db
			.update(t.account)
			.set({ deactivated_at: deactivated.applied ? new Date() : null })
			.where(eq(t.account.did, did))
			.run();
	}

	async importAccount(_options: ImportAccountOptions) {}
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

interface ImportAccountOptions {}
