import type { BuildAction } from '@oomfware/fetch-router';

import type { routes } from '../routes';

export default {
	middleware: [],
	action() {
		return new Response('This is an AT Protocol personal data server.');
	},
} satisfies BuildAction<'ANY', typeof routes.home>;
