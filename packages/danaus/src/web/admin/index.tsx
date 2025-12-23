import { Hono } from 'hono';
import { jsxRenderer } from 'hono/jsx-renderer';

import { parseBasicAuth } from '#app/auth/verifier.ts';
import type { AppContext } from '#app/context.ts';

import { IdProvider } from '../components/id.tsx';
import { registerForms } from '../forms/index.ts';
import Group1Outlined from '../icons/central/group-1-outlined.tsx';
import HomeOpenOutlined from '../icons/central/home-open-outlined.tsx';
import MagnifyingGlassOutlined from '../icons/central/magnifying-glass-outlined.tsx';
import PlusLargeOutlined from '../icons/central/plus-large-outlined.tsx';
import Button from '../primitives/button.tsx';
import Field from '../primitives/field.tsx';
import Input from '../primitives/input.tsx';
import Select from '../primitives/select.tsx';

import AsideItem from './components/aside-item.tsx';
import StatCard from './components/stat-card.tsx';
import { createAdminForms } from './forms.ts';

const REALM = `admin`;

export const createAdminApp = (ctx: AppContext) => {
	const app = new Hono();
	const main = new Hono();

	const adminPassword = ctx.config.secrets.adminPassword;
	if (adminPassword === null) {
		app.use(async (c, _next) => {
			return c.text(`Administration UI is disabled`);
		});

		return app;
	}

	app.use(async (c, next) => {
		const auth = parseBasicAuth(c.req.raw);
		if (auth === null || auth.password !== adminPassword) {
			return c.text(`Unauthorized`, 401, {
				'www-authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
			});
		}

		await next();
	});

	const forms = createAdminForms(ctx);
	app.use(registerForms(forms));

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

	main.use(
		jsxRenderer(({ children, Layout: Html }) => {
			return (
				<Html>
					<div class="flex flex-col gap-4 p-4 sm:p-16 sm:pt-24 lg:grid lg:grid-cols-[280px_minmax(0,640px)] lg:justify-center">
						<aside class="-ml-2 flex flex-col gap-2 sm:ml-0">
							<h2 class="pb-2 pl-4 text-base-400 font-medium">PDS administration</h2>

							<div class="flex flex-col gap-px">
								<AsideItem href="/admin" exact icon={<HomeOpenOutlined size={20} />}>
									Home
								</AsideItem>

								<AsideItem href="/admin/accounts" icon={<Group1Outlined size={20} />}>
									Accounts
								</AsideItem>
							</div>
						</aside>

						<hr class="border-neutral-stroke-1 sm:hidden" />

						<main>{children}</main>
					</div>
				</Html>
			);
		}),
	);

	// #region home route
	main.get('/', (c) => {
		const accountStats = ctx.accountManager.getAccountStats();
		const inviteCodeStats = ctx.accountManager.getInviteCodeStats();
		const sequencerStats = ctx.sequencer.getStats();

		return c.render(
			<>
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
			</>,
		);
	});
	// #endregion

	// #region accounts routes
	main.get('/accounts', (c) => {
		const query = c.req.query('q') ?? '';
		const cursor = c.req.query('cursor');

		const { accounts, cursor: nextCursor } = ctx.accountManager.listAccounts({
			query: query || undefined,
			cursor,
			limit: 50,
		});

		const buildHref = (nextCursor: string) => {
			const params = new URLSearchParams();
			if (query) {
				params.set('q', query);
			}
			params.set('cursor', nextCursor);
			return `/admin/accounts?${params.toString()}`;
		};

		return c.render(
			<>
				<title>Accounts - Danaus admin</title>

				<div class="flex flex-col gap-4">
					<h3 class="text-base-400 font-medium">Accounts</h3>

					<div class="flex gap-2">
						<form method="get" action="/admin/accounts" class="contents">
							<Input
								type="search"
								name="q"
								value={query}
								placeholder="Search by handle or email..."
								contentBefore={<MagnifyingGlassOutlined size={16} />}
								class="grow"
							/>
						</form>

						<Button label="New account" href="/admin/accounts/new" variant="primary">
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
											<span class="truncate text-base-200 text-neutral-foreground-3">{account.email}</span>
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
			</>,
		);
	});

	main.on(['GET', 'POST'], '/accounts/new', (c) => {
		const domains = ctx.config.identity.serviceHandleDomains;
		const domainOptions = domains.map((d) => ({ value: d, label: d }));

		const { createAccountForm } = forms;
		const { fields } = createAccountForm;

		return c.render(
			<>
				<title>New account - Danaus admin</title>

				<div class="flex flex-col gap-4">
					<h3 class="text-base-400 font-medium">New account</h3>

					<form {...createAccountForm} class="flex max-w-96 flex-col gap-6">
						<Field label="Handle" required validationMessageText={fields.handle.issues()[0]?.message}>
							<div class="flex gap-2">
								<Input {...fields.handle.as('text')} placeholder="alice" required class="grow" />

								<Select {...fields.domain.as('select')} options={domainOptions} />
							</div>
						</Field>

						<Field label="Email" required validationMessageText={fields.email.issues()[0]?.message}>
							<Input {...fields.email.as('email')} placeholder="alice@example.com" required />
						</Field>

						<Field label="Password" required validationMessageText={fields.password.issues()[0]?.message}>
							<Input {...fields.password.as('password')} required />
						</Field>

						<div class="flex gap-3 pt-2">
							<Button type="submit" variant="primary">
								Create account
							</Button>
							<Button href="/admin/accounts" variant="outlined">
								Cancel
							</Button>
						</div>
					</form>
				</div>
			</>,
		);
	});
	// #endregion

	app.route('/', main);

	return app;
};
