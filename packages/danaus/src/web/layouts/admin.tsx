import type { JSXNode } from '@oomfware/jsx';

import AsideItem from '../components/aside-item.tsx';
import Group1Outlined from '../icons/central/group-1-outlined.tsx';
import HomeOpenOutlined from '../icons/central/home-open-outlined.tsx';
import { routes } from '../routes.ts';

import { BaseLayout } from './base.tsx';

export interface AdminLayoutProps {
	children?: JSXNode;
}

/**
 * admin layout with sidebar navigation.
 */
export const AdminLayout = (props: AdminLayoutProps) => {
	return (
		<BaseLayout>
			<div class="flex flex-col gap-4 p-4 sm:p-16 sm:pt-24 lg:grid lg:grid-cols-[280px_minmax(0,640px)] lg:justify-center">
				<aside class="-ml-2 flex flex-col gap-2 sm:ml-0">
					<h2 class="pb-2 pl-4 text-base-400 font-medium">PDS administration</h2>

					<div class="flex flex-col gap-px">
						<AsideItem href={routes.admin.dashboard.href()} exact icon={<HomeOpenOutlined size={20} />}>
							Home
						</AsideItem>

						<AsideItem href={routes.admin.accounts.index.href()} icon={<Group1Outlined size={20} />}>
							Accounts
						</AsideItem>
					</div>
				</aside>

				<hr class="border-neutral-stroke-1 sm:hidden" />

				<main>{props.children}</main>
			</div>
		</BaseLayout>
	);
};
