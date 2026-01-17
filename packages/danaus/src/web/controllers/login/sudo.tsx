import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render, type JSXNode } from '@oomfware/jsx';

import { PreferredMfa } from '#app/accounts/db/schema.ts';
import {
	RECOVERY_CODE_LENGTH,
	RECOVERY_CODE_RE,
	TOTP_CODE_LENGTH,
	TOTP_CODE_RE,
} from '#app/accounts/totp.ts';
import { generateWebAuthnAuthenticationOptions } from '#app/accounts/webauthn.ts';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession, requireSession } from '#web/middlewares/session.ts';
import Button from '#web/primitives/button.tsx';
import Field from '#web/primitives/field.tsx';
import Input from '#web/primitives/input.tsx';
import MenuItem from '#web/primitives/menu-item.tsx';
import MenuList from '#web/primitives/menu-list.tsx';
import MenuPopover from '#web/primitives/menu-popover.tsx';
import MenuTrigger from '#web/primitives/menu-trigger.tsx';
import Menu from '#web/primitives/menu.tsx';
import { routes } from '#web/routes.ts';

import { verifySudoForm, verifyWebAuthnSudoForm, type AuthFactor } from './lib/forms.ts';

export default {
	middleware: [requireSession(), forms({ verifySudoForm, verifyWebAuthnSudoForm })],
	actions: {
		index({ url }): never {
			const { accountManager } = getAppContext();
			const session = getSession();

			const redirectUrl = url.searchParams.get('redirect');
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			const isElevated = accountManager.isSessionElevated(session);
			if (isElevated) {
				redirect(redirectUrl);
			}

			const mfaStatus = accountManager.getMfaStatus(session.did);
			if (mfaStatus === null) {
				redirect(routes.login.sudo.password.href(undefined, { redirect: redirectUrl }));
			}

			switch (mfaStatus.preferred) {
				case PreferredMfa.WebAuthn: {
					redirect(routes.login.sudo.webauthn.href(undefined, { redirect: redirectUrl }));
				}
				case PreferredMfa.Totp: {
					redirect(routes.login.sudo.totp.href(undefined, { redirect: redirectUrl }));
				}
			}
		},
		totp({ url }) {
			const { accountManager } = getAppContext();
			const session = getSession();

			const { fields } = verifySudoForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			if (accountManager.getMfaStatus(session.did) === null) {
				redirect(routes.login.sudo.index.href(undefined, { redirect: redirectUrl }));
			}

			return render(
				<BaseForm factor="totp" redirectUrl={redirectUrl}>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">Confirm your identity</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter the 6-digit code from your authenticator app to continue.
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
		recovery({ url }) {
			const { accountManager } = getAppContext();
			const session = getSession();

			const { fields } = verifySudoForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			if (accountManager.getMfaStatus(session.did) === null) {
				redirect(routes.login.sudo.index.href(undefined, { redirect: redirectUrl }));
			}

			return render(
				<BaseForm factor="recovery" redirectUrl={redirectUrl}>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">Confirm your identity</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter one of your recovery codes to continue.
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
		async webauthn({ url }) {
			const { accountManager, config } = getAppContext();
			const session = getSession();

			const { fields } = verifyWebAuthnSudoForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			if (accountManager.getMfaStatus(session.did) === null) {
				redirect(routes.login.sudo.index.href(undefined, { redirect: redirectUrl }));
			}

			// get user's WebAuthn credentials (security keys or passkeys)
			const webauthnCredentials = accountManager.listWebAuthnCredentials(session.did);
			if (webauthnCredentials.length === 0) {
				// no WebAuthn credentials, redirect to TOTP
				redirect(routes.login.sudo.totp.href(undefined, { redirect: redirectUrl }));
			}

			// generate authentication options
			const options = await generateWebAuthnAuthenticationOptions({
				rpId: new URL(config.service.publicUrl).hostname,
				allowCredentials: webauthnCredentials,
			});

			// store the challenge for verification (reuse webauthn challenge table)
			const challengeToken = accountManager.createWebAuthnChallenge(session.did, options.challenge);

			return render(
				<BaseLayout>
					<title>Confirm your identity - Danaus</title>

					<script src="/assets/webauthn-authenticate.js" type="module" />

					<div class="flex flex-1 items-center justify-center p-4">
						<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
							<form {...verifyWebAuthnSudoForm} class="flex flex-col gap-6">
								<input {...fields.challenge.as('hidden', challengeToken)} />
								<input {...fields.redirect.as('hidden', redirectUrl)} />

								<div class="flex flex-col gap-2">
									<h1 class="text-base-500 font-semibold">Confirm your identity</h1>
									<p class="text-base-300 text-neutral-foreground-3">
										Insert your security key and touch it to continue.
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
											<MenuItem href={routes.login.sudo.totp.href(undefined, { redirect: redirectUrl })}>
												Use authenticator app
											</MenuItem>

											<MenuItem href={routes.login.sudo.recovery.href(undefined, { redirect: redirectUrl })}>
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
		password({ url }) {
			const { accountManager } = getAppContext();
			const session = getSession();

			const { fields } = verifySudoForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			if (accountManager.getMfaStatus(session.did) !== null) {
				redirect(routes.login.sudo.index.href(undefined, { redirect: redirectUrl }));
			}

			return render(
				<BaseForm factor="password" redirectUrl={redirectUrl}>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">Confirm your identity</h1>
						<p class="text-base-300 text-neutral-foreground-3">Enter your password to continue.</p>
					</div>

					<Field label="Password" validationMessageText={fields.allIssues()?.at(0)?.message}>
						<Input {...fields._code.as('password')} autocomplete="current-password" required autofocus />
					</Field>

					<Button type="submit" variant="primary">
						Confirm
					</Button>
				</BaseForm>,
			);
		},
	},
} satisfies Controller<typeof routes.login.sudo>;

const BaseForm = (props: { factor: AuthFactor; redirectUrl: string; children: JSXNode }) => {
	const { accountManager } = getAppContext();
	const { did } = getSession();

	const { fields } = verifySudoForm;

	const mfaStatus = accountManager.getMfaStatus(did);

	return (
		<BaseLayout>
			<title>Confirm your identity - Danaus</title>

			<div class="flex flex-1 items-center justify-center p-4">
				<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
					<form {...verifySudoForm} class="flex flex-col gap-6">
						<input {...fields.redirect.as('hidden', props.redirectUrl)} />
						<input {...fields.factor.as('hidden', props.factor)} />

						{props.children}

						{mfaStatus !== null && (
							<Menu>
								<MenuTrigger>
									<Button>Show other methods</Button>
								</MenuTrigger>

								<MenuPopover>
									<MenuList>
										{props.factor !== 'webauthn' && mfaStatus.hasWebAuthn && (
											<MenuItem
												href={routes.login.sudo.webauthn.href(undefined, {
													redirect: props.redirectUrl,
												})}
											>
												Use security key
											</MenuItem>
										)}

										{props.factor !== 'totp' && mfaStatus.hasTotp && (
											<MenuItem
												href={routes.login.sudo.totp.href(undefined, {
													redirect: props.redirectUrl,
												})}
											>
												Use authenticator app
											</MenuItem>
										)}

										{props.factor !== 'recovery' && mfaStatus.hasRecoveryCodes && (
											<MenuItem
												href={routes.login.sudo.recovery.href(undefined, {
													redirect: props.redirectUrl,
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
