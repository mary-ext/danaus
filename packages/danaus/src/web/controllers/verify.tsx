import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render, type JSXNode } from '@oomfware/jsx';

import { PreferredMfa } from '#app/accounts/db/schema.ts';
import type { MfaStatus, VerifyChallenge } from '#app/accounts/manager.ts';
import {
	RECOVERY_CODE_LENGTH,
	RECOVERY_CODE_RE,
	TOTP_CODE_LENGTH,
	TOTP_CODE_RE,
} from '#app/accounts/totp.ts';
import { generateWebAuthnAuthenticationOptions } from '#app/accounts/webauthn.ts';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { tryGetSession } from '#web/middlewares/session.ts';
import Button from '#web/primitives/button.tsx';
import Field from '#web/primitives/field.tsx';
import Input from '#web/primitives/input.tsx';
import MenuItem from '#web/primitives/menu-item.tsx';
import MenuList from '#web/primitives/menu-list.tsx';
import MenuPopover from '#web/primitives/menu-popover.tsx';
import MenuTrigger from '#web/primitives/menu-trigger.tsx';
import Menu from '#web/primitives/menu.tsx';
import { routes } from '#web/routes.ts';

import { verifyForm, verifyWebAuthnForm, type AuthFactor } from './login/lib/forms.ts';

/** context for verify pages - resolved challenge with mode detection */
interface VerifyContext {
	challenge: VerifyChallenge;
	mfaStatus: MfaStatus | null;
	redirectUrl: string;
	/** true if session_id is set (sudo mode), false if null (MFA login) */
	isSudo: boolean;
}

/**
 * resolves the verify context from the request.
 *
 * modes are mutually exclusive:
 * 1. if ?token present → MFA login mode (token must be valid)
 * 2. if no ?token but session → sudo mode (create/reuse sudo challenge)
 * 3. neither → redirect to login
 */
const resolveVerifyContext = (url: URL): VerifyContext => {
	const { accountManager } = getAppContext();

	const tokenParam = url.searchParams.get('token');
	const redirectUrl = url.searchParams.get('redirect') ?? routes.account.overview.href();

	// mode 1: MFA login - ?token is present
	if (tokenParam !== null) {
		const challenge = accountManager.getVerifyChallenge(tokenParam);
		if (challenge === null) {
			// invalid or expired token → redirect to login (don't fall back to sudo)
			redirect(routes.login.href(undefined, { redirect: redirectUrl }));
		}

		const mfaStatus = accountManager.getMfaStatus(challenge.did);
		if (mfaStatus === null) {
			// no MFA configured (shouldn't happen, but handle it)
			redirect(routes.login.href(undefined, { redirect: redirectUrl }));
		}

		return {
			challenge,
			mfaStatus,
			redirectUrl,
			isSudo: false,
		};
	}

	// mode 2: sudo - no token, but has session
	const session = tryGetSession();
	if (session === null) {
		redirect(routes.login.href(undefined, { redirect: redirectUrl }));
	}

	// already elevated? redirect directly to target
	if (accountManager.isSessionElevated(session)) {
		redirect(redirectUrl);
	}

	// create or reuse sudo challenge
	const challenge = accountManager.getOrCreateSudoChallenge(session.id, session.did);
	const mfaStatus = accountManager.getMfaStatus(session.did);

	return {
		challenge,
		mfaStatus,
		redirectUrl,
		isSudo: true,
	};
};

export default {
	middleware: [forms({ verifyForm, verifyWebAuthnForm })],
	actions: {
		index({ url }) {
			const ctx = resolveVerifyContext(url);

			// for sudo mode with no MFA → go to password
			if (ctx.isSudo && ctx.mfaStatus === null) {
				redirect(routes.verify.password.href(undefined, { redirect: ctx.redirectUrl }));
			}

			// for MFA login without mfaStatus, this shouldn't happen but redirect to login
			if (ctx.mfaStatus === null) {
				redirect(routes.login.href(undefined, { redirect: ctx.redirectUrl }));
			}

			// redirect to preferred method
			const tokenParam = ctx.isSudo ? undefined : ctx.challenge.token;
			switch (ctx.mfaStatus.preferred) {
				case PreferredMfa.WebAuthn: {
					redirect(
						routes.verify.webauthn.href(undefined, { token: tokenParam, redirect: ctx.redirectUrl }),
					);
				}
				case PreferredMfa.Totp: {
					redirect(routes.verify.totp.href(undefined, { token: tokenParam, redirect: ctx.redirectUrl }));
				}
			}
		},
		totp({ url }) {
			const { fields } = verifyForm;

			const ctx = resolveVerifyContext(url);

			// for sudo without MFA → redirect to index
			if (ctx.isSudo && ctx.mfaStatus === null) {
				redirect(routes.verify.index.href(undefined, { redirect: ctx.redirectUrl }));
			}

			return render(
				<BaseForm
					factor="totp"
					challenge={ctx.challenge.token}
					redirectUrl={ctx.redirectUrl}
					mfaStatus={ctx.mfaStatus}
					isSudo={ctx.isSudo}
				>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">
							{ctx.isSudo ? 'Confirm your identity' : 'Two-factor authentication'}
						</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter the 6-digit code from your authenticator app
							{ctx.isSudo ? ' to continue.' : '.'}
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

			const { fields } = verifyWebAuthnForm;

			const ctx = resolveVerifyContext(url);

			// for sudo without MFA → redirect to index
			if (ctx.isSudo && ctx.mfaStatus === null) {
				redirect(routes.verify.index.href(undefined, { redirect: ctx.redirectUrl }));
			}

			// get user's WebAuthn credentials
			const webauthnCredentials = accountManager.listWebAuthnCredentials(ctx.challenge.did);
			if (webauthnCredentials.length === 0) {
				// no WebAuthn credentials → redirect to TOTP
				const tokenParam = ctx.isSudo ? undefined : ctx.challenge.token;
				redirect(routes.verify.totp.href(undefined, { token: tokenParam, redirect: ctx.redirectUrl }));
			}

			// generate authentication options
			const options = await generateWebAuthnAuthenticationOptions({
				rpId: new URL(config.service.publicUrl).hostname,
				allowCredentials: webauthnCredentials,
			});

			// store the challenge for verification
			accountManager.setVerifyChallengeWebAuthn(ctx.challenge.token, options.challenge);

			return render(
				<BaseLayout>
					<title>{ctx.isSudo ? 'Confirm your identity' : 'Two-factor authentication'} - Danaus</title>

					<script src="/assets/webauthn-authenticate.js" type="module" />

					<div class="flex flex-1 items-center justify-center p-4">
						<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
							<form {...verifyWebAuthnForm} class="flex flex-col gap-6">
								<input {...fields.challenge.as('hidden', ctx.challenge.token)} />
								<input {...fields.redirect.as('hidden', ctx.redirectUrl)} />

								<div class="flex flex-col gap-2">
									<h1 class="text-base-500 font-semibold">
										{ctx.isSudo ? 'Confirm your identity' : 'Two-factor authentication'}
									</h1>
									<p class="text-base-300 text-neutral-foreground-3">
										Insert your security key and touch it
										{ctx.isSudo ? ' to continue.' : ' to verify your identity.'}
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

								<OtherMethodsMenu
									factor="webauthn"
									challenge={ctx.challenge.token}
									redirectUrl={ctx.redirectUrl}
									mfaStatus={ctx.mfaStatus}
									isSudo={ctx.isSudo}
								/>
							</form>
						</div>
					</div>
				</BaseLayout>,
			);
		},
		recovery({ url }) {
			const { fields } = verifyForm;

			const ctx = resolveVerifyContext(url);

			// for sudo without MFA → redirect to index
			if (ctx.isSudo && ctx.mfaStatus === null) {
				redirect(routes.verify.index.href(undefined, { redirect: ctx.redirectUrl }));
			}

			return render(
				<BaseForm
					factor="recovery"
					challenge={ctx.challenge.token}
					redirectUrl={ctx.redirectUrl}
					mfaStatus={ctx.mfaStatus}
					isSudo={ctx.isSudo}
				>
					<div class="flex flex-col gap-2">
						<h1 class="text-base-500 font-semibold">
							{ctx.isSudo ? 'Confirm your identity' : 'Two-factor authentication'}
						</h1>
						<p class="text-base-300 text-neutral-foreground-3">
							Enter one of your recovery codes
							{ctx.isSudo ? ' to continue.' : ' to verify your identity.'}
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
		password({ url }) {
			const { fields } = verifyForm;

			const ctx = resolveVerifyContext(url);

			// password is only allowed in sudo mode for non-MFA users
			if (!ctx.isSudo) {
				redirect(routes.login.href(undefined, { redirect: ctx.redirectUrl }));
			}

			// MFA users must use MFA methods
			if (ctx.mfaStatus !== null) {
				redirect(routes.verify.index.href(undefined, { redirect: ctx.redirectUrl }));
			}

			return render(
				<BaseForm
					factor="password"
					challenge={ctx.challenge.token}
					redirectUrl={ctx.redirectUrl}
					mfaStatus={null}
					isSudo={true}
				>
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
} satisfies Controller<typeof routes.verify>;

const BaseForm = (props: {
	factor: AuthFactor;
	challenge: string;
	redirectUrl: string;
	mfaStatus: MfaStatus | null;
	isSudo: boolean;
	children: JSXNode;
}) => {
	const { fields } = verifyForm;

	const title = props.isSudo ? 'Confirm your identity' : 'Two-factor authentication';

	return (
		<BaseLayout>
			<title>{title} - Danaus</title>

			<div class="flex flex-1 items-center justify-center p-4">
				<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
					<form {...verifyForm} class="flex flex-col gap-6">
						<input {...fields.challenge.as('hidden', props.challenge)} />
						<input {...fields.redirect.as('hidden', props.redirectUrl)} />
						<input {...fields.factor.as('hidden', props.factor)} />

						{props.children}

						<OtherMethodsMenu
							factor={props.factor}
							challenge={props.challenge}
							redirectUrl={props.redirectUrl}
							mfaStatus={props.mfaStatus}
							isSudo={props.isSudo}
						/>
					</form>
				</div>
			</div>
		</BaseLayout>
	);
};

const OtherMethodsMenu = (props: {
	factor: AuthFactor;
	challenge: string;
	redirectUrl: string;
	mfaStatus: MfaStatus | null;
	isSudo: boolean;
}) => {
	const { mfaStatus, isSudo, challenge, redirectUrl } = props;

	if (mfaStatus === null) {
		return null;
	}

	// count how many other methods are available
	const otherMethodsCount =
		(props.factor !== 'webauthn' && mfaStatus.hasWebAuthn ? 1 : 0) +
		(props.factor !== 'totp' && mfaStatus.hasTotp ? 1 : 0) +
		(props.factor !== 'recovery' && mfaStatus.hasRecoveryCodes ? 1 : 0);

	if (otherMethodsCount === 0) {
		return null;
	}

	// for MFA login, include token param; for sudo, omit it
	const tokenParam = isSudo ? undefined : challenge;

	return (
		<Menu>
			<MenuTrigger>
				<Button>Show other methods</Button>
			</MenuTrigger>

			<MenuPopover>
				<MenuList>
					{props.factor !== 'webauthn' && mfaStatus.hasWebAuthn && (
						<MenuItem
							href={routes.verify.webauthn.href(undefined, {
								token: tokenParam,
								redirect: redirectUrl,
							})}
						>
							Use security key
						</MenuItem>
					)}

					{props.factor !== 'totp' && mfaStatus.hasTotp && (
						<MenuItem
							href={routes.verify.totp.href(undefined, {
								token: tokenParam,
								redirect: redirectUrl,
							})}
						>
							Use authenticator app
						</MenuItem>
					)}

					{props.factor !== 'recovery' && mfaStatus.hasRecoveryCodes && (
						<MenuItem
							href={routes.verify.recovery.href(undefined, {
								token: tokenParam,
								redirect: redirectUrl,
							})}
						>
							Use 2FA recovery code
						</MenuItem>
					)}
				</MenuList>
			</MenuPopover>
		</Menu>
	);
};
