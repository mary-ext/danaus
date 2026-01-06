/**
 * invoker command actions
 */
export type InvokerCommand =
	// dialog commands
	| 'show-modal'
	| 'close'
	// popover commands
	| 'toggle-popover'
	| 'show-popover'
	| 'hide-popover'
	// custom commands (must start with --)
	| `--${string}`;
