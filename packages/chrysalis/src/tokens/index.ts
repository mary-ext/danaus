import { generateGreyRamp } from '../grey.js';
import { generateBrandRamp, generateColorRamp } from '../ramp.js';
import type { Theme, ThemeConfig } from '../types.js';

import { generateBrandTokens } from './brand.js';
import { generateNeutralTokens } from './neutral.js';
import { generateStatusTokens } from './status.js';

/** default cranberry color for danger status */
const DEFAULT_DANGER = '#c50f1f';
/** default green color for success status */
const DEFAULT_SUCCESS = '#107c10';
/** default orange color for warning status */
const DEFAULT_WARNING = '#f7630c';

/**
 * generates a complete theme from configuration.
 * @param config theme configuration with brand and optional status colors
 * @returns theme with light and dark token mappings
 */
export function generateTheme(config: ThemeConfig): Theme {
	const grey = generateGreyRamp();
	const brand = generateBrandRamp(config.brand);

	const dangerRamp = generateColorRamp(config.danger ?? DEFAULT_DANGER);
	const successRamp = generateColorRamp(config.success ?? DEFAULT_SUCCESS);
	const warningRamp = generateColorRamp(config.warning ?? DEFAULT_WARNING);

	const neutral = generateNeutralTokens(grey, brand);
	const brandTokens = generateBrandTokens(brand);
	const status = generateStatusTokens(dangerRamp, successRamp, warningRamp);

	return {
		light: {
			...neutral.light,
			...brandTokens.light,
			...status.light,
		},
		dark: {
			...neutral.dark,
			...brandTokens.dark,
			...status.dark,
		},
	};
}
