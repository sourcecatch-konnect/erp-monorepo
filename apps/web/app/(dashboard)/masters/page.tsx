"use client";

import * as React from "react";
import Link from "next/link";
import {
    IconBuildingStore,
    IconBuildingWarehouse,
    IconEngine,
    IconFileInvoice,
    IconGauge,
    IconGps,
    IconMap2,
    IconMapPin,
    IconPackage,
    IconReceipt,
    IconRoad,
    IconRoute,
    IconRulerMeasure,
    IconSearch,
    IconSettingsBolt,
    IconTrain,
    IconTruck,
    IconTruckDelivery,
    IconUser,
    IconUsers,
    IconX,
} from "@tabler/icons-react";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { PERMS } from "@skerp/types";
import type { PermissionKey } from "@skerp/types";
import { useDebouncedValue } from "../../../features/masters/_shared/hooks/useDebouncedValue";

// ─── types ────────────────────────────────────────────────────────────────────

type MasterCard = {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
    group: string;
    permission?: PermissionKey;
};

// ─── data ─────────────────────────────────────────────────────────────────────

const ALL_CARDS: MasterCard[] = [
    // Customers & Logistics
    { title: "Customers", description: "Profiles, credit limits & GST", href: "/masters/customer", icon: IconUsers, group: "Customers & Logistics", permission: PERMS.MASTERS.CUSTOMER.VIEW },
    { title: "Routes", description: "Source → destination city pairs", href: "/masters/route", icon: IconRoute, group: "Customers & Logistics", permission: PERMS.MASTERS.ROUTE.VIEW },
    { title: "Goods", description: "Goods catalogue & dimensions", href: "/masters/goods", icon: IconPackage, group: "Customers & Logistics", permission: PERMS.MASTERS.GOODS.VIEW },
    { title: "Units of Measure", description: "Weight, packaging, count and other units", href: "/masters/unit-of-measure", icon: IconRulerMeasure, group: "Customers & Logistics", permission: PERMS.MASTERS.UNIT_OF_MEASURE.VIEW },
    { title: "Transports", description: "Third-party transport parties", href: "/masters/transport", icon: IconRoad, group: "Customers & Logistics", permission: PERMS.MASTERS.TRANSPORT.VIEW },
    { title: "Labours", description: "Supervisors, hamals & mechanics", href: "/masters/labour", icon: IconUser, group: "Customers & Logistics", permission: PERMS.MASTERS.LABOUR.VIEW },

    // Fleet
    { title: "Vehicles", description: "Own & market fleet vehicles", href: "/masters/vehicle", icon: IconTruck, group: "Fleet", permission: PERMS.MASTERS.VEHICLE.VIEW },
    { title: "Drivers", description: "Driver profiles & licences", href: "/masters/driver", icon: IconUser, group: "Fleet", permission: PERMS.MASTERS.DRIVER.VIEW },
    { title: "Vehicle Types", description: "Container, open body, 407, etc.", href: "/masters/vehicle-type", icon: IconTruckDelivery, group: "Fleet", permission: PERMS.MASTERS.VEHICLE_TYPE.VIEW },
    { title: "OneLap Trackers", description: "OneLap GPS tracker devices and availability", href: "/masters/one-lap-trackers", icon: IconGps, group: "Fleet", permission: PERMS.MASTERS.ONE_LAP_TRACKER.VIEW },

    // Rates & Finance
    { title: "Agreements", description: "Customer rate agreements", href: "/masters/agreement", icon: IconFileInvoice, group: "Rates & Finance", permission: PERMS.MASTERS.AGREEMENT.VIEW },
    { title: "Rate Matrix", description: "Route-wise freight rate entries", href: "/masters/rate-matrix", icon: IconReceipt, group: "Rates & Finance", permission: PERMS.MASTERS.RATE_MATRIX.VIEW },
    { title: "Wagons", description: "Railway wagon types & dimensions", href: "/masters/wagons", icon: IconTrain, group: "Rates & Finance", permission: PERMS.MASTERS.WAGON.VIEW },
    { title: "Railway Freight", description: "Rail freight matrix by route", href: "/masters/railway-freight", icon: IconTrain, group: "Rates & Finance", permission: PERMS.MASTERS.RAILWAY_FREIGHT.VIEW },
    { title: "Creditors", description: "Payees grouped by category", href: "/masters/creditor", icon: IconReceipt, group: "Rates & Finance", permission: PERMS.MASTERS.CREDITOR.VIEW },
    { title: "Cash Accounts", description: "Bank accounts & cash-in-hand", href: "/masters/cash-account", icon: IconReceipt, group: "Rates & Finance", permission: PERMS.MASTERS.CASH_ACCOUNT.VIEW },

    // Organisation
    { title: "Branches", description: "Branch offices, GST & settings", href: "/masters/branch", icon: IconBuildingWarehouse, group: "Organisation", permission: PERMS.MASTERS.BRANCH.VIEW },
    { title: "Company", description: "Company profile, PAN & logo", href: "/masters/company", icon: IconBuildingStore, group: "Organisation", permission: PERMS.MASTERS.COMPANY.VIEW },
    { title: "Warehouses", description: "Storage locations & capacity", href: "/masters/warehouse", icon: IconBuildingWarehouse, group: "Organisation", permission: PERMS.MASTERS.WAREHOUSE.VIEW },

    // Maintenance
    { title: "Spare Parts", description: "Items & service parts inventory", href: "/masters/spare-parts", icon: IconSettingsBolt, group: "Maintenance", permission: PERMS.MASTERS.SPARE_PART.VIEW },
    { title: "Spare Categories", description: "Categorise spare parts", href: "/masters/spare-category", icon: IconEngine, group: "Maintenance", permission: PERMS.MASTERS.SPARE_CATEGORY.VIEW },
    { title: "Spare Part Suppliers", description: "Supplier contacts & GSTIN", href: "/masters/spare-part-supplier", icon: IconBuildingStore, group: "Maintenance", permission: PERMS.MASTERS.SPARE_PART_SUPPLIER.VIEW },
    { title: "Pumps", description: "Fuel pump locations & diesel rates", href: "/masters/pumps", icon: IconGauge, group: "Maintenance", permission: PERMS.MASTERS.PUMP.VIEW },

    // Geography
    { title: "States", description: "State master records", href: "/masters/state", icon: IconMap2, group: "Geography", permission: PERMS.MASTERS.STATE.VIEW },
    { title: "Cities", description: "City records linked to states", href: "/masters/city", icon: IconMapPin, group: "Geography", permission: PERMS.MASTERS.CITY.VIEW },
    { title: "Areas", description: "Locality areas within cities", href: "/masters/area", icon: IconMapPin, group: "Geography", permission: PERMS.MASTERS.AREA.VIEW },
];

const GROUP_ORDER = [
    "Customers & Logistics",
    "Fleet",
    "Rates & Finance",
    "Organisation",
    "Maintenance",
    "Geography",
] as const;

type Group = (typeof GROUP_ORDER)[number];

// Computed once at module level
const GROUPED: { label: Group; cards: MasterCard[] }[] = GROUP_ORDER.map(
    (label) => ({ label, cards: ALL_CARDS.filter((c) => c.group === label) })
);

const SECTION_ID = (label: string) =>
    `masters-section-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

// ─── localStorage hit tracking ────────────────────────────────────────────────

const LS_KEY = "skerp:masters:hits";
const QUICK_MAX = 8;
// Fallback order when no history exists yet
const DEFAULT_QUICK_HREFS = [
    "/masters/customer",
    "/masters/vehicle",
    "/masters/driver",
    "/masters/route",
    "/masters/branch",
    "/masters/agreement",
    "/masters/rate-matrix",
    "/masters/goods",
];

function readHits(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function recordHit(href: string) {
    try {
        const hits = readHits();
        hits[href] = (hits[href] ?? 0) + 1;
        localStorage.setItem(LS_KEY, JSON.stringify(hits));
    } catch {
        // storage unavailable — silently ignore
    }
}

function getQuickAccess(): MasterCard[] {
    const hits = readHits();
    const hasAny = Object.keys(hits).length > 0;

    if (!hasAny) {
        // First visit — use editorial defaults
        return DEFAULT_QUICK_HREFS
            .map((href) => ALL_CARDS.find((c) => c.href === href))
            .filter(Boolean) as MasterCard[];
    }

    return [...ALL_CARDS]
        .filter((c) => hits[c.href] !== undefined)
        .sort((a, b) => (hits[b.href] ?? 0) - (hits[a.href] ?? 0))
        .slice(0, QUICK_MAX);
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
    return (
        <div className="flex items-start gap-3 rounded-md border border-border bg-white p-3.5">
            <Skeleton className="mt-0.5 size-8 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-3.5 w-2/5 rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
            </div>
        </div>
    );
}

function SectionSkeleton({ count }: { count: number }) {
    return (
        <section className="space-y-3">
            <Skeleton className="h-3 w-28 rounded" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
        </section>
    );
}

export function MastersPageSkeleton() {
    return (
        <div className="flex gap-6">
            {/* sidebar skeleton */}
            <aside className="hidden w-44 shrink-0 xl:block">
                <div className="space-y-1 pt-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-7 w-full rounded-md" />
                    ))}
                </div>
            </aside>

            <div className="min-w-0 flex-1 space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-24 rounded" />
                        <Skeleton className="h-3.5 w-64 rounded" />
                    </div>
                    <Skeleton className="h-9 w-56 rounded-md" />
                </div>
                <SectionSkeleton count={8} />
                <div className="border-t" />
                <SectionSkeleton count={4} />
                <SectionSkeleton count={3} />
            </div>
        </div>
    );
}

// ─── card ─────────────────────────────────────────────────────────────────────

const GRID = "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

const MasterCardItem = React.memo(function MasterCardItem({
    card,
    onNavigate,
}: {
    card: MasterCard;
    onNavigate: (href: string) => void;
}) {
    const Icon = card.icon;
    return (
        <Link
            href={card.href}
            onClick={() => onNavigate(card.href)}
            className="group flex items-start gap-3 rounded-md border border-border bg-white p-3.5 transition-all duration-150 hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
        >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary">
                <Icon size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug text-foreground">
                    {card.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {card.description}
                </p>
            </div>
        </Link>
    );
});

// ─── sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { label: string; id: string }[] = [
    { label: "Frequently used", id: "masters-section-frequently-used" },
    ...GROUP_ORDER.map((g) => ({ label: g, id: SECTION_ID(g) })),
];
function CategorySidebar({
    activeId,
    onItemClick,
}: {
    activeId: string;
    onItemClick: (id: string) => void;
}) {
    return (
        <nav aria-label="Master categories" className="space-y-0.5">
            {NAV_ITEMS.map(({ label, id }) => {
                const isActive = activeId === id;

                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onItemClick(id)}
                        className={[
                            "flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-100",
                            isActive
                                ? "bg-sky-50 font-medium text-sky-700"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                    >
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MastersPage() {
    const [query, setQuery] = React.useState("");
    const debounced = useDebouncedValue(query, 220);
    const [activeSection, setActiveSection] = React.useState(NAV_ITEMS[0]!.id);

    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const scrollToSection = React.useCallback((id: string) => {
        const root = contentRef.current;
        const section = document.getElementById(id);

        if (!root || !section) return;

        const rootTop = root.getBoundingClientRect().top;
        const sectionTop = section.getBoundingClientRect().top;

        root.scrollTo({
            top: root.scrollTop + sectionTop - rootTop,
            behavior: "smooth",
        });
    }, []);

    // Re-read localStorage on mount so SSR and client are consistent
    const [quickAccess, setQuickAccess] = React.useState<MasterCard[]>([]);
    React.useEffect(() => {
        setQuickAccess(getQuickAccess());
    }, []);

    // Record a hit + refresh the quick-access list
    const handleNavigate = React.useCallback((href: string) => {
        recordHit(href);
        setQuickAccess(getQuickAccess());
    }, []);

    // IntersectionObserver — highlight sidebar item for the section most in view
    React.useEffect(() => {
        const root = contentRef.current;
        if (!root || typeof IntersectionObserver === "undefined") return;

        const sectionIds = NAV_ITEMS.map((n) => n.id);
        const map = new Map<string, number>();

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    map.set(entry.target.id, entry.intersectionRatio);
                }

                let best = "";
                let bestRatio = -1;

                for (const [id, ratio] of map) {
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        best = id;
                    }
                }

                if (best) setActiveSection(best);
            },
            {
                root,
                threshold: [0, 0.1, 0.5, 1],
                rootMargin: "-20px 0px -60% 0px",
            }
        );

        for (const id of sectionIds) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }

        return () => observer.disconnect();
    }, []);

    const searchResults = React.useMemo(() => {
        const term = debounced.trim().toLowerCase();
        if (!term) return null;
        return ALL_CARDS.filter(
            (c) =>
                c.title.toLowerCase().includes(term) ||
                c.description.toLowerCase().includes(term) ||
                c.group.toLowerCase().includes(term)
        );
    }, [debounced]);

    const isSearching = searchResults !== null;

    return (
        <div className="flex h-[calc(100vh-8rem)] min-h-0 gap-6 overflow-hidden">
            {/* ── category sidebar ─────────────────────────────────────────── */}
            <aside className="hidden w-44 shrink-0 xl:block">
                <div className="h-full overflow-y-auto pt-1">
                    <p className="mb-2 px-2.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Categories
                    </p>

                    {isSearching ? (
                        <p className="px-2.5 text-[12px] italic text-muted-foreground/60">
                            Searching…
                        </p>
                    ) : (
                        <CategorySidebar
                            activeId={activeSection}
                            onItemClick={scrollToSection}
                        />
                    )}
                </div>
            </aside>

            {/* ── main content ─────────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* fixed header */}
                <div className="shrink-0 pb-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-semibold tracking-tight">Masters</h1>
                            <p className="text-sm text-muted-foreground">
                                Reference data &amp; configuration used across the system
                            </p>
                        </div>

                        <div className="relative w-full max-w-xs">
                            <IconSearch
                                size={15}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search masters…"
                                className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-8 text-sm shadow-none outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                            />
                            {query ? (
                                <button
                                    onClick={() => setQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    aria-label="Clear search"
                                >
                                    <IconX size={14} />
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* scrollable content only */}
                <div
                    ref={contentRef}
                    className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2"
                >
                    {isSearching ? (
                        <section className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}{" "}
                                for &ldquo;{debounced}&rdquo;
                            </p>

                            {searchResults.length > 0 ? (
                                <div className={GRID}>
                                    {searchResults.map((c) => (
                                        <MasterCardItem
                                            key={c.href}
                                            card={c}
                                            onNavigate={handleNavigate}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                                    No masters match your search.
                                </div>
                            )}
                        </section>
                    ) : (
                        <>
                            <section
                                id="masters-section-frequently-used"
                                className="space-y-3"
                            >
                                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Frequently used
                                </h2>

                                {quickAccess.length > 0 ? (
                                    <div className={GRID}>
                                        {quickAccess.map((c) => (
                                            <MasterCardItem
                                                key={c.href}
                                                card={c}
                                                onNavigate={handleNavigate}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className={GRID}>
                                        {Array.from({ length: 8 }).map((_, i) => (
                                            <CardSkeleton key={i} />
                                        ))}
                                    </div>
                                )}
                            </section>

                            <div className="border-t" />

                            {GROUPED.map((group) => (
                                <section
                                    key={group.label}
                                    id={SECTION_ID(group.label)}
                                    className="space-y-3"
                                >
                                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        {group.label}
                                    </h2>

                                    <div className={GRID}>
                                        {group.cards.map((c) => (
                                            <MasterCardItem
                                                key={c.href}
                                                card={c}
                                                onNavigate={handleNavigate}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
