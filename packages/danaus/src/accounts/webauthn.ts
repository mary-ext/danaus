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

import { WebAuthnCredentialType } from './db/schema.ts';
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
	/** credential type to register */
	credentialType: WebAuthnCredentialType;
}

/**
 * generates WebAuthn registration options for creating a new credential.
 * @param params registration parameters
 * @returns registration options to send to the client
 */
export const generateWebAuthnRegistrationOptions = async (params: GenerateRegistrationOptionsParams) => {
	const { rpId, rpName, userId, userName, excludeCredentials = [], credentialType } = params;

	// passkeys require discoverable credentials and user verification
	// security keys are non-discoverable 2FA only
	const isPasskey = credentialType === WebAuthnCredentialType.Passkey;

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
			residentKey: isPasskey ? 'required' : 'discouraged',
			userVerification: isPasskey ? 'required' : 'discouraged',
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
	/** whether user verification is required (true for passkeys, false for security keys) */
	requireUserVerification: boolean;
}

/**
 * verifies a WebAuthn registration response.
 * @param params verification parameters
 * @returns verification result
 */
export const verifyWebAuthnRegistration = async (
	params: VerifyRegistrationParams,
): Promise<VerifiedRegistrationResponse> => {
	const { response, expectedChallenge, expectedOrigin, expectedRpId, requireUserVerification } = params;

	return await verifyRegistrationResponse({
		response,
		expectedChallenge,
		expectedOrigin,
		expectedRPID: expectedRpId,
		requireUserVerification,
	});
};

// #endregion

// #region authentication

export interface GenerateAuthenticationOptionsParams {
	/** relying party ID (domain) */
	rpId: string;
	/** allowed credentials (omit for discoverable/passkey flow) */
	allowCredentials?: WebauthnCredential[];
	/** whether user verification is required (true for passkey login) */
	userVerificationRequired?: boolean;
}

/**
 * generates WebAuthn authentication options for verifying with an existing credential.
 * @param params authentication parameters
 * @returns authentication options to send to the client
 */
export const generateWebAuthnAuthenticationOptions = async (params: GenerateAuthenticationOptionsParams) => {
	const { rpId, allowCredentials, userVerificationRequired = false } = params;

	// determine user verification requirement:
	// - required: passkey-only flow (passwordless login)
	// - preferred: mixed credentials or MFA (passkeys will do UV, security keys won't)
	// - discouraged: security keys only
	let userVerification: 'required' | 'preferred' | 'discouraged';
	if (userVerificationRequired) {
		userVerification = 'required';
	} else if (allowCredentials?.some((cred) => cred.type === WebAuthnCredentialType.Passkey)) {
		userVerification = 'preferred';
	} else {
		userVerification = 'discouraged';
	}

	return await generateAuthenticationOptions({
		rpID: rpId,
		userVerification,
		allowCredentials: allowCredentials?.map((cred) => ({
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

	// passkeys require user verification, security keys only need user presence
	const requireUserVerification = credential.type === WebAuthnCredentialType.Passkey;

	return await verifyAuthenticationResponse({
		response,
		expectedChallenge,
		expectedOrigin,
		expectedRPID: expectedRpId,
		requireUserVerification,
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
