import type { EventEmitter } from 'node:events';

import Queue from '#app/utils/queue.ts';

export class AsyncBuffer<T> {
	private queue = new Queue<T>();
	private closed = false;
	private deferred = Promise.withResolvers<void>();

	constructor(private maxSize: number) {}

	push(value: T): void {
		if (this.closed) {
			return;
		}

		if (this.queue.size >= this.maxSize) {
			this.closed = true;
		}

		this.queue.enqueue(value);
		this.deferred.resolve();
	}

	pushMany(values: T[]): void {
		if (this.closed) {
			return;
		}

		if (this.queue.size + values.length > this.maxSize) {
			this.closed = true;
		}

		for (const value of values) {
			this.queue.enqueue(value);
		}

		this.deferred.resolve();
	}

	close(): void {
		if (this.closed) {
			return;
		}

		this.closed = true;
		this.deferred.resolve();
	}

	async *events(): AsyncGenerator<T> {
		while (true) {
			await this.deferred.promise;

			if (this.queue.size > this.maxSize) {
				throw new AsyncBufferFullError(this.maxSize);
			}

			const value = this.queue.dequeue();
			if (value !== undefined) {
				yield value;
			} else if (this.closed) {
				return;
			} else {
				this.deferred = Promise.withResolvers();
			}
		}
	}
}

/**
 * async buffer full error.
 */
export class AsyncBufferFullError extends Error {
	/**
	 * create a buffer full error.
	 * @param maxSize maximum buffer size
	 */
	constructor(maxSize: number) {
		super(`reached max buffer size: ${maxSize}`);
	}
}

export interface OnOptions {
	maxSize: number;
	signal?: AbortSignal;
}

type EventMapOf<TEmitter> = TEmitter extends EventEmitter<infer TEvents> ? TEvents : never;

/**
 * async iterator for event emitter subscriptions.
 * @param emitter event emitter
 * @param event event name
 * @param options subscription options
 * @returns async iterator of events
 */
export const on = <
	TEmitter extends EventEmitter<any>,
	TEventName extends keyof EventMapOf<TEmitter> & (string | symbol),
>(
	emitter: TEmitter,
	event: TEventName,
	options: OnOptions,
): AsyncIterableIterator<EventMapOf<TEmitter>[TEventName]> => {
	const { maxSize, signal } = options;
	const buffer = new AsyncBuffer<EventMapOf<TEmitter>[TEventName]>(maxSize);

	const handler = (...args: EventMapOf<TEmitter>[TEventName]) => {
		buffer.push(args);
	};

	const cleanup = () => {
		emitter.off(event, handler);
		buffer.close();
	};

	signal?.throwIfAborted();

	emitter.on(event, handler);
	signal?.addEventListener('abort', cleanup, { once: true });

	return (async function* () {
		try {
			yield* buffer.events();
		} finally {
			cleanup();
		}
	})();
};
