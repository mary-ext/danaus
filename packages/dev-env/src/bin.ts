import { TestBsky } from './bsky.ts';
import { BSKY_PORT, PDS_PORT, PLC_PORT } from './const.ts';
import { TestPlc } from './plc.ts';

// polyfill for Node.js 22
if (typeof AsyncDisposableStack === 'undefined') {
	globalThis.AsyncDisposableStack = class ADS implements AsyncDisposableStack {
		#disposed = false;
		#stack: (() => Promise<void>)[] = [];

		readonly [Symbol.toStringTag] = 'AsyncDisposableStack';

		get disposed() {
			return this.#disposed;
		}

		use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
			if (this.#disposed) {
				throw new ReferenceError('AsyncDisposableStack already disposed');
			}
			if (value != null) {
				if (Symbol.asyncDispose in (value as object)) {
					this.#stack.push(async () => {
						await (value as AsyncDisposable)[Symbol.asyncDispose]();
					});
				} else if (Symbol.dispose in (value as object)) {
					this.#stack.push(async () => (value as Disposable)[Symbol.dispose]());
				}
			}
			return value;
		}

		adopt<T>(value: T, onDisposeAsync: (value: T) => PromiseLike<void> | void): T {
			if (this.#disposed) {
				throw new ReferenceError('AsyncDisposableStack already disposed');
			}
			this.#stack.push(async () => {
				await onDisposeAsync(value);
			});
			return value;
		}

		defer(onDisposeAsync: () => PromiseLike<void> | void): void {
			if (this.#disposed) {
				throw new ReferenceError('AsyncDisposableStack already disposed');
			}
			this.#stack.push(async () => {
				await onDisposeAsync();
			});
		}

		move(): AsyncDisposableStack {
			if (this.#disposed) {
				throw new ReferenceError('AsyncDisposableStack already disposed');
			}
			const cloned = new ADS();
			cloned.#stack = this.#stack;
			this.#stack = [];
			this.#disposed = true;
			return cloned;
		}

		async disposeAsync(): Promise<void> {
			if (this.#disposed) {
				return;
			}
			this.#disposed = true;
			let error: unknown;
			while (this.#stack.length > 0) {
				const dispose = this.#stack.pop()!;
				try {
					await dispose();
				} catch (e) {
					error ??= e;
				}
			}
			if (error) {
				throw error;
			}
		}

		[Symbol.asyncDispose]() {
			return this.disposeAsync();
		}
	};
}

const run = async () => {
	console.log(`
┌──────────────────────────────────┐
│  danaus dev-env (PLC + bsky)     │
└──────────────────────────────────┘
`);

	const dbPostgresUrl = process.env.DB_POSTGRES_URL;
	if (!dbPostgresUrl) {
		throw new Error('DB_POSTGRES_URL is required');
	}

	await using stack = new AsyncDisposableStack();

	const plc = await TestPlc.create({
		port: PLC_PORT,
		dbPostgresUrl: dbPostgresUrl,
		dbPostgresSchema: 'plc',
	});
	stack.use(plc);

	const bsky = await TestBsky.create({
		plcUrl: plc.url,
		repoProvider: `ws://localhost:${PDS_PORT}`,
		pdsPort: PDS_PORT,
		port: BSKY_PORT,
		dbPostgresUrl: dbPostgresUrl,
		dbPostgresSchema: 'bsky',
		redisHost: process.env.REDIS_HOST ?? 'localhost',
		privateKey: '3f916c70dc69e4c5e83877f013325b11ecac31742e6a42f5c4fb240d0703d9d5',
	});
	stack.use(bsky);

	console.log(`👤 PLC server http://localhost:${plc.port}`);
	console.log(`🌅 AppView http://localhost:${bsky.port}`);
	console.log(`🌅 AppView DID ${bsky.serverDid}`);

	const shutdown = async () => {
		console.log('\nshutting down...');
		await stack.disposeAsync();
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	// keep process alive
	await new Promise(() => {});
};

run().catch((err) => {
	console.error('fatal error:', err);
	process.exit(1);
});
