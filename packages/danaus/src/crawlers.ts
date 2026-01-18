import { ComAtprotoSyncRequestCrawl } from '@atcute/atproto';
import { Client, simpleFetchHandler } from '@atcute/client';

import { crawlerLogger } from '#app/logger.ts';

const MINUTE = 60_000;
const NOTIFY_THRESHOLD = 20 * MINUTE;

interface CrawlerClient {
	client: Client;
	service: string;
}

/**
 * manages crawler notification for federation.
 * notifies configured relay/crawler services when repo events occur.
 */
export class Crawlers {
	readonly clients: CrawlerClient[];
	private lastNotified = 0;
	private pendingTrailing = false;

	/**
	 * create a crawlers manager.
	 * @param hostname PDS hostname to report in crawl requests
	 * @param crawlers list of crawler service URLs
	 */
	constructor(
		readonly hostname: string,
		crawlers: string[],
	) {
		this.clients = crawlers.map((service) => ({
			client: new Client({ handler: simpleFetchHandler({ service }) }),
			service,
		}));
	}

	/**
	 * notify crawlers of a repo update.
	 * throttled with leading + trailing: first call fires immediately,
	 * subsequent calls within the window are deferred to fire once at the end.
	 */
	notifyOfUpdate(): void {
		if (this.clients.length === 0) {
			return;
		}

		const now = Date.now();
		const elapsed = now - this.lastNotified;

		if (elapsed >= NOTIFY_THRESHOLD) {
			// enough time has passed - notify immediately (leading edge)
			this.sendNotifications();
		} else if (!this.pendingTrailing) {
			// schedule trailing edge notification
			this.pendingTrailing = true;
			const remaining = NOTIFY_THRESHOLD - elapsed;

			setTimeout(() => {
				this.pendingTrailing = false;
				this.sendNotifications();
			}, remaining);
		}
		// else: trailing already scheduled, nothing to do
	}

	private sendNotifications(): void {
		this.lastNotified = Date.now();

		// fire-and-forget notifications to all crawlers
		for (const { client, service: crawler } of this.clients) {
			client
				.call(ComAtprotoSyncRequestCrawl, {
					input: { hostname: this.hostname },
				})
				.catch((err) => {
					crawlerLogger.warn('failed to request crawl', { err, crawler });
				});
		}
	}
}
