"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCalendarTime,
  IconEdit,
  IconFileText,
  IconPackage,
  IconReceipt,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { formatPaise } from "@/lib/money";
import { useGRNDetail } from "./useHook/useGRN";
import { GRNStatusBadge } from "./components/grn-ui";
import { grnApi } from "./grn.service";
import ImageLightbox, {
  type LightboxImage,
} from "./components/imageLightBox";
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
  return String(value);
};

const fullName = (
  user?:
    | {
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        email?: string | null;
      }
    | null,
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

const sameRecord = (
  a: Record<string, string>,
  b: Record<string, string>,
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => a[key] === b[key]);
};
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value ?? DASH}</dd>
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
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}


type GRNDetailPageProps = {
  id: string;
};
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

  const grn = grnQuery.data;
  const lr = grn?.lorryReceipt;
  const group = lr?.group;
    const damagePhotos = (grn?.damagePhotos ??
    EMPTY_DAMAGE_PHOTOS) as DamagePhoto[];

  React.useEffect(() => {
    let active = true;

    async function loadDamagePhotoPreviews() {
      if (!grn?.id || damagePhotos.length === 0) {
        setPhotoPreviewUrls((prev) =>
          Object.keys(prev).length ? {} : prev,
        );
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

      setPhotoPreviewUrls((prev) =>
        sameRecord(prev, next) ? prev : next,
      );
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
      <div className="mx-auto max-w-5xl space-y-4 p-4">
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

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
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


  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push("/vp-management/grn")}
      >
        <IconArrowLeft size={16} className="mr-1" />
        Back to GRN
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {grn.grnNumber || "GRN Detail"}
            </h1>
            <GRNStatusBadge status={grn.status} />
          </div>

          <p className="text-sm text-muted-foreground">
            LR: {lr?.lrNumber || "—"} · Created {formatDateTime(grn.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/vp-management/grn/${grn.id}/edit`)
              }
            >
              <IconEdit size={14} className="mr-1.5" />
              Edit
            </Button>
          ) : null}

         
        </div>
      </div>

      {grn.cancelReason ? (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Cancelled: </strong>
          {grn.cancelReason}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <CardSection title="LR & Route Details" icon={<IconTruck size={14} />}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="LR Number" value={lr?.lrNumber} />

              <Field label="Invoice No" value={lr?.invoiceNumber} />
              <Field
                label="Invoice Amount"
                value={formatPaise(lr?.invoiceAmount)}
              />
              <Field label="Group Number" value={group?.groupNumber} />
              <Field label="Transport Type" value={group?.transportType} />
              <Field label="Consignor" value={group?.consignor?.name} />
              <Field label="Consignee" value={group?.consignee?.name} />
              <Field label="Origin Branch" value={group?.originBranch?.name} />
              <Field
                label="Destination Branch"
                value={group?.destinationBranch?.name}
              />
            </dl>
          </CardSection>

          <CardSection
            title="Goods Received"
            icon={<IconPackage size={14} />}
            action={
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {grn.goods?.length ?? 0} item
                {(grn.goods?.length ?? 0) === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 text-xs uppercase">SN</TableHead>
                    <TableHead className="text-xs uppercase">Goods</TableHead>
                    <TableHead className="text-xs uppercase">Unit</TableHead>
                    <TableHead className="text-xs uppercase">Total</TableHead>
                    <TableHead className="text-xs uppercase">
                      Received
                    </TableHead>
                    <TableHead className="text-xs uppercase">Damage</TableHead>
                    <TableHead className="text-xs uppercase">
                      Shortage
                    </TableHead>
                    <TableHead className="text-xs uppercase">Weight</TableHead>
                    <TableHead className="text-xs uppercase">
                      Remarks
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {grn.goods?.length ? (
                    grn.goods.map((item, index) => (
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
                        <TableCell>{item.unit || "—"}</TableCell>
                        <TableCell>{formatNumber(item.totalQty)}</TableCell>
                        <TableCell>{formatNumber(item.receivedQty)}</TableCell>
                        <TableCell>{formatNumber(item.damageQty)}</TableCell>
                        <TableCell>{formatNumber(item.shortageQty)}</TableCell>
                        <TableCell>{formatNumber(item.weight)}</TableCell>
                        <TableCell>{item.remarks || "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={9}
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
            title="Receiving Details"
            icon={<IconCalendarTime size={14} />}
          >
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Gate No" value={grn.gateNo} />
              <Field label="In Date Time" value={formatDateTime(grn.inDateTime)} />
              <Field
                label="Out Date Time"
                value={formatDateTime(grn.outDateTime)}
              />
              <Field
                label="Unloading Minutes"
                value={
                  grn.unloadingMinutes
                    ? `${grn.unloadingMinutes} min`
                    : null
                }
              />
              <Field
                label="Total Weight MT"
                value={formatNumber(grn.totalWeightMt)}
              />
              <Field label="Damages By" value={grn.damagesBy} />
              <Field label="Remarks" value={grn.remarks} />
            </dl>
          </CardSection>

         <CardSection
  title="LR Source Documents"
  icon={<IconFileText size={14} />}
>
  <div className="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="text-xs uppercase">Document</TableHead>
          <TableHead className="text-xs uppercase">Value</TableHead>
     
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableRow>
          <TableCell className="font-medium">LR Copy</TableCell>
          <TableCell>{lr?.lrNumber || "—"}</TableCell>
         
        </TableRow>

        <TableRow>
          <TableCell className="font-medium">Invoice</TableCell>
          <TableCell>
            {lr?.invoiceNumber ? (
              <div>
                <div>{lr.invoiceNumber}</div>
                <div className="text-xs text-muted-foreground">
                  Amount: {formatPaise(lr.invoiceAmount)}
                </div>
              </div>
            ) : (
              "—"
            )}
          </TableCell>
     
        </TableRow>

        <TableRow>
          <TableCell className="font-medium">Way Bill</TableCell>
          <TableCell>{lr?.ewayBill?.ewayBillNo || "—"}</TableCell>
        
        </TableRow>

        <TableRow>
          <TableCell className="font-medium">Seal No</TableCell>
          <TableCell>{group?.sealNumber || "—"}</TableCell>
   
        </TableRow>

        <TableRow>
          <TableCell className="font-medium">Kata Receipt</TableCell>
          <TableCell>—</TableCell>

        </TableRow>
      </TableBody>
    </Table>
  </div>
</CardSection>

        <CardSection title="Damage Photos" icon={<IconFileText size={14} />}>
  {damagePhotos.length ? (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {damagePhotos.map((photo) => {
          const imageUrl =
            photoPreviewUrls[photo.id] || getDirectPhotoUrl(photo);
          const imageName = getPhotoName(photo);

          const lightboxIndex = damagePhotoImages.findIndex(
            (item) => item.id === String(photo.id)
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
                    setActivePhotoIndex(lightboxIndex >= 0 ? lightboxIndex : 0);
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
                <div className="truncate font-medium">{imageName}</div>

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

        <div className="space-y-4">
    
          <CardSection title="Labour & Supervisor" icon={<IconUser size={14} />}>
            <dl className="grid gap-4">
              <Field
                label="Labour"
                value={grn.labourName || grn.labour?.name}
              />
              <Field
                label="Labour Charge"
                value={formatPaise(grn.labourCharge)}
              />
              <Field
                label="Unloading Supervisor"
                value={fullName(grn.unloadingSupervisor)}
              />
              <Field label="Created By" value={fullName(grn.createdBy)} />
            </dl>
          </CardSection>

          <CardSection title="Freight & Charges" icon={<IconReceipt size={14} />}>
            <dl className="grid gap-4">
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
              <Field
                label="Detention Amount"
                value={formatPaise(grn.detentionAmount)}
              />
              <Field label="Gross Total" value={formatPaise(grn.grossTotal)} />
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
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Net Amount
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatPaise(grn.netAmount)}
                </p>
              </div>
            </dl>
          </CardSection>
        </div>
      </div>
    </div>
  );
}
