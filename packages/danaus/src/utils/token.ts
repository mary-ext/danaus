// inspired by Apple's random strong password generator

import { randomInt } from 'node:crypto';

/** consonants for password generation (20 chars) */
const CONSONANTS = 'bcdfghjkmnpqrstvwxyz';

/** vowels for password generation (5 chars) */
const VOWELS = 'aeiou';

/** digit positions for email tokens (starts and ends of groups) */
const EMAIL_TOKEN_DIGIT_POSITIONS = [0, 5, 7, 12];

/** digit positions for app passwords (starts and ends of groups) */
const APP_PASSWORD_DIGIT_POSITIONS = [0, 5, 7, 12, 14, 19];

/** uppercase positions for app passwords (letters) */
const APP_PASSWORD_UPPER_POSITIONS = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19];

const c = () => CONSONANTS[randomInt(CONSONANTS.length)]!;
const v = () => VOWELS[randomInt(VOWELS.length)]!;

/**
 * generates a random email token
 * @returns random token like "1erson-timgep"
 */
export const generateEmailToken = (): string => {
	const g = () => [c(), v(), c(), c(), v(), c()];

	const chars = [...g(), `-`, ...g()];

	// place one digit at the end of either group
	const digitPos = EMAIL_TOKEN_DIGIT_POSITIONS[randomInt(EMAIL_TOKEN_DIGIT_POSITIONS.length)]!;
	chars[digitPos] = randomInt(10).toString();

	return chars.join('');
};

/**
 * generates a random app password
 * @returns random password like "yaqrox-4urhif-fiqcEz"
 */
export const generateAppPassword = (): string => {
	const g = () => [c(), v(), c(), c(), v(), c()];

	const chars = [...g(), `-`, ...g(), `-`, ...g()];

	// place one uppercase letter at a random position
	const upperPos = APP_PASSWORD_UPPER_POSITIONS[randomInt(APP_PASSWORD_UPPER_POSITIONS.length)]!;
	chars[upperPos] = chars[upperPos]!.toUpperCase();

	// place one digit at one of the allowed positions
	const digitPos = APP_PASSWORD_DIGIT_POSITIONS[randomInt(APP_PASSWORD_DIGIT_POSITIONS.length)]!;
	chars[digitPos] = randomInt(10).toString();

	return chars.join('');
};

/**
 * generates a random invite code
 * @returns invite code like "kefwic-catcog"
 */
export const generateInviteCode = (): string => {
	const g = () => [c(), v(), c(), c(), v(), c()];

	const chars = [...g(), `-`, ...g()];

	return chars.join('');
};
