import type { ColorRamp } from '../types.js';

/**
 * generates status semantic tokens from color ramps.
 * @param danger danger color ramp (cranberry)
 * @param success success color ramp (green)
 * @param warning warning color ramp (orange)
 * @returns light and dark status token mappings
 */
export function generateStatusTokens(
	danger: ColorRamp,
	success: ColorRamp,
	warning: ColorRamp,
): { light: Record<string, string>; dark: Record<string, string> } {
	const light: Record<string, string> = {
		// #region success (green)
		colorStatusSuccessBackground1: success.tint60,
		colorStatusSuccessBackground2: success.tint40,
		colorStatusSuccessBackground3: success.primary,
		colorStatusSuccessForeground1: success.shade30,
		colorStatusSuccessForeground2: success.shade10,
		colorStatusSuccessForeground3: success.tint20,
		colorStatusSuccessForegroundInverted: success.tint30,
		colorStatusSuccessBorderActive: success.primary,
		colorStatusSuccessBorder1: success.tint40,
		colorStatusSuccessBorder2: success.tint20,
		// #endregion

		// #region warning (orange)
		colorStatusWarningBackground1: warning.tint60,
		colorStatusWarningBackground2: warning.tint40,
		colorStatusWarningBackground3: warning.primary,
		colorStatusWarningForeground1: warning.shade30,
		colorStatusWarningForeground2: warning.shade10,
		colorStatusWarningForeground3: warning.shade30,
		colorStatusWarningForegroundInverted: warning.tint30,
		colorStatusWarningBorderActive: warning.primary,
		colorStatusWarningBorder1: warning.tint40,
		colorStatusWarningBorder2: warning.shade30,
		// #endregion

		// #region danger (cranberry)
		colorStatusDangerBackground1: danger.tint60,
		colorStatusDangerBackground2: danger.tint40,
		colorStatusDangerBackground3: danger.primary,
		colorStatusDangerBackground3Hover: danger.shade10,
		colorStatusDangerBackground3Pressed: danger.shade20,
		colorStatusDangerForeground1: danger.shade30,
		colorStatusDangerForeground2: danger.shade10,
		colorStatusDangerForeground3: danger.primary,
		colorStatusDangerForegroundInverted: danger.tint30,
		colorStatusDangerBorderActive: danger.primary,
		colorStatusDangerBorder1: danger.tint40,
		colorStatusDangerBorder2: danger.primary,
		// #endregion
	};

	const dark: Record<string, string> = {
		// #region success (green)
		colorStatusSuccessBackground1: success.shade40,
		colorStatusSuccessBackground2: success.shade30,
		colorStatusSuccessBackground3: success.primary,
		colorStatusSuccessForeground1: success.tint30,
		colorStatusSuccessForeground2: success.tint40,
		colorStatusSuccessForeground3: success.tint20,
		colorStatusSuccessForegroundInverted: success.shade10,
		colorStatusSuccessBorderActive: success.tint30,
		colorStatusSuccessBorder1: success.primary,
		colorStatusSuccessBorder2: success.tint20,
		// #endregion

		// #region warning (orange)
		colorStatusWarningBackground1: warning.shade40,
		colorStatusWarningBackground2: warning.shade30,
		colorStatusWarningBackground3: warning.primary,
		colorStatusWarningForeground1: warning.tint30,
		colorStatusWarningForeground2: warning.tint40,
		colorStatusWarningForeground3: warning.tint40,
		colorStatusWarningForegroundInverted: warning.shade30,
		colorStatusWarningBorderActive: warning.tint30,
		colorStatusWarningBorder1: warning.primary,
		colorStatusWarningBorder2: warning.tint20,
		// #endregion

		// #region danger (cranberry)
		colorStatusDangerBackground1: danger.shade40,
		colorStatusDangerBackground2: danger.shade30,
		colorStatusDangerBackground3: danger.primary,
		colorStatusDangerBackground3Hover: danger.shade10,
		colorStatusDangerBackground3Pressed: danger.shade20,
		colorStatusDangerForeground1: danger.tint30,
		colorStatusDangerForeground2: danger.tint40,
		colorStatusDangerForeground3: danger.tint40,
		colorStatusDangerForegroundInverted: danger.tint10,
		colorStatusDangerBorderActive: danger.tint30,
		colorStatusDangerBorder1: danger.primary,
		colorStatusDangerBorder2: danger.tint30,
		// #endregion
	};

	return { light, dark };
}
