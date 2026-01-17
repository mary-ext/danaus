import { redirect, type Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { BaseLayout } from '#web/layouts/base.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import Button from '#web/primitives/button.tsx';
import DialogActions from '#web/primitives/dialog-actions.tsx';
import DialogBody from '#web/primitives/dialog-body.tsx';
import DialogContent from '#web/primitives/dialog-content.tsx';
import DialogTitle from '#web/primitives/dialog-title.tsx';
import { routes } from '#web/routes.ts';

import { deleteBackupCodesForm, generateBackupCodesForm } from './recovery/lib/forms';

export default {
	middleware: [],
	actions: {
		show({ url }) {
			const { accountManager } = getAppContext();
			const session = getSession();

			if (accountManager.getMfaStatus(session.did) === null) {
				redirect(routes.account.security.overview.href());
			}

			// require sudo mode
			if (!accountManager.isSessionElevated(session)) {
				redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
			}

			// generate codes if none exist
			let codes = accountManager.getRecoveryCodes(session.did);
			if (codes.length === 0) {
				accountManager.generateRecoveryCodes(session.did);
				codes = accountManager.getRecoveryCodes(session.did);
			}

			return render(
				<BaseLayout>
					<title>Recovery codes - Danaus</title>

					<div class="flex flex-1 items-center justify-center p-4">
						<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
							<DialogBody>
								<DialogTitle>Recovery codes</DialogTitle>

								<DialogContent class="flex flex-col gap-4">
									<p class="text-base-300">
										Save these codes in a secure place. Each code can only be used once.
									</p>

									<div class="grid grid-cols-2 gap-2">
										{codes.map((code) => (
											<code class="rounded-md bg-neutral-background-3 px-3 py-2 text-center font-mono text-base-300 select-all">
												{code}
											</code>
										))}
									</div>
								</DialogContent>

								<DialogActions>
									<Button href={routes.account.security.overview.href()}>Done</Button>
								</DialogActions>
							</DialogBody>
						</div>
					</div>
				</BaseLayout>,
			);
		},
		regenerate: {
			middleware: [forms({ generateBackupCodesForm })],
			action({ url }) {
				const { accountManager } = getAppContext();
				const session = getSession();

				if (accountManager.getMfaStatus(session.did) === null) {
					redirect(routes.account.security.overview.href());
				}

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const { fields } = generateBackupCodesForm;

				const error = fields.allIssues()?.at(0);

				return render(
					<BaseLayout>
						<title>Regenerate recovery codes? - Danaus</title>

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...generateBackupCodesForm} class="contents">
									<DialogBody>
										<DialogTitle>Regenerate recovery codes?</DialogTitle>

										<DialogContent>
											<p>
												This will invalidate your existing recovery codes. Make sure to save the new ones.
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
												Regenerate
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
			middleware: [forms({ deleteBackupCodesForm })],
			action({ url }) {
				const { accountManager } = getAppContext();
				const session = getSession();

				if (accountManager.getMfaStatus(session.did) === null) {
					redirect(routes.account.security.overview.href());
				}

				// require sudo mode
				if (!accountManager.isSessionElevated(session)) {
					redirect(routes.login.sudo.index.href(undefined, { redirect: url.pathname }));
				}

				const { fields } = deleteBackupCodesForm;

				const error = fields.allIssues()?.at(0);

				return render(
					<BaseLayout>
						<title>Delete recovery codes? - Danaus</title>

						<div class="flex flex-1 items-center justify-center p-4">
							<div class="w-full max-w-120 rounded-xl bg-neutral-background-1 shadow-64">
								<form {...deleteBackupCodesForm} class="contents">
									<DialogBody>
										<DialogTitle>Delete recovery codes?</DialogTitle>

										<DialogContent>
											<p class="text-base-300">
												You won't be able to use recovery codes to sign in until you generate new ones.
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
												Delete
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
} satisfies Controller<typeof routes.account.security.recovery>;
