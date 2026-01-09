import type { Controller } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import StatCard from '../admin/components/stat-card.tsx';
import { createAccountForm } from '../admin/forms.ts';
import MagnifyingGlassOutlined from '../icons/central/magnifying-glass-outlined.tsx';
import PlusLargeOutlined from '../icons/central/plus-large-outlined.tsx';
import { AdminLayout } from '../layouts/admin.tsx';
import { getAppContext } from '../middlewares/app-context.ts';
import { requireAdmin } from '../middlewares/basic-auth.ts';
import Button from '../primitives/button.tsx';
import Field from '../primitives/field.tsx';
import Input from '../primitives/input.tsx';
import Select from '../primitives/select.tsx';
import { routes } from '../routes.ts';

export default {
	middleware: [requireAdmin(), forms({ createAccountForm })],
	actions: {
		dashboard() {
			const ctx = getAppContext();
			const accountStats = ctx.accountManager.getAccountStats();
			const inviteCodeStats = ctx.accountManager.getInviteCodeStats();
			const sequencerStats = ctx.sequencer.getStats();

			return render(
				<AdminLayout>
					<title>Home - Danaus admin</title>

					<div class="flex flex-col gap-4">
						<h3 class="text-base-400 font-medium">Home</h3>

						<div class="flex flex-col gap-6">
							<div class="flex flex-col gap-2">
								<h4 class="text-base-300 font-medium text-neutral-foreground-2">Accounts</h4>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
									<StatCard label="Total" value={accountStats.total} />
									<StatCard label="Active" value={accountStats.active} />
									<StatCard label="Deactivated" value={accountStats.deactivated} />
									<StatCard label="Taken down" value={accountStats.takendown} />
									<StatCard label="Delete scheduled" value={accountStats.deleteScheduled} />
								</div>
							</div>

							<div class="flex flex-col gap-2">
								<h4 class="text-base-300 font-medium text-neutral-foreground-2">Invite codes</h4>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
									<StatCard label="Total" value={inviteCodeStats.total} />
									<StatCard label="Available" value={inviteCodeStats.available} />
									<StatCard label="Used" value={inviteCodeStats.used} />
									<StatCard label="Disabled" value={inviteCodeStats.disabled} />
								</div>
							</div>

							<div class="flex flex-col gap-2">
								<h4 class="text-base-300 font-medium text-neutral-foreground-2">Sequencer</h4>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
									<StatCard label="Last seq" value={sequencerStats.lastSeq} />
									<StatCard label="Total events" value={sequencerStats.totalEvents} />
									<StatCard label="Invalidated events" value={sequencerStats.invalidatedEvents} />
								</div>
							</div>
						</div>
					</div>
				</AdminLayout>,
			);
		},

		accounts: {
			index({ url }) {
				const ctx = getAppContext();
				const query = url.searchParams.get('q') ?? '';
				const cursor = url.searchParams.get('cursor') ?? undefined;

				const { accounts, cursor: nextCursor } = ctx.accountManager.listAccounts({
					query: query || undefined,
					cursor,
					limit: 50,
				});

				const buildHref = (nextCursor: string) => {
					return routes.admin.accounts.index.href(undefined, {
						q: query || undefined,
						cursor: nextCursor,
					});
				};

				return render(
					<AdminLayout>
						<title>Accounts - Danaus admin</title>

						<div class="flex flex-col gap-4">
							<h3 class="text-base-400 font-medium">Accounts</h3>

							<div class="flex gap-2">
								<form method="get" action={routes.admin.accounts.index.href()} class="contents">
									<Input
										type="search"
										name="q"
										value={query}
										placeholder="Search by handle or email..."
										contentBefore={<MagnifyingGlassOutlined size={16} />}
										class="grow"
									/>
								</form>

								<Button label="New account" href={routes.admin.accounts.create.href()} variant="primary">
									<PlusLargeOutlined size={16} />
									New
								</Button>
							</div>

							<div class="flex flex-col">
								{accounts.length === 0 ? (
									<p class="py-8 text-center text-base-300 text-neutral-foreground-3">
										{query ? 'No accounts found matching your search.' : 'No accounts yet.'}
									</p>
								) : (
									<ul class="divide-y divide-neutral-stroke-2">
										{accounts.map((account) => (
											<li class="flex items-center justify-between gap-4 py-3">
												<div class="flex min-w-0 flex-col">
													<span class="truncate text-base-300 font-medium">@{account.handle}</span>
													<span class="truncate text-base-200 text-neutral-foreground-3">
														{account.email}
													</span>
												</div>
												<div class="flex shrink-0 gap-2 text-base-200 text-neutral-foreground-3">
													{account.deactivated_at && (
														<span class="rounded-md bg-neutral-background-3 px-1.5 py-0.5 text-neutral-foreground-2">
															deactivated
														</span>
													)}
													{account.takedown_ref && (
														<span class="rounded-md bg-status-danger-background-1 px-1.5 py-0.5 text-status-danger-foreground-1">
															taken down
														</span>
													)}
												</div>
											</li>
										))}
									</ul>
								)}
							</div>

							{nextCursor && (
								<div class="flex justify-end">
									<Button href={buildHref(nextCursor)} variant="outlined">
										Next page
									</Button>
								</div>
							)}
						</div>
					</AdminLayout>,
				);
			},

			create() {
				const ctx = getAppContext();
				const domains = ctx.config.identity.serviceHandleDomains;
				const domainOptions = domains.map((d) => ({ value: d, label: d }));

				const { fields } = createAccountForm;

				return render(
					<AdminLayout>
						<title>New account - Danaus admin</title>

						<div class="flex flex-col gap-4">
							<h3 class="text-base-400 font-medium">New account</h3>

							<form {...createAccountForm} class="flex max-w-96 flex-col gap-6">
								<Field label="Handle" required validationMessageText={fields.handle.issues()?.[0]!.message}>
									<div class="flex gap-2">
										<Input {...fields.handle.as('text')} placeholder="alice" required class="grow" />

										<Select {...fields.domain.as('select')} options={domainOptions} />
									</div>
								</Field>

								<Field label="Email" required validationMessageText={fields.email.issues()?.[0]!.message}>
									<Input {...fields.email.as('email')} placeholder="alice@example.com" required />
								</Field>

								<Field
									label="Password"
									required
									validationMessageText={fields.password.issues()?.[0]!.message}
								>
									<Input {...fields.password.as('password')} required />
								</Field>

								<div class="flex gap-3 pt-2">
									<Button type="submit" variant="primary">
										Create account
									</Button>
									<Button href={routes.admin.accounts.index.href()} variant="outlined">
										Cancel
									</Button>
								</div>
							</form>
						</div>
					</AdminLayout>,
				);
			},
		},
	},
} satisfies Controller<typeof routes.admin>;
