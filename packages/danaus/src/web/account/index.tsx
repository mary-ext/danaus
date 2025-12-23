import type { Did } from '@atcute/lexicons';

import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { jsxRenderer } from 'hono/jsx-renderer';

import { formatAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import type { WebSession } from '#app/accounts/manager.ts';
import { readWebSessionToken, verifyWebSessionToken } from '#app/auth/web.ts';
import type { AppContext } from '#app/context.ts';

import AsideItem from '../admin/components/aside-item.tsx';
import { IdProvider } from '../components/id.tsx';
import { registerForms } from '../forms/index.ts';
import DotGrid1x3HorizontalOutlined from '../icons/central/dot-grid-1x3-horizontal-outlined.tsx';
import Key2Outlined from '../icons/central/key-2-outlined.tsx';
import PasskeysOutlined from '../icons/central/passkeys-outlined.tsx';
import PasswordOutlined from '../icons/central/password-outlined.tsx';
import PersonOutlined from '../icons/central/person-outlined.tsx';
import PhoneOutlined from '../icons/central/phone-outlined.tsx';
import PlusLargeOutlined from '../icons/central/plus-large-outlined.tsx';
import ShieldOutlined from '../icons/central/shield-outlined.tsx';
import TrashCanOutlined from '../icons/central/trash-can-outlined.tsx';
import UsbOutlined from '../icons/central/usb-outlined.tsx';
import Button from '../primitives/button.tsx';
import DialogActions from '../primitives/dialog-actions.tsx';
import DialogBody from '../primitives/dialog-body.tsx';
import DialogContent from '../primitives/dialog-content.tsx';
import DialogSurface from '../primitives/dialog-surface.tsx';
import DialogTitle from '../primitives/dialog-title.tsx';
import Dialog from '../primitives/dialog.tsx';
import Field from '../primitives/field.tsx';
import Input from '../primitives/input.tsx';
import MenuDivider from '../primitives/menu-divider.tsx';
import MenuItem from '../primitives/menu-item.tsx';
import MenuList from '../primitives/menu-list.tsx';
import MenuPopover from '../primitives/menu-popover.tsx';
import MenuTrigger from '../primitives/menu-trigger.tsx';
import Menu from '../primitives/menu.tsx';
import MessageBarBody from '../primitives/message-bar-body.tsx';
import MessageBarTitle from '../primitives/message-bar-title.tsx';
import MessageBar from '../primitives/message-bar.tsx';
import Select from '../primitives/select.tsx';

import { createAccountForms } from './forms.ts';

export const createAccountApp = (ctx: AppContext) => {
	const app = new Hono();

	const forms = createAccountForms(ctx);
	app.use(registerForms(forms));

	// #region verify credentials helper
	const verifyCredentials = (c: Context): WebSession => {
		const token = readWebSessionToken(c.req.raw);
		if (!token) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		const sessionId = verifyWebSessionToken(ctx.config.secrets.jwtKey, token);
		if (!sessionId) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		const session = ctx.accountManager.getWebSession(sessionId);
		if (!session) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		return session;
	};
	// #endregion

	// #region base HTML renderer
	app.use(
		jsxRenderer(({ children }) => {
			return (
				<IdProvider>
					<html lang="en">
						<head>
							<meta charset="utf-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<link rel="stylesheet" href="/assets/style.css" />
						</head>

						<body>
							<div class="flex min-h-dvh flex-col">{children}</div>
						</body>
					</html>
				</IdProvider>
			);
		}),
	);
	// #endregion

	// #region login route (unauthenticated)
	app.on(['GET', 'POST'], '/login', (c) => {
		const { signInForm } = forms;
		const { fields } = signInForm;

		return c.render(
			<>
				<title>sign in - danaus</title>

				<div class="flex flex-1 items-center justify-center p-4">
					<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
						<form {...signInForm} class="flex flex-col gap-6">
							<h1 class="text-base-500 font-semibold">Sign in to your account</h1>

							<Field
								label="Handle or email"
								required
								validationMessageText={fields.identifier.issues()[0]?.message}
							>
								<Input {...fields.identifier.as('text')} placeholder="alice.bsky.social" required autofocus />
							</Field>

							<Field label="Password" required validationMessageText={fields.password.issues()[0]?.message}>
								<Input {...fields.password.as('password')} required />
							</Field>

							<Button type="submit" variant="primary">
								Sign in
							</Button>
						</form>
					</div>
				</div>
			</>,
		);
	});
	// #endregion

	// #region overview route
	app.get('/', (c) => {
		const session = verifyCredentials(c);
		const account = ctx.accountManager.getAccount(session.did);

		return c.render(
			<AccountLayout>
				<title>My account - Danaus</title>

				<div class="flex flex-col gap-4">
					<div class="flex h-8 items-center">
						<h3 class="text-base-400 font-medium">Account overview</h3>
					</div>

					<div class="flex flex-col gap-8">
						<div class="flex flex-col gap-2">
							<h4 class="text-base-300 font-medium text-neutral-foreground-2">Your identity</h4>

							<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
								<div class="flex items-center gap-4 px-4 py-3">
									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium wrap-break-word">@{account?.handle}</p>
										<p class="text-base-300 text-neutral-foreground-3">Your username on the network</p>
									</div>

									<Menu>
										<MenuTrigger>
											<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
												<DotGrid1x3HorizontalOutlined size={16} />
											</button>
										</MenuTrigger>

										<MenuPopover>
											<MenuList>
												<MenuItem>Change handle</MenuItem>
												<MenuItem>Request refresh</MenuItem>
											</MenuList>
										</MenuPopover>
									</Menu>
								</div>
							</div>
						</div>

						<div class="flex flex-col gap-2">
							<h4 class="text-base-300 font-medium text-neutral-foreground-2">Account management</h4>

							<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
								<div class="flex items-center gap-4 px-4 py-3">
									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium">Data export</p>
										<p class="text-base-300 text-neutral-foreground-3">Download your repository and blobs</p>
									</div>

									<Button disabled>Export</Button>
								</div>

								<div class="flex items-center gap-4 px-4 py-3">
									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium">Deactivate account</p>
										<p class="text-base-300 text-neutral-foreground-3">Temporarily disable your account</p>
									</div>

									<Button disabled>Deactivate</Button>
								</div>

								<div class="flex items-center gap-4 px-4 py-3">
									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium">Delete account</p>
										<p class="text-base-300 text-neutral-foreground-3">Permanently delete your account</p>
									</div>

									<Button disabled>Delete</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</AccountLayout>,
		);
	});
	// #endregion

	// #region app passwords route
	app.on(['GET', 'POST'], '/app-passwords', (c) => {
		const session = verifyCredentials(c);
		const did = session.did as Did;
		const { createAppPasswordForm, deleteAppPasswordForm } = forms;

		const passwords = ctx.accountManager.listAppPasswords(did);

		const newPasswordResult = createAppPasswordForm.result;
		const newPasswordError = createAppPasswordForm.fields.allIssues().at(0);

		return c.render(
			<AccountLayout>
				<title>App passwords - Danaus</title>

				<div class="flex flex-col gap-4">
					<div class="flex h-8 shrink-0 items-center justify-between">
						<h3 class="text-base-400 font-medium">App passwords</h3>

						<Button commandfor="create-app-password-dialog" command="show-modal" variant="primary">
							<PlusLargeOutlined size={16} />
							New
						</Button>
					</div>

					{newPasswordResult && (
						<MessageBar intent="success" layout="multiline">
							<MessageBarBody>
								<MessageBarTitle>App password created</MessageBarTitle>

								<div class="mt-2 flex flex-col gap-2">
									<code class="rounded-md bg-neutral-background-3 px-2 py-1 font-mono text-base-300">
										{newPasswordResult.secret}
									</code>
									<p class="text-base-200 text-neutral-foreground-3">
										Copy this password now. You won't be able to see it again.
									</p>
								</div>
							</MessageBarBody>
						</MessageBar>
					)}

					{newPasswordError && (
						<MessageBar intent="error" layout="singleline">
							<MessageBarBody>{newPasswordError.message}</MessageBarBody>
						</MessageBar>
					)}

					{passwords.length === 0 ? (
						<p class="py-8 text-center text-base-300 text-neutral-foreground-3">no app passwords yet.</p>
					) : (
						<ul class="divide-y divide-neutral-stroke-2">
							{passwords.map((password) => (
								<li class="flex items-center justify-between gap-4 py-3">
									<div class="flex flex-col">
										<span class="text-base-300 font-medium">{password.name}</span>
										<span class="text-base-200 text-neutral-foreground-3">
											{formatAppPasswordPrivilege(password.privilege)} · created{' '}
											{password.created_at.toLocaleDateString()}
										</span>
									</div>
									<form {...deleteAppPasswordForm} class="contents">
										<input type="hidden" name="name" value={password.name} />
										<Button type="submit" variant="subtle">
											<TrashCanOutlined size={16} />
											Delete
										</Button>
									</form>
								</li>
							))}
						</ul>
					)}
				</div>

				<Dialog id="create-app-password-dialog">
					<DialogSurface>
						<DialogBody>
							<DialogTitle>Create app password</DialogTitle>

							<form {...createAppPasswordForm} class="contents">
								<DialogContent class="flex flex-col gap-6">
									<Field label="Name" required>
										<Input {...createAppPasswordForm.fields.name.as('text')} placeholder="My app" required />
									</Field>

									<Field label="Privilege">
										<Select
											{...createAppPasswordForm.fields.privilege.as('select')}
											options={[
												{ value: 'limited', label: 'Limited - cannot access DMs' },
												{ value: 'privileged', label: 'Privileged - can access DMs' },
												{ value: 'full', label: 'Full - full account access' },
											]}
										/>
									</Field>
								</DialogContent>

								<DialogActions>
									<Button type="submit" variant="primary">
										Create
									</Button>
									<Button commandfor="create-app-password-dialog" command="close" variant="outlined">
										Cancel
									</Button>
								</DialogActions>
							</form>
						</DialogBody>
					</DialogSurface>
				</Dialog>
			</AccountLayout>,
		);
	});
	// #endregion

	// #region security route
	app.get('/security', (c) => {
		const session = verifyCredentials(c);
		const account = ctx.accountManager.getAccount(session.did);

		return c.render(
			<AccountLayout>
				<title>Security - Danaus</title>

				<div class="flex flex-col gap-4">
					<div class="flex h-8 shrink-0 items-center">
						<h3 class="text-base-400 font-medium">Security</h3>
					</div>

					<div class="flex flex-col gap-8">
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

						<div class="flex flex-col gap-2">
							<h4 class="text-base-300 font-medium text-neutral-foreground-2">Ways to prove who you are</h4>

							<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
								<div class="flex items-center gap-4 px-4 py-3">
									<PasswordOutlined size={24} class="shrink-0" />

									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium wrap-break-word">Password</p>
										<p class="text-base-300 text-neutral-foreground-3">Last changed yesterday</p>
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

								<div class="flex items-center gap-4 px-4 py-3">
									<PhoneOutlined size={24} class="shrink-0" />

									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium wrap-break-word">Bitwarden</p>
										<p class="text-base-300 text-neutral-foreground-3">Authenticator · Added yesterday</p>
									</div>

									<Menu>
										<MenuTrigger>
											<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
												<DotGrid1x3HorizontalOutlined size={16} />
											</button>
										</MenuTrigger>

										<MenuPopover>
											<MenuList>
												<MenuItem>Rename</MenuItem>
												<MenuDivider />
												<MenuItem>Remove</MenuItem>
											</MenuList>
										</MenuPopover>
									</Menu>
								</div>

								<div class="flex items-center gap-4 px-4 py-3">
									<UsbOutlined size={24} class="shrink-0" />

									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium wrap-break-word">YubiKey 5</p>
										<p class="text-base-300 text-neutral-foreground-3">Security key · Added 2 weeks ago</p>
									</div>

									<Menu>
										<MenuTrigger>
											<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
												<DotGrid1x3HorizontalOutlined size={16} />
											</button>
										</MenuTrigger>

										<MenuPopover>
											<MenuList>
												<MenuItem>Rename</MenuItem>
												<MenuDivider />
												<MenuItem>Remove</MenuItem>
											</MenuList>
										</MenuPopover>
									</Menu>
								</div>

								<div class="flex items-center gap-4 px-4 py-3">
									<PasskeysOutlined size={24} class="shrink-0" />

									<div class="min-w-0 grow">
										<p class="text-base-300 font-medium wrap-break-word">iCloud Keychain</p>
										<p class="text-base-300 text-neutral-foreground-3">Passkey · Added last month</p>
									</div>

									<Menu>
										<MenuTrigger>
											<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
												<DotGrid1x3HorizontalOutlined size={16} />
											</button>
										</MenuTrigger>

										<MenuPopover>
											<MenuList>
												<MenuItem>Rename</MenuItem>
												<MenuDivider />
												<MenuItem>Remove</MenuItem>
											</MenuList>
										</MenuPopover>
									</Menu>
								</div>

								<button class="flex items-center gap-4 bg-subtle-background px-4 py-3 text-left outline-2 -outline-offset-2 outline-transparent transition select-none first:rounded-t-md last:rounded-b-md hover:bg-subtle-background-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active">
									<div class="grid h-6 w-6 shrink-0 place-items-center">
										<PlusLargeOutlined size={16} />
									</div>

									<div class="min-w-0 grow">
										<p class="text-base-300">Add another way to sign in</p>
									</div>
								</button>
							</div>
						</div>
					</div>
				</div>
			</AccountLayout>,
		);
	});
	// #endregion

	return app;
};

// #region account layout component
interface AccountLayoutProps {
	children?: unknown;
}

const AccountLayout = (props: AccountLayoutProps) => {
	return (
		<div class="flex flex-col gap-4 p-4 sm:p-16 sm:pt-24 lg:grid lg:grid-cols-[280px_minmax(0,640px)] lg:justify-center">
			<aside class="-ml-2 flex flex-col gap-4 sm:ml-0">
				<div class="flex h-8 shrink-0 items-center pl-4">
					<h2 class="text-base-400 font-medium">Account</h2>
				</div>

				<div class="flex flex-col gap-px">
					<AsideItem href="/account" exact icon={<PersonOutlined size={20} />}>
						Overview
					</AsideItem>

					<AsideItem href="/account/app-passwords" icon={<Key2Outlined size={20} />}>
						App passwords
					</AsideItem>

					<AsideItem href="/account/security" icon={<ShieldOutlined size={20} />}>
						Security
					</AsideItem>
				</div>
			</aside>

			<hr class="border-neutral-stroke-1 sm:hidden" />

			<main>{props.children}</main>
		</div>
	);
};
// #endregion
