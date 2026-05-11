import { InvalidRequestError } from '@atcute/xrpc-server';

const SEPARATOR = '::';

const defaultValidator = (s: string): s is string => s.length > 0;

/**
 * generic keyset cursor with timestamp and secondary key.
 * format: `{timestamp}::{key}`
 */
export class TimeKeyset<K extends string = string> {
	private readonly validateKey: (key: string) => key is K;

	constructor(validateKey?: (key: string) => key is K) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- generic default fallback
		this.validateKey = validateKey ?? (defaultValidator as (key: string) => key is K);
	}

	/**
	 * pack a cursor from timestamp and key.
	 */
	pack(time: Date, key: K): string {
		return `${time.getTime()}${SEPARATOR}${key}`;
	}

	/**
	 * unpack a cursor string into timestamp and key.
	 * @throws InvalidRequestError if cursor is malformed
	 */
	unpack(cursor: string): { time: Date; key: K } {
		const idx = cursor.indexOf(SEPARATOR);
		if (idx === -1) {
			throw new InvalidRequestError({ error: 'InvalidCursor', message: 'malformed cursor' });
		}

		const timestamp = +cursor.slice(0, idx);
		if (!Number.isSafeInteger(timestamp)) {
			throw new InvalidRequestError({ error: 'InvalidCursor', message: 'malformed cursor' });
		}

		const key = cursor.slice(idx + SEPARATOR.length);
		if (!this.validateKey(key)) {
			throw new InvalidRequestError({ error: 'InvalidCursor', message: 'malformed cursor' });
		}

		return { time: new Date(timestamp), key };
	}

	/**
	 * unpack a cursor string, returning undefined if not provided.
	 */
	unpackOptional(cursor: string | undefined): { time: Date; key: K } | undefined {
		if (cursor === undefined) {
			return undefined;
		}
		return this.unpack(cursor);
	}
}
