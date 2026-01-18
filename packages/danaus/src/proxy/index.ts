import type { DidDocumentResolver } from '@atcute/identity-resolver';
import { defaultNotFoundHandler, InvalidRequestError, type NotFoundHandler } from '@atcute/xrpc-server';
import { createServiceJwt } from '@atcute/xrpc-server/auth';

import type { ActorManager } from '#app/actors/manager.ts';
import type { AuthVerifier } from '#app/auth/verifier.ts';
import type { ProxyTargetConfig } from '#app/config.ts';
import { proxyLogger } from '#app/logger.ts';

import {
	buildProxyRequestHeaders,
	buildProxyRequestHeadersWithInput,
	filterResponseHeaders,
	parseProxyHeader,
	parseRequestNsid,
} from './utils.ts';

export type { ProxyTarget } from './utils.ts';

export type PassthroughFn = (request: Request, input?: unknown) => Promise<void>;

export interface ServiceProxy {
	/** not-found handler for XRPCRouter that proxies unhandled requests */
	handleNotFound: NotFoundHandler;
	/**
	 * proxy the request to an external service and throw the response.
	 * use this in local handlers that want to delegate to the atproto-proxy target.
	 * @param request original request
	 * @param input parsed input body for POST requests (if body was already consumed)
	 * @throws Response from the proxied request, or returns if no atproto-proxy header
	 */
	passthrough: PassthroughFn;
}

export interface ServiceProxyOptions {
	targets: Map<string, ProxyTargetConfig>;
	authVerifier: AuthVerifier;
	actorManager: ActorManager;
	didDocumentResolver: DidDocumentResolver<string>;
}

/**
 * create service proxy handlers.
 * @param options proxy dependencies
 * @returns handleNotFound for XRPCRouter and passthrough for local handlers
 */
export const createServiceProxy = (options: ServiceProxyOptions): ServiceProxy => {
	const { targets, authVerifier, actorManager, didDocumentResolver } = options;

	/**
	 * core proxy logic - performs the actual proxying.
	 */
	const proxyRequest = async (request: Request, input?: unknown): Promise<Response> => {
		const proxyHeader = request.headers.get('atproto-proxy');
		if (!proxyHeader) {
			throw new InvalidRequestError({ description: `missing atproto-proxy header` });
		}

		// only allow GET, HEAD, POST
		if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
			throw new InvalidRequestError({ description: `XRPC requests only support GET, HEAD, and POST` });
		}

		// dev-only check: input should not be provided for GET requests
		if (import.meta.env?.DEV && input !== undefined && request.method === 'GET') {
			throw new Error(`passthrough: input provided for GET request`);
		}

		// parse NSID from request path
		const lxm = parseRequestNsid(request);

		// parse proxy header and resolve target
		const target = await parseProxyHeader(targets, didDocumentResolver, proxyHeader, lxm);
		if (target === null) {
			// NSID is excluded from proxying for this target
			throw new InvalidRequestError({ description: `method not found` });
		}

		// verify authorization and get user DID
		const auth = await authVerifier.authorization(request);

		// load user's signing keypair
		const keypair = await actorManager.importKeypair(auth.did);

		// create service auth JWT signed with user's key
		const serviceJwt = await createServiceJwt({
			keypair: keypair,
			issuer: auth.did,
			audience: target.did,
			lxm: lxm,
		});

		// build upstream request
		const upstreamUrl = new URL(request.url);
		upstreamUrl.protocol = new URL(target.url).protocol;
		upstreamUrl.host = new URL(target.url).host;

		let upstreamHeaders: Headers;
		let upstreamBody: Bun.BodyInit | null = null;

		if (input !== undefined) {
			// body was already consumed, reserialize from input
			upstreamHeaders = buildProxyRequestHeadersWithInput(request, serviceJwt);
			upstreamBody = JSON.stringify(input);
		} else if (request.method === 'POST') {
			// stream the original body
			upstreamHeaders = buildProxyRequestHeaders(request, serviceJwt);
			upstreamBody = request.body;
		} else {
			upstreamHeaders = buildProxyRequestHeaders(request, serviceJwt);
		}

		const upstreamRequest = new Request(upstreamUrl.toString(), {
			method: request.method,
			headers: upstreamHeaders,
			body: upstreamBody,
			duplex: upstreamBody !== null ? 'half' : undefined,
		});

		// forward request
		let upstreamResponse: Response;
		try {
			upstreamResponse = await fetch(upstreamRequest);
		} catch (err) {
			proxyLogger.error('upstream service unreachable', { err, target: target.url });
			throw err;
		}

		// build response with filtered headers
		const responseHeaders = filterResponseHeaders(upstreamResponse.headers);

		return new Response(upstreamResponse.body, {
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: responseHeaders,
		});
	};

	const handleNotFound: NotFoundHandler = async (request) => {
		const proxyHeader = request.headers.get('atproto-proxy');
		if (!proxyHeader) {
			return defaultNotFoundHandler(request);
		}

		return proxyRequest(request);
	};

	const passthrough: PassthroughFn = async (request, input) => {
		const proxyHeader = request.headers.get('atproto-proxy');
		if (!proxyHeader) {
			// no proxy header - continue with local handler logic
			return;
		}

		// dev-only check: input should not be provided for GET requests
		if (import.meta.env?.DEV && input !== undefined && request.method === 'GET') {
			throw new Error(`passthrough: input provided for GET request`);
		}

		// parse NSID from request path
		const lxm = parseRequestNsid(request);

		// check if NSID is excluded for this target
		const target = await parseProxyHeader(targets, didDocumentResolver, proxyHeader, lxm);
		if (target === null) {
			// NSID is excluded - continue with local handler logic
			return;
		}

		const response = await proxyRequest(request, input);
		throw response;
	};

	return { handleNotFound, passthrough };
};
