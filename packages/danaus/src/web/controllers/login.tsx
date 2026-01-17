import type { Controller } from '@oomfware/fetch-router';

import type { routes } from '../routes.ts';

import mfa from './login/mfa.tsx';
import show from './login/show.tsx';
import sudo from './login/sudo.tsx';

export default {
	middleware: [],
	actions: {
		mfa: mfa,
		show: show,
		sudo: sudo,
	},
} satisfies Controller<typeof routes.login>;
