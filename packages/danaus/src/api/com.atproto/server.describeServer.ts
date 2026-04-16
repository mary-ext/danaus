import { ComAtprotoServerDescribeServer } from '@atcute/atproto';
import type { GenericUri } from '@atcute/lexicons';
import { json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

export const describeServer = (router: XRPCRouter, context: AppContext) => {
	const { config } = context;

	router.addQuery(ComAtprotoServerDescribeServer, {
		async handler() {
			return json({
				did: config.service.did,
				availableUserDomains: config.identity.serviceHandleDomains,
				inviteCodeRequired: config.service.registration !== 'open',
				contact: {
					email: config.service.branding.contactEmailAddress ?? undefined,
				},
				links: {
					// oxlint-disable-next-line no-unsafe-type-assertion -- config URL string to branded URI
					privacyPolicy: (config.service.branding.privacyPolicyUrl as GenericUri | null) ?? undefined,
					// oxlint-disable-next-line no-unsafe-type-assertion
					termsOfService: (config.service.branding.termsOfServiceUrl as GenericUri | null) ?? undefined,
				},
			});
		},
	});
};
