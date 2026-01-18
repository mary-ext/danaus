import { invalid } from '@oomfware/forms';

import { getAppContext } from '../middlewares/app-context';
import { getSession } from '../middlewares/session';

/**
 * require the current session to be in sudo mode.
 * refreshes the sudo timeout on success.
 * calls invalid() if not elevated.
 */
export const requireSudo = (): void => {
	const { webSessionManager } = getAppContext();
	const session = getSession();

	if (!webSessionManager.isSessionElevated(session)) {
		invalid(`Elevated permission has expired, reauthenticate again.`);
	}

	// refresh the sudo timeout
	webSessionManager.elevateSession(session.id);
};
