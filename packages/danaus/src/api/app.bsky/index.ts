import type { XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { getPreferences } from './actor.getPreferences';
import { putPreferences } from './actor.putPreferences';

export const appBsky = (router: XRPCRouter, context: AppContext) => {
	getPreferences(router, context);
	putPreferences(router, context);
};
