import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
	generate: {
		files: ['lexicons-src/**/*.ts'],
		outdir: 'lib/lexicons/',
		imports: ['@atcute/atproto'],
	},
	export: {
		outdir: 'lexicons/',
		clean: true,
	},
});
