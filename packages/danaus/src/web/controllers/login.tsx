import type { Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { generateWebAuthnAuthenticationOptions } from '#app/accounts/webauthn.ts';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { Button, Checkbox, Field, Input } from '#web/primitives/index.ts';
import { routes } from '#web/routes.ts';

import { loginForm, passkeyLoginForm } from './login/lib/forms.ts';

export default {
	middleware: [],
	actions: {
		index: {
			middleware: [forms({ loginForm, passkeyLoginForm })],
			action({ url }) {
				const { fields } = loginForm;
				const passkeyFields = passkeyLoginForm.fields;

				const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();

				return render(
					<BaseLayout>
						<title>Sign in - Danaus</title>

						<script type="module" src={routes.assets.href({ path: 'webauthn-passkey-login.js' })} />

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
								<form {...loginForm} class="flex flex-col gap-6">
									<h1 class="text-base-500 font-semibold">Sign in to your account</h1>

									<input {...fields.redirect.as('hidden', redirectUrl ?? routes.account.overview.href())} />

									<Field
										label="Handle or email"
										required
										validationMessageText={fields.identifier.issues()?.[0]?.message}
									>
										<Input
											{...fields.identifier.as('text')}
											autocomplete="username"
											placeholder="alice.bsky.social"
											required
											autofocus
										/>
									</Field>

									<Field
										label="Password"
										required
										validationMessageText={fields._password.issues()?.[0]?.message}
									>
										<Input {...fields._password.as('password')} autocomplete="current-password" required />
									</Field>

									<Checkbox name="remember" value="true">
										Remember this device
									</Checkbox>

									<Button type="submit" variant="primary">
										Sign in
									</Button>
								</form>

								<danaus-passkey-login
									class="contents"
									data-challenge-url={routes.login.passkey.challenge.href()}
								>
									<div class="flex items-center gap-4 py-4">
										<div class="h-px flex-1 bg-neutral-stroke-2" />
										<span class="text-base-200 text-neutral-foreground-3">or</span>
										<div class="h-px flex-1 bg-neutral-stroke-2" />
									</div>

									<form {...passkeyLoginForm} class="contents" data-target="passkey-login.form">
										<input
											{...passkeyFields.redirect.as('hidden', redirectUrl ?? routes.account.overview.href())}
										/>
										<input
											{...passkeyFields.response.as('hidden', '')}
											data-target="passkey-login.response"
										/>

										<Button disabled data-target="passkey-login.start">
											Sign in with passkey
										</Button>

										<p
											data-target="passkey-login.status"
											class="mt-2 text-center text-base-200 text-neutral-foreground-3 empty:hidden"
										/>
									</form>
								</danaus-passkey-login>
							</div>
						</div>
					</BaseLayout>,
				);
			},
		},
		passkey: {
			async challenge() {
				const { accountManager, config } = getAppContext();

				// generate discoverable authentication options (no allowCredentials)
				const options = await generateWebAuthnAuthenticationOptions({
					rpId: config.service.hostname,
					userVerificationRequired: true,
				});

				// store challenge for verification (using null DID since we don't know the user yet)
				// we'll use the challenge itself as a lookup key
				accountManager.createPasskeyLoginChallenge(options.challenge);

				return Response.json(options);
			},
		},
	},
} satisfies Controller<typeof routes.login>;
