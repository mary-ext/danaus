import type { Handle } from '@atcute/lexicons';

const DISALLOWED_TLDS = [
	'.local',
	'.arpa',
	'.invalid',
	'.localhost',
	'.internal',
	'.example',
	'.alt',
	// policy could concievably change on ".onion" some day
	'.onion',
	// NOTE: .test is allowed in testing and devopment. In practical terms
	// "should" "never" actually resolve and get registered in production
];

const endsWithAny = (str: string, suffixes: string[]): boolean => {
	return suffixes.some((suffix) => str.endsWith(suffix));
};

export const isServiceDomain = (handle: Handle, availableUserDomains: string[]): boolean => {
	return endsWithAny(handle, availableUserDomains);
};

export const isValidTld = (handle: Handle): boolean => {
	return !endsWithAny(handle, DISALLOWED_TLDS);
};
