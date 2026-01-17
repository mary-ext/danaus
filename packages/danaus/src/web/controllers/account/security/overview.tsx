import type { BuildAction } from '@oomfware/fetch-router';
import { render } from '@oomfware/jsx';

import type { Account, TotpCredential, WebauthnCredential } from '#app/accounts/manager.ts';
import { WebAuthnCredentialType } from '#app/accounts/db/schema.ts';

import DotGrid1x3HorizontalOutlined from '#web/icons/central/dot-grid-1x3-horizontal-outlined.tsx';
import PasskeysOutlined from '#web/icons/central/passkeys-outlined.tsx';
import PasswordOutlined from '#web/icons/central/password-outlined.tsx';
import PhoneOutlined from '#web/icons/central/phone-outlined.tsx';
import PlusLargeOutlined from '#web/icons/central/plus-large-outlined.tsx';
import UsbOutlined from '#web/icons/central/usb-outlined.tsx';
import { AccountLayout } from '#web/layouts/account.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import Button from '#web/primitives/button.tsx';
import DialogActions from '#web/primitives/dialog-actions.tsx';
import DialogBody from '#web/primitives/dialog-body.tsx';
import DialogClose from '#web/primitives/dialog-close.tsx';
import DialogContent from '#web/primitives/dialog-content.tsx';
import DialogSurface from '#web/primitives/dialog-surface.tsx';
import DialogTitle from '#web/primitives/dialog-title.tsx';
import Dialog from '#web/primitives/dialog.tsx';
import MenuDivider from '#web/primitives/menu-divider.tsx';
import MenuItem from '#web/primitives/menu-item.tsx';
import MenuList from '#web/primitives/menu-list.tsx';
import MenuPopover from '#web/primitives/menu-popover.tsx';
import MenuTrigger from '#web/primitives/menu-trigger.tsx';
import Menu from '#web/primitives/menu.tsx';
import { routes } from '#web/routes.ts';

export default {
	middleware: [],
	action() {
		const { accountManager } = getAppContext();
		const { did } = getSession();
		const account = accountManager.getAccount(did)!;

		const totpCredentials = accountManager.listTotpCredentials(did);
		const securityKeys = accountManager.listWebAuthnCredentialsByType(did, WebAuthnCredentialType.SecurityKey);
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

					<Menu>
						<MenuTrigger>
							<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
								<DotGrid1x3HorizontalOutlined size={16} />
							</button>
						</MenuTrigger>

						<MenuPopover>
							<MenuList>
								<MenuItem>Change email</MenuItem>
							</MenuList>
						</MenuPopover>
					</Menu>
				</div>
			</div>
		</div>
	);
};

const AuthenticationSection = ({
	account,
	totpCredentials,
	securityKeys,
}: {
	account: Account;
	totpCredentials: TotpCredential[];
	securityKeys: WebauthnCredential[];
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

					<Menu>
						<MenuTrigger>
							<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
								<DotGrid1x3HorizontalOutlined size={16} />
							</button>
						</MenuTrigger>

						<MenuPopover>
							<MenuList>
								<MenuItem>Change password</MenuItem>
							</MenuList>
						</MenuPopover>
					</Menu>
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

						<Menu>
							<MenuTrigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</MenuTrigger>

							<MenuPopover>
								<MenuList>
									<MenuItem href={routes.account.security.totp.remove.href({ id: totp.id })}>Remove</MenuItem>
								</MenuList>
							</MenuPopover>
						</Menu>
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

						<Menu>
							<MenuTrigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</MenuTrigger>

							<MenuPopover>
								<MenuList>
									<MenuItem href={routes.account.security.webauthn.remove.href({ id: key.id })}>
										Remove
									</MenuItem>
								</MenuList>
							</MenuPopover>
						</Menu>
					</div>
				))}

				{/* Passkeys placeholder (future) */}

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

			<Dialog id="add-auth-method-dialog">
				<DialogSurface>
					<DialogBody>
						<DialogTitle>Add sign-in method</DialogTitle>

						<DialogContent class="flex flex-col">
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
									<p class="text-base-300 text-neutral-foreground-3">
										Use a hardware key like YubiKey
									</p>
								</div>
							</a>

							<button disabled class="flex items-center gap-4 rounded-md px-4 py-3 text-left opacity-50">
								<PasskeysOutlined size={24} class="shrink-0" />

								<div class="min-w-0 grow">
									<p class="text-base-300 font-medium">Passkey</p>
									<p class="text-base-300 text-neutral-foreground-3">
										Use Face ID, Touch ID, or Windows Hello (coming soon)
									</p>
								</div>
							</button>
						</DialogContent>

						<DialogActions>
							<DialogClose>
								<Button>Cancel</Button>
							</DialogClose>
						</DialogActions>
					</DialogBody>
				</DialogSurface>
			</Dialog>
		</div>
	);
};

const RecoverySection = () => {
	const ctx = getAppContext();
	const session = getSession();

	const backupCodeCount = ctx.accountManager.getRecoveryCodeCount(session.did);

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
						<Menu>
							<MenuTrigger>
								<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
									<DotGrid1x3HorizontalOutlined size={16} />
								</button>
							</MenuTrigger>

							<MenuPopover>
								<MenuList>
									<MenuItem href={routes.account.security.recovery.show.href()}>View codes</MenuItem>
									<MenuItem href={routes.account.security.recovery.regenerate.href()}>
										Regenerate codes
									</MenuItem>

									<MenuDivider />

									<MenuItem href={routes.account.security.recovery.remove.href()}>Remove all codes</MenuItem>
								</MenuList>
							</MenuPopover>
						</Menu>
					) : (
						<Button href={routes.account.security.recovery.show.href()}>Generate</Button>
					)}
				</div>
			</div>
		</div>
	);
};
