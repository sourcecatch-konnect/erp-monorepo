"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBan,
  IconCalendarTime,
  IconCircleCheck,
  IconClock,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPrinter,
  IconReceipt,
  IconRoute,
  IconScale,
  IconTruck,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { formatPaise } from "@/lib/money";
import { runPdfAction, type PdfAction } from "@/lib/pdf-actions";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { useGRNDetail } from "./useHook/useGRN";
import { GRNStatusBadge, GRNVPLoadingStatusBadge } from "./components/grn-ui";
import { grnApi } from "./grn.service";
import ImageLightbox, { type LightboxImage } from "./components/imageLightBox";
const DASH = <span className="text-muted-foreground/60">—</span>;

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return DASH;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value?: number | string | null) => {
  if (value === undefined || value === null || value === "") return DASH;

  const number = Number(value);
  if (!Number.isFinite(number)) return DASH;

  return number.toLocaleString("en-IN", {
    maximumFractionDigits: 4,
  });
};

const formatLabel = (value?: string | null) => {
  if (!value) return DASH;

  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatDuration = (minutes?: number | null) => {
  if (minutes === undefined || minutes === null) return DASH;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
};

const toMetricTonnes = (
  value?: number | string | null,
  unit?: string | null,
) => {
  if (value === undefined || value === null || value === "") return null;

  const weight = Number(value);
  if (!Number.isFinite(weight)) return null;

  const normalizedUnit = unit?.trim().toUpperCase();
  return normalizedUnit === "KG" || normalizedUnit === "KGS"
    ? weight / 1000
    : weight;
};

const formatWeightMt = (value?: number | string | null) => {
  if (value === undefined || value === null || value === "") return DASH;
  return `${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 4,
  })} MT`;
};

const fullName = (
  user?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null,
) => {
  if (!user) return DASH;

  const name = [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || DASH;
};

type DamagePhoto = {
  id: string;
  url?: string | null;
  publicUrl?: string | null;
  viewUrl?: string | null;
  originalName?: string | null;
  filename?: string | null;
  mime?: string | null;
  mimeType?: string | null;
};

const EMPTY_DAMAGE_PHOTOS: DamagePhoto[] = [];

const sameRecord = (a: Record<string, string>, b: Record<string, string>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => a[key] === b[key]);
};
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm font-medium text-foreground">
        {value ?? DASH}
      </dd>
    </div>
  );
}

function CardSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold leading-none">
            {value}
          </p>
          {hint ? (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>

        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

type GRNDetailPageProps = {
  id: string;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const toAbsoluteUrl = (url?: string | null) => {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const getDirectPhotoUrl = (photo: {
  url?: string | null;
  publicUrl?: string | null;
  viewUrl?: string | null;
}) => {
  return toAbsoluteUrl(photo.viewUrl || photo.publicUrl || photo.url);
};

const getPhotoName = (photo: {
  originalName?: string | null;
  filename?: string | null;
}) => {
  return photo.originalName || photo.filename || "Damage Photo";
};
export default function GRNDetailPage({ id }: GRNDetailPageProps) {
  const router = useRouter();
  const grnQuery = useGRNDetail(id);

  const [photoLightboxOpen, setPhotoLightboxOpen] = React.useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0);
  const [photoPreviewUrls, setPhotoPreviewUrls] = React.useState<
    Record<string, string>
  >({});
  const [pdfBusy, setPdfBusy] = React.useState(false);

  const grn = grnQuery.data;
  const lr = grn?.lorryReceipt;
  const group = lr?.group;
  type DetailTrip = {
    tripNumber?: string | null;
    vehicle?: { vehicleNumber?: string | null } | null;
    driver?: { name?: string | null } | null;
  };
  type DetailGroup = NonNullable<typeof group> & {
    priority?: string | null;
    isMarketVehicle?: boolean | null;
    marketVehicleNumber?: string | null;
    marketDriverName?: string | null;
    railheadBranch?: { name?: string | null } | null;
    primaryTrip?: DetailTrip | null;
    secondaryTrip?: DetailTrip | null;
  };
  const detailGroup = group as DetailGroup | null | undefined;
  const totalWeightMt =
    grn?.totalWeightMt ?? toMetricTonnes(lr?.totalWeight, lr?.unit);
  const damagePhotos = (grn?.damagePhotos ??
    EMPTY_DAMAGE_PHOTOS) as DamagePhoto[];

  React.useEffect(() => {
    let active = true;

    async function loadDamagePhotoPreviews() {
      if (!grn?.id || damagePhotos.length === 0) {
        setPhotoPreviewUrls((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }

      const entries = await Promise.all(
        damagePhotos.map(async (photo) => {
          try {
            const { viewUrl } = await grnApi.getDamagePhotoViewUrl(
              grn.id,
              photo.id,
            );

            return [String(photo.id), viewUrl] as const;
          } catch {
            return [String(photo.id), ""] as const;
          }
        }),
      );

      if (!active) return;

      const next = Object.fromEntries(
        entries.filter(([, url]) => Boolean(url)),
      ) as Record<string, string>;

      setPhotoPreviewUrls((prev) => (sameRecord(prev, next) ? prev : next));
    }

    loadDamagePhotoPreviews();

    return () => {
      active = false;
    };
  }, [grn?.id, damagePhotos]);
  const damagePhotoImages = React.useMemo<LightboxImage[]>(() => {
    return damagePhotos
      .map((photo) => {
        const imageUrl = photoPreviewUrls[photo.id] || getDirectPhotoUrl(photo);

        if (!imageUrl) return null;

        return {
          id: String(photo.id),
          url: imageUrl,
          title: getPhotoName(photo),
          meta: `${photo.mime || photo.mimeType || "image"}`,
        };
      })
      .filter(Boolean) as LightboxImage[];
  }, [damagePhotos, photoPreviewUrls]);
  if (grnQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (grnQuery.isError || !grn) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm font-medium">GRN not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This GRN may be deleted, cancelled, or outside your branch scope.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/vp-management/grn")}
          >
            Back to GRN
          </Button>
        </div>
      </div>
    );
  }

  const isEditable = ["DRAFT", "SUBMITTED"].includes(grn.status);
  const grnNumber = grn.grnNumber || grn.id;

  const handlePdf = async (action: PdfAction, withLetterhead: boolean) => {
    try {
      setPdfBusy(true);
      const blob = await grnApi.downloadPdf(grn.id, withLetterhead);
      const suffix = withLetterhead ? "" : "-plain";
      runPdfAction(
        blob,
        action,
        `${grnNumber.replaceAll("/", "-")}${suffix}.pdf`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPdfBusy(false);
    }
  };

  const openPrintPreview = (withLetterhead: boolean) => {
    window.open(
      `/api/grn/${encodeURIComponent(grn.id)}/print-preview?letterhead=${withLetterhead}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const trip = detailGroup?.primaryTrip ?? detailGroup?.secondaryTrip ?? null;
  const vehicleNumber = detailGroup?.isMarketVehicle
    ? detailGroup.marketVehicleNumber
    : trip?.vehicle?.vehicleNumber;
  const driverName = detailGroup?.isMarketVehicle
    ? detailGroup.marketDriverName
    : trip?.driver?.name;
  type GoodsRow = NonNullable<typeof grn.goods>[number] & {
    availableQty?: number | null;
  };
  const goods = (grn.goods ?? []) as GoodsRow[];
  const vpLoadingSummary = grn.vpLoadingSummary ?? {
    status: "PENDING" as const,
    loadedQty: 0,
    remainingQty: grn.receivedQty,
    progressPercent: 0,
    activeLoadingCount: 0,
  };
  const vpLoadings = grn.vpLoadings ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => router.push("/vp-management/grn")}
          >
            <IconArrowLeft size={16} className="mr-1.5" />
            Back to GRN
          </Button>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pdfBusy}
                >
                  {pdfBusy ? (
                    <IconLoader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <IconDownload size={14} className="mr-1.5" />
                  )}
                  {pdfBusy ? "Preparing…" : "Print / PDF"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Download</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handlePdf("download", true)}>
                  <IconDownload size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePdf("download", false)}>
                  <IconDownload size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Print</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handlePdf("print", true)}>
                  <IconPrinter size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePdf("print", false)}>
                  <IconPrinter size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Preview</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => openPrintPreview(true)}>
                  <IconEye size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openPrintPreview(false)}>
                  <IconEye size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isEditable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/vp-management/grn/${grn.id}/edit`)}
              >
                <IconEdit size={14} className="mr-1.5" />
                Edit GRN
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {grn.grnNumber || "GRN Detail"}
              </h1>
              <GRNStatusBadge status={grn.status} />
              <GRNVPLoadingStatusBadge status={vpLoadingSummary.status} />
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Goods receipt for LR {lr?.lrNumber || "—"}
            </p>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                <IconFileText
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="truncate">LR {lr?.lrNumber || "—"}</span>
              </div>

              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                <IconTruck
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="truncate">
                  {vehicleNumber || "Vehicle not available"}
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2 sm:col-span-2 xl:col-span-2">
                <IconClock
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />

                <span className="shrink-0 text-muted-foreground">
                  Received:
                </span>

                <span className="min-w-0 whitespace-nowrap font-medium">
                  {formatDateTime(grn.inDateTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {grn.cancelReason ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <IconBan size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">GRN cancelled</p>
            <p className="mt-0.5">{grn.cancelReason}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Total Quantity"
          value={formatNumber(grn.totalQty)}
          hint={`${goods.length} goods line${goods.length === 1 ? "" : "s"}`}
          icon={<IconPackage size={18} />}
        />
        <MetricCard
          label="Received Quantity"
          value={formatNumber(grn.receivedQty)}
          hint={`${formatNumber(grn.totalQty - grn.receivedQty)} pending`}
          icon={<IconCircleCheck size={18} />}
        />
        <MetricCard
          label="Damage / Shortage"
          value={`${formatNumber(grn.damageQty)} / ${formatNumber(
            grn.shortageQty,
          )}`}
          hint="Damage / shortage quantities"
          icon={<IconAlertCircle size={18} />}
        />
        <MetricCard
          label="Total Weight"
          value={formatWeightMt(totalWeightMt)}
          hint={grn.totalWeightMt == null ? "From LR" : "GRN snapshot"}
          icon={<IconScale size={18} />}
        />
        <MetricCard
          label="VP Loaded"
          value={`${formatNumber(vpLoadingSummary.loadedQty)} / ${formatNumber(
            grn.receivedQty,
          )}`}
          hint={`${vpLoadingSummary.progressPercent}% loaded`}
          icon={<IconTruck size={18} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <CardSection
            title="LR, Route & Vehicle"
            icon={<IconRoute size={15} />}
          >
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                {/* Loading */}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    Loading Location
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold">
                    {lr?.loadingLocation?.name || "—"}
                  </p>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Source Branch:{" "}
                    <span className="font-medium text-foreground">
                      {detailGroup?.originBranch?.name || "—"}
                    </span>
                  </p>
                </div>

                {/* Route indicator */}
                <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
                  <span className="h-px w-8 bg-border" />
                  <IconTruck size={18} />
                  <span className="h-px w-8 bg-border" />
                </div>

                {/* Unloading */}
                <div className="min-w-0 sm:text-right">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    Unloading Location
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold">
                    {lr?.unloadingLocation?.name || "—"}
                  </p>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Destination Branch:{" "}
                    <span className="font-medium text-foreground">
                      {detailGroup?.destinationBranch?.name || "—"}
                    </span>
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 whitespace-nowrap xl:col-span-2">
                  <Field label="LR Number" value={lr?.lrNumber} />
                </div>

                <div className="min-w-0 whitespace-nowrap xl:col-span-2">
                  <Field
                    label="Group Number"
                    value={detailGroup?.groupNumber}
                  />
                </div>

                <Field
                  label="Transport Type"
                  value={formatLabel(detailGroup?.transportType)}
                />

                <Field
                  label="Priority"
                  value={formatLabel(detailGroup?.priority)}
                />

                <Field label="Consignor" value={detailGroup?.consignor?.name} />

                <Field label="Consignee" value={detailGroup?.consignee?.name} />

                <Field
                  label="Origin Branch"
                  value={detailGroup?.originBranch?.name}
                />

                <Field
                  label="Railhead Branch"
                  value={detailGroup?.railheadBranch?.name}
                />

                <Field
                  label="Destination Branch"
                  value={detailGroup?.destinationBranch?.name}
                />

                <Field label="Vehicle Number" value={vehicleNumber} />

                <Field label="Driver" value={driverName} />

                <div className="col-span-full min-w-0 whitespace-nowrap">
                  <Field label="Trip Number" value={trip?.tripNumber} />
                </div>
              </dl>
            </div>
          </CardSection>

          <CardSection
            title="Goods Received"
            icon={<IconPackage size={14} />}
            action={
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {goods.length} item{goods.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[440px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 text-xs font-semibold uppercase">
                      SN
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase">
                      Goods
                    </TableHead>

                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Total
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Received
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Damage
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">
                      Shortage
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {goods.length ? (
                    goods.map((item, index) => (
                      <TableRow key={item.id ?? index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {item.goodsName || "—"}
                          </div>
                          {item.description ? (
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          ) : null}
                        </TableCell>

                        <TableCell className="text-right tabular-nums">
                          {formatNumber(item.totalQty)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-emerald-700">
                          {formatNumber(item.receivedQty)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(item.damageQty)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(item.shortageQty)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        No goods found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardSection>

          <CardSection
            title="VP Loading Progress"
            icon={<IconTruck size={15} />}
            action={
              <GRNVPLoadingStatusBadge status={vpLoadingSummary.status} />
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Loaded Qty</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(vpLoadingSummary.loadedQty)}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Remaining Qty</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(vpLoadingSummary.remainingQty)}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Active Loadings</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {vpLoadingSummary.activeLoadingCount}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Loading progress</span>
                <span className="font-semibold tabular-nums">
                  {vpLoadingSummary.progressPercent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${vpLoadingSummary.progressPercent}%` }}
                />
              </div>
            </div>

            {vpLoadings.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table className="min-w-[550px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase">
                        VP Loading
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase">
                        Wagon
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase">
                        Gate
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase">
                        Loaded Qty
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vpLoadings.map((loading) => {
                      const row = loading.vpWagonLoading.mrRrRow;
                      const schedule = row.mrRr.vpSchedule;

                      return (
                        <TableRow key={loading.id}>
                          <TableCell>
                            <Link
                              href={`/vp-management/vp-loading/${encodeURIComponent(
                                schedule.id,
                              )}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {loading.loadingNumber}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {schedule.scheduleNumber}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{row.wagon.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.rowLabel}
                            </p>
                          </TableCell>
                          <TableCell>
                            {loading.vpWagonLoading.gateNo
                              ? `Gate ${loading.vpWagonLoading.gateNo}`
                              : DASH}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNumber(loading.loadedQty)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                loading.status === "CANCELLED"
                                  ? "font-medium text-red-600"
                                  : "font-medium text-emerald-700"
                              }
                            >
                              {formatLabel(loading.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                No VP Loading has been created for this GRN.
              </div>
            )}
          </CardSection>

          <CardSection
            title="Receiving Details"
            icon={<IconCalendarTime size={15} />}
          >
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              <Field
                label="Gate No"
                value={grn.gateNo ? `Gate ${grn.gateNo}` : null}
              />
              <Field label="No. of Labour" value={grn.labourCount} />
              <Field
                label="In Date Time"
                value={formatDateTime(grn.inDateTime)}
              />
              <Field
                label="Out Date Time"
                value={formatDateTime(grn.outDateTime)}
              />
              <Field
                label="Unloading Duration"
                value={formatDuration(grn.unloadingMinutes)}
              />
              <Field
                label="Total Weight MT"
                value={formatWeightMt(totalWeightMt)}
              />
              <Field label="Damage By" value={formatLabel(grn.damagesBy)} />
              <Field label="Labour Type" value={formatLabel(grn.labourName)} />
              <Field label="Supervisor" value={grn.unloadingSupervisor?.name} />
              <Field label="Remarks" value={grn.remarks} />
            </dl>
          </CardSection>

          <CardSection
            title="Document Verification"
            icon={<IconFileText size={15} />}
          >
            <div className="overflow-x-auto rounded-lg border bg-background">
              <Table className="min-w-[360px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Document
                    </TableHead>

                    <TableHead className="w-[32%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Source Value
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      LR Copy
                    </TableCell>

                    <TableCell className="font-medium">
                      {lr?.lrNumber || DASH}
                    </TableCell>
                  </TableRow>

                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      Invoice
                    </TableCell>

                    <TableCell>
                      {lr?.invoiceNumber ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {lr.invoiceNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Amount: {formatPaise(lr.invoiceAmount)}
                          </p>
                        </div>
                      ) : (
                        DASH
                      )}
                    </TableCell>
                  </TableRow>

                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      Way Bill
                    </TableCell>

                    <TableCell className="font-medium">
                      {lr?.ewayBill?.ewayBillNo || DASH}
                    </TableCell>
                  </TableRow>

                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      Seal Number
                    </TableCell>

                    <TableCell className="font-medium">
                      {detailGroup?.sealNumber || DASH}
                    </TableCell>
                  </TableRow>

                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      Kata Receipt
                    </TableCell>

                    <TableCell className="font-medium">
                      {formatWeightMt(totalWeightMt)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardSection>

          <CardSection
            title="Damage Evidence"
            icon={<IconAlertCircle size={15} />}
            action={
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {damagePhotos.length} photo
                {damagePhotos.length === 1 ? "" : "s"}
              </span>
            }
          >
            {damagePhotos.length ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  {damagePhotos.map((photo) => {
                    const imageUrl =
                      photoPreviewUrls[photo.id] || getDirectPhotoUrl(photo);
                    const imageName = getPhotoName(photo);

                    const lightboxIndex = damagePhotoImages.findIndex(
                      (item) => item.id === String(photo.id),
                    );

                    return (
                      <div
                        key={photo.id}
                        className="overflow-hidden rounded-lg border bg-muted/20 text-sm"
                      >
                        {imageUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePhotoIndex(
                                lightboxIndex >= 0 ? lightboxIndex : 0,
                              );
                              setPhotoLightboxOpen(true);
                            }}
                            className="block w-full cursor-zoom-in text-left"
                          >
                            <img
                              src={imageUrl}
                              alt={imageName}
                              loading="lazy"
                              className="aspect-video w-full bg-muted object-cover transition hover:opacity-90"
                            />
                          </button>
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                            Image not available
                          </div>
                        )}

                        <div className="p-3">
                          <div className="truncate font-medium">
                            {imageName}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {photo.mime || photo.mimeType || "image"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ImageLightbox
                  open={photoLightboxOpen}
                  images={damagePhotoImages}
                  activeIndex={activePhotoIndex}
                  onOpenChange={setPhotoLightboxOpen}
                  onActiveIndexChange={setActivePhotoIndex}
                />
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No damage photos uploaded
              </div>
            )}
          </CardSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <CardSection
            title="Freight & Charges"
            icon={<IconReceipt size={15} />}
          >
            <dl className="grid grid-cols-2 gap-4">
              <Field
                label="Total Freight"
                value={formatPaise(grn.totalFreight)}
              />
              <Field
                label="Balance Freight"
                value={formatPaise(grn.balanceFreight)}
              />
              <Field
                label="Freight / MT"
                value={formatPaise(grn.freightPerMt)}
              />
              <Field label="Advance" value={formatPaise(grn.advanceAmount)} />
              <Field label="Detention Days" value={grn.detentionDays} />
              <Field
                label="Detention Rate"
                value={formatPaise(grn.detentionRate)}
              />
              <Field
                label="Detention Amount"
                value={formatPaise(grn.detentionAmount)}
              />
              <Field
                label="Damage Amount"
                value={formatPaise(grn.damageAmount)}
              />
              <Field label="TDS" value={formatPaise(grn.tdsAmount)} />
              <Field label="Hamali" value={formatPaise(grn.hamaliAmount)} />
              <Field
                label="Printing & Stationery"
                value={formatPaise(grn.printingStationaryAmount)}
              />
            </dl>

            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Gross Total</span>
                <span className="font-semibold">
                  {formatPaise(grn.grossTotal)}
                </span>
              </div>
              <div className="rounded-lg bg-primary p-4 text-primary-foreground">
                <p className="text-xs font-medium uppercase opacity-80">
                  Net Amount
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatPaise(grn.netAmount)}
                </p>
              </div>
            </div>
          </CardSection>

          <CardSection
            title="Labour & Supervisor"
            icon={<IconUsers size={15} />}
          >
            <dl className="grid gap-4">
              <Field
                label="Labour"
                value={grn.labour?.name || formatLabel(grn.labourName)}
              />
              <Field label="No. of Labour" value={grn.labourCount} />
              <Field
                label="Labour Charge"
                value={formatPaise(grn.labourCharge)}
              />
              <Field
                label="Unloading Supervisor"
                value={grn.unloadingSupervisor?.name}
              />
            </dl>
          </CardSection>

          <CardSection title="Audit Information" icon={<IconUser size={15} />}>
            <dl className="grid gap-4">
              <Field label="Created By" value={fullName(grn.createdBy)} />
              <Field label="Created At" value={formatDateTime(grn.createdAt)} />
              <Field label="Updated By" value={fullName(grn.updatedBy)} />
              <Field label="Updated At" value={formatDateTime(grn.updatedAt)} />
            </dl>
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
