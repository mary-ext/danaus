import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render, type JSXNode } from '@oomfware/jsx';

import { PreferredMfa } from '#app/accounts/db/schema.ts';
import type { MfaStatus } from '#app/accounts/manager.ts';
import {
	RECOVERY_CODE_LENGTH,
	RECOVERY_CODE_RE,
	TOTP_CODE_LENGTH,
	TOTP_CODE_RE,
} from '#app/accounts/totp.ts';
import { generateWebAuthnAuthenticationOptions } from '#app/accounts/webauthn.ts';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import Button from '#web/primitives/button.tsx';
import Field from '#web/primitives/field.tsx';
import Input from '#web/primitives/input.tsx';
import MenuItem from '#web/primitives/menu-item.tsx';
import MenuList from '#web/primitives/menu-list.tsx';
import MenuPopover from '#web/primitives/menu-popover.tsx';
import MenuTrigger from '#web/primitives/menu-trigger.tsx';
import Menu from '#web/primitives/menu.tsx';
import { routes } from '#web/routes.ts';

import { verifyMfaLoginForm, verifyWebAuthnMfaForm, type AuthFactor } from './lib/forms.ts';

export default {
	middleware: [forms({ verifyMfaLoginForm, verifyWebAuthnMfaForm })],
	actions: {
		index({ url }) {
			const { accountManager } = getAppContext();

			const redirectUrl = url.searchParams.get('redirect');
			const token = url.searchParams.get('token');
			if (token === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaChallenge = accountManager.getMfaChallenge(token);
			if (mfaChallenge === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaStatus = accountManager.getMfaStatus(mfaChallenge.did);
			if (mfaStatus === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			switch (mfaStatus.preferred) {
				case PreferredMfa.WebAuthn: {
					redirect(routes.login.mfa.webauthn.href(undefined, { token: token, redirect: redirectUrl }));
				}
				case PreferredMfa.Totp: {
					redirect(routes.login.mfa.totp.href(undefined, { token: token, redirect: redirectUrl }));
				}
			}
		},
		totp({ url }) {
			const { accountManager } = getAppContext();

			const { fields } = verifyMfaLoginForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			const challenge = url.searchParams.get('token') ?? fields.challenge.value();
			if (challenge == null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaChallenge = accountManager.getMfaChallenge(challenge);
			if (mfaChallenge === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaStatus = accountManager.getMfaStatus(mfaChallenge.did);
			if (mfaStatus === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			return render(
				<BaseForm factor="totp" challenge={challenge} redirectUrl={redirectUrl} mfaStatus={mfaStatus}>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">Two-factor authentication</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter the 6-digit code from your authenticator app.
						</p>
					</div>

					<Field label="Verification code" validationMessageText={fields.allIssues()?.at(0)?.message}>
						<Input
							{...fields._code.as('text')}
							placeholder="000000"
							autocomplete="one-time-code"
							inputmode="numeric"
							pattern={TOTP_CODE_RE.source}
							minlength={TOTP_CODE_LENGTH}
							maxlength={TOTP_CODE_LENGTH}
							required
							autofocus
						/>
					</Field>

					<Button type="submit" variant="primary">
						Confirm
					</Button>
				</BaseForm>,
			);
		},
		async webauthn({ url }) {
			const { accountManager, config } = getAppContext();

			const { fields } = verifyWebAuthnMfaForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			const challenge = url.searchParams.get('token') ?? fields.challenge.value();
			if (challenge == null || accountManager.getMfaChallenge(challenge) === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaChallenge = accountManager.getMfaChallenge(challenge)!;

			// get user's WebAuthn credentials (security keys or passkeys)
			const webauthnCredentials = accountManager.listWebAuthnCredentials(mfaChallenge.did);
			if (webauthnCredentials.length === 0) {
				// no WebAuthn credentials, redirect to TOTP
				redirect(routes.login.mfa.totp.href(undefined, { token: challenge, redirect: redirectUrl }));
			}

			// generate authentication options
			const options = await generateWebAuthnAuthenticationOptions({
				rpId: new URL(config.service.publicUrl).hostname,
				allowCredentials: webauthnCredentials,
			});

			// store the challenge for verification
			accountManager.setMfaChallengeWebAuthn(challenge, options.challenge);

			return render(
				<BaseLayout>
					<title>Two-factor authentication - Danaus</title>

					<script src="/assets/webauthn-authenticate.js" type="module" />

					<div class="flex flex-1 items-center justify-center p-4">
						<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
							<form {...verifyWebAuthnMfaForm} class="flex flex-col gap-6">
								<input {...fields.challenge.as('hidden', challenge)} />
								<input {...fields.redirect.as('hidden', redirectUrl ?? routes.account.overview.href())} />

								<div class="flex flex-col gap-2">
									<h1 class="text-base-500 font-semibold">Two-factor authentication</h1>
									<p class="text-base-300 text-neutral-foreground-3">
										Insert your security key and touch it to verify your identity.
									</p>
								</div>

								<danaus-webauthn-authenticate data-options={JSON.stringify(options)}>
									<input {...fields.response.as('hidden', '')} data-target="webauthn-authenticate.response" />

									<Button data-target="webauthn-authenticate.start" type="button" variant="primary">
										Use security key
									</Button>

									<div
										data-target="webauthn-authenticate.status"
										class="text-center text-base-300 text-neutral-foreground-3"
									/>
								</danaus-webauthn-authenticate>

								<Menu>
									<MenuTrigger>
										<Button>Show other methods</Button>
									</MenuTrigger>

									<MenuPopover>
										<MenuList>
											<MenuItem
												href={routes.login.mfa.totp.href(undefined, {
													token: challenge,
													redirect: redirectUrl,
												})}
											>
												Use authenticator app
											</MenuItem>

											<MenuItem
												href={routes.login.mfa.recovery.href(undefined, {
													token: challenge,
													redirect: redirectUrl,
												})}
											>
												Use 2FA recovery code
											</MenuItem>
										</MenuList>
									</MenuPopover>
								</Menu>
							</form>
						</div>
					</div>
				</BaseLayout>,
			);
		},
		recovery({ url }) {
			const { accountManager } = getAppContext();

			const { fields } = verifyMfaLoginForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			const challenge = url.searchParams.get('token') ?? fields.challenge.value();
			if (challenge == null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaChallenge = accountManager.getMfaChallenge(challenge);
			if (mfaChallenge === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			const mfaStatus = accountManager.getMfaStatus(mfaChallenge.did);
			if (mfaStatus === null) {
				redirect(routes.login.show.href(undefined, { redirect: redirectUrl }));
			}

			return render(
				<BaseForm factor="recovery" challenge={challenge} redirectUrl={redirectUrl} mfaStatus={mfaStatus}>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">Two-factor authentication</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter one of your recovery codes to verify your identity.
						</p>
					</div>

					<Field label="Recovery code" validationMessageText={fields.allIssues()?.at(0)?.message}>
						<Input
							{...fields._code.as('text')}
							placeholder="XXXX-XXXX"
							pattern={RECOVERY_CODE_RE.source}
							minlength={RECOVERY_CODE_LENGTH}
							maxlength={RECOVERY_CODE_LENGTH + 1}
							required
							autofocus
						/>
					</Field>

					<Button type="submit" variant="primary">
						Confirm
					</Button>
				</BaseForm>,
			);
		},
	},
} satisfies Controller<typeof routes.login.mfa>;

const BaseForm = (props: {
	factor: AuthFactor;
	challenge: string;
	redirectUrl: string | undefined;
	mfaStatus: MfaStatus;
	children: JSXNode;
}) => {
	const { fields } = verifyMfaLoginForm;

	const challenge = props.challenge;
	const redirectUrl = props.redirectUrl ?? routes.account.overview.href();
	const { mfaStatus } = props;

	// count how many other methods are available
	const otherMethodsCount =
		(props.factor !== 'webauthn' && mfaStatus.hasWebAuthn ? 1 : 0) +
		(props.factor !== 'totp' && mfaStatus.hasTotp ? 1 : 0) +
		(props.factor !== 'recovery' && mfaStatus.hasRecoveryCodes ? 1 : 0);

	return (
		<BaseLayout>
			<title>Two-factor authentication - Danaus</title>

			<div class="flex flex-1 items-center justify-center p-4">
				<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
					<form {...verifyMfaLoginForm} class="flex flex-col gap-6">
						<input {...fields.challenge.as('hidden', challenge)} />
						<input {...fields.redirect.as('hidden', redirectUrl)} />
						<input {...fields.factor.as('hidden', props.factor)} />

						{props.children}

						{otherMethodsCount > 0 && (
							<Menu>
								<MenuTrigger>
									<Button>Show other methods</Button>
								</MenuTrigger>

								<MenuPopover>
									<MenuList>
										{props.factor !== 'webauthn' && mfaStatus.hasWebAuthn && (
											<MenuItem
												href={routes.login.mfa.webauthn.href(undefined, {
													token: challenge,
													redirect: redirectUrl,
												})}
											>
												Use security key
											</MenuItem>
										)}

										{props.factor !== 'totp' && mfaStatus.hasTotp && (
											<MenuItem
												href={routes.login.mfa.totp.href(undefined, {
													token: challenge,
													redirect: redirectUrl,
												})}
											>
												Use authenticator app
											</MenuItem>
										)}

										{props.factor !== 'recovery' && mfaStatus.hasRecoveryCodes && (
											<MenuItem
												href={routes.login.mfa.recovery.href(undefined, {
													token: challenge,
													redirect: redirectUrl,
												})}
											>
												Use 2FA recovery code
											</MenuItem>
										)}
									</MenuList>
								</MenuPopover>
							</Menu>
						)}
					</form>
				</div>
			</div>
		</BaseLayout>
	);
};
