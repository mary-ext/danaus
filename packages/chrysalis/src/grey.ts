import { formatHex, type Hsl } from 'culori';

import type { GreyRamp } from './types.js';

/**
 * generates a grey ramp with 49 stops (lightness 2-98% in steps of 2).
 * @returns grey ramp keyed by lightness percentage
 */
export function generateGreyRamp(): GreyRamp {
	const ramp: GreyRamp = {};

	for (let i = 2; i <= 98; i += 2) {
		const color: Hsl = {
			mode: 'hsl',
			h: 0,
			s: 0,
			l: i / 100,
		};
		ramp[i] = formatHex(color)!;
	}

	return ramp;
}
