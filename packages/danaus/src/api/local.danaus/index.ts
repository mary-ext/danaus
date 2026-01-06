import type { XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { createAccount } from './account.createAccount';
import { getStats } from './admin.getStats';
import { getSubjectStatus } from './admin.getSubjectStatus';
import { updateSubjectStatus } from './admin.updateSubjectStatus';

export const localDanaus = (router: XRPCRouter, context: AppContext) => {
	createAccount(router, context);

	getStats(router, context);
	getSubjectStatus(router, context);
	updateSubjectStatus(router, context);
};
