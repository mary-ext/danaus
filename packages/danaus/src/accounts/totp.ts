import { timingSafeEqual } from 'node:crypto';

import { fromBase32, toBase32 } from '@atcute/multibase';

import { customAlphabet } from 'nanoid';
import QRCode from 'qrcode';

// #region constants

/** TOTP secret length in bytes (160 bits as per RFC 6238) */
const SECRET_LENGTH = 20;

/** TOTP code length in digits */
export const TOTP_CODE_LENGTH = 6;

/** TOTP code regex pattern */
export const TOTP_CODE_RE = /^\d{6}$/;

/** TOTP time step in seconds */
const TIME_STEP = 30;

/** TOTP time window tolerance (±1 step for clock drift) */
const TIME_WINDOW = 1;

/** maximum TOTP credentials per account */
export const MAX_TOTP_CREDENTIALS = 5;

/** number of backup codes to generate */
const RECOVERY_CODE_COUNT = 10;

/** recovery code length in characters */
export const RECOVERY_CODE_LENGTH = 8;

/** recovery code regex pattern */
export const RECOVERY_CODE_RE = /^[a-zA-Z\d]{4}-?[a-zA-Z\d]{4}$/;

/** recovery code alphabet (no confusing characters: 0, 1, I, O, L) */
const RECOVERY_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

// #endregion

// #region secret generation

/**
 * generates a random TOTP secret.
 * @returns 20 random bytes
 */
export const generateSecret = (): Uint8Array => {
	const bytes = new Uint8Array(SECRET_LENGTH);
	crypto.getRandomValues(bytes);
	return bytes;
};

/**
 * encodes a secret as base32 for display and storage.
 * @param secret the raw secret bytes
 * @returns uppercase base32 string
 */
export const encodeSecret = (secret: Uint8Array): string => {
	return toBase32(secret).toUpperCase();
};

/**
 * decodes a base32 secret string back to bytes.
 * @param encoded the base32 encoded secret
 * @returns raw secret bytes
 */
export const decodeSecret = (encoded: string): Uint8Array => {
	return fromBase32(encoded.toLowerCase());
};

// #endregion

// #region TOTP URI and QR code

/**
 * generates an otpauth:// URI for TOTP registration.
 * @param secret the raw secret bytes
 * @param label the account label (usually handle)
 * @param issuer the service name
 * @returns otpauth URI string
 */
export const generateTotpUri = (secret: Uint8Array, label: string, issuer: string): string => {
	const encodedSecret = encodeSecret(secret);
	const encodedLabel = encodeURIComponent(label);
	const encodedIssuer = encodeURIComponent(issuer);

	return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_CODE_LENGTH}&period=${TIME_STEP}`;
};

/**
 * generates a QR code as a base64-encoded data URI.
 * @param uri the otpauth URI to encode
 * @returns base64 data URI for embedding in img src
 */
export const generateQrCode = async (uri: string): Promise<string> => {
	return QRCode.toDataURL(uri, {
		errorCorrectionLevel: 'M',
		margin: 2,
		width: 200,
	});
};

// #endregion

// #region TOTP verification

/**
 * generates a TOTP code for a given counter value.
 * implements RFC 4226 HOTP algorithm.
 * @param secret the raw secret bytes
 * @param counter the counter value (typically floor(time / 30))
 * @returns 6-digit code
 */
const generateHotp = async (secret: Uint8Array, counter: number): Promise<string> => {
	// convert counter to 8-byte big-endian buffer
	const counterBuffer = new Uint8Array(8);
	for (let i = 7; i >= 0; i--) {
		counterBuffer[i] = counter & 0xff;
		counter = Math.floor(counter / 256);
	}

	// import key for HMAC-SHA1
	const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);

	// compute HMAC-SHA1
	const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
	const hash = new Uint8Array(signature);

	// dynamic truncation (RFC 4226)
	const offset = hash[hash.length - 1]! & 0x0f;
	const binary =
		((hash[offset]! & 0x7f) << 24) |
		((hash[offset + 1]! & 0xff) << 16) |
		((hash[offset + 2]! & 0xff) << 8) |
		(hash[offset + 3]! & 0xff);

	// generate 6-digit code
	const code = binary % 10 ** TOTP_CODE_LENGTH;
	return code.toString().padStart(TOTP_CODE_LENGTH, '0');
};

/**
 * verifies a TOTP code against a secret.
 * checks current time step and ±1 for clock drift tolerance.
 * @param secret the raw secret bytes
 * @param code the code to verify
 * @param lastUsedCounter last used counter to prevent replay attacks (null if first use)
 * @returns the matched counter value if valid, or null if invalid
 */
export const verifyTotpCode = async (
	secret: Uint8Array,
	code: string,
	lastUsedCounter: number | null,
): Promise<number | null> => {
	if (!isTotpCode(code)) {
		return null;
	}

	const codeBytes = Buffer.from(code);

	const currentTime = Math.floor(Date.now() / 1000);
	const currentCounter = Math.floor(currentTime / TIME_STEP);

	// check current window and ±1 for clock drift
	for (let i = -TIME_WINDOW; i <= TIME_WINDOW; i++) {
		const counter = currentCounter + i;

		// skip if this counter was already used (replay attack prevention)
		if (lastUsedCounter != null && counter <= lastUsedCounter) {
			continue;
		}

		const expectedCode = await generateHotp(secret, counter);

		if (timingSafeEqual(codeBytes, Buffer.from(expectedCode))) {
			return counter;
		}
	}

	return null;
};

// #endregion

// #region backup codes

const generateBackupCode = customAlphabet(RECOVERY_CODE_ALPHABET, RECOVERY_CODE_LENGTH);

/**
 * generates backup codes.
 * @returns array of 10 backup codes, 8 characters each
 */
export const generateBackupCodes = (): string[] => {
	const codes: string[] = [];
	for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
		const raw = generateBackupCode();
		const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;

		codes.push(code);
	}
	return codes;
};

/**
 * checks if a code is a valid TOTP code (6 digits).
 * @param code the code to check
 * @returns true if valid
 */
export const isTotpCode = (code: string): boolean => {
	return TOTP_CODE_RE.test(code);
};

/**
 * checks if a code is a valid recovery code (8 alphanumeric chars).
 * @param code the code to check
 * @returns true if valid
 */
export const isRecoveryCode = (code: string): boolean => {
	return RECOVERY_CODE_RE.test(code);
};

// #endregion
