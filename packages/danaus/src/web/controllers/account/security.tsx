import type { Controller } from '@oomfware/fetch-router';

import type { routes } from '#web/routes.ts';

import overview from './security/overview.tsx';
import recovery from './security/recovery.tsx';
import totp from './security/totp.tsx';

export default {
	middleware: [],
	actions: {
		overview,
		totp,
		recovery,
	},
} satisfies Controller<typeof routes.account.security>;
