import { expect, test, describe } from 'bun:test';

import {
	generateTheme,
	generateGreyRamp,
	generateBrandRamp,
	generateColorRamp,
	themeToCss,
} from './index.js';

describe('grey ramp', () => {
	const grey = generateGreyRamp();

	test('generates 49 stops from 2 to 98', () => {
		expect(Object.keys(grey).length).toBe(49);
		expect(grey[2]).toBeDefined();
		expect(grey[98]).toBeDefined();
	});

	test('generates greys at correct lightness', () => {
		expect(grey[14]).toBe('#242424');
		expect(grey[26]).toBe('#424242');
		expect(grey[38]).toBe('#616161');
		expect(grey[74]).toBe('#bdbdbd');
		expect(grey[84]).toBe('#d6d6d6');
		expect(grey[68]).toBe('#adadad');
	});
});

describe('color ramp', () => {
	const ramp = generateColorRamp('#107c10');

	test('primary matches input color', () => {
		expect(ramp.primary).toBe('#107c10');
	});

	test('shades are darker than primary', () => {
		expect(ramp.shade10).not.toBe(ramp.primary);
		expect(ramp.shade50).not.toBe(ramp.primary);
	});

	test('tints are lighter than primary', () => {
		expect(ramp.tint10).not.toBe(ramp.primary);
		expect(ramp.tint60).not.toBe(ramp.primary);
	});
});

describe('brand ramp', () => {
	const brand = generateBrandRamp('#0f6cbd');

	test('generates 16 positions from 10 to 160', () => {
		expect(Object.keys(brand).length).toBe(16);
		for (let i = 10; i <= 160; i += 10) {
			expect(brand[i]).toBeDefined();
		}
	});

	test('position 80 is the base color', () => {
		expect(brand[80]).toBe('#0f6cbd');
	});

	test('lower positions are darker', () => {
		expect(brand[10]).not.toBe(brand[80]);
		expect(brand[40]).not.toBe(brand[80]);
	});

	test('higher positions are lighter', () => {
		expect(brand[100]).not.toBe(brand[80]);
		expect(brand[160]).not.toBe(brand[80]);
	});
});

describe('theme generation', () => {
	const theme = generateTheme({ brand: '#0f6cbd' });

	describe('light theme neutral tokens', () => {
		test('foreground colors use grey ramp', () => {
			expect(theme.light.colorNeutralForeground1).toBe('#242424');
			expect(theme.light.colorNeutralForeground2).toBe('#424242');
			expect(theme.light.colorNeutralForeground3).toBe('#616161');
			expect(theme.light.colorNeutralForegroundDisabled).toBe('#bdbdbd');
		});

		test('background colors', () => {
			expect(theme.light.colorNeutralBackground1).toBe('#ffffff');
			expect(theme.light.colorNeutralBackground2).toBe('#fafafa');
			expect(theme.light.colorNeutralBackground3).toBe('#f5f5f5');
		});

		test('stroke colors', () => {
			expect(theme.light.colorNeutralStroke1).toBe('#d1d1d1');
			expect(theme.light.colorNeutralStroke2).toBe('#e0e0e0');
			expect(theme.light.colorNeutralStrokeAccessible).toBe('#616161');
		});

		test('special values', () => {
			expect(theme.light.colorNeutralForegroundInverted).toBe('#ffffff');
			expect(theme.light.colorNeutralForegroundOnBrand).toBe('#ffffff');
			expect(theme.light.colorBackgroundOverlay).toBe('rgba(0, 0, 0, 0.4)');
			expect(theme.light.colorStrokeFocus2).toBe('#000000');
		});
	});

	describe('dark theme neutral tokens', () => {
		test('foreground colors', () => {
			expect(theme.dark.colorNeutralForeground1).toBe('#ffffff');
			expect(theme.dark.colorNeutralForeground2).toBe('#d6d6d6');
			expect(theme.dark.colorNeutralForeground3).toBe('#adadad');
			expect(theme.dark.colorNeutralForegroundDisabled).toBe('#5c5c5c');
		});

		test('background colors', () => {
			expect(theme.dark.colorNeutralBackground1).toBe('#292929');
			expect(theme.dark.colorNeutralBackground2).toBe('#1f1f1f');
			expect(theme.dark.colorNeutralBackground3).toBe('#141414');
		});

		test('stroke colors', () => {
			expect(theme.dark.colorNeutralStroke1).toBe('#666666');
			expect(theme.dark.colorNeutralStroke2).toBe('#525252');
			expect(theme.dark.colorNeutralStrokeAccessible).toBe('#adadad');
			expect(theme.dark.colorNeutralStrokeDisabled).toBe('#424242');
		});
	});

	describe('brand tokens', () => {
		test('light theme brand background uses brand[80]', () => {
			expect(theme.light.colorBrandBackground).toBe('#0f6cbd');
		});

		test('light theme compound brand uses brand[80]', () => {
			expect(theme.light.colorCompoundBrandBackground).toBe('#0f6cbd');
			expect(theme.light.colorCompoundBrandForeground1).toBe('#0f6cbd');
			expect(theme.light.colorCompoundBrandStroke).toBe('#0f6cbd');
		});

		test('dark theme brand uses different positions', () => {
			expect(theme.dark.colorBrandBackground).not.toBe(theme.light.colorBrandBackground);
		});
	});

	describe('status tokens', () => {
		test('success tokens exist', () => {
			expect(theme.light.colorStatusSuccessBackground1).toBeDefined();
			expect(theme.light.colorStatusSuccessForeground1).toBeDefined();
			expect(theme.light.colorStatusSuccessBorder1).toBeDefined();
		});

		test('warning tokens exist', () => {
			expect(theme.light.colorStatusWarningBackground1).toBeDefined();
			expect(theme.light.colorStatusWarningForeground3).toBeDefined();
			expect(theme.light.colorStatusWarningBorder1).toBeDefined();
		});

		test('danger tokens exist', () => {
			expect(theme.light.colorStatusDangerBackground1).toBeDefined();
			expect(theme.light.colorStatusDangerForeground1).toBeDefined();
			expect(theme.light.colorStatusDangerBorder1).toBeDefined();
		});
	});
});

describe('CSS output', () => {
	const theme = generateTheme({ brand: '#0f6cbd' });
	const css = themeToCss(theme);

	test('outputs :root selector', () => {
		expect(css).toContain(':root {');
	});

	test('outputs light theme tokens', () => {
		expect(css).toContain('--color-neutral-foreground-1: #242424');
		expect(css).toContain('--color-brand-background: #0f6cbd');
	});

	test('outputs dark media query', () => {
		expect(css).toContain('@media (prefers-color-scheme: dark)');
	});

	test('converts camelCase to kebab-case', () => {
		expect(css).toContain('--color-neutral-foreground-1');
		expect(css).toContain('--color-brand-background');
		expect(css).toContain('--color-compound-brand-foreground-1');
	});
});
