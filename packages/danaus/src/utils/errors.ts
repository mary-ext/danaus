export const isErrnoException = (err: unknown): err is NodeJS.ErrnoException => {
	return err instanceof Error && 'errno' in err;
};
