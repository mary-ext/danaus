import { HTMLAttributes } from '@oomfware/jsx';

declare module '@oomfware/jsx' {
	namespace JSX {
		interface IntrinsicElements {
			'danaus-webauthn-register': HTMLAttributes & {
				'data-options': string;
			};
			'danaus-webauthn-authenticate': HTMLAttributes & {
				'data-options': string;
				'data-auto-submit'?: 'true' | 'false';
			};
		}
	}
}
