/**
 * auth scopes for legacy access tokens.
 */
export enum AuthScope {
	Access = 'com.atproto.access',
	Refresh = 'com.atproto.refresh',
	AppPass = 'com.atproto.appPass',
	AppPassPrivileged = 'com.atproto.appPassPrivileged',
	SignupQueued = 'com.atproto.signupQueued',
	Takendown = 'com.atproto.takendown',
}

export const ACCESS_FULL = [AuthScope.Access] as const;
export const ACCESS_PRIVILEGED = [...ACCESS_FULL, AuthScope.AppPassPrivileged] as const;
export const ACCESS_STANDARD = [...ACCESS_PRIVILEGED, AuthScope.AppPass] as const;

const authScopesValues = new Set(Object.values(AuthScope));

export const isAuthScope = (value: unknown): value is AuthScope => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- type guard implementation
	return authScopesValues.has(value as AuthScope);
};
