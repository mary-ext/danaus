import type { ActorDbConnection } from '../actor-store-types';
import { t } from '../db';

export type LegacyPreferences = (typeof t.legacyPref.$inferSelect)['content'];

/**
 * preference reader.
 */
export class PreferenceReader {
	protected readonly db: ActorDbConnection;

	/**
	 * create a preference reader.
	 * @param db actor database handle
	 */
	constructor(db: ActorDbConnection) {
		this.db = db;
	}

	/**
	 * fetch legacy preferences.
	 * @returns legacy preferences
	 */
	getLegacyPreferences(): LegacyPreferences {
		const row = this.db.select({ content: t.legacyPref.content }).from(t.legacyPref).get();

		return row?.content ?? [];
	}
}
