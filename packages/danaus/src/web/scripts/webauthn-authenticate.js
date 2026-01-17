// @ts-check

import { fromBase64Url, toBase64Url } from './base64url.js';

/**
 * WebAuthn authentication element.
 *
 * @attr {string} data-options - JSON PublicKeyCredentialRequestOptions
 */
class WebAuthnAuthenticateElement extends HTMLElement {
	/** @type {PublicKeyCredentialRequestOptionsJSON | null} */
	#options = null;

	/** @type {HTMLButtonElement | null} */
	get startButton() {
		return this.querySelector('[data-target="webauthn-authenticate.start"]');
	}

	/** @type {HTMLInputElement | null} */
	get responseInput() {
		return this.querySelector('[data-target="webauthn-authenticate.response"]');
	}

	/** @type {HTMLElement | null} */
	get statusElement() {
		return this.querySelector('[data-target="webauthn-authenticate.status"]');
	}

	connectedCallback() {
		const optionsJson = this.dataset.options;
		if (!optionsJson) {
			return;
		}

		this.#options = JSON.parse(optionsJson);

		const startButton = this.startButton;
		if (startButton) {
			startButton.addEventListener('click', (e) => {
				e.preventDefault();
				this.#handleAuthentication();
			});
		}
	}

	async #handleAuthentication() {
		const options = this.#options;
		const status = this.statusElement;
		const responseInput = this.responseInput;
		const startButton = this.startButton;

		if (!options || !status || !responseInput) {
			console.error('WebAuthn authenticate: missing required elements');
			return;
		}

		try {
			if (startButton) {
				startButton.disabled = true;
			}
			status.textContent = 'Waiting for security key...';

			// convert options to the format expected by navigator.credentials.get
			/** @type {PublicKeyCredentialRequestOptions} */
			const publicKeyOptions = {
				...options,
				challenge: fromBase64Url(options.challenge),
				allowCredentials: options.allowCredentials?.map((cred) => ({
					...cred,
					id: fromBase64Url(cred.id),
				})),
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
			status.textContent = 'Security key verified!';

			// auto-submit the form
			this.closest('form')?.submit();
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
			console.error('WebAuthn authentication error:', err);
		}
	}
}

customElements.define('danaus-webauthn-authenticate', WebAuthnAuthenticateElement);

/**
 * @typedef {object} PublicKeyCredentialRequestOptionsJSON
 * @property {string} challenge
 * @property {number} [timeout]
 * @property {string} [rpId]
 * @property {Array<{id: string, type: 'public-key', transports?: AuthenticatorTransport[]}>} [allowCredentials]
 * @property {UserVerificationRequirement} [userVerification]
 */
