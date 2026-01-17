import type { JSXNode } from '@oomfware/jsx';

import { IdProvider } from '../components/id.tsx';
import { routes } from '../routes.ts';

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
					<link rel="stylesheet" href={routes.assets.href({ path: 'style.css' })} />
				</head>

				<body>
					<div class="flex min-h-dvh flex-col">{props.children}</div>
				</body>
			</html>
		</IdProvider>
	);
};
