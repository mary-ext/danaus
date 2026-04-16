import { fromBase64Url, toBase64Url } from '@atcute/multibase';

/**
 * webauthn registration element.
 *
 * @attr {string} data-options - json PublicKeyCredentialCreationOptions
 */
class WebAuthnRegisterElement extends HTMLElement {
	#options: PublicKeyCredentialCreationOptionsJson | null = null;

	get startButton(): HTMLButtonElement | null {
		return this.querySelector('[data-target="webauthn-register.start"]');
	}

	get responseInput(): HTMLInputElement | null {
		return this.querySelector('[data-target="webauthn-register.response"]');
	}

	get statusElement(): HTMLElement | null {
		return this.querySelector('[data-target="webauthn-register.status"]');
	}

	get formElement(): HTMLFormElement | null {
		return this.querySelector('form');
	}

	connectedCallback() {
		const optionsJson = this.dataset.options;
		if (!optionsJson) {
			return;
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- trusted dataset JSON
		this.#options = JSON.parse(optionsJson) as PublicKeyCredentialCreationOptionsJson;

		const startButton = this.startButton;
		if (startButton) {
			startButton.disabled = false;
			startButton.addEventListener('click', (event) => {
				event.preventDefault();
				void this.#handleRegistration();
			});
		}
	}

	async #handleRegistration() {
		const options = this.#options;
		const status = this.statusElement;
		const startButton = this.startButton;
		const responseInput = this.responseInput;

		if (!options || !status || !responseInput) {
			console.error('webauthn register: missing required elements');
			return;
		}

		try {
			if (startButton) {
				startButton.disabled = true;
			}
			status.textContent = '';

			const publicKeyOptions: PublicKeyCredentialCreationOptions = {
				...options,
				challenge: fromBase64Url(options.challenge),
				user: {
					...options.user,
					id: fromBase64Url(options.user.id),
				},
				// oxlint-disable-next-line no-map-spread -- immutable credential transform
				excludeCredentials: options.excludeCredentials?.map((credential) => ({
					...credential,
					id: fromBase64Url(credential.id),
				})),
			};

			// oxlint-disable-next-line no-unsafe-type-assertion -- WebAuthn API returns PublicKeyCredential
			const credential = (await navigator.credentials.create({
				publicKey: publicKeyOptions,
			})) as PublicKeyCredential | null;

			if (!credential) {
				status.textContent = 'Registration cancelled';
				if (startButton) {
					startButton.disabled = false;
				}
				return;
			}

			// oxlint-disable-next-line no-unsafe-type-assertion -- WebAuthn create response type
			const response = credential.response as AuthenticatorAttestationResponse;

			const serialized = JSON.stringify({
				id: credential.id,
				rawId: toBase64Url(new Uint8Array(credential.rawId)),
				type: credential.type,
				response: {
					clientDataJSON: toBase64Url(new Uint8Array(response.clientDataJSON)),
					attestationObject: toBase64Url(new Uint8Array(response.attestationObject)),
					transports: response.getTransports?.() ?? [],
				},
				clientExtensionResults: credential.getClientExtensionResults(),
			});

			responseInput.value = serialized;
			status.textContent = 'Security key registered!';

			this.formElement?.submit();
		} catch (err) {
			if (startButton) {
				startButton.disabled = false;
			}

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
			console.error('webauthn registration error:', err);
		}
	}
}

customElements.define('danaus-webauthn-register', WebAuthnRegisterElement);

type PublicKeyCredentialCreationOptionsJson = {
	challenge: string;
	rp: {
		name: string;
		id?: string;
	};
	user: {
		id: string;
		name: string;
		displayName: string;
	};
	pubKeyCredParams: PublicKeyCredentialParameters[];
	timeout?: number;
	excludeCredentials?: Array<{
		id: string;
		type: 'public-key';
		transports?: AuthenticatorTransport[];
	}>;
	authenticatorSelection?: AuthenticatorSelectionCriteria;
	attestation?: AttestationConveyancePreference;
};
