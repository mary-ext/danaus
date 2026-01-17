import type { Controller } from '@oomfware/fetch-router';
import { render } from '@oomfware/jsx';

import { BaseLayout } from '#web/layouts/base.tsx';
import { requireSession } from '#web/middlewares/session.ts';
import { Button } from '#web/primitives/index.ts';
import { routes } from '#web/routes.ts';

export default {
	authorize: {
		middleware: [requireSession()],
		action() {
			return render(
				<BaseLayout>
					<title>authorize - danaus</title>

					<div class="flex flex-1 items-center justify-center p-4">
						<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
							<div class="flex flex-col gap-4">
								<h1 class="text-base-500 font-semibold">authorize application</h1>

								<p class="text-base-300 text-neutral-foreground-3">
									OAuth authorization is not yet implemented.
								</p>

								<Button href={routes.account.overview.href()} variant="outlined">
									Back to account
								</Button>
							</div>
						</div>
					</div>
				</BaseLayout>,
			);
		},
	},
} satisfies Controller<typeof routes.oauth>;
