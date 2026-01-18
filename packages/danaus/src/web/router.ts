import { createRouter, type Middleware } from '@oomfware/fetch-router';
import { asyncContext } from '@oomfware/fetch-router/middlewares/async-context';

import { withContext } from '@logtape/logtape';

import type { AppContext } from '#app/context.ts';
import { generateRequestId, httpLogger } from '#app/logger.ts';

import accountController from './controllers/account.tsx';
import adminController from './controllers/admin.tsx';
import assetsController from './controllers/assets.ts';
import homeController from './controllers/home.tsx';
import loginController from './controllers/login.tsx';
import oauthController from './controllers/oauth.tsx';
import verifyController from './controllers/verify.tsx';
import { provideAppContext } from './middlewares/app-context.ts';
import { routes } from './routes.ts';

/**
 * middleware that logs incoming requests and sets implicit logging context.
 */
const requestLogger = (): Middleware => {
	return async ({ request }, next) => {
		const requestId = generateRequestId();
		const { pathname } = new URL(request.url);
		const method = request.method;

		return withContext({ requestId, path: pathname, method }, async () => {
			const start = performance.now();
			httpLogger.debug('request started');

			const response = await next();

			httpLogger.info('request completed', {
				status: response.status,
				durationMs: Math.round(performance.now() - start),
			});

			return response;
		});
	};
};

/**
 * creates the web router with all routes and middleware.
 * @param ctx application context
 * @returns the configured router
 */
export const createWebRouter = (ctx: AppContext) => {
	const router = createRouter({
		middleware: [asyncContext(), requestLogger(), provideAppContext(ctx)],
	});

	router.map(routes.home, homeController);
	router.map(routes.assets, assetsController);
	router.map(routes.admin, adminController);
	router.map(routes.login, loginController);
	router.map(routes.verify, verifyController);
	router.map(routes.account, accountController);
	router.map(routes.oauth, oauthController);

	return router;
};
