import { fromBase64Url, toBase64Url } from '@atcute/multibase';

/**
 * passkey login element - fetches challenge and handles discoverable credential authentication.
 *
 * @attr {string} data-challenge-url - url to fetch authentication challenge from
 */
class PasskeyLoginElement extends HTMLElement {
	get startButton(): HTMLButtonElement | null {
		return this.querySelector('[data-target="passkey-login.start"]');
	}

	get responseInput(): HTMLInputElement | null {
		return this.querySelector('[data-target="passkey-login.response"]');
	}

	get statusElement(): HTMLElement | null {
		return this.querySelector('[data-target="passkey-login.status"]');
	}

	get formElement(): HTMLFormElement | null {
		return this.querySelector('[data-target="passkey-login.form"]');
	}

	connectedCallback() {
		const challengeUrl = this.dataset.challengeUrl;
		if (!challengeUrl) {
			return;
		}

		const startButton = this.startButton;
		if (startButton) {
			// enable the button now that js is loaded
			startButton.disabled = false;
			startButton.addEventListener('click', (event) => {
				event.preventDefault();
				void this.#handlePasskeyLogin(challengeUrl);
			});
		}
	}

	async #handlePasskeyLogin(challengeUrl: string) {
		const status = this.statusElement;
		const responseInput = this.responseInput;
		const startButton = this.startButton;

		if (!status || !responseInput) {
			console.error('passkey login: missing required elements');
			return;
		}

		try {
			if (startButton) {
				startButton.disabled = true;
			}

			const challengeResponse = await fetch(challengeUrl);
			if (!challengeResponse.ok) {
				throw new Error('Failed to fetch challenge');
			}

			// oxlint-disable-next-line no-unsafe-type-assertion -- trusted API JSON response
			const options = (await challengeResponse.json()) as PublicKeyCredentialRequestOptionsJson;

			status.textContent = '';

			const publicKeyOptions: PublicKeyCredentialRequestOptions = {
				...options,
				challenge: fromBase64Url(options.challenge),
				allowCredentials: undefined,
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
			if (startButton) {
				startButton.disabled = false;
			}

			if (err instanceof Error) {
				if (err.message.includes('timed out')) {
					return;
				} else {
					status.textContent = `Authentication failed: ${err.message}`;
				}
			} else {
				status.textContent = 'Authentication failed. Please try again.';
			}

			console.error('passkey login error:', err);
		}
	}
}

customElements.define('danaus-passkey-login', PasskeyLoginElement);

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
