import type { Did } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import { and, asc, eq, gt, inArray, or, sql } from 'drizzle-orm';

import { TimeKeyset } from '#app/utils/keyset.ts';
import { generateInviteCode } from '#app/utils/token.ts';

import { t, type AccountDb } from './db';

export type InviteCode = typeof t.inviteCode.$inferSelect;
export type InviteCodeUse = typeof t.inviteCodeUse.$inferSelect;

export interface InviteCodeWithUses extends InviteCode {
	uses: InviteCodeUse[];
}

const inviteCodeKeyset = new TimeKeyset();

interface InviteCodeManagerOptions {
	db: AccountDb;
}

interface ListInviteCodesOptions {
	limit?: number;
	cursor?: string;
	includeDisabled?: boolean;
	includeUsed?: boolean;
}

export class InviteCodeManager {
	readonly #db: AccountDb;

	constructor(options: InviteCodeManagerOptions) {
		this.#db = options.db;
	}

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
			const inserted = this.#db
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
		const invite = this.#db.select().from(t.inviteCode).where(eq(t.inviteCode.code, code)).get();

		if (!invite || invite.disabled) {
			throw new InvalidRequestError({
				error: 'InvalidInviteCode',
				message: 'provided invite code not available',
			});
		}

		// -1 means unlimited uses
		if (invite.available_uses !== -1) {
			const uses =
				this.#db
					.select({ count: sql<number>`count(*)` })
					.from(t.inviteCodeUse)
					.where(eq(t.inviteCodeUse.code, code))
					.get()?.count ?? 0;

			if (uses >= invite.available_uses) {
				throw new InvalidRequestError({
					error: 'InvalidInviteCode',
					message: 'provided invite code not available',
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
		this.#db
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
		const invite = this.#db.select().from(t.inviteCode).where(eq(t.inviteCode.code, code)).get();

		if (!invite) {
			return null;
		}

		const uses = this.#db.select().from(t.inviteCodeUse).where(eq(t.inviteCodeUse.code, code)).all();

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
		const paginatedCodes = this.#db.$with('paginated_codes').as(
			this.#db
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

		const rows = this.#db
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

		this.#db.update(t.inviteCode).set({ disabled: true }).where(inArray(t.inviteCode.code, codes)).run();
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
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.inviteCode)
				.get()?.count ?? 0;

		const disabled =
			this.#db
				.select({ count: sql<number>`count(*)` })
				.from(t.inviteCode)
				.where(eq(t.inviteCode.disabled, true))
				.get()?.count ?? 0;

		const used =
			this.#db
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
}
