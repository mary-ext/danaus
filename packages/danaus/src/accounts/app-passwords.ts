import { InvalidRequestError } from '@atcute/xrpc-server';

import { AppPasswordPrivilege } from './db/schema';

export type AppPasswordPrivilegeString = 'limited' | 'privileged' | 'full';

const privilegeToString = new Map<AppPasswordPrivilege, AppPasswordPrivilegeString>([
	[AppPasswordPrivilege.Limited, 'limited'],
	[AppPasswordPrivilege.Privileged, 'privileged'],
	[AppPasswordPrivilege.Full, 'full'],
]);

const stringToPrivilege = new Map<AppPasswordPrivilegeString, AppPasswordPrivilege>([
	['limited', AppPasswordPrivilege.Limited],
	['privileged', AppPasswordPrivilege.Privileged],
	['full', AppPasswordPrivilege.Full],
]);

/**
 * parse a lexicon privilege string into a privilege enum.
 * @param privilege privilege string
 * @returns privilege enum
 */
export const parseAppPasswordPrivilege = (privilege: string): AppPasswordPrivilege => {
	if (isAppPasswordPrivilegeString(privilege)) {
		return stringToPrivilege.get(privilege)!;
	}

	throw new InvalidRequestError({
		error: 'InvalidAppPasswordPrivilege',
		description: `invalid app password privilege`,
	});
};

/**
 * format a privilege enum for lexicon output.
 * @param privilege privilege enum
 * @returns privilege string
 */
export const formatAppPasswordPrivilege = (privilege: AppPasswordPrivilege): AppPasswordPrivilegeString => {
	const value = privilegeToString.get(privilege);
	if (!value) {
		throw new InvalidRequestError({
			error: 'InvalidAppPasswordPrivilege',
			description: `invalid app password privilege`,
		});
	}

	return value;
};

/**
 * check whether a value is an app password privilege string.
 * @param value input value
 * @returns true when it is a valid privilege string
 */
export const isAppPasswordPrivilegeString = (value: string): value is AppPasswordPrivilegeString => {
	return value === 'limited' || value === 'privileged' || value === 'full';
};
