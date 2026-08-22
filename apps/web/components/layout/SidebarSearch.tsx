"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { Input } from "@skerp/ui/components/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@skerp/ui/components/sidebar";
import { cn } from "@skerp/ui/lib/util";
import {
  buildNavSearchIndex,
  searchNavEntries,
  type NavSearchEntry,
} from "@/config/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAppSelector } from "@/store/hooks";

const MAX_RESULTS = 50;
const LISTBOX_ID = "sidebar-nav-search-results";

/**
 * Sidebar navigation search.
 *
 * Filters every permission-visible page in `NAV_SECTIONS` (top-level links,
 * group landing pages and group children) as you type — debounced — and
 * navigates on Enter / click. `Ctrl+K` (`Cmd+K` on macOS) focuses it from
 * anywhere, expanding the sidebar first when it is collapsed to icons.
 */
export function SidebarSearch() {
  const router = useRouter();
  const { state, isMobile, setOpen, setOpenMobile, openMobile } = useSidebar();
  const permissions = useAppSelector((s) => s.auth.user?.permissions);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [openList, setOpenList] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [pendingFocus, setPendingFocus] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);

  const debouncedQuery = useDebouncedValue(query, 150);

  const index = React.useMemo(
    () => buildNavSearchIndex(permissions),
    [permissions],
  );

  const results = React.useMemo(
    () => searchNavEntries(index, debouncedQuery).slice(0, MAX_RESULTS),
    [index, debouncedQuery],
  );

  // The input only exists while the sidebar is expanded (icon mode swaps it for
  // a button), so Ctrl+K expands first and focuses once it has mounted.
  const isExpanded = isMobile ? openMobile : state === "expanded";

  React.useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
  }, []);

  const requestFocus = React.useCallback(() => {
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
    setPendingFocus(true);
  }, [isMobile, setOpen, setOpenMobile]);

  React.useEffect(() => {
    if (!pendingFocus || !isExpanded) return;

    // Give the sheet / expand transition a frame to reveal the input.
    const timer = window.setTimeout(
      () => {
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpenList(true);
        setPendingFocus(false);
      },
      isMobile ? 150 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [pendingFocus, isExpanded, isMobile]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      requestFocus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestFocus]);

  // A fresh result set always starts at the top.
  React.useEffect(() => setHighlight(0), [debouncedQuery]);

  // Keep the highlighted row in view while arrowing through a long list.
  React.useEffect(() => {
    if (!openList) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight, openList]);

  const go = (entry: NavSearchEntry) => {
    setOpenList(false);
    setQuery("");
    setHighlight(0);
    inputRef.current?.blur();
    if (isMobile) setOpenMobile(false);
    router.push(entry.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!openList) {
        setOpenList(true);
        return;
      }
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const chosen = results[highlight];
      if (openList && chosen) {
        e.preventDefault();
        go(chosen);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        setOpenList(false);
        inputRef.current?.blur();
      }
    }
  };

  // Collapsed to icons: the input has no room, so show a button that expands
  // the sidebar and focuses the input — same entry point as Ctrl+K.
  if (!isMobile && state === "collapsed") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Search pages (Ctrl+K)"
            onClick={requestFocus}
          >
            <IconSearch />
            <span>Search</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="relative px-1">
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Search pages…"
        aria-label="Search pages"
        aria-expanded={openList}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={
          openList && results[highlight]
            ? `${LISTBOX_ID}-${highlight}`
            : undefined
        }
        className="h-8 rounded-md bg-background pr-14 pl-8"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpenList(true);
        }}
        onFocus={() => setOpenList(true)}
        onBlur={() => setOpenList(false)}
        onKeyDown={onInputKeyDown}
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>

      {openList ? (
        <div
          ref={listRef}
          id={LISTBOX_ID}
          role="listbox"
          // mousedown (not click) so picking a row beats the input blur.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-1 z-50 mt-1 max-h-80 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              No pages match that search
            </p>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  id={`${LISTBOX_ID}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === highlight}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors",
                    i === highlight && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{entry.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.group
                        ? `${entry.section} › ${entry.group}`
                        : entry.section}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
