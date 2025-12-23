import { Hono } from 'hono';
import { jsxRenderer } from 'hono/jsx-renderer';

import type { AppContext } from '#app/context.ts';

import { IdProvider } from '../components/id.tsx';
import Button from '../primitives/button.tsx';

export const createOAuthApp = (_ctx: AppContext) => {
	const app = new Hono();

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

	// #region authorize route
	app.on(['GET', 'POST'], '/authorize', (c) => {
		return c.render(
			<>
				<title>authorize - danaus</title>

				<div class="flex flex-1 items-center justify-center p-4">
					<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
						<div class="flex flex-col gap-4">
							<h1 class="text-base-500 font-semibold">authorize application</h1>

							<p class="text-base-300 text-neutral-foreground-3">
								OAuth authorization is not yet implemented.
							</p>

							<Button href="/account" variant="outlined">
								Back to account
							</Button>
						</div>
					</div>
				</div>
			</>,
		);
	});
	// #endregion

	return app;
};
