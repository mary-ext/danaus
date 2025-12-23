import type { XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { createAccount } from './account.createAccount';
import { signIn } from './account.signIn';
import { signOut } from './account.signOut';
import { getStats } from './admin.getStats';
import { getSubjectStatus } from './admin.getSubjectStatus';
import { updateSubjectStatus } from './admin.updateSubjectStatus';
import { createAppPassword } from './legacyAuth.createAppPassword';
import { deleteAppPassword } from './legacyAuth.deleteAppPassword';
import { listAppPasswords } from './legacyAuth.listAppPasswords';

export const localDanaus = (router: XRPCRouter, context: AppContext) => {
	createAccount(router, context);
	signIn(router, context);
	signOut(router, context);

	getStats(router, context);
	getSubjectStatus(router, context);
	updateSubjectStatus(router, context);

	createAppPassword(router, context);
	deleteAppPassword(router, context);
	listAppPasswords(router, context);
};
