"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@skerp/ui/components/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@skerp/ui/components/collapsible";
import {
  canShowNavLink,
  isNavGroup,
  NAV_SECTIONS,
  type NavGroup,
  type NavItem,
  type NavLink,
} from "@/config/navigation";
import { useAppSelector } from "@/store/hooks";
import { useLowStockCount } from "@/features/stock/hooks/useLowStockCount";

/** Maps a nav item's `badgeKey` to the live count that feeds it — kept as a
 *  small lookup so navigation.ts itself stays free of feature-specific hooks. */
function useNavBadgeCounts(): Record<string, number> {
  const stockLow = useLowStockCount();
  return { stockLow };
}

const filterNavItem = (
  item: NavItem,
  permissions: string[] | undefined,
): NavItem | null => {
  if (!isNavGroup(item)) {
    return canShowNavLink(item, permissions) ? item : null;
  }

  const items = item.items.filter((child) => canShowNavLink(child, permissions));
  return items.length ? { ...item, items } : null;
};

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-500/15 px-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Top-level link item with an icon. */
function NavLinkItem({
  link,
  pathname,
  badgeCount,
}: {
  link: NavLink;
  pathname: string;
  badgeCount: number;
}) {
  const Icon = link.icon;

  if (link.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={link.title} disabled aria-disabled>
          <Icon />
          <span>{link.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={link.title}
        isActive={pathname === link.href}
      >
        <Link href={link.href}>
          <Icon />
          <span>{link.title}</span>
          {link.badgeKey && <NavBadge count={badgeCount} />}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Collapsible group — expands to reveal child links. */
function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const Icon = group.icon;
  const hasActiveChild = group.items.some((child) => pathname === child.href);

  return (
    <Collapsible
      asChild
      defaultOpen={hasActiveChild}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={group.title}>
            <Icon />
            <span>{group.title}</span>
            <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((sub) => (
              <SidebarMenuSubItem key={`${sub.title}`}>
                {sub.disabled ? (
                  <SidebarMenuSubButton
                    aria-disabled
                    className="cursor-not-allowed opacity-50"
                  >
                    <span>{sub.title}</span>
                  </SidebarMenuSubButton>
                ) : (
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === sub.href}
                  >
                    <Link href={sub.href}>
                      <span>{sub.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                )}
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** Renders every nav section; section labels are the menu "break points". */
export function NavMain() {
  const pathname = usePathname();
  const permissions = useAppSelector((state) => state.auth.user?.permissions);
  const badgeCounts = useNavBadgeCounts();
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .map((item) => filterNavItem(item, permissions))
      .filter((item): item is NavItem => Boolean(item)),
  })).filter((section) => section.items.length);

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarMenu>
            {section.items.map((item) =>
              isNavGroup(item) ? (
                <NavGroupItem
                  key={`group:${item.title}`}
                  group={item}
                  pathname={pathname}
                />
              ) : (
                <NavLinkItem
                  key={`link:${item.href}:${item.title}`}
                  link={item}
                  pathname={pathname}
                  badgeCount={item.badgeKey ? (badgeCounts[item.badgeKey] ?? 0) : 0}
                />
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
