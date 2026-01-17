import { AsyncLocalStorage } from 'node:async_hooks';

type BunServer = ReturnType<typeof Bun.serve>;

const serverStorage = new AsyncLocalStorage<BunServer>();

/**
 * runs a callback with the server available via AsyncLocalStorage.
 * @param server bun server instance
 * @param fn callback to run
 * @returns result of the callback
 */
export const runWithServer = <T>(server: BunServer, fn: () => T): T => {
	return serverStorage.run(server, fn);
};

/**
 * retrieves the bun server from the current async context.
 * @returns the bun server instance
 * @throws if called outside of a request context
 */
export const getServer = (): BunServer => {
	const server = serverStorage.getStore();
	if (server === undefined) {
		throw new Error('server not available in current context');
	}
	return server;
};
