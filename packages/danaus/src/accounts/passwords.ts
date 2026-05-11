import { InvalidRequestError } from '@atcute/xrpc-server';

const PASSWORD_ALG = 'argon2id';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;

export const verifyPasswordConstraints = (password: string): void => {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new InvalidRequestError({
			error: 'InvalidPassword',
			message: `password too short`,
		});
	}

	if (password.length > MAX_PASSWORD_LENGTH) {
		throw new InvalidRequestError({
			error: 'InvalidPassword',
			message: 'password too long',
		});
	}
};

export const hashPassword = async (password: string): Promise<string> => {
	verifyPasswordConstraints(password);

	const hash = await Bun.password.hash(password, {
		algorithm: PASSWORD_ALG,
		memoryCost: 65536,
		timeCost: 2,
	});

	return hash;
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
	verifyPasswordConstraints(password);

	const valid = await Bun.password.verify(password, hash, PASSWORD_ALG);

	return valid;
};
