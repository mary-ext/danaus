import type { BuildAction } from '@oomfware/fetch-router';
import { render } from '@oomfware/jsx';

import { WebAuthnCredentialType } from '#app/accounts/db/schema.ts';
import type { Account } from '#app/accounts/manager.ts';
import type { TotpCredential, WebauthnCredential } from '#app/accounts/mfa.ts';

import DotGrid1x3HorizontalOutlined from '#web/icons/central/dot-grid-1x3-horizontal-outlined.tsx';
import PasskeysOutlined from '#web/icons/central/passkeys-outlined.tsx';
import PasswordOutlined from '#web/icons/central/password-outlined.tsx';
import PhoneOutlined from '#web/icons/central/phone-outlined.tsx';
import PlusLargeOutlined from '#web/icons/central/plus-large-outlined.tsx';
import UsbOutlined from '#web/icons/central/usb-outlined.tsx';
import { AccountLayout } from '#web/layouts/account.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import { Button, Dialog, Menu } from '#web/primitives/index.ts';
import { routes } from '#web/routes.ts';

export default {
	middleware: [],
	action() {
		const { accountManager, mfaManager } = getAppContext();
		const { did } = getSession();
		const account = accountManager.getAccount(did)!;

		const totpCredentials = mfaManager.listTotpCredentials(did);
		const securityKeys = mfaManager.listWebAuthnCredentialsByType(did, WebAuthnCredentialType.SecurityKey);
		const passkeys = mfaManager.listWebAuthnCredentialsByType(did, WebAuthnCredentialType.Passkey);
		const hasMfa = totpCredentials.length > 0 || securityKeys.length > 0;

		return render(
			<AccountLayout>
				<title>Security - Danaus</title>

				<div class="flex flex-col gap-4">
					<div class="flex h-8 shrink-0 items-center">
						<h3 class="text-base-400 font-medium">Security</h3>
					</div>

					<div class="flex flex-col gap-8">
						<InformationSection account={account} />

						<AuthenticationSection
							account={account}
							totpCredentials={totpCredentials}
							securityKeys={securityKeys}
							passkeys={passkeys}
						/>

						{hasMfa && <RecoverySection />}
					</div>
				</div>
			</AccountLayout>,
		);
	},
} satisfies BuildAction<'ANY', typeof routes.account.security.overview>;

const InformationSection = ({ account }: { account: Account }) => {
	return (
		<div class="flex flex-col gap-2">
			<h4 class="text-base-300 font-medium text-neutral-foreground-2">Account information</h4>

			<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
				<div class="flex items-center gap-4 px-4 py-3">
					<div class="min-w-0 grow">
						<p class="text-base-300 font-medium wrap-break-word">{account?.email}</p>
						<p class="text-base-300 text-neutral-foreground-3">
							{account?.email_confirmed_at ? 'Verified' : 'Not verified'}
						</p>
					</div>

					{!account?.email_confirmed_at && <Button>Verify</Button>}

					<Menu.Root>
						<Menu.Trigger>
							<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
								<DotGrid1x3HorizontalOutlined size={16} />
							</button>
						</Menu.Trigger>

						<Menu.Popover>
							<Menu.List>
								<Menu.Item>Change email</Menu.Item>
							</Menu.List>
						</Menu.Popover>
					</Menu.Root>
				</div>
			</div>
		</div>
	);
};

const AuthenticationSection = ({
	account,
	totpCredentials,
	securityKeys,
	passkeys,
}: {
	account: Account;
	totpCredentials: TotpCredential[];
	securityKeys: WebauthnCredential[];
	passkeys: WebauthnCredential[];
}) => {
	return (
		<div class="flex flex-col gap-2">
			<h4 class="text-base-300 font-medium text-neutral-foreground-2">Ways to prove who you are</h4>

			<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
				{/* Password (always shown) */}
				<div class="flex items-center gap-4 px-4 py-3">
					<PasswordOutlined size={24} class="shrink-0" />

					<div class="min-w-0 grow">
						<p class="text-base-300 font-medium wrap-break-word">Password</p>
						<p class="text-base-300 text-neutral-foreground-3">
							Last changed {(account.password_updated_at || account.created_at).toLocaleDateString()}
						</p>
					</div>

					<Menu.Root>
						<Menu.Trigger>
							<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
								<DotGrid1x3HorizontalOutlined size={16} />
							</button>
						</Menu.Trigger>

						<Menu.Popover>
							<Menu.List>
								<Menu.Item>Change password</Menu.Item>
							</Menu.List>
						</Menu.Popover>
					</Menu.Root>
				</div>

				{/* TOTP credentials */}
				{totpCredentials.map((totp) => (
					<div class="flex items-center gap-4 px-4 py-3">
						<PhoneOutlined size={24} class="shrink-0" />

						<div class="min-w-0 grow">
							<p class="text-base-300 font-medium wrap-break-word">{totp.name}</p>
							<p class="text-base-300 text-neutral-foreground-3">
								Authenticator · Added {totp.created_at.toLocaleDateString()}
							</p>
						</div>

						<Menu.Root>
							<Menu.Trigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</Menu.Trigger>

							<Menu.Popover>
								<Menu.List>
									<Menu.Item href={routes.account.security.totp.remove.href({ id: totp.id })}>
										Remove
									</Menu.Item>
								</Menu.List>
							</Menu.Popover>
						</Menu.Root>
					</div>
				))}

				{/* Security keys */}
				{securityKeys.map((key) => (
					<div class="flex items-center gap-4 px-4 py-3">
						<UsbOutlined size={24} class="shrink-0" />

						<div class="min-w-0 grow">
							<p class="text-base-300 font-medium wrap-break-word">{key.name}</p>
							<p class="text-base-300 text-neutral-foreground-3">
								Security key · Added {key.created_at.toLocaleDateString()}
							</p>
						</div>

						<Menu.Root>
							<Menu.Trigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</Menu.Trigger>

							<Menu.Popover>
								<Menu.List>
									<Menu.Item href={routes.account.security.webauthn.remove.href({ id: key.id })}>
										Remove
									</Menu.Item>
								</Menu.List>
							</Menu.Popover>
						</Menu.Root>
					</div>
				))}

				{/* Passkeys */}
				{passkeys.map((key) => (
					<div class="flex items-center gap-4 px-4 py-3">
						<PasskeysOutlined size={24} class="shrink-0" />

						<div class="min-w-0 grow">
							<p class="text-base-300 font-medium wrap-break-word">{key.name}</p>
							<p class="text-base-300 text-neutral-foreground-3">
								Passkey · Added {key.created_at.toLocaleDateString()}
							</p>
						</div>

						<Menu.Root>
							<Menu.Trigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</Menu.Trigger>

							<Menu.Popover>
								<Menu.List>
									<Menu.Item href={routes.account.security.webauthn.remove.href({ id: key.id })}>
										Remove
									</Menu.Item>
								</Menu.List>
							</Menu.Popover>
						</Menu.Root>
					</div>
				))}

				{/* Add another way to sign in */}
				<button
					command="show-modal"
					commandfor="add-auth-method-dialog"
					class="flex items-center gap-4 bg-subtle-background px-4 py-3 text-left outline-2 -outline-offset-2 outline-transparent transition select-none first:rounded-t-md last:rounded-b-md hover:bg-subtle-background-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active"
				>
					<div class="grid h-6 w-6 shrink-0 place-items-center">
						<PlusLargeOutlined size={16} />
					</div>

					<div class="min-w-0 grow">
						<p class="text-base-300">Add another way to sign in</p>
					</div>
				</button>
			</div>

			<Dialog.Root id="add-auth-method-dialog">
				<Dialog.Surface>
					<Dialog.Body>
						<Dialog.Title>Add sign-in method</Dialog.Title>

						<Dialog.Content class="flex flex-col">
							<a
								href={routes.account.security.totp.register.href()}
								class="flex items-center gap-4 rounded-md px-4 py-3 text-left outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active"
							>
								<PhoneOutlined size={24} class="shrink-0" />

								<div class="min-w-0 grow">
									<p class="text-base-300 font-medium">Authenticator app</p>
									<p class="text-base-300 text-neutral-foreground-3">
										Use an app like Google Authenticator or Bitwarden
									</p>
								</div>
							</a>

							<a
								href={routes.account.security.webauthn.register.href()}
								class="flex items-center gap-4 rounded-md px-4 py-3 text-left outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active"
							>
								<UsbOutlined size={24} class="shrink-0" />

								<div class="min-w-0 grow">
									<p class="text-base-300 font-medium">Security key</p>
									<p class="text-base-300 text-neutral-foreground-3">Use a hardware key like YubiKey</p>
								</div>
							</a>

							<a
								href={routes.account.security.webauthn.register.href(undefined, { type: 'passkey' })}
								class="flex items-center gap-4 rounded-md px-4 py-3 text-left outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active"
							>
								<PasskeysOutlined size={24} class="shrink-0" />

								<div class="min-w-0 grow">
									<p class="text-base-300 font-medium">Passkey</p>
									<p class="text-base-300 text-neutral-foreground-3">
										Use Face ID, Touch ID, or Windows Hello
									</p>
								</div>
							</a>
						</Dialog.Content>

						<Dialog.Actions>
							<Dialog.Close>
								<Button>Cancel</Button>
							</Dialog.Close>
						</Dialog.Actions>
					</Dialog.Body>
				</Dialog.Surface>
			</Dialog.Root>
		</div>
	);
};

const RecoverySection = () => {
	const { mfaManager } = getAppContext();
	const session = getSession();

	const backupCodeCount = mfaManager.getRecoveryCodeCount(session.did);

	return (
		<div class="flex flex-col gap-2">
			<h4 class="text-base-300 font-medium text-neutral-foreground-2">Recovery options</h4>

			<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
				<div class="flex items-center gap-4 px-4 py-3">
					<div class="min-w-0 grow">
						<p class="text-base-300 font-medium">Backup codes</p>
						<p class="text-base-300 text-neutral-foreground-3">
							{backupCodeCount > 0 ? `${backupCodeCount} of 10 codes remaining` : 'No backup codes generated'}
						</p>
					</div>

					{backupCodeCount > 0 ? (
						<Menu.Root>
							<Menu.Trigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</Menu.Trigger>

							<Menu.Popover>
								<Menu.List>
									<Menu.Item href={routes.account.security.recovery.show.href()}>View codes</Menu.Item>
									<Menu.Item href={routes.account.security.recovery.regenerate.href()}>
										Regenerate codes
									</Menu.Item>

									<Menu.Divider />

									<Menu.Item href={routes.account.security.recovery.remove.href()}>
										Remove all codes
									</Menu.Item>
								</Menu.List>
							</Menu.Popover>
						</Menu.Root>
					) : (
						<Button href={routes.account.security.recovery.show.href()}>Generate</Button>
					)}
				</div>
			</div>
		</div>
	);
};
