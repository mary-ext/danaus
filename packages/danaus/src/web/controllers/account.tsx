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
} from '#web/account/forms.ts';
import AtOutlined from '#web/icons/central/at-outlined.tsx';
import DotGrid1x3HorizontalOutlined from '#web/icons/central/dot-grid-1x3-horizontal-outlined.tsx';
import Key2Outlined from '#web/icons/central/key-2-outlined.tsx';
import PlusLargeOutlined from '#web/icons/central/plus-large-outlined.tsx';
import { AccountLayout } from '#web/layouts/account.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession, requireSession } from '#web/middlewares/session.ts';
import { Accordion, Button, Dialog, Field, Input, Menu, MessageBar, Select } from '#web/primitives/index.ts';
import type { routes } from '#web/routes.ts';

import security from './account/security.tsx';

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
			const { accountManager, config } = getAppContext();
			const session = getSession();

			const account = accountManager.getAccount(session.did)!;

			// determine current handle parts for form prefill
			const currentHandle = account.handle ?? '';
			const isServiceHandle = config.identity.serviceHandleDomains.some((d) => currentHandle.endsWith(d));
			const currentDomain = isServiceHandle
				? (config.identity.serviceHandleDomains.find((d) => currentHandle.endsWith(d)) ?? 'custom')
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
							<MessageBar.Root intent="error" layout="singleline">
								<MessageBar.Body>{updateHandleError.message}</MessageBar.Body>
							</MessageBar.Root>
						)}

						{refreshHandleError && (
							<MessageBar.Root intent="error" layout="singleline">
								<MessageBar.Body>{refreshHandleError.message}</MessageBar.Body>
							</MessageBar.Root>
						)}

						<div class="flex flex-col gap-8">
							<div class="flex flex-col gap-2">
								<h4 class="text-base-300 font-medium text-neutral-foreground-2">Your identity</h4>

								<div class="flex flex-col divide-y divide-neutral-stroke-2 rounded-md bg-neutral-background-1 shadow-4">
									<div class="flex items-center gap-4 px-4 py-3">
										<div class="min-w-0 grow">
											<p class="text-base-300 font-medium wrap-break-word">@{account.handle}</p>
											<p class="text-base-300 text-neutral-foreground-3">Your username on the network</p>
										</div>

										<Menu.Root>
											<Menu.Trigger>
												<button class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-subtle-background text-neutral-foreground-3 outline-2 -outline-offset-2 outline-transparent transition hover:bg-subtle-background-hover hover:text-neutral-foreground-3-hover focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active active:text-neutral-foreground-3-active">
													<DotGrid1x3HorizontalOutlined size={16} />
												</button>
											</Menu.Trigger>

											<Menu.Popover>
												<Menu.List>
													<Menu.Item command="show-modal" commandfor="change-service-handle-dialog">
														Change handle
													</Menu.Item>

													<Menu.Item command="show-modal" commandfor="refresh-handle-dialog">
														Request refresh
													</Menu.Item>
												</Menu.List>
											</Menu.Popover>
										</Menu.Root>
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

					<Dialog.Root id="change-service-handle-dialog">
						<Dialog.Surface>
							<Dialog.Body>
								<Dialog.Title>Change handle</Dialog.Title>

								<form {...updateHandleForm} class="contents">
									<Dialog.Content class="flex flex-col gap-4">
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
													options={config.identity.serviceHandleDomains.map((d) => ({
														value: d,
														label: d,
													}))}
												/>
											</div>
										</Field>
									</Dialog.Content>

									<Dialog.Actions>
										<Button command="show-modal" commandfor="change-custom-handle-dialog">
											Use my own domain
										</Button>

										<div class="grow"></div>

										<Dialog.Close>
											<Button>Cancel</Button>
										</Dialog.Close>

										<Button type="submit" variant="primary">
											Change
										</Button>
									</Dialog.Actions>
								</form>
							</Dialog.Body>
						</Dialog.Surface>
					</Dialog.Root>

					<Dialog.Root id="refresh-handle-dialog">
						<Dialog.Surface>
							<Dialog.Body>
								<Dialog.Title>Request handle refresh</Dialog.Title>

								<form {...refreshHandleForm} class="contents">
									<Dialog.Content>
										<p class="text-base-300">
											This will notify the network to re-verify your handle. Use this if apps are marking your
											handle as invalid despite being set up correctly.
										</p>
									</Dialog.Content>

									<Dialog.Actions>
										<Dialog.Close>
											<Button>Cancel</Button>
										</Dialog.Close>

										<Button type="submit" variant="primary">
											Refresh
										</Button>
									</Dialog.Actions>
								</form>
							</Dialog.Body>
						</Dialog.Surface>
					</Dialog.Root>

					<Dialog.Root id="change-custom-handle-dialog">
						<Dialog.Surface>
							<Dialog.Body>
								<Dialog.Title>Change handle</Dialog.Title>

								<form {...updateHandleForm} class="contents">
									<Dialog.Content class="flex flex-col gap-4">
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

										<Accordion.Root class="flex flex-col gap-2">
											<Accordion.Item name="handle-method" open>
												<Accordion.Header>DNS record</Accordion.Header>
												<Accordion.Panel>
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
												</Accordion.Panel>
											</Accordion.Item>

											<Accordion.Item name="handle-method">
												<Accordion.Header>HTTP well-known entry</Accordion.Header>
												<Accordion.Panel>
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
												</Accordion.Panel>
											</Accordion.Item>
										</Accordion.Root>
									</Dialog.Content>

									<Dialog.Actions>
										<Dialog.Close>
											<Button>Cancel</Button>
										</Dialog.Close>

										<Button type="submit" variant="primary">
											Change
										</Button>
									</Dialog.Actions>
								</form>
							</Dialog.Body>
						</Dialog.Surface>
					</Dialog.Root>
				</AccountLayout>,
			);
		},

		appPasswords() {
			const { legacyAuthManager } = getAppContext();
			const session = getSession();
			const did = session.did as Did;

			const passwords = legacyAuthManager.listAppPasswords(did);

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
							<MessageBar.Root intent="success" layout="multiline">
								<MessageBar.Body>
									<MessageBar.Title>App password created</MessageBar.Title>

									<div class="mt-2 flex flex-col gap-2">
										<code class="rounded-md bg-neutral-background-3 px-2 py-1 font-mono text-base-300">
											{newPasswordResult.secret}
										</code>
										<p class="text-base-200 text-neutral-foreground-3">
											Copy this password now. You won't be able to see it again.
										</p>
									</div>
								</MessageBar.Body>
							</MessageBar.Root>
						)}

						{newPasswordError && (
							<MessageBar.Root intent="error" layout="singleline">
								<MessageBar.Body>{newPasswordError.message}</MessageBar.Body>
							</MessageBar.Root>
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
												{privilege} · Created {password.created_at.toLocaleDateString()}
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
													<Dialog.Root>
														<Dialog.Trigger>
															<Menu.Item>Remove</Menu.Item>
														</Dialog.Trigger>

														<Dialog.Surface>
															<Dialog.Body>
																<Dialog.Title>Remove app password?</Dialog.Title>

																<form {...deleteAppPasswordForm} class="contents">
																	<input type="hidden" name="name" value={password.name} />

																	<Dialog.Content>
																		<p class="text-base-300">
																			Any app signed in with "{password.name}" will be signed out immediately.
																		</p>
																	</Dialog.Content>

																	<Dialog.Actions>
																		<Dialog.Close>
																			<Button>Cancel</Button>
																		</Dialog.Close>

																		<Button type="submit" variant="primary">
																			Remove
																		</Button>
																	</Dialog.Actions>
																</form>
															</Dialog.Body>
														</Dialog.Surface>
													</Dialog.Root>
												</Menu.List>
											</Menu.Popover>
										</Menu.Root>
									</div>
								);
							})}
						</div>
					</div>

					<Dialog.Root id="create-app-password-dialog">
						<Dialog.Surface>
							<Dialog.Body>
								<Dialog.Title>Create app password</Dialog.Title>

								<form {...createAppPasswordForm} class="contents">
									<Dialog.Content class="flex flex-col gap-4">
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
									</Dialog.Content>

									<Dialog.Actions>
										<Dialog.Close>
											<Button>Cancel</Button>
										</Dialog.Close>

										<Button type="submit" variant="primary">
											Create
										</Button>
									</Dialog.Actions>
								</form>
							</Dialog.Body>
						</Dialog.Surface>
					</Dialog.Root>
				</AccountLayout>,
			);
		},

		security,
	},
} satisfies Controller<typeof routes.account>;
