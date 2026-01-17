import { redirect } from '@oomfware/fetch-router';
import { form } from '@oomfware/forms';

import * as v from 'valibot';

import { requireSudo } from '#app/web/lib/forms.ts';
import { routes } from '#app/web/routes.ts';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';

export const generateBackupCodesForm = form(v.object({}), async () => {
	const { accountManager } = getAppContext();
	const { did } = getSession();

	requireSudo();

	accountManager.generateRecoveryCodes(did);

	redirect(routes.account.security.recovery.show.href());
});

export const deleteBackupCodesForm = form(v.object({}), async () => {
	const { accountManager } = getAppContext();
	const { did } = getSession();

	requireSudo();

	accountManager.deleteRecoveryCodes(did);

	redirect(routes.account.security.overview.href());
});
