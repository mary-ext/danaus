import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { WebAuthnCredentialType } from '#app/accounts/db/schema.ts';
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

import {
	completeWebAuthnForm,
	initiateWebAuthnRegistration,
	removeWebAuthnForm,
} from './webauthn/lib/forms';

export default {
	middleware: [],
	actions: {
		register: {
			middleware: [forms({ completeWebAuthnForm })],
			async action({ url }) {
				const { accountManager } = getAppContext();
				const session = getSession();

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const account = accountManager.getAccount(session.did)!;

				const { fields } = completeWebAuthnForm;

				// check if we have an existing token (form was submitted but failed)
				let token = fields.token.value();
				let options;

				if (token) {
					// try to get existing challenge
					const existingChallenge = accountManager.getWebAuthnChallenge(token);
					if (existingChallenge) {
						// regenerate options with the same challenge
						const state = await initiateWebAuthnRegistration(
							session.did,
							account.handle ?? session.did,
						);
						// delete old challenge and use new one
						accountManager.deleteWebAuthnChallenge(token);
						token = state.token;
						options = state.options;
					}
				}

				if (!options) {
					// generate new registration
					const state = await initiateWebAuthnRegistration(
						session.did,
						account.handle ?? session.did,
					);
					token = state.token;
					options = state.options;
				}

				const generalError = fields.issues()?.at(0);

				return render(
					<BaseLayout>
						<title>Set up security key - Danaus</title>

						<script type="module" src={routes.assets.href({ path: 'webauthn-register.js' })} />

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...completeWebAuthnForm} class="contents">
									<DialogBody>
										<DialogTitle>Set up security key</DialogTitle>

										<DialogContent class="flex flex-col gap-4">
											<p class="text-base-300">
												Insert your security key and follow your browser's prompts to register it.
											</p>

											<input {...fields.token.as('hidden', token!)} />

											<danaus-webauthn-register data-options={JSON.stringify(options)}>
												<p
													data-target="webauthn-register.status"
													class="text-base-300 text-neutral-foreground-3"
												>
													Initializing...
												</p>

												<input
													{...fields.response.as('hidden', '')}
													data-target="webauthn-register.response"
												/>

												<Field
													label="Name"
													hint="Give this security key a name to help you identify it"
													validationMessageText={fields.name.issues()?.at(0)?.message}
												>
													<Input
														{...fields.name.as('text')}
														placeholder={accountManager.generateWebAuthnName(
															session.did,
															WebAuthnCredentialType.SecurityKey,
														)}
													/>
												</Field>
											</danaus-webauthn-register>

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

											<Button
												type="submit"
												variant="primary"
												disabled
												data-target="webauthn-register.submit"
											>
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
			middleware: [forms({ removeWebAuthnForm })],
			action({ url, params }) {
				const { accountManager } = getAppContext();
				const session = getSession();

				const id = coerceToInteger(params.id);
				if (id === null) {
					redirect(routes.account.security.overview.href());
				}

				const credential = accountManager.getWebAuthnCredential(session.did, id);
				if (credential === null) {
					redirect(routes.account.security.overview.href());
				}

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const { fields } = removeWebAuthnForm;

				const error = fields.allIssues()?.at(0);

				return render(
					<BaseLayout>
						<title>Remove "{credential.name}" security key? - Danaus</title>

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...removeWebAuthnForm} class="contents">
									<input {...fields.id.as('hidden', params.id)} />

									<DialogBody>
										<DialogTitle>Remove this security key?</DialogTitle>

										<DialogContent>
											<p class="text-base-300">
												You'll no longer be able to use "{credential.name}" to sign in.
											</p>

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
} satisfies Controller<typeof routes.account.security.webauthn>;
