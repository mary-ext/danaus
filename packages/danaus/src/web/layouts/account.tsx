import type { JSXNode } from '@oomfware/jsx';

import AsideItem from '#web/components/aside-item.tsx';
import Key2Outlined from '#web/icons/central/key-2-outlined.tsx';
import PersonOutlined from '#web/icons/central/person-outlined.tsx';
import ShieldOutlined from '#web/icons/central/shield-outlined.tsx';
import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import { Menu } from '#web/primitives/index.ts';
import { routes } from '#web/routes.ts';

import { BaseLayout } from './base.tsx';

export interface AccountLayoutProps {
	children?: JSXNode;
}

/**
 * account management layout with sidebar navigation.
 */
export const AccountLayout = (props: AccountLayoutProps) => {
	const { accountManager } = getAppContext();
	const session = getSession();

	const account = accountManager.getAccount(session.did)!;

	return (
		<BaseLayout>
			<div class="flex min-h-0 grow flex-col gap-4 p-4 sm:p-16 sm:py-24 lg:grid lg:grid-cols-[280px_minmax(0,640px)] lg:justify-center">
				<aside class="-ml-2 flex flex-col gap-4 sm:ml-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-(--spacing(48)))]">
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

					<div class="mt-auto flex flex-col gap-px">
						<Menu.Root>
							<Menu.Trigger>
								<button class="ml-2 flex items-center gap-2 rounded-md p-2 outline-2 -outline-offset-2 outline-transparent transition duration-100 ease-fluent select-none hover:bg-subtle-background-hover focus-visible:z-10 focus-visible:outline-stroke-focus-2 active:bg-subtle-background-active">
									<div class="size-8 shrink-0 rounded-full bg-brand-background"></div>

									<div class="flex flex-col">
										<span class="text-base-300">{account.handle ? `@${account.handle}` : account.did}</span>
									</div>
								</button>
							</Menu.Trigger>

							<Menu.Popover>
								<Menu.List>
									<form action={routes.login.logout.href()} method="post" class="contents">
										<Menu.Item type="submit">Sign out</Menu.Item>
									</form>
								</Menu.List>
							</Menu.Popover>
						</Menu.Root>
					</div>
				</aside>

				<hr class="border-neutral-stroke-1 sm:hidden" />

				<main>{props.children}</main>
			</div>
		</BaseLayout>
	);
};
