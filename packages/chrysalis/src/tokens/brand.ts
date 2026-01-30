import type { BrandRamp } from '../types.js';

/**
 * generates brand semantic tokens from a brand ramp.
 * @param brand brand ramp
 * @returns light and dark brand token mappings
 */
export function generateBrandTokens(brand: BrandRamp): {
	light: Record<string, string>;
	dark: Record<string, string>;
} {
	const light: Record<string, string> = {
		// #region foreground
		colorBrandForegroundLink: brand[70],
		colorBrandForegroundLinkHover: brand[60],
		colorBrandForegroundLinkPressed: brand[40],
		colorBrandForegroundLinkSelected: brand[70],
		colorBrandForeground1: brand[80],
		colorBrandForeground2: brand[70],
		colorBrandForeground2Hover: brand[60],
		colorBrandForeground2Pressed: brand[30],
		colorBrandForegroundOnLight: brand[80],
		colorBrandForegroundOnLightHover: brand[70],
		colorBrandForegroundOnLightPressed: brand[50],
		colorBrandForegroundOnLightSelected: brand[60],
		colorBrandForegroundInverted: brand[100],
		colorBrandForegroundInvertedHover: brand[110],
		colorBrandForegroundInvertedPressed: brand[100],
		// #endregion

		// #region background
		colorBrandBackground: brand[80],
		colorBrandBackgroundHover: brand[70],
		colorBrandBackgroundPressed: brand[40],
		colorBrandBackgroundSelected: brand[60],
		colorBrandBackgroundStatic: brand[80],
		colorBrandBackground2: brand[160],
		colorBrandBackground2Hover: brand[150],
		colorBrandBackground2Pressed: brand[130],
		colorBrandBackground3Static: brand[60],
		colorBrandBackground4Static: brand[40],
		colorBrandBackgroundInverted: '#ffffff',
		colorBrandBackgroundInvertedHover: brand[160],
		colorBrandBackgroundInvertedPressed: brand[140],
		colorBrandBackgroundInvertedSelected: brand[150],
		// #endregion

		// #region stroke
		colorBrandStroke1: brand[80],
		colorBrandStroke2: brand[140],
		colorBrandStroke2Hover: brand[120],
		colorBrandStroke2Pressed: brand[80],
		colorBrandStroke2Contrast: brand[140],
		// #endregion

		// #region compound brand
		colorCompoundBrandForeground1: brand[80],
		colorCompoundBrandForeground1Hover: brand[70],
		colorCompoundBrandForeground1Pressed: brand[60],
		colorCompoundBrandBackground: brand[80],
		colorCompoundBrandBackgroundHover: brand[70],
		colorCompoundBrandBackgroundPressed: brand[60],
		colorCompoundBrandStroke: brand[80],
		colorCompoundBrandStrokeHover: brand[70],
		colorCompoundBrandStrokePressed: brand[60],
		// #endregion
	};

	const dark: Record<string, string> = {
		// #region foreground
		colorBrandForegroundLink: brand[100],
		colorBrandForegroundLinkHover: brand[110],
		colorBrandForegroundLinkPressed: brand[90],
		colorBrandForegroundLinkSelected: brand[100],
		colorBrandForeground1: brand[100],
		colorBrandForeground2: brand[110],
		colorBrandForeground2Hover: brand[130],
		colorBrandForeground2Pressed: brand[160],
		colorBrandForegroundOnLight: brand[80],
		colorBrandForegroundOnLightHover: brand[70],
		colorBrandForegroundOnLightPressed: brand[50],
		colorBrandForegroundOnLightSelected: brand[60],
		colorBrandForegroundInverted: brand[80],
		colorBrandForegroundInvertedHover: brand[70],
		colorBrandForegroundInvertedPressed: brand[60],
		// #endregion

		// #region background
		colorBrandBackground: brand[70],
		colorBrandBackgroundHover: brand[80],
		colorBrandBackgroundPressed: brand[40],
		colorBrandBackgroundSelected: brand[60],
		colorBrandBackgroundStatic: brand[80],
		colorBrandBackground2: brand[20],
		colorBrandBackground2Hover: brand[40],
		colorBrandBackground2Pressed: brand[10],
		colorBrandBackground3Static: brand[60],
		colorBrandBackground4Static: brand[40],
		colorBrandBackgroundInverted: '#ffffff',
		colorBrandBackgroundInvertedHover: brand[160],
		colorBrandBackgroundInvertedPressed: brand[140],
		colorBrandBackgroundInvertedSelected: brand[150],
		// #endregion

		// #region stroke
		colorBrandStroke1: brand[100],
		colorBrandStroke2: brand[50],
		colorBrandStroke2Hover: brand[50],
		colorBrandStroke2Pressed: brand[30],
		colorBrandStroke2Contrast: brand[50],
		// #endregion

		// #region compound brand
		colorCompoundBrandForeground1: brand[100],
		colorCompoundBrandForeground1Hover: brand[110],
		colorCompoundBrandForeground1Pressed: brand[90],
		colorCompoundBrandBackground: brand[100],
		colorCompoundBrandBackgroundHover: brand[110],
		colorCompoundBrandBackgroundPressed: brand[90],
		colorCompoundBrandStroke: brand[100],
		colorCompoundBrandStrokeHover: brand[110],
		colorCompoundBrandStrokePressed: brand[90],
		// #endregion
	};

	return { light, dark };
}
