// @ts-nocheck

/**
 * decode a base64url string to a Uint8Array.
 * @param {string} str
 * @returns {Uint8Array<ArrayBuffer>}
 */
export const fromBase64Url = (str) => {
	return Uint8Array.fromBase64(str, { alphabet: 'base64url' });
};

/**
 * encode an ArrayBuffer to a base64url string.
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
export const toBase64Url = (buffer) => {
	if (buffer instanceof ArrayBuffer) {
		buffer = new Uint8Array(buffer);
	}

	return buffer.toBase64({ alphabet: 'base64url' });
};
