"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCalendarTime,
  IconFileText,
  IconPackage,
  IconReceipt,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
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

const DASH = "—";

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

function StatusBadge({ status }: { status?: string | null }) {
  const label = status || DASH;

  return (
    <span className="inline-flex rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">
      {label}
    </span>
  );
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoGrid({
  children,
  columns = 3,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const className =
    columns === 4
      ? "grid gap-4 md:grid-cols-4"
      : columns === 2
        ? "grid gap-4 md:grid-cols-2"
        : "grid gap-4 md:grid-cols-3";

  return <div className={className}>{children}</div>;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value || DASH}</div>
    </div>
  );
}

type GRNDetailPageProps = {
  id: string;
};

export default function GRNDetailPage({ id }: GRNDetailPageProps) {
  const router = useRouter();
  const grnQuery = useGRNDetail(id);

  const grn = grnQuery.data;
  const lr = grn?.lorryReceipt;
  const group = lr?.group;

  if (grnQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
          Loading GRN detail...
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
            onClick={() => router.push("/grn")}
          >
            Back to GRN
          </Button>
        </div>
      </div>
    );
  }

  const damagePhotos = grn.damagePhotos ?? [];

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            className="mb-2 gap-2 px-0"
            onClick={() => router.push("/grn")}
          >
            <IconArrowLeft size={16} />
            Back to GRN
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {grn.grnNumber || "GRN Detail"}
            </h1>
            <StatusBadge status={grn.status} />
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            LR: {lr?.lrNumber || DASH}
          </p>
        </div>

        <div className="flex gap-2">
          {grn.status === "DRAFT" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/grn/${grn.id}/edit`)}
            >
              Edit
            </Button>
          ) : null}

          <Button type="button" variant="outline">
            Download PDF
          </Button>
        </div>
      </div>

      {/* Top Summary */}
      <DetailCard title="GRN Summary" icon={<IconReceipt size={16} />}>
        <InfoGrid columns={4}>
          <InfoItem label="GRN Number" value={grn.grnNumber} />
          <InfoItem label="Status" value={<StatusBadge status={grn.status} />} />
          <InfoItem label="Gate No" value={grn.gateNo} />
          <InfoItem label="Created At" value={formatDateTime(grn.createdAt)} />

          <InfoItem label="Total Qty" value={formatNumber(grn.totalQty)} />
          <InfoItem label="Received Qty" value={formatNumber(grn.receivedQty)} />
          <InfoItem label="Damage Qty" value={formatNumber(grn.damageQty)} />
          <InfoItem label="Shortage Qty" value={formatNumber(grn.shortageQty)} />
        </InfoGrid>
      </DetailCard>

      {/* LR / Customer / Route */}
      <DetailCard title="LR & Route Details" icon={<IconTruck size={16} />}>
        <InfoGrid columns={3}>
          <InfoItem label="LR Number" value={lr?.lrNumber} />
          <InfoItem label="LR Status" value={lr?.status} />
          <InfoItem label="Invoice No" value={lr?.invoiceNumber} />

          <InfoItem label="Invoice Amount" value={formatPaise(lr?.invoiceAmount)} />
          <InfoItem label="Group Number" value={group?.groupNumber} />
          <InfoItem label="Consignor" value={group?.consignor?.name} />

          <InfoItem label="Consignee" value={group?.consignee?.name} />
          <InfoItem label="Origin Branch" value={group?.originBranch?.name} />
          <InfoItem label="Destination Branch" value={group?.destinationBranch?.name} />
        </InfoGrid>
      </DetailCard>

      {/* Receiving */}
      <DetailCard title="Receiving Details" icon={<IconCalendarTime size={16} />}>
        <InfoGrid columns={3}>
          <InfoItem label="In Date Time" value={formatDateTime(grn.inDateTime)} />
          <InfoItem label="Out Date Time" value={formatDateTime(grn.outDateTime)} />
          <InfoItem
            label="Unloading Minutes"
            value={
              grn.unloadingMinutes
                ? `${grn.unloadingMinutes} min`
                : DASH
            }
          />

          <InfoItem label="Total Weight MT" value={formatNumber(grn.totalWeightMt)} />
          <InfoItem label="Damages By" value={grn.damagesBy} />
          <InfoItem label="Remarks" value={grn.remarks} />
        </InfoGrid>
      </DetailCard>

      {/* Labour / Supervisor */}
      <DetailCard title="Labour & Supervisor" icon={<IconUser size={16} />}>
        <InfoGrid columns={3}>
          <InfoItem
            label="Labour"
            value={grn.labourName || grn.labour?.name || DASH}
          />
          <InfoItem label="Labour Type" value={grn.labour?.type} />
          <InfoItem label="Labour Mobile" value={grn.labour?.mobileNo} />

          <InfoItem
            label="Labour Charge"
            value={formatPaise(grn.labourCharge)}
          />
          <InfoItem
            label="Unloading Supervisor"
            value={fullName(grn.unloadingSupervisor)}
          />
          <InfoItem label="Created By" value={fullName(grn.createdBy)} />
        </InfoGrid>
      </DetailCard>

      {/* Document Checks */}
      <DetailCard title="Document Checks" icon={<IconFileText size={16} />}>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {[
                {
                  label: "LR Copy",
                  checked: grn.lrCopyChecked,
                  remark: grn.lrCopyRemark,
                },
                {
                  label: "Invoice",
                  checked: grn.invoiceChecked,
                  remark: grn.invoiceRemark,
                },
                {
                  label: "Kata Receipt",
                  checked: grn.kataReceiptChecked,
                  remark: grn.kataReceiptRemark,
                },
                {
                  label: "Way Bill",
                  checked: grn.wayBillChecked,
                  remark: grn.wayBillRemark,
                },
                {
                  label: "Seal No",
                  checked: grn.sealNoChecked,
                  remark: grn.sealNoRemark,
                },
              ].map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>
                    {row.checked ? (
                      <span className="text-green-600">Checked</span>
                    ) : (
                      <span className="text-muted-foreground">Not checked</span>
                    )}
                  </TableCell>
                  <TableCell>{row.remark || DASH}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DetailCard>

      {/* Goods */}
      <DetailCard title="Goods Received" icon={<IconPackage size={16} />}>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12">SN</TableHead>
                <TableHead>Goods</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Damage</TableHead>
                <TableHead>Shortage</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {grn.goods?.length ? (
                grn.goods.map((item, index) => (
                  <TableRow key={item.id ?? index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.goodsName}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{item.unit || DASH}</TableCell>
                    <TableCell>{formatNumber(item.totalQty)}</TableCell>
                    <TableCell>{formatNumber(item.receivedQty)}</TableCell>
                    <TableCell>{formatNumber(item.damageQty)}</TableCell>
                    <TableCell>{formatNumber(item.shortageQty)}</TableCell>
                    <TableCell>{formatNumber(item.weight)}</TableCell>
                    <TableCell>{item.remarks || DASH}</TableCell>
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
      </DetailCard>

      {/* Charges */}
      <DetailCard title="Freight & Charges" icon={<IconReceipt size={16} />}>
        <InfoGrid columns={4}>
          <InfoItem label="Total Freight" value={formatPaise(grn.totalFreight)} />
          <InfoItem label="Balance Freight" value={formatPaise(grn.balanceFreight)} />
          <InfoItem label="Freight / MT" value={formatPaise(grn.freightPerMt)} />
          <InfoItem label="Advance" value={formatPaise(grn.advanceAmount)} />

          <InfoItem label="Detention Days" value={formatNumber(grn.detentionDays)} />
          <InfoItem label="Detention Rate" value={formatPaise(grn.detentionRate)} />
          <InfoItem label="Detention Amount" value={formatPaise(grn.detentionAmount)} />
          <InfoItem label="Gross Total" value={formatPaise(grn.grossTotal)} />

          <InfoItem label="Damage Amount" value={formatPaise(grn.damageAmount)} />
          <InfoItem label="TDS" value={formatPaise(grn.tdsAmount)} />
          <InfoItem label="Hamali" value={formatPaise(grn.hamaliAmount)} />
          <InfoItem
            label="Printing & Stationery"
            value={formatPaise(grn.printingStationaryAmount)}
          />

          <InfoItem
            label="Net Amount"
            value={
              <span className="text-base font-semibold">
                {formatPaise(grn.netAmount)}
              </span>
            }
          />
        </InfoGrid>
      </DetailCard>

      {/* Damage Photos */}
      <DetailCard title="Damage Photos" icon={<IconFileText size={16} />}>
        {damagePhotos.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {damagePhotos.map((photo: any) => (
              <a
                key={photo.id}
                href={photo.url || photo.publicUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border bg-muted/20 p-3 text-sm hover:bg-muted/40"
              >
                <div className="font-medium">
                  {photo.originalName || photo.filename || "Damage Photo"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {photo.mime || "image"} ·{" "}
                  {photo.sizeBytes
                    ? `${(Number(photo.sizeBytes) / 1024 / 1024).toFixed(1)} MB`
                    : DASH}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No damage photos uploaded
          </div>
        )}
      </DetailCard>
    </div>
  );
}