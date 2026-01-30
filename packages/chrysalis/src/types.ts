/**
 * color ramp with 12 stops for brand and status colors.
 * shades (darker) and tints (lighter) are generated from the primary color.
 */
export interface ColorRamp {
	/** darkest shade */
	shade50: string;
	shade40: string;
	shade30: string;
	shade20: string;
	shade10: string;
	/** base color */
	primary: string;
	tint10: string;
	tint20: string;
	tint30: string;
	tint40: string;
	tint50: string;
	/** lightest tint */
	tint60: string;
}

/**
 * grey ramp with 49 stops (lightness 2-98% in steps of 2).
 * keys are lightness percentages.
 */
export type GreyRamp = Record<number, string>;

/**
 * brand ramp with 16 stops (10-160 in steps of 10).
 * keys are position values.
 */
export type BrandRamp = Record<number, string>;

/**
 * theme configuration for generating color tokens.
 */
export interface ThemeConfig {
	/** brand base color (hex) */
	brand: string;
	/** danger color, defaults to cranberry (#c50f1f) */
	danger?: string;
	/** success color, defaults to green (#107c10) */
	success?: string;
	/** warning color, defaults to orange (#f7630c) */
	warning?: string;
}

/**
 * generated theme containing light and dark token mappings.
 */
export interface Theme {
	light: Record<string, string>;
	dark: Record<string, string>;
}
