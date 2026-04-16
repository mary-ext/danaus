import { fromBase64Url, toBase64Url } from '@atcute/multibase';

/**
 * webauthn authentication element.
 *
 * @attr {string} data-options - json PublicKeyCredentialRequestOptions
 */
class WebAuthnAuthenticateElement extends HTMLElement {
	#options: PublicKeyCredentialRequestOptionsJson | null = null;

	get startButton(): HTMLButtonElement | null {
		return this.querySelector('[data-target="webauthn-authenticate.start"]');
	}

	get responseInput(): HTMLInputElement | null {
		return this.querySelector('[data-target="webauthn-authenticate.response"]');
	}

	get statusElement(): HTMLElement | null {
		return this.querySelector('[data-target="webauthn-authenticate.status"]');
	}

	get formElement(): HTMLFormElement | null {
		return this.querySelector('[data-target="webauthn-authenticate.form"]');
	}

	connectedCallback() {
		const optionsJson = this.dataset.options;
		if (!optionsJson) {
			return;
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- trusted dataset JSON
		this.#options = JSON.parse(optionsJson) as PublicKeyCredentialRequestOptionsJson;

		const startButton = this.startButton;
		if (startButton) {
			// enable the button now that js is loaded
			startButton.disabled = false;
			startButton.addEventListener('click', (event) => {
				event.preventDefault();
				void this.#handleAuthentication();
			});
		}
	}

	async #handleAuthentication() {
		const options = this.#options;
		const status = this.statusElement;
		const responseInput = this.responseInput;
		const startButton = this.startButton;

		if (!options || !status || !responseInput) {
			console.error('webauthn authenticate: missing required elements');
			return;
		}

		try {
			if (startButton) {
				startButton.disabled = true;
			}
			status.textContent = '';

			const publicKeyOptions: PublicKeyCredentialRequestOptions = {
				...options,
				challenge: fromBase64Url(options.challenge),
				// oxlint-disable-next-line no-map-spread -- immutable credential transform
				allowCredentials: options.allowCredentials?.map((credential) => ({
					...credential,
					id: fromBase64Url(credential.id),
				})),
			};

			// oxlint-disable-next-line no-unsafe-type-assertion -- WebAuthn API returns PublicKeyCredential
			const credential = (await navigator.credentials.get({
				publicKey: publicKeyOptions,
			})) as PublicKeyCredential | null;

			if (!credential) {
				status.textContent = 'Authentication cancelled';
				if (startButton) {
					startButton.disabled = false;
				}
				return;
			}

			// oxlint-disable-next-line no-unsafe-type-assertion -- WebAuthn get response type
			const response = credential.response as AuthenticatorAssertionResponse;

			const serialized = JSON.stringify({
				id: credential.id,
				rawId: toBase64Url(new Uint8Array(credential.rawId)),
				type: credential.type,
				response: {
					clientDataJSON: toBase64Url(new Uint8Array(response.clientDataJSON)),
					authenticatorData: toBase64Url(new Uint8Array(response.authenticatorData)),
					signature: toBase64Url(new Uint8Array(response.signature)),
					userHandle: response.userHandle ? toBase64Url(new Uint8Array(response.userHandle)) : null,
				},
				clientExtensionResults: credential.getClientExtensionResults(),
			});

			responseInput.value = serialized;

			this.formElement?.submit();
		} catch (err) {
			console.error('[webauthn-authenticate] error:', err);

			if (startButton) {
				startButton.disabled = false;
			}

			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					status.textContent = 'Authentication cancelled';
					return;
				} else {
					status.textContent = `Authentication failed: ${err.message}`;
				}
			} else {
				status.textContent = 'Authentication failed. Please try again.';
			}
		}
	}
}

customElements.define('danaus-webauthn-authenticate', WebAuthnAuthenticateElement);

type PublicKeyCredentialRequestOptionsJson = {
	challenge: string;
	timeout?: number;
	rpId?: string;
	allowCredentials?: Array<{
		id: string;
		type: 'public-key';
		transports?: AuthenticatorTransport[];
	}>;
	userVerification?: UserVerificationRequirement;
};
