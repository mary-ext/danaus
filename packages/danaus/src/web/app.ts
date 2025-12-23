import { Hono } from 'hono';

import type { AppContext } from '../context.ts';

import { createAccountApp } from './account/index.tsx';
import { createAdminApp } from './admin/index.tsx';
import { createOAuthApp } from './oauth/index.tsx';

export const createWebApp = (ctx: AppContext): Hono => {
	const app = new Hono();

	app.get('/', (c) => c.text(`This is an AT Protocol personal data server.`));
	app.route('/admin', createAdminApp(ctx));
	app.route('/account', createAccountApp(ctx));
	app.route('/oauth', createOAuthApp(ctx));

	return app;
};
