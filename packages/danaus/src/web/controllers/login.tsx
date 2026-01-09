import type { BuildAction } from '@oomfware/fetch-router';
import { forms } from '@oomfware/forms';
import { render } from '@oomfware/jsx';

import { signInForm } from '../account/forms.ts';
import { BaseLayout } from '../layouts/base.tsx';
import Button from '../primitives/button.tsx';
import Field from '../primitives/field.tsx';
import Input from '../primitives/input.tsx';
import type { routes } from '../routes.ts';

export default {
	middleware: [forms({ signInForm })],
	action() {
		const { fields } = signInForm;

		return render(
			<BaseLayout>
				<title>sign in - danaus</title>

				<div class="flex flex-1 items-center justify-center p-4">
					<div class="w-full max-w-96 rounded-xl bg-neutral-background-1 p-6 shadow-16">
						<form {...signInForm} class="flex flex-col gap-6">
							<h1 class="text-base-500 font-semibold">Sign in to your account</h1>

							<Field
								label="Handle or email"
								required
								validationMessageText={fields.identifier.issues()?.[0]!.message}
							>
								<Input {...fields.identifier.as('text')} placeholder="alice.bsky.social" required autofocus />
							</Field>

							<Field
								label="Password"
								required
								validationMessageText={fields._password.issues()?.[0]!.message}
							>
								<Input {...fields._password.as('password')} required />
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
} satisfies BuildAction<'ANY', typeof routes.home>;
