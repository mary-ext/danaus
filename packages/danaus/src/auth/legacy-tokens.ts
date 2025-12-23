import type { KeyObject } from 'node:crypto';

import type { Did } from '@atcute/lexicons';

import * as jose from 'jose';

import { AuthScope } from './scopes';

export interface LegacyTokenOptions {
	did: Did;
	scope: AuthScope;
	serviceDid: Did;
	jwtKey: KeyObject;
	issuedAt?: number;
	expiresInMs: number;
}

export interface LegacyRefreshTokenOptions {
	did: Did;
	serviceDid: Did;
	jwtKey: KeyObject;
	sessionId: string;
	issuedAt?: number;
	expiresInMs: number;
}

export interface LegacySessionTokens {
	accessJwt: string;
	refreshJwt: string;
}

/**
 * create a legacy access jwt.
 * @param options token options
 * @returns signed access jwt
 */
export const createLegacyAccessJwt = async (options: LegacyTokenOptions): Promise<string> => {
	const issuedAt = options.issuedAt ?? Date.now();
	const exp = issuedAt + options.expiresInMs;

	return await new jose.SignJWT({ scope: options.scope })
		.setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
		.setAudience(options.serviceDid)
		.setSubject(options.did)
		.setIssuedAt(Math.floor(issuedAt / 1000))
		.setExpirationTime(Math.floor(exp / 1000))
		.sign(options.jwtKey);
};

/**
 * create a legacy refresh jwt.
 * @param options token options
 * @returns signed refresh jwt
 */
export const createLegacyRefreshJwt = async (options: LegacyRefreshTokenOptions): Promise<string> => {
	const issuedAt = options.issuedAt ?? Date.now();
	const exp = issuedAt + options.expiresInMs;

	return await new jose.SignJWT({ scope: AuthScope.Refresh })
		.setProtectedHeader({ alg: 'HS256', typ: 'refresh+jwt' })
		.setAudience(options.serviceDid)
		.setSubject(options.did)
		.setJti(options.sessionId)
		.setIssuedAt(Math.floor(issuedAt / 1000))
		.setExpirationTime(Math.floor(exp / 1000))
		.sign(options.jwtKey);
};

/**
 * create both access and refresh jwt for legacy sessions.
 * @param access access token options
 * @param refresh refresh token options
 * @returns session tokens
 */
export const createLegacySessionTokens = async (
	access: LegacyTokenOptions,
	refresh: LegacyRefreshTokenOptions,
): Promise<LegacySessionTokens> => {
	const [accessJwt, refreshJwt] = await Promise.all([
		createLegacyAccessJwt(access),
		createLegacyRefreshJwt(refresh),
	]);

	return { accessJwt, refreshJwt };
};
