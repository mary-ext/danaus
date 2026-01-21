import { AsyncLocalStorage } from 'node:async_hooks';

import { configure, getConsoleSink, getLogger, type LogRecord } from '@logtape/logtape';
import { nanoid } from 'nanoid';

// #region configuration

export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface LoggingConfig {
	level: LogLevel;
	json: boolean;
}

/**
 * configure the logging system.
 * @param config logging configuration
 */
export const configureLogging = async (config: LoggingConfig): Promise<void> => {
	await configure({
		reset: true,
		contextLocalStorage: new AsyncLocalStorage(),
		sinks: {
			console: getConsoleSink({
				formatter: config.json ? jsonFormatter : textFormatter,
			}),
		},
		loggers: [
			{ category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
			{ category: ['danaus'], lowestLevel: config.level, sinks: ['console'] },
		],
	});
};

// #endregion

// #region formatters

const jsonFormatter = (record: LogRecord): string => {
	return JSON.stringify({
		time: new Date(record.timestamp).toISOString(),
		level: record.level,
		logger: record.category.join(':'),
		msg: record.message.join(''),
		...record.properties,
	});
};

const textFormatter = (record: LogRecord): string => {
	const time = new Date(record.timestamp).toISOString();
	const props = Object.keys(record.properties).length > 0 ? ` ${JSON.stringify(record.properties)}` : '';
	return `${time} ${record.level.toUpperCase().padEnd(7)} [${record.category.join(':')}] ${record.message.join('')}${props}`;
};

// #endregion

// #region subsystem loggers

/** main HTTP/server logger */
export const httpLogger = getLogger(['danaus']);

/** account & auth operations */
export const accountLogger = getLogger(['danaus', 'account']);

/** blob storage operations */
export const blobStoreLogger = getLogger(['danaus', 'blob-store']);

/** DID/identity cache operations */
export const didCacheLogger = getLogger(['danaus', 'did-cache']);

/** lexicon cache operations */
export const lexiconCacheLogger = getLogger(['danaus', 'lexicon-cache']);

/** event sequencer */
export const seqLogger = getLogger(['danaus', 'sequencer']);

/** background queue tasks */
export const backgroundLogger = getLogger(['danaus', 'background']);

/** crawler/relay notifications */
export const crawlerLogger = getLogger(['danaus', 'crawler']);

/** service proxy operations */
export const proxyLogger = getLogger(['danaus', 'proxy']);

/** OAuth operations (future) */
export const oauthLogger = getLogger(['danaus', 'oauth']);

// #endregion

// #region helpers

/**
 * generate short request ID.
 * @returns 8-character request ID
 */
export const generateRequestId = () => nanoid(8);

// #endregion
