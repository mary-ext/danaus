import type { ActorDbConnection } from '../actor-store-types';
import { t } from '../db';

import { PreferenceReader, type LegacyPreferences } from './reader';

/**
 * preference writer.
 */
export class PreferenceTransactor extends PreferenceReader {
	/**
	 * create a preference writer.
	 * @param db actor database handle
	 */
	constructor(db: ActorDbConnection) {
		super(db);
	}

	/**
	 * replace legacy preferences.
	 * @param preferences legacy preferences
	 */
	putLegacyPreferences(preferences: LegacyPreferences): void {
		this.db
			.insert(t.legacyPref)
			.values({ id: 1, content: preferences })
			.onConflictDoUpdate({
				target: t.legacyPref.id,
				set: { content: preferences },
			})
			.run();
	}
}
