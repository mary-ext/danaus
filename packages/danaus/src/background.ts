import PQueue from 'p-queue';

export interface BackgroundQueueOptions {
	/** maximum concurrent tasks (default: 5) */
	concurrency?: number;
}

/**
 * a simple queue for in-process, out-of-band background work.
 * tasks are fire-and-forget with error logging.
 */
export class BackgroundQueue implements Disposable {
	readonly #queue: PQueue;
	#destroyed = false;

	constructor(options: BackgroundQueueOptions = {}) {
		this.#queue = new PQueue({ concurrency: options.concurrency ?? 5 });
	}

	/**
	 * add a task to the background queue.
	 * task errors are logged but not propagated.
	 * @param task async function to execute
	 */
	add(task: () => Promise<void>): void {
		if (this.#destroyed) {
			return;
		}

		this.#queue
			.add(() => task())
			.catch((err) => {
				console.error('background queue task failed:', err);
			});
	}

	/**
	 * wait for all pending tasks to complete.
	 */
	async onIdle(): Promise<void> {
		await this.#queue.onIdle();
	}

	/**
	 * stop accepting new tasks and wait for pending tasks to complete.
	 */
	async destroy(): Promise<void> {
		this.#destroyed = true;
		await this.#queue.onIdle();
	}

	dispose(): void {
		this.#destroyed = true;
		this.#queue.clear();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}
