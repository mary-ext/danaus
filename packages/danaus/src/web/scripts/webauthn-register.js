// @ts-check

import { fromBase64Url, toBase64Url } from './base64url.js';

/**
 * WebAuthn registration element.
 *
 * @attr {string} data-options - JSON PublicKeyCredentialCreationOptions
 */
class WebAuthnRegisterElement extends HTMLElement {
	/** @type {HTMLInputElement | null} */
	get responseInput() {
		return this.querySelector('[data-target="webauthn-register.response"]');
	}

	/** @type {HTMLButtonElement | null} */
	get submitButton() {
		return this.querySelector('[data-target="webauthn-register.submit"]');
	}

	/** @type {HTMLElement | null} */
	get statusElement() {
		return this.querySelector('[data-target="webauthn-register.status"]');
	}

	connectedCallback() {
		const options = this.dataset.options;
		if (options) {
			this.#handleRegistration(JSON.parse(options));
		}
	}

	/**
	 * @param {PublicKeyCredentialCreationOptionsJSON} options
	 */
	async #handleRegistration(options) {
		const status = this.statusElement;
		const submitButton = this.submitButton;
		const responseInput = this.responseInput;

		if (!status || !submitButton || !responseInput) {
			console.error('WebAuthn register: missing required elements');
			return;
		}

		try {
			status.textContent = 'Waiting for security key...';

			// convert options to the format expected by navigator.credentials.create
			/** @type {PublicKeyCredentialCreationOptions} */
			const publicKeyOptions = {
				...options,
				challenge: fromBase64Url(options.challenge),
				user: {
					...options.user,
					id: fromBase64Url(options.user.id),
				},
				excludeCredentials: options.excludeCredentials?.map((cred) => ({
					...cred,
					id: fromBase64Url(cred.id),
				})),
			};

			const credential = /** @type {PublicKeyCredential | null} */ (
				await navigator.credentials.create({ publicKey: publicKeyOptions })
			);

			if (!credential) {
				status.textContent = 'Registration cancelled';
				return;
			}

			const response = /** @type {AuthenticatorAttestationResponse} */ (credential.response);

			// serialize the response for the server
			const serialized = JSON.stringify({
				id: credential.id,
				rawId: toBase64Url(credential.rawId),
				type: credential.type,
				response: {
					clientDataJSON: toBase64Url(response.clientDataJSON),
					attestationObject: toBase64Url(response.attestationObject),
					transports: response.getTransports?.() ?? [],
				},
				clientExtensionResults: credential.getClientExtensionResults(),
			});

			responseInput.value = serialized;
			submitButton.disabled = false;
			status.textContent = 'Security key registered! Click Save to continue.';
		} catch (err) {
			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					status.textContent = 'Registration was cancelled or timed out. Please try again.';
				} else if (err.name === 'InvalidStateError') {
					status.textContent = 'This security key is already registered.';
				} else {
					status.textContent = `Registration failed: ${err.message}`;
				}
			} else {
				status.textContent = 'Registration failed. Please try again.';
			}
			console.error('WebAuthn registration error:', err);
		}
	}
}

customElements.define('danaus-webauthn-register', WebAuthnRegisterElement);

/**
 * @typedef {object} PublicKeyCredentialCreationOptionsJSON
 * @property {string} challenge
 * @property {object} rp
 * @property {string} rp.name
 * @property {string} [rp.id]
 * @property {object} user
 * @property {string} user.id
 * @property {string} user.name
 * @property {string} user.displayName
 * @property {PublicKeyCredentialParameters[]} pubKeyCredParams
 * @property {number} [timeout]
 * @property {Array<{id: string, type: 'public-key', transports?: AuthenticatorTransport[]}>} [excludeCredentials]
 * @property {AuthenticatorSelectionCriteria} [authenticatorSelection]
 * @property {AttestationConveyancePreference} [attestation]
 */
