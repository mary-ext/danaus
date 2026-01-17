// @ts-check

import { fromBase64Url, toBase64Url } from './base64url.js';

/**
 * Passkey login element - fetches challenge and handles discoverable credential authentication.
 *
 * @attr {string} data-challenge-url - URL to fetch authentication challenge from
 */
class PasskeyLoginElement extends HTMLElement {
	/** @type {HTMLButtonElement | null} */
	get startButton() {
		return this.querySelector('[data-target="passkey-login.start"]');
	}

	/** @type {HTMLInputElement | null} */
	get responseInput() {
		return this.querySelector('[data-target="passkey-login.response"]');
	}

	/** @type {HTMLElement | null} */
	get statusElement() {
		return this.querySelector('[data-target="passkey-login.status"]');
	}

	/** @type {HTMLFormElement | null} */
	get formElement() {
		return this.querySelector('[data-target="passkey-login.form"]');
	}

	connectedCallback() {
		const challengeUrl = this.dataset.challengeUrl;
		if (!challengeUrl) {
			return;
		}

		const startButton = this.startButton;
		if (startButton) {
			// enable the button now that JS is loaded
			startButton.disabled = false;
			startButton.addEventListener('click', (e) => {
				e.preventDefault();
				this.#handlePasskeyLogin(challengeUrl);
			});
		}
	}

	/**
	 * @param {string} challengeUrl
	 */
	async #handlePasskeyLogin(challengeUrl) {
		const status = this.statusElement;
		const responseInput = this.responseInput;
		const startButton = this.startButton;

		if (!status || !responseInput) {
			console.error('Passkey login: missing required elements');
			return;
		}

		try {
			if (startButton) {
				startButton.disabled = true;
			}
			status.textContent = 'Fetching challenge...';

			// fetch challenge options from server
			const challengeResponse = await fetch(challengeUrl);
			if (!challengeResponse.ok) {
				throw new Error('Failed to fetch challenge');
			}

			/** @type {PublicKeyCredentialRequestOptionsJSON} */
			const options = await challengeResponse.json();

			status.textContent = 'Waiting for passkey...';

			// convert options to the format expected by navigator.credentials.get
			// omit allowCredentials for discoverable flow
			const { allowCredentials: _, ...rest } = options;

			/** @type {PublicKeyCredentialRequestOptions} */
			const publicKeyOptions = {
				...rest,
				challenge: fromBase64Url(options.challenge),
			};

			const credential = /** @type {PublicKeyCredential | null} */ (
				await navigator.credentials.get({ publicKey: publicKeyOptions })
			);

			if (!credential) {
				status.textContent = 'Authentication cancelled';
				if (startButton) {
					startButton.disabled = false;
				}
				return;
			}

			const response = /** @type {AuthenticatorAssertionResponse} */ (credential.response);

			// serialize the response for the server
			// TODO: investigate if we can avoid double JSON encoding (stringified JSON in form field)
			const serialized = JSON.stringify({
				id: credential.id,
				rawId: toBase64Url(credential.rawId),
				type: credential.type,
				response: {
					clientDataJSON: toBase64Url(response.clientDataJSON),
					authenticatorData: toBase64Url(response.authenticatorData),
					signature: toBase64Url(response.signature),
					userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
				},
				clientExtensionResults: credential.getClientExtensionResults(),
			});

			responseInput.value = serialized;
			status.textContent = 'Passkey verified!';

			// submit the form
			this.formElement?.submit();
		} catch (err) {
			if (startButton) {
				startButton.disabled = false;
			}

			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					status.textContent = 'Authentication was cancelled or timed out. Please try again.';
				} else {
					status.textContent = `Authentication failed: ${err.message}`;
				}
			} else {
				status.textContent = 'Authentication failed. Please try again.';
			}
			console.error('Passkey login error:', err);
		}
	}
}

customElements.define('danaus-passkey-login', PasskeyLoginElement);

/**
 * @typedef {object} PublicKeyCredentialRequestOptionsJSON
 * @property {string} challenge
 * @property {number} [timeout]
 * @property {string} [rpId]
 * @property {Array<{id: string, type: 'public-key', transports?: AuthenticatorTransport[]}>} [allowCredentials]
 * @property {UserVerificationRequirement} [userVerification]
 */
