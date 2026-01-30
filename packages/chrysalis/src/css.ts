import type { Theme } from './types.js';

/**
 * converts a camelCase token name to kebab-case CSS variable name.
 * e.g., colorNeutralBackground1 -> --color-neutral-background-1
 */
function tokenToCssVar(token: string): string {
	return (
		'--' +
		token
			.replace(/([A-Z])/g, '-$1')
			.replace(/(\d+)/g, '-$1')
			.toLowerCase()
	);
}

/**
 * converts a theme to CSS with light/dark media query support.
 * @param theme generated theme
 * @returns CSS string with :root light theme and @media dark theme
 */
export function themeToCss(theme: Theme): string {
	const lines: string[] = [':root {', '\t& {'];

	// light theme tokens
	for (const [token, value] of Object.entries(theme.light)) {
		lines.push(`\t\t${tokenToCssVar(token)}: ${value};`);
	}

	lines.push('\t}', '', '\t@media (prefers-color-scheme: dark) {');

	// dark theme tokens
	for (const [token, value] of Object.entries(theme.dark)) {
		lines.push(`\t\t${tokenToCssVar(token)}: ${value};`);
	}

	lines.push('\t}', '}', '');

	return lines.join('\n');
}
