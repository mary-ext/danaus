import type { BuildAction } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { BaseLayout } from '#web/layouts/base.tsx';
import Button from '#web/primitives/button.tsx';
import Field from '#web/primitives/field.tsx';
import Input from '#web/primitives/input.tsx';
import { routes } from '#web/routes.ts';

import { loginForm } from './lib/forms';

export default {
	middleware: [forms({ loginForm })],
	action({ url }) {
		const { fields } = loginForm;

		const redirectUrl = url.searchParams.get('redirect') ?? fields.redirect.value();

		return render(
			<BaseLayout>
				<title>Sign in - Danaus</title>

				<div class="flex flex-1 items-center justify-center p-4">
					<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
						<form {...loginForm} class="flex flex-col gap-6">
							<h1 class="text-base-500 font-semibold">Sign in to your account</h1>

							<input {...fields.redirect.as('hidden', redirectUrl ?? routes.account.overview.href())} />

							<Field
								label="Handle or email"
								required
								validationMessageText={fields.identifier.issues()?.[0]!.message}
							>
								<Input
									{...fields.identifier.as('text')}
									autocomplete="username"
									placeholder="alice.bsky.social"
									required
									autofocus
								/>
							</Field>

							<Field
								label="Password"
								required
								validationMessageText={fields._password.issues()?.[0]!.message}
							>
								<Input {...fields._password.as('password')} autocomplete="current-password" required />
							</Field>

							<Button type="submit" variant="primary">
								Sign in
							</Button>
						</form>
					</div>
				</div>
			</BaseLayout>,
		);
	},
} satisfies BuildAction<'ANY', typeof routes.login.show>;
