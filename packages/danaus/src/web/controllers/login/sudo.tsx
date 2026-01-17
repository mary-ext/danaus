import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render, type JSXNode } from '@oomfware/jsx';

import {
	RECOVERY_CODE_LENGTH,
	RECOVERY_CODE_RE,
	TOTP_CODE_LENGTH,
	TOTP_CODE_RE,
} from '#app/accounts/totp.ts';

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

import { verifySudoForm, type AuthFactor } from './lib/forms.ts';

export default {
	middleware: [requireSession(), forms({ verifySudoForm })],
	actions: {
		index({ url }) {
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

			const hasMfa = accountManager.isMfaEnabled(session.did);
			if (hasMfa) {
				// TODO: redirect to preferred MFA
				redirect(routes.login.sudo.totp.href(undefined, { redirect: redirectUrl }));
			} else {
				redirect(routes.login.sudo.password.href(undefined, { redirect: redirectUrl }));
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

			if (!accountManager.isMfaEnabled(session.did)) {
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

			if (!accountManager.isMfaEnabled(session.did)) {
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
		password({ url }) {
			const { accountManager } = getAppContext();
			const session = getSession();

			const { fields } = verifySudoForm;

			const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();
			if (!redirectUrl) {
				redirect(routes.account.overview.href());
			}

			if (accountManager.isMfaEnabled(session.did)) {
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

	const hasMfa = accountManager.isMfaEnabled(did);

	return (
		<BaseLayout>
			<title>Confirm your identity - Danaus</title>

			<div class="flex flex-1 items-center justify-center p-4">
				<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
					<form {...verifySudoForm} class="flex flex-col gap-6">
						<input {...fields.redirect.as('hidden', props.redirectUrl)} />
						<input {...fields.factor.as('hidden', props.factor)} />

						{props.children}

						{hasMfa && props.factor !== 'password' && (
							<Menu>
								<MenuTrigger>
									<Button>Show other methods</Button>
								</MenuTrigger>

								<MenuPopover>
									<MenuList>
										{props.factor !== 'totp' && (
											<MenuItem
												href={routes.login.sudo.totp.href(undefined, {
													redirect: props.redirectUrl,
												})}
											>
												Use authenticator app
											</MenuItem>
										)}

										{props.factor !== 'recovery' && (
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
