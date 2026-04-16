import type { BunRequest, CookieInit } from 'bun';
import { createHmac, timingSafeEqual, type KeyObject } from 'node:crypto';

/**
 * web session cookie name.
 */
export const WEB_SESSION_COOKIE = 'danaus_session';

/**
 * read the web session cookie.
 * @param request http request
 * @returns token or null
 */
export const readWebSessionToken = (request: Request): string | null => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- Bun-specific API access
	const cookies = (request as BunRequest).cookies;

	return cookies.get(WEB_SESSION_COOKIE) ?? null;
};

/**
 * set the web session cookie.
 * @param request http request
 * @param token session token
 * @param options cookie options
 */
export const setWebSessionToken = (request: Request, token: string, options: CookieInit = {}): void => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- Bun-specific API access
	const cookies = (request as BunRequest).cookies;

	cookies.set(WEB_SESSION_COOKIE, token, options);
};

/**
 * create a web session token for a session id.
 * @param key signing key
 * @param sessionId session id
 * @returns signed token
 */
export const createWebSessionToken = (key: KeyObject, sessionId: string): string => {
	const signature = signWebSessionId(key, sessionId);
	return `${sessionId}.${signature}`;
};

/**
 * verify a web session token and return session id.
 * @param key signing key
 * @param token session token
 * @returns session id or null
 */
export const verifyWebSessionToken = (key: KeyObject, token: string): string | null => {
	const idx = token.indexOf('.');
	if (idx <= 0 || idx >= token.length - 1) {
		return null;
	}

	const sessionId = token.slice(0, idx);
	const signature = token.slice(idx + 1);

	const expectedBytes = createHmac('sha256', key).update(sessionId).digest();
	const signatureBytes = Buffer.from(signature, 'base64url');

	if (!timingSafeEqual(expectedBytes, signatureBytes)) {
		return null;
	}

	return sessionId;
};

const signWebSessionId = (key: KeyObject, sessionId: string): string => {
	return createHmac('sha256', key).update(sessionId).digest('base64url');
};
