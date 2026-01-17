import { isHandle } from '@atcute/lexicons/syntax';
import { defaultExceptionHandler, XRPCRouter } from '@atcute/xrpc-server';
import { createBunWebSocket } from '@atcute/xrpc-server-bun';
import { cors } from '@atcute/xrpc-server/middlewares/cors';

import webauthnAuthenticateScript from '#web/scripts/webauthn-authenticate.js' with { type: 'file' };
import webauthnRegisterScript from '#web/scripts/webauthn-register.js' with { type: 'file' };
import styles from '#web/styles/main.out.css' with { type: 'file' };

import { appBsky } from './api/app.bsky/index.ts';
import { comAtproto } from './api/com.atproto/index.ts';
import { localDanaus } from './api/local.danaus/index.ts';
import type { AppConfig } from './config.ts';
import { createAppContext, type AppContext } from './context.ts';
import { createWebRouter } from './web/router.ts';

export interface PdsServerOptions {
	config: AppConfig;
}

/**
 * bun-backed danaus pds server.
 */
export class PdsServer implements AsyncDisposable {
	readonly config: AppConfig;

	#instance?: {
		disposables: AsyncDisposableStack;
		server: ReturnType<typeof Bun.serve>;
		context: AppContext;
	};

	constructor(options: PdsServerOptions) {
		this.config = options.config;
	}

	/**
	 * start listening for requests.
	 * @returns bun server instance
	 */
	async start(): Promise<void> {
		if (this.#instance) {
			return;
		}

		await using disposables = new AsyncDisposableStack();

		const context = createAppContext(this.config);

		// register cleanup in reverse dependency order
		// NOTE: Bun/JSCore quirk - AsyncDisposableStack.use() requires AsyncDisposable,
		// doesn't accept Disposable like the spec allows, so we use defer() instead
		disposables.defer(() => context.backgroundQueue.dispose());
		disposables.defer(() => context.identityCache.dispose());
		disposables.defer(() => context.accountManager.dispose());

		const { wrap, adapter } = createBunWebSocket();
		const router = new XRPCRouter({
			websocket: adapter,
			middlewares: [
				cors({
					exclude: ['local.danaus.*'],
					allowedHeaders: ['x-bsky-topics'],
					allowPrivateNetwork: true,
				}),
			],
			handleNotFound: context.proxy.handleNotFound,
			handleException(err, request) {
				return defaultExceptionHandler(err, request);
			},
		});

		const wrapped = wrap(router);

		appBsky(router, context);
		comAtproto(router, context);
		localDanaus(router, context);

		const web = createWebRouter(context);

		const corsHeaders = { 'access-control-allow-origin': '*' };

		const server: ReturnType<typeof Bun.serve> = Bun.serve({
			port: this.config.service.port,
			hostname: this.config.service.hostname,
			websocket: wrapped.websocket,
			routes: {
				'/.well-known/atproto-did'(req: Request) {
					const host = req.headers.get('host');
					if (host === null) {
						return new Response('User not found', { status: 400, headers: corsHeaders });
					}

					// strip port if present
					const handle = host.includes(':') ? host.slice(0, host.indexOf(':')) : host;
					if (!isHandle(handle)) {
						return new Response('User not found', { status: 404, headers: corsHeaders });
					}

					const supportedHandle = context.config.identity.serviceHandleDomains.some(
						(domain) => handle.endsWith(domain) || handle === domain.slice(1),
					);
					if (!supportedHandle) {
						return new Response('User not found', { status: 404, headers: corsHeaders });
					}

					const account = context.accountManager.getAccount(handle);
					if (account === null) {
						return new Response('User not found', { status: 404, headers: corsHeaders });
					}

					return new Response(account.did, {
						headers: { 'content-type': 'text/plain', ...corsHeaders },
					});
				},

				'/xrpc/_health': Response.json(
					{ version: `danaus-${context.config.service.version}` },
					{ headers: corsHeaders },
				),
				'/xrpc/*': wrapped.fetch,

				'/assets/style.css': new Response(Bun.file(styles)),
				'/assets/webauthn-register.js': new Response(Bun.file(webauthnRegisterScript)),
				'/assets/webauthn-authenticate.js': new Response(Bun.file(webauthnAuthenticateScript)),

				'/*': (request) => web.fetch(request),
			},
		});
		disposables.defer(() => server.stop());

		this.#instance = {
			disposables: disposables.move(),
			context: context,
			server: server,
		};
	}

	/**
	 * stop the server and release resources.
	 */
	async dispose(): Promise<void> {
		if (this.#instance) {
			await this.#instance.disposables[Symbol.asyncDispose]();
			this.#instance = undefined;
		}
	}

	async [Symbol.asyncDispose]() {
		await this.dispose();
	}

	get server(): ReturnType<typeof Bun.serve> | undefined {
		return this.#instance?.server;
	}

	/**
	 * service context.
	 * @returns app context
	 */
	get context(): AppContext | undefined {
		return this.#instance?.context;
	}

	/**
	 * service base url.
	 * @returns service url
	 */
	get url(): string {
		return this.config.service.publicUrl;
	}

	/**
	 * service port.
	 * @returns port number
	 */
	get port(): number {
		return this.server?.port ?? this.config.service.port;
	}
}
