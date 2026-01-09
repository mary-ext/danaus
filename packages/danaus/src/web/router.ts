import { createRouter } from '@oomfware/fetch-router';
import { asyncContext } from '@oomfware/fetch-router/middlewares/async-context';

import type { AppContext } from '#app/context.ts';

import accountController from './controllers/account.tsx';
import adminController from './controllers/admin.tsx';
import homeController from './controllers/home.tsx';
import loginController from './controllers/login.tsx';
import oauthController from './controllers/oauth.tsx';
import { provideAppContext } from './middlewares/app-context.ts';
import { routes } from './routes.ts';

/**
 * creates the web router with all routes and middleware.
 * @param ctx application context
 * @returns the configured router
 */
export const createWebRouter = (ctx: AppContext) => {
	const router = createRouter({
		middleware: [asyncContext(), provideAppContext(ctx)],
	});

	router.map(routes.home, homeController);
	router.map(routes.admin, adminController);
	router.map(routes.login, loginController);
	router.map(routes.account, accountController);
	router.map(routes.oauth, oauthController);

	return router;
};
