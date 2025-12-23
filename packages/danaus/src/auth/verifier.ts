import type { KeyObject } from 'node:crypto';

import type { DidDocumentResolver } from '@atcute/identity-resolver';
import type { Did, Nsid } from '@atcute/lexicons';
import { isDid } from '@atcute/lexicons/syntax';
import { AuthRequiredError, InvalidRequestError, type XRPCErrorOptions } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';

import * as jose from 'jose';

import { AccountStatus } from '#app/accounts/types.ts';
import { AuthScope, isAuthScope } from '#app/auth/scopes.ts';

import type { AccountManager } from '../accounts/manager';

import { readWebSessionToken, verifyWebSessionToken } from './web';

/**
 * options for account checks.
 */
export interface VerifiedOptions {
	checkTakedown?: boolean;
	checkDeactivated?: boolean;
}

/**
 * scope options for auth checks.
 */
export interface ScopedOptions {
	scopes?: readonly AuthScope[];
}

/**
 * scope options for extra auth checks.
 */
export interface ExtraScopedOptions {
	additional?: readonly AuthScope[];
}
/**
 * auth verifier configuration.
 */
export interface AuthVerifierOptions {
	accountManager: AccountManager;
	serviceDid: Did;
	adminPassword: string | null;
	jwtKey: KeyObject;
	didDocumentResolver: DidDocumentResolver;
}

export const enum AuthCredentialsType {
	Unauthenticated,
	OAuth,
	Access,
	Refresh,
	WebSession,
	UserServiceAuth,
	AdminToken,
}

/**
 * unauthenticated credentials.
 */
export interface UnauthenticatedOutput {
	type: AuthCredentialsType.Unauthenticated;
}

/**
 * admin token credentials.
 */
export interface AdminTokenOutput {
	type: AuthCredentialsType.AdminToken;
}

/**
 * access token credentials.
 */
export interface AccessOutput {
	type: AuthCredentialsType.Access;
	did: Did;
	scope: AuthScope;
}

/**
 * refresh token credentials.
 */
export interface RefreshOutput {
	type: AuthCredentialsType.Refresh;
	did: Did;
	tokenId: string;
}

/**
 * oauth credentials.
 */
export interface OAuthOutput {
	type: AuthCredentialsType.OAuth;
	did: Did;
	scope: AuthScope;
}

/**
 * service auth credentials.
 */
export interface UserServiceAuthOutput {
	type: AuthCredentialsType.UserServiceAuth;
	did: Did;
}

/**
 * web session credentials.
 */
export interface WebSessionOutput {
	type: AuthCredentialsType.WebSession;
	did: Did;
	sessionId: string;
}

type AuthType = 'unknown' | 'basic' | 'bearer' | 'dpop';

/**
 * auth verifier.
 */
export class AuthVerifier {
	private readonly accountManager: AccountManager;
	private readonly jwtKey: KeyObject;
	private readonly adminPassword: string | null;
	private readonly serviceDid: Did;
	private readonly serviceJwtVerifier: ServiceJwtVerifier;

	/**
	 * create an auth verifier.
	 * @param options verifier options
	 */
	constructor(options: AuthVerifierOptions) {
		this.accountManager = options.accountManager;
		this.jwtKey = options.jwtKey;
		this.adminPassword = options.adminPassword;
		this.serviceDid = options.serviceDid;
		this.serviceJwtVerifier = new ServiceJwtVerifier({
			serviceDid: options.serviceDid,
			resolver: options.didDocumentResolver,
		});
	}

	/**
	 * unauthenticated access guard.
	 * @param request http request
	 * @returns unauthenticated output
	 */
	unauthenticated(request: Request): UnauthenticatedOutput {
		const header = request.headers.get('authorization');
		if (header) {
			throw new AuthRequiredError({ description: `invalid authorization header` });
		}

		return { type: AuthCredentialsType.Unauthenticated };
	}

	/**
	 * admin verifier (basic auth).
	 * @param request http request
	 * @returns admin token output
	 */
	async admin(request: Request): Promise<AdminTokenOutput> {
		const parsed = parseBasicAuth(request);
		if (!parsed || !this.adminPassword) {
			throw new AuthRequiredError({ description: `invalid authorization header` });
		}

		if (parsed.username !== 'admin' || parsed.password !== this.adminPassword) {
			throw new AuthRequiredError({ description: `invalid authorization header` });
		}

		return { type: AuthCredentialsType.AdminToken };
	}

	/**
	 * optional admin verifier (basic auth).
	 * @param request http request
	 * @returns admin token output or unauthenticated output
	 */
	async adminOptional(request: Request): Promise<AdminTokenOutput | UnauthenticatedOutput> {
		const type = getAuthType(request);
		switch (type) {
			case 'basic': {
				return this.admin(request);
			}
		}

		return this.unauthenticated(request);
	}

	/**
	 * bearer access verifier.
	 * @param request http request
	 * @param options verification options
	 * @returns access output
	 */
	async authorization(
		request: Request,
		options: VerifiedOptions & ScopedOptions & ExtraScopedOptions = {},
	): Promise<AccessOutput | OAuthOutput> {
		const type = getAuthType(request);

		switch (type) {
			case 'dpop': {
				return this.oauth(request);
			}
			case 'bearer': {
				return this.access(request, options);
			}
			case 'unknown': {
				throw invalidTokenError(`unsupported authorization type`);
			}
		}

		throw invalidTokenError(`missing authorization`);
	}

	/**
	 * authorization or admin with optional fallback.
	 * @param request http request
	 * @param options verification options
	 * @returns auth output
	 */
	async authorizationOrAdminOptional(
		request: Request,
		options: VerifiedOptions & ScopedOptions & ExtraScopedOptions = {},
	): Promise<AccessOutput | OAuthOutput | AdminTokenOutput | UnauthenticatedOutput> {
		const type = getAuthType(request);
		switch (type) {
			case 'dpop': {
				return this.oauth(request);
			}
			case 'bearer': {
				return this.authorization(request, options);
			}
			case 'basic': {
				return this.admin(request);
			}
		}

		return this.unauthenticated(request);
	}

	/**
	 * user service auth verifier.
	 * @param request http request
	 * @returns service auth output
	 */
	async userServiceAuth(request: Request): Promise<UserServiceAuthOutput> {
		const auth = await this.verifyServiceJwt(request);
		return {
			type: AuthCredentialsType.UserServiceAuth,
			did: auth.issuer,
		};
	}

	/**
	 * optional user service auth verifier.
	 * @param request http request
	 * @returns service auth output or unauthenticated output
	 */
	async userServiceAuthOptional(request: Request): Promise<UserServiceAuthOutput | UnauthenticatedOutput> {
		const type = getAuthType(request);
		if (type === 'bearer') {
			return this.userServiceAuth(request);
		}

		return this.unauthenticated(request);
	}

	/**
	 * web session verifier.
	 * @param request http request
	 * @param options verification options
	 * @returns web session output
	 */
	async web(request: Request, options: VerifiedOptions = {}): Promise<WebSessionOutput> {
		const token = readWebSessionToken(request);
		if (!token) {
			throw new AuthRequiredError({ description: `missing web session cookie` });
		}

		const sessionId = verifyWebSessionToken(this.jwtKey, token);
		if (!sessionId) {
			throw new AuthRequiredError({ description: `invalid web session cookie` });
		}

		const session = this.accountManager.getWebSession(sessionId);
		if (!session) {
			throw new AuthRequiredError({ description: `invalid web session` });
		}

		this.assertAccountStatus(session.did, options);

		return {
			type: AuthCredentialsType.WebSession,
			did: session.did,
			sessionId: session.id,
		};
	}

	/**
	 * authorization or user service auth verifier.
	 * @param request http request
	 * @param options verification options
	 * @returns auth output
	 */
	async authorizationOrUserServiceAuth(
		request: Request,
		options: VerifiedOptions & ScopedOptions & ExtraScopedOptions = {},
	): Promise<UserServiceAuthOutput | AccessOutput | OAuthOutput> {
		if (isServiceToken(request)) {
			return this.userServiceAuth(request);
		}

		return this.authorization(request, options);
	}

	/**
	 * oauth verifier placeholder.
	 * @param _request http request
	 */
	private async oauth(_request: Request): Promise<never> {
		throw new InvalidRequestError({ error: 'OAuthNotImplemented', description: `oauth is not implemented` });
	}

	private async access(
		request: Request,
		options: VerifiedOptions & ScopedOptions & ExtraScopedOptions,
	): Promise<AccessOutput> {
		const { payload, protectedHeader } = await this.verifyBearerJwt(request);

		if (!protectedHeader.typ || protectedHeader.typ !== 'at+jwt') {
			throw invalidTokenError(`invalid token type`);
		}

		const scope = payload.scope;
		if (!isAuthScope(scope)) {
			throw invalidTokenError(`missing token scope`);
		}

		if (options.scopes || options.additional) {
			const allowed =
				(options.scopes ? options.scopes.includes(scope) : false) ||
				(options.additional ? options.additional.includes(scope) : false);

			if (!allowed) {
				throw invalidTokenError(`bad token scope`);
			}
		}

		const did = payload.sub;
		if (typeof did !== 'string' || !isDid(did)) {
			throw invalidTokenError(`invalid token subject`);
		}

		this.assertAccountStatus(did, options);

		return { type: AuthCredentialsType.Access, did: did, scope: scope };
	}

	/**
	 * refresh token verifier.
	 * @param request http request
	 * @returns refresh output
	 */
	async refresh(request: Request): Promise<RefreshOutput> {
		const { payload, protectedHeader } = await this.verifyBearerJwt(request);

		if (!protectedHeader.typ || protectedHeader.typ !== 'refresh+jwt') {
			throw invalidTokenError(`invalid token type`);
		}

		const did = payload.sub;
		if (typeof did !== 'string' || !isDid(did)) {
			throw invalidTokenError(`invalid token subject`);
		}

		const tokenId = payload.jti;
		if (typeof tokenId !== 'string') {
			throw new AuthRequiredError({ error: 'MissingTokenId', description: `refresh token id is missing` });
		}

		return { type: AuthCredentialsType.Refresh, did: did, tokenId: tokenId };
	}

	private assertAccountStatus(did: Did, options: VerifiedOptions): void {
		if (options.checkTakedown || options.checkDeactivated) {
			const status = this.accountManager.getAccountStatus(did);

			if (options.checkTakedown && status === AccountStatus.Takendown) {
				throw new AuthRequiredError({ error: 'AccountTakedown', description: `account has been taken down` });
			}

			if (options.checkDeactivated && status === AccountStatus.Deactivated) {
				throw new AuthRequiredError({ error: 'AccountDeactivated', description: `account is deactivated` });
			}
		}
	}

	private async verifyBearerJwt(
		request: Request,
	): Promise<{ payload: jose.JWTPayload; protectedHeader: jose.JWTHeaderParameters }> {
		const token = bearerTokenFromRequest(request);
		if (!token) {
			throw new AuthRequiredError({ description: `missing bearer token` });
		}

		try {
			const result = await jose.jwtVerify(token, this.jwtKey, { audience: this.serviceDid });

			return { payload: result.payload, protectedHeader: result.protectedHeader };
		} catch (err) {
			if (err instanceof jose.errors.JWTExpired) {
				throw new InvalidRequestError({ error: 'ExpiredToken', description: `token has expired` });
			}

			throw invalidTokenError(`token could not be verified`);
		}
	}

	private async verifyServiceJwt(request: Request): Promise<VerifiedJwt> {
		const token = bearerTokenFromRequest(request);
		if (!token) {
			throw new AuthRequiredError({ description: `missing bearer token` });
		}

		const lxm = parseRequestNsid(request);
		const result = await this.serviceJwtVerifier.verify(token, { lxm: lxm ?? null });

		if (!result.ok) {
			throw new AuthRequiredError({ error: result.error.error, description: result.error.description });
		}

		return result.value;
	}
}

const invalidTokenError = (description: string, options?: Partial<XRPCErrorOptions>): InvalidRequestError => {
	return new InvalidRequestError({
		error: 'InvalidToken',
		description: description,
		status: options?.status,
	});
};

const getAuthType = (request: Request): AuthType => {
	const parsed = parseAuthHeader(request);
	if (!parsed) {
		return 'unknown';
	}

	switch (parsed.scheme) {
		case 'dpop':
			return 'dpop';
		case 'bearer':
			return 'bearer';
		case 'basic':
			return 'basic';
		default:
			return 'unknown';
	}
};

const bearerTokenFromRequest = (request: Request): string | null => {
	const parsed = parseAuthHeader(request);
	if (!parsed || parsed.scheme !== 'bearer') {
		return null;
	}

	return parsed.value;
};

export const parseBasicAuth = (request: Request): { username: string; password: string } | null => {
	const parsed = parseAuthHeader(request);
	if (!parsed || parsed.scheme !== 'basic') {
		return null;
	}

	let decoded: string;
	try {
		decoded = Buffer.from(parsed.value, 'base64').toString('utf8');
	} catch {
		return null;
	}

	const idx = decoded.indexOf(':');
	if (idx === -1) {
		return null;
	}

	return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
};

const parseAuthHeader = (request: Request): { scheme: string; value: string } | null => {
	const header = request.headers.get('authorization');
	if (!header) {
		return null;
	}

	const idx = header.indexOf(' ');
	if (idx === -1) {
		return null;
	}

	const scheme = header.slice(0, idx).toLowerCase();
	const value = header.slice(idx + 1).trim();

	if (!value) {
		return null;
	}

	return { scheme: scheme, value: value };
};

const parseRequestNsid = (request: Request): Nsid | null => {
	const url = new URL(request.url);
	if (!url.pathname.startsWith('/xrpc/')) {
		return null;
	}

	return url.pathname.slice('/xrpc/'.length) as Nsid;
};

const isServiceToken = (request: Request): boolean => {
	const token = bearerTokenFromRequest(request);
	if (!token) {
		return false;
	}

	const payload = jose.decodeJwt(token);
	return typeof payload?.lxm === 'string';
};
