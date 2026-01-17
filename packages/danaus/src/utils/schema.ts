import { isKeyDid } from '@atcute/identity';
import { isDid, type Did } from '@atcute/lexicons/syntax';

import * as v from 'valibot';

const HOSTNAME_RE =
	/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

const HOSTNAME_SUFFIX_RE =
	/^\.([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export const isHostnameSuffix = (input: string) => {
	return HOSTNAME_SUFFIX_RE.test(input);
};

export const str = v.string();

export const strbool = v.pipe(
	str,
	v.rawTransform(({ dataset, addIssue, NEVER }) => {
		const input = dataset.value;

		if (input === 'true' || input === 'yes' || input === '1') {
			return true;
		}
		if (input === 'false' || input === 'no' || input === '0') {
			return false;
		}

		addIssue({ message: `must be a stringbool` });
		return NEVER;
	}),
);

export const strlist = v.pipe(
	str,
	v.transform((input) => {
		if (input.length === 0) {
			return [];
		}

		return input.split(',');
	}),
);

export const strint = v.pipe(str, v.toNumber(), v.safeInteger());

export const port = v.pipe(strint, v.minValue(0), v.maxValue(65535));

export const hostname = v.pipe(str, v.regex(HOSTNAME_RE, `must be a valid hostname`));

export const url = v.pipe(str, v.url());

export const email = v.pipe(str, v.email());

export const did = v.custom<Did>((input) => isDid(input), `must be a did`);

export const didKey = v.custom<Did<'key'>>(
	(input) => typeof input === 'string' && isKeyDid(input),
	`must be a did:key`,
);

export const normalizeWhitespace = v.transform<string, string>((input) => {
	return input.replace(/\s+/g, ' ').trim();
});
