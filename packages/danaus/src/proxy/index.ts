import { InvalidRequestError, type FetchMiddleware } from '@atcute/xrpc-server';
import { createServiceJwt } from '@atcute/xrpc-server/auth';

import type { AppContext } from '#app/context.ts';

import {
	buildProxyRequestHeaders,
	filterResponseHeaders,
	parseProxyHeader,
	parseRequestNsid,
} from './utils.ts';

/**
 * create proxy middleware that forwards requests to external services.
 * the middleware activates when the `atproto-proxy` header is present.
 * @param ctx app context
 * @returns fetch middleware
 */
export const createProxyMiddleware = (ctx: AppContext): FetchMiddleware => {
	return async (request, next) => {
		const proxyHeader = request.headers.get('atproto-proxy');
		if (!proxyHeader) {
			return next(request);
		}

		// only allow GET, HEAD, POST
		if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
			throw new InvalidRequestError({ description: `XRPC requests only support GET, HEAD, and POST` });
		}

		// parse NSID from request path
		const lxm = parseRequestNsid(request);

		// parse proxy header and resolve target
		const target = await parseProxyHeader(ctx, proxyHeader, lxm);
		if (target === null) {
			// NSID is excluded from proxying for this target
			return next(request);
		}

		// verify authorization and get user DID
		const auth = await ctx.authVerifier.authorization(request);

		// load user's signing keypair
		const keypair = await ctx.actorManager.importKeypair(auth.did);

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

		const upstreamHeaders = buildProxyRequestHeaders(request, serviceJwt);

		const upstreamRequest = new Request(upstreamUrl.toString(), {
			method: request.method,
			headers: upstreamHeaders,
			body: request.method === 'POST' ? request.body : null,
			duplex: request.method === 'POST' ? 'half' : undefined,
		});

		// forward request
		const upstreamResponse = await fetch(upstreamRequest);

		upstreamResponse
			.clone()
			.text()
			.then((text) => {
				console.log(`${auth.did} -> ${upstreamUrl.toString()}`);
				console.log(text);
			});

		// build response with filtered headers
		const responseHeaders = filterResponseHeaders(upstreamResponse.headers);

		return new Response(upstreamResponse.body, {
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: responseHeaders,
		});
	};
};
