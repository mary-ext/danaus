import type { Did } from '@atcute/lexicons';
import type { Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { AppPasswordPrivilege } from '#app/accounts/db/schema.ts';

import {
	createAppPasswordForm,
	deleteAppPasswordForm,
	refreshHandleForm,
	updateHandleForm,
} from '../account/forms.ts';
import AtOutlined from '../icons/central/at-outlined.tsx';
import DotGrid1x3HorizontalOutlined from '../icons/central/dot-grid-1x3-horizontal-outlined.tsx';
import Key2Outlined from '../icons/central/key-2-outlined.tsx';
import PasskeysOutlined from '../icons/central/passkeys-outlined.tsx';
import PasswordOutlined from '../icons/central/password-outlined.tsx';
import PhoneOutlined from '../icons/central/phone-outlined.tsx';
import PlusLargeOutlined from '../icons/central/plus-large-outlined.tsx';
import TrashCanOutlined from '../icons/central/trash-can-outlined.tsx';
import UsbOutlined from '../icons/central/usb-outlined.tsx';
import { AccountLayout } from '../layouts/account.tsx';
import { getAppContext } from '../middlewares/app-context.ts';
import { getSession, requireSession } from '../middlewares/session.ts';
import AccordionHeader from '../primitives/accordion-header.tsx';
import AccordionItem from '../primitives/accordion-item.tsx';
import AccordionPanel from '../primitives/accordion-panel.tsx';
import Accordion from '../primitives/accordion.tsx';
import Button from '../primitives/button.tsx';
import DialogActions from '../primitives/dialog-actions.tsx';
import DialogBody from '../primitives/dialog-body.tsx';
import DialogClose from '../primitives/dialog-close.tsx';
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
import type { routes } from '../routes.ts';

export default {
	middleware: [
		requireSession(),
		forms({
			updateHandleForm,
			refreshHandleForm,
			createAppPasswordForm,
			deleteAppPasswordForm,
		}),
	],
	actions: {
		overview() {
			const ctx = getAppContext();
			const session = getSession();
			const account = ctx.accountManager.getAccount(session.did);

			// determine current handle parts for form prefill
			const currentHandle = account?.handle ?? '';
			const isServiceHandle = ctx.config.identity.serviceHandleDomains.some((d) => currentHandle.endsWith(d));
			const currentDomain = isServiceHandle
				? (ctx.config.identity.serviceHandleDomains.find((d) => currentHandle.endsWith(d)) ?? 'custom')
				: 'custom';
			const currentLocalPart = isServiceHandle
				? currentHandle.slice(0, -currentDomain.length)
				: currentHandle;

			const updateHandleError = updateHandleForm.fields.allIssues()?.[0];
			const refreshHandleError = refreshHandleForm.fields.allIssues()?.[0];

			return render(
				<AccountLayout>
					<title>My account - Danaus</title>

					<div class="flex flex-col gap-4">
						<div class="flex h-8 items-center">
							<h3 class="text-base-400 font-medium">Account overview</h3>
						</div>

						{updateHandleError && (
							<MessageBar intent="error" layout="singleline">
								<MessageBarBody>{updateHandleError.message}</MessageBarBody>
							</MessageBar>
						)}

						{refreshHandleError && (
							<MessageBar intent="error" layout="singleline">
								<MessageBarBody>{refreshHandleError.message}</MessageBarBody>
							</MessageBar>
						)}

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
													<MenuItem command="show-modal" commandfor="change-service-handle-dialog">
														Change handle
													</MenuItem>

													<MenuItem command="show-modal" commandfor="refresh-handle-dialog">
														Request refresh
													</MenuItem>
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
											<p class="text-base-300 text-neutral-foreground-3">
												Download your repository and blobs
											</p>
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

					<Dialog id="change-service-handle-dialog">
						<DialogSurface>
							<DialogBody>
								<DialogTitle>Change handle</DialogTitle>

								<form {...updateHandleForm} class="contents">
									<DialogContent class="flex flex-col gap-4">
										<p class="text-base-300 text-neutral-foreground-3">
											Your handle is your unique identity on the AT Protocol network.
										</p>

										<Field label="Handle" required>
											<div class="flex gap-2">
												<Input
													{...updateHandleForm.fields.handle.as('text')}
													value={updateHandleForm.fields.handle.value() || currentLocalPart}
													placeholder="alice"
													contentBefore={<AtOutlined size={16} />}
													class="grow"
												/>

												<Select
													{...updateHandleForm.fields.domain.as('select')}
													value={updateHandleForm.fields.domain.value() || currentDomain}
													options={ctx.config.identity.serviceHandleDomains.map((d) => ({
														value: d,
														label: d,
													}))}
												/>
											</div>
										</Field>
									</DialogContent>

									<DialogActions>
										<Button command="show-modal" commandfor="change-custom-handle-dialog">
											Use my own domain
										</Button>

										<div class="grow"></div>

										<DialogClose>
											<Button>Cancel</Button>
										</DialogClose>

										<Button type="submit" variant="primary">
											Change
										</Button>
									</DialogActions>
								</form>
							</DialogBody>
						</DialogSurface>
					</Dialog>

					<Dialog id="refresh-handle-dialog">
						<DialogSurface>
							<DialogBody>
								<DialogTitle>Request handle refresh</DialogTitle>

								<form {...refreshHandleForm} class="contents">
									<DialogContent>
										<p class="text-base-300">
											This will notify the network to re-verify your handle. Use this if apps are marking your
											handle as invalid despite being set up correctly.
										</p>
									</DialogContent>

									<DialogActions>
										<DialogClose>
											<Button>Cancel</Button>
										</DialogClose>

										<Button type="submit" variant="primary">
											Refresh
										</Button>
									</DialogActions>
								</form>
							</DialogBody>
						</DialogSurface>
					</Dialog>

					<Dialog id="change-custom-handle-dialog">
						<DialogSurface>
							<DialogBody>
								<DialogTitle>Change handle</DialogTitle>

								<form {...updateHandleForm} class="contents">
									<DialogContent class="flex flex-col gap-4">
										<p class="text-base-300 text-neutral-foreground-3">
											Your handle is your unique identity on the AT Protocol network.
										</p>

										<Field label="Handle" required>
											<Input
												{...updateHandleForm.fields.handle.as('text')}
												placeholder="alice.com"
												contentBefore={<AtOutlined size={16} />}
											/>
										</Field>

										<input {...updateHandleForm.fields.domain.as('hidden', 'custom')} />

										<Accordion class="flex flex-col gap-2">
											<AccordionItem name="handle-method" open>
												<AccordionHeader>DNS record</AccordionHeader>
												<AccordionPanel>
													<div class="flex flex-col gap-3">
														<p class="text-base-300 text-neutral-foreground-3">
															Add the following DNS record to your domain:
														</p>

														<div class="flex flex-col gap-2 rounded-md bg-neutral-background-3 p-3">
															<div class="flex flex-col gap-0.5">
																<span class="text-base-200 text-neutral-foreground-3">Host</span>
																<input
																	type="text"
																	readonly
																	value="_atproto.<your-domain>"
																	class="font-mono text-base-300 outline-none"
																/>
															</div>
															<div class="flex flex-col gap-0.5">
																<span class="text-base-200 text-neutral-foreground-3">Type</span>
																<input
																	type="text"
																	readonly
																	value="TXT"
																	class="font-mono text-base-300 outline-none"
																/>
															</div>
															<div class="flex flex-col gap-0.5">
																<span class="text-base-200 text-neutral-foreground-3">Value</span>
																<input
																	type="text"
																	readonly
																	value={`did=${session.did}`}
																	class="font-mono text-base-300 outline-none"
																/>
															</div>
														</div>
													</div>
												</AccordionPanel>
											</AccordionItem>

											<AccordionItem name="handle-method">
												<AccordionHeader>HTTP well-known entry</AccordionHeader>
												<AccordionPanel>
													<div class="flex flex-col gap-3">
														<p class="text-base-300 text-neutral-foreground-3">
															Upload a text file to the following URL:
														</p>

														<div class="flex flex-col gap-2 rounded-md bg-neutral-background-3 p-3">
															<div class="flex flex-col gap-0.5">
																<span class="text-base-200 text-neutral-foreground-3">URL</span>
																<input
																	type="text"
																	readonly
																	value="https://<your-domain>/.well-known/atproto-did"
																	class="font-mono text-base-300 outline-none"
																/>
															</div>
															<div class="flex flex-col gap-0.5">
																<span class="text-base-200 text-neutral-foreground-3">Contents</span>
																<input
																	type="text"
																	readonly
																	value={session.did}
																	class="font-mono text-base-300 outline-none"
																/>
															</div>
														</div>
													</div>
												</AccordionPanel>
											</AccordionItem>
										</Accordion>
									</DialogContent>

									<DialogActions>
										<DialogClose>
											<Button>Cancel</Button>
										</DialogClose>

										<Button type="submit" variant="primary">
											Change
										</Button>
									</DialogActions>
								</form>
							</DialogBody>
						</DialogSurface>
					</Dialog>
				</AccountLayout>,
			);
		},

		appPasswords() {
			const ctx = getAppContext();
			const session = getSession();
			const did = session.did as Did;

			const passwords = ctx.accountManager.listAppPasswords(did);

			const newPasswordResult = createAppPasswordForm.result;
			const newPasswordError = createAppPasswordForm.fields.allIssues()?.[0];

			return render(
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

						<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
							{passwords.length === 0 && (
								<div class="flex flex-col gap-1 p-8 text-center">
									<p class="text-base-300 font-medium">No app passwords created</p>
									<p class="text-base-300 text-neutral-foreground-3">
										App passwords lets you sign into legacy AT Protocol apps.
									</p>
								</div>
							)}

							{passwords.map((password) => {
								let privilege = `Unknown`;
								switch (password.privilege) {
									case AppPasswordPrivilege.Full: {
										privilege = `Full access`;
										break;
									}
									case AppPasswordPrivilege.Privileged: {
										privilege = `Privileged access`;
										break;
									}
									case AppPasswordPrivilege.Limited: {
										privilege = `Limited access`;
										break;
									}
								}

								return (
									<div class="flex items-center gap-4 px-4 py-3">
										<Key2Outlined size={24} class="shrink-0 text-neutral-foreground-3" />

										<div class="min-w-0 grow">
											<p class="text-base-300 font-medium">{password.name}</p>
											<p class="text-base-300 text-neutral-foreground-3">
												{privilege} · created {password.created_at.toLocaleDateString()}
											</p>
										</div>

										<form {...deleteAppPasswordForm} class="contents">
											<input type="hidden" name="name" value={password.name} />
											<Button type="submit" variant="subtle">
												<TrashCanOutlined size={16} />
											</Button>
										</form>
									</div>
								);
							})}
						</div>
					</div>

					<Dialog id="create-app-password-dialog">
						<DialogSurface>
							<DialogBody>
								<DialogTitle>Create app password</DialogTitle>

								<form {...createAppPasswordForm} class="contents">
									<DialogContent class="flex flex-col gap-4">
										<p class="text-base-300 text-neutral-foreground-3">
											App passwords let you sign into legacy AT Protocol apps without giving them access to
											your main password.
										</p>

										<Field label="Name" required>
											<Input {...createAppPasswordForm.fields.name.as('text')} placeholder="App" required />
										</Field>

										<Field label="Privilege" required>
											<Select
												{...createAppPasswordForm.fields.privilege.as('select')}
												options={[
													{ value: 'limited', label: 'Limited access' },
													{ value: 'privileged', label: 'Privileged access' },
													{ value: 'full', label: 'Full access' },
												]}
											/>
										</Field>
									</DialogContent>

									<DialogActions>
										<DialogClose>
											<Button>Cancel</Button>
										</DialogClose>

										<Button type="submit" variant="primary">
											Create
										</Button>
									</DialogActions>
								</form>
							</DialogBody>
						</DialogSurface>
					</Dialog>
				</AccountLayout>,
			);
		},

		security() {
			const ctx = getAppContext();
			const session = getSession();
			const account = ctx.accountManager.getAccount(session.did);

			return render(
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
		},
	},
} satisfies Controller<typeof routes.account>;
