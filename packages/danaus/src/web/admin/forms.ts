import type { Handle } from '@atcute/lexicons';
import { XRPCError } from '@atcute/xrpc-server';
import { redirect } from '@oomfware/fetch-router';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#app/accounts/passwords.ts';
import { provisionAccount } from '#app/api/local.danaus/account.createAccount.ts';

import { getAppContext } from '../middlewares/app-context.ts';

export const createAccountForm = form(
	v.object({
		handle: v.pipe(
			v.string(),
			v.minLength(1, `Handle is required`),
			v.maxLength(63, `Handle is too long`),
			v.regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/, `Invalid handle`),
		),
		domain: v.string(),
		email: v.pipe(v.string(), v.minLength(1, `Email is required`), v.email(`Invalid email`)),
		password: v.pipe(
			v.string(),
			v.minLength(1, `Password is required`),
			v.minLength(MIN_PASSWORD_LENGTH, `Password is too short`),
			v.maxLength(MAX_PASSWORD_LENGTH, `Password is too long`),
		),
	}),
	async (data, issue) => {
		const ctx = getAppContext();

		// validate domain against config
		if (!ctx.config.identity.serviceHandleDomains.includes(data.domain)) {
			invalid(issue.domain(`Invalid domain`));
		}

		const handle = `${data.handle}${data.domain}` as Handle;

		try {
			await provisionAccount(ctx, {
				handle,
				email: data.email,
				password: data.password,
			});

			redirect('/admin/accounts');
		} catch (err) {
			if (err instanceof XRPCError && err.status === 400) {
				switch (err.error) {
					case 'InvalidHandle':
					case 'UnsupportedDomain': {
						invalid(issue.handle(`Invalid handle`));
					}
					case 'HandleTaken': {
						invalid(issue.handle(`Handle is already taken`));
					}
					case 'InvalidEmail': {
						invalid(issue.email(`Invalid email`));
					}
					case 'EmailTaken': {
						invalid(issue.email(`Email is already taken`));
					}
					case 'InvalidPassword': {
						invalid(issue.password(`Invalid password`));
					}
					default: {
						invalid(`Something went wrong`);
					}
				}
			}

			throw err;
		}
	},
);
