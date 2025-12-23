import { document, integer, object, query, required } from '@atcute/lexicon-doc/builder';

const accountStats = object({
	properties: {
		total: required(integer()),
		active: required(integer()),
		deactivated: required(integer()),
		takendown: required(integer()),
		deleteScheduled: required(integer()),
	},
});

const sequencerStats = object({
	properties: {
		lastSeq: required(integer()),
		totalEvents: required(integer()),
		invalidatedEvents: required(integer()),
	},
});

const inviteCodeStats = object({
	properties: {
		total: required(integer()),
		available: required(integer()),
		disabled: required(integer()),
		used: required(integer()),
	},
});

export default document({
	id: 'local.danaus.admin.getStats',
	defs: {
		accountStats: accountStats,
		sequencerStats: sequencerStats,
		inviteCodeStats: inviteCodeStats,
		main: query({
			description: 'get admin stats for this pds',
			output: {
				encoding: 'application/json',
				schema: object({
					properties: {
						accounts: required(accountStats),
						sequencer: required(sequencerStats),
						inviteCodes: required(inviteCodeStats),
					},
				}),
			},
		}),
	},
});
