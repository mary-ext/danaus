import type { JSXNode } from '@oomfware/jsx';

import { IdProvider } from '../components/id.tsx';

export interface BaseLayoutProps {
	children?: JSXNode;
}

/**
 * base HTML layout wrapper for all pages.
 * includes the document structure, meta tags, and stylesheet.
 */
export const BaseLayout = (props: BaseLayoutProps) => {
	return (
		<IdProvider>
			<html lang="en">
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<link rel="stylesheet" href="/assets/style.css" />
				</head>

				<body>
					<div class="flex min-h-dvh flex-col">{props.children}</div>
				</body>
			</html>
		</IdProvider>
	);
};
