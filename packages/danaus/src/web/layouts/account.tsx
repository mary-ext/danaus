import type { JSXNode } from '@oomfware/jsx';

import AsideItem from '../components/aside-item.tsx';
import Key2Outlined from '../icons/central/key-2-outlined.tsx';
import PersonOutlined from '../icons/central/person-outlined.tsx';
import ShieldOutlined from '../icons/central/shield-outlined.tsx';
import { routes } from '../routes.ts';

import { BaseLayout } from './base.tsx';

export interface AccountLayoutProps {
	children?: JSXNode;
}

/**
 * account management layout with sidebar navigation.
 */
export const AccountLayout = (props: AccountLayoutProps) => {
	return (
		<BaseLayout>
			<div class="flex flex-col gap-4 p-4 sm:p-16 sm:pt-24 lg:grid lg:grid-cols-[280px_minmax(0,640px)] lg:justify-center">
				<aside class="-ml-2 flex flex-col gap-4 sm:ml-0">
					<div class="flex h-8 shrink-0 items-center pl-4">
						<h2 class="text-base-400 font-medium">Account</h2>
					</div>

					<div class="flex flex-col gap-px">
						<AsideItem href={routes.account.overview.href()} exact icon={<PersonOutlined size={20} />}>
							Overview
						</AsideItem>

						<AsideItem href={routes.account.appPasswords.href()} icon={<Key2Outlined size={20} />}>
							App passwords
						</AsideItem>

						<AsideItem href={routes.account.security.overview.href()} icon={<ShieldOutlined size={20} />}>
							Security
						</AsideItem>
					</div>
				</aside>

				<hr class="border-neutral-stroke-1 sm:hidden" />

				<main>{props.children}</main>
			</div>
		</BaseLayout>
	);
};
