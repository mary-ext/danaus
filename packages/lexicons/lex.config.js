import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
	files: ['lexicons-src/**/*.ts'],
	outdir: 'lib/lexicons/',
	imports: ['@atcute/atproto'],
	export: {
		outdir: 'lexicons/',
		clean: true,
	},
});
