import { getAtprotoServiceEndpoint, isAtprotoAudience } from '@atcute/identity';
import type { Did, Nsid } from '@atcute/lexicons';
import { isNsid, type AtprotoDid } from '@atcute/lexicons/syntax';
import { InvalidRequestError } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

export interface ProxyTarget {
	did: Did;
	url: string;
}

/**
 * parse atproto-proxy header and resolve service endpoint.
 * @param ctx app context
 * @param header proxy header value (format: `did#serviceId`)
 * @param nsid request NSID to check exclusions
 * @returns resolved proxy target with DID and URL, or null if NSID is excluded
 */
export const parseProxyHeader = async (
	ctx: AppContext,
	header: string,
	nsid: Nsid,
): Promise<ProxyTarget | null> => {
	if (!isAtprotoAudience(header)) {
		throw new InvalidRequestError({ description: `invalid atproto-proxy header` });
	}

	const targetConfig = ctx.config.proxy.targets.get(header);

	// check if NSID is excluded for this target
	if (targetConfig?.exclude?.includes(nsid)) {
		return null;
	}

	// resolve audience (with optional redirect)
	const audience = targetConfig?.to ?? header;

	const hashIndex = audience.indexOf('#');
	const did = audience.slice(0, hashIndex) as AtprotoDid;
	const serviceId = audience.slice(hashIndex) as `#${string}`;

	const didDoc = await ctx.didDocumentResolver.resolve(did);
	if (!didDoc) {
		throw new InvalidRequestError({ description: `could not resolve proxy did` });
	}

	const url = getAtprotoServiceEndpoint(didDoc, { id: serviceId });
	if (!url) {
		throw new InvalidRequestError({ description: `could not resolve proxy service url` });
	}

	return { did, url };
};

// #region request headers

const REQUEST_HEADERS_TO_FORWARD = ['accept-encoding', 'accept-language', 'atproto-accept-labelers'] as const;

const REQUEST_CONTENT_HEADERS = ['content-type', 'content-encoding', 'content-length'] as const;

/**
 * build headers for upstream proxy request.
 * @param req original request
 * @param serviceJwt service auth JWT
 * @returns headers for upstream request
 */
export const buildProxyRequestHeaders = (req: Request, serviceJwt: string): Headers => {
	const headers = new Headers();

	// forward standard headers
	for (const name of REQUEST_HEADERS_TO_FORWARD) {
		const value = req.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	// ensure accept-encoding has a value
	if (!headers.has('accept-encoding')) {
		headers.set('accept-encoding', 'identity');
	}

	// forward all x-* headers
	for (const [name, value] of req.headers) {
		if (name.startsWith('x-')) {
			headers.set(name, value);
		}
	}

	// forward content headers for POST requests
	if (req.method === 'POST') {
		for (const name of REQUEST_CONTENT_HEADERS) {
			const value = req.headers.get(name);
			if (value) {
				headers.set(name, value);
			}
		}
	}

	// set service auth
	headers.set('authorization', `Bearer ${serviceJwt}`);

	return headers;
};

// #endregion
// #region response headers

const RESPONSE_HEADERS_TO_FORWARD = [
	'content-type',
	'content-language',
	'atproto-repo-rev',
	'atproto-content-labelers',
	'retry-after',
] as const;

/**
 * filter headers from upstream response.
 * @param upstreamHeaders headers from upstream response
 * @returns filtered headers for client response
 */
export const filterResponseHeaders = (upstreamHeaders: Headers): Headers => {
	const headers = new Headers();

	// forward specific headers
	for (const name of RESPONSE_HEADERS_TO_FORWARD) {
		const value = upstreamHeaders.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	// forward all x-* headers
	for (const [name, value] of upstreamHeaders) {
		if (name.startsWith('x-')) {
			headers.set(name, value);
		}
	}

	return headers;
};

// #endregion
// #region nsid parsing

/**
 * parse NSID from request path.
 * @param req request
 * @returns NSID or null if not an XRPC request
 */
export const parseRequestNsid = (req: Request): Nsid => {
	const url = new URL(req.url);
	if (!url.pathname.startsWith('/xrpc/')) {
		throw new InvalidRequestError({ description: `invalid XRPC request path` });
	}

	const nsid = url.pathname.slice('/xrpc/'.length);
	if (!isNsid(nsid)) {
		throw new InvalidRequestError({ description: `invalid XRPC request path` });
	}

	return nsid;
};

// #endregion
