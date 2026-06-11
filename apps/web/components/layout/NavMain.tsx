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
  isNavGroup,
  NAV_SECTIONS,
  type NavGroup,
  type NavItem,
  type NavLink,
} from "@/config/navigation";
import { useAppSelector } from "@/store/hooks";

const canShowLink = (
  link: { permission?: string },
  permissions: string[] | undefined,
) => !link.permission || Boolean(permissions?.includes(link.permission));

const filterNavItem = (
  item: NavItem,
  permissions: string[] | undefined,
): NavItem | null => {
  if (!isNavGroup(item)) {
    return canShowLink(item, permissions) ? item : null;
  }

  const items = item.items.filter((child) => canShowLink(child, permissions));
  return items.length ? { ...item, items } : null;
};

/** Top-level link item with an icon. */
function NavLinkItem({ link, pathname }: { link: NavLink; pathname: string }) {
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
                />
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
