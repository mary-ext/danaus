import path from 'node:path';

import type { BuildAction } from '@oomfware/fetch-router';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { routes } from '#web/routes.ts';

const resolveAssetPath = (assetsDirectory: string, assetPath: string): string | null => {
	let decodedPath = assetPath.replace(/^\/+/, '');
	if (!decodedPath) {
		return null;
	}

	try {
		decodedPath = decodeURIComponent(decodedPath);
	} catch {
		return null;
	}

	const resolvedAssetsDir = path.resolve(assetsDirectory);
	const resolvedAssetPath = path.resolve(resolvedAssetsDir, decodedPath);
	if (
		resolvedAssetPath === resolvedAssetsDir ||
		!resolvedAssetPath.startsWith(`${resolvedAssetsDir}${path.sep}`)
	) {
		return null;
	}

	return resolvedAssetPath;
};

export default {
	middleware: [],
	async action({ params, request }) {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response(null, { status: 405 });
		}

		const { config } = getAppContext();
		const assetPath = resolveAssetPath(config.service.publicAssetsDirectory, params.path ?? '');
		if (!assetPath) {
			return new Response(null, { status: 404 });
		}

		const response = new Response(Bun.file(assetPath));
		if (config.service.devMode) {
			response.headers.set('cache-control', 'no-cache');
		}

		return response;
	},
} satisfies BuildAction<'ANY', typeof routes.assets>;
