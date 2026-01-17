import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type AuthenticatorTransportFuture,
	type RegistrationResponseJSON,
	type VerifiedAuthenticationResponse,
	type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';

import type { WebauthnCredential } from './manager';

// #region constants

/** maximum WebAuthn credentials per account */
export const MAX_WEBAUTHN_CREDENTIALS = 10;

/** WebAuthn challenge TTL in milliseconds (5 minutes) */
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

// #endregion

// #region registration

export interface GenerateRegistrationOptionsParams {
	/** relying party ID (domain) */
	rpId: string;
	/** relying party name */
	rpName: string;
	/** user identifier (DID) */
	userId: string;
	/** user display name (handle) */
	userName: string;
	/** existing credentials to exclude */
	excludeCredentials?: WebauthnCredential[];
}

/**
 * generates WebAuthn registration options for creating a new security key credential.
 * @param params registration parameters
 * @returns registration options to send to the client
 */
export const generateWebAuthnRegistrationOptions = async (params: GenerateRegistrationOptionsParams) => {
	const { rpId, rpName, userId, userName, excludeCredentials = [] } = params;

	return await generateRegistrationOptions({
		rpName,
		rpID: rpId,
		userName,
		userID: new TextEncoder().encode(userId),
		attestationType: 'none',
		excludeCredentials: excludeCredentials.map((cred) => ({
			id: cred.credential_id,
			transports: cred.transports ?? undefined,
		})),
		authenticatorSelection: {
			// non-discoverable for security keys (2FA only)
			residentKey: 'discouraged',
			// password already verified, no need for PIN/biometric
			userVerification: 'discouraged',
		},
	});
};

export interface VerifyRegistrationParams {
	/** the response from the authenticator */
	response: RegistrationResponseJSON;
	/** the expected challenge (base64url) */
	expectedChallenge: string;
	/** the expected origin */
	expectedOrigin: string;
	/** the expected relying party ID */
	expectedRpId: string;
}

/**
 * verifies a WebAuthn registration response.
 * @param params verification parameters
 * @returns verification result
 */
export const verifyWebAuthnRegistration = async (
	params: VerifyRegistrationParams,
): Promise<VerifiedRegistrationResponse> => {
	const { response, expectedChallenge, expectedOrigin, expectedRpId } = params;

	return await verifyRegistrationResponse({
		response,
		expectedChallenge,
		expectedOrigin,
		expectedRPID: expectedRpId,
	});
};

// #endregion

// #region authentication

export interface GenerateAuthenticationOptionsParams {
	/** relying party ID (domain) */
	rpId: string;
	/** allowed credentials */
	allowCredentials?: WebauthnCredential[];
}

/**
 * generates WebAuthn authentication options for verifying with an existing credential.
 * @param params authentication parameters
 * @returns authentication options to send to the client
 */
export const generateWebAuthnAuthenticationOptions = async (params: GenerateAuthenticationOptionsParams) => {
	const { rpId, allowCredentials = [] } = params;

	return await generateAuthenticationOptions({
		rpID: rpId,
		userVerification: 'discouraged',
		allowCredentials: allowCredentials.map((cred) => ({
			id: cred.credential_id,
			transports: cred.transports ?? undefined,
		})),
	});
};

export interface VerifyAuthenticationParams {
	/** the response from the authenticator */
	response: AuthenticationResponseJSON;
	/** the expected challenge (base64url) */
	expectedChallenge: string;
	/** the expected origin */
	expectedOrigin: string;
	/** the expected relying party ID */
	expectedRpId: string;
	/** the credential being verified */
	credential: WebauthnCredential;
}

/**
 * verifies a WebAuthn authentication response.
 * @param params verification parameters
 * @returns verification result
 */
export const verifyWebAuthnAuthentication = async (
	params: VerifyAuthenticationParams,
): Promise<VerifiedAuthenticationResponse> => {
	const { response, expectedChallenge, expectedOrigin, expectedRpId, credential } = params;

	return await verifyAuthenticationResponse({
		response,
		expectedChallenge,
		expectedOrigin,
		expectedRPID: expectedRpId,
		credential: {
			id: credential.credential_id,
			publicKey: new Uint8Array(credential.public_key),
			counter: credential.counter,
			transports: credential.transports ?? undefined,
		},
	});
};

// #endregion

// #region types re-export

export type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON };

// #endregion
