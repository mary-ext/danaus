import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import {
	decodeSecret,
	encodeSecret,
	generateQrCode,
	generateSecret,
	generateTotpUri,
} from '#app/accounts/totp.ts';
import { coerceToInteger } from '#app/web/lib/coerce.ts';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import Button from '#web/primitives/button.tsx';
import DialogActions from '#web/primitives/dialog-actions.tsx';
import DialogBody from '#web/primitives/dialog-body.tsx';
import DialogContent from '#web/primitives/dialog-content.tsx';
import DialogTitle from '#web/primitives/dialog-title.tsx';
import Field from '#web/primitives/field.tsx';
import Input from '#web/primitives/input.tsx';
import { routes } from '#web/routes.ts';

import { removeTotpForm, setupTotpForm } from './totp/lib/forms';

export default {
	middleware: [],
	actions: {
		register: {
			middleware: [forms({ setupTotpForm })],
			async action({ url }) {
				const { accountManager, config } = getAppContext();
				const session = getSession();

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const account = accountManager.getAccount(session.did)!;

				const { fields } = setupTotpForm;

				// preserve secret across form submissions, or generate a new one
				let secretBase32 = fields.secret.value();
				let secretBytes: Uint8Array;
				if (secretBase32) {
					secretBytes = decodeSecret(secretBase32);
				} else {
					secretBytes = generateSecret();
					secretBase32 = encodeSecret(secretBytes);
				}

				const issuer = config.service.branding.name;
				const label = account.handle ?? session.did;

				const uri = generateTotpUri(secretBytes, label, issuer);

				const generalError = fields.issues()?.at(0);

				return render(
					<BaseLayout>
						<title>Set up authenticator - Danaus</title>

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-150 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...setupTotpForm} class="contents">
									<DialogBody>
										<DialogTitle>Set up authenticator app</DialogTitle>

										<DialogContent class="flex flex-col gap-4">
											<p class="text-base-300">
												Scan this QR code with your authenticator app, or enter the code manually.
											</p>

											<input {...fields.secret.as('hidden', secretBase32)} />

											<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
												<img
													src={await generateQrCode(uri)}
													alt="QR code for authenticator app"
													width={200}
													height={200}
													class="shrink-0 rounded-md"
												/>

												<div class="flex flex-col gap-4">
													<div class="flex flex-col gap-2">
														<span class="text-base-200 text-neutral-foreground-3">Manual entry code</span>
														<code class="rounded-md bg-neutral-background-3 px-3 py-2 font-mono text-base-300 break-all select-all">
															{secretBase32}
														</code>
													</div>

													<div class="flex flex-col gap-2">
														<span class="text-base-200 text-neutral-foreground-3">URI</span>
														<code class="rounded-md bg-neutral-background-3 px-3 py-2 font-mono text-base-300 break-all select-all">
															{uri}
														</code>
													</div>
												</div>
											</div>

											<Field
												label="Name"
												hint="Give this authenticator a name to help you identify it"
												validationMessageText={fields.name.issues()?.at(0)?.message}
											>
												<Input
													{...fields.name.as('text')}
													placeholder={accountManager.generateTotpName(session.did)}
												/>
											</Field>

											<Field
												label="Verification code"
												required
												hint="Enter the 6-digit code from your authenticator app"
												validationMessageText={fields._code.issues()?.at(0)?.message}
											>
												<Input
													{...fields._code.as('text')}
													placeholder="000000"
													autocomplete="one-time-code"
													inputmode="numeric"
													pattern="[0-9]*"
													maxlength={6}
													required
												/>
											</Field>

											{generalError && (
												<p role="alert" class="text-base-300 text-status-danger-foreground-1">
													{generalError.message}
												</p>
											)}
										</DialogContent>

										<DialogActions>
											<Button type="button" href={routes.account.security.overview.href()}>
												Cancel
											</Button>

											<Button type="submit" variant="primary">
												Save
											</Button>
										</DialogActions>
									</DialogBody>
								</form>
							</div>
						</div>
					</BaseLayout>,
				);
			},
		},
		remove: {
			middleware: [forms({ removeTotpForm })],
			action({ url, params }) {
				const { accountManager } = getAppContext();
				const session = getSession();

				const id = coerceToInteger(params.id);
				if (id === null) {
					redirect(routes.account.security.overview.href());
				}

				const totp = accountManager.getTotpCredential(session.did, id);
				if (totp === null) {
					redirect(routes.account.security.overview.href());
				}

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const { fields } = removeTotpForm;

				const error = fields.allIssues()?.at(0);

				return render(
					<BaseLayout>
						<title>Remove "{totp.name}" authenticator? - Danaus</title>

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...removeTotpForm} class="contents">
									<input {...fields.id.as('hidden', params.id)} />

									<DialogBody>
										<DialogTitle>Remove this authenticator?</DialogTitle>

										<DialogContent>
											<p class="text-base-300">You'll no longer be able to use "{totp.name}" to sign in.</p>

											{error && (
												<p role="alert" class="text-base-300 text-status-danger-foreground-1">
													{error.message}
												</p>
											)}
										</DialogContent>

										<DialogActions>
											<Button type="button" href={routes.account.security.overview.href()}>
												Cancel
											</Button>

											<Button type="submit" variant="primary">
												Remove
											</Button>
										</DialogActions>
									</DialogBody>
								</form>
							</div>
						</div>
					</BaseLayout>,
				);
			},
		},
	},
} satisfies Controller<typeof routes.account.security.totp>;
