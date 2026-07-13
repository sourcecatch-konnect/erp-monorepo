"use client";

import * as React from "react";
import type { LorryReceipt } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { AttachmentPanel } from "@skerp/attachments-web";
import {
  IconTruckDelivery,
  IconClipboardCheck,
  IconPencil,
  IconArrowBackUp,
} from "@tabler/icons-react";

import { attachmentApi } from "@/features/attachments/attachment.client";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const DELIVERY_POD_ENTITY = "lr-delivery";
export const ACK_SCAN_ENTITY = "lr-acknowledgement";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function InfoField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

type Props = {
  lr: LorryReceipt;
  canDeliver: boolean;
  canAcknowledge: boolean;
  onDeliver: () => void;
  onEditDelivery: () => void;
  onUndoDelivery: () => void;
  onAcknowledge: () => void;
  onEditAcknowledgement: () => void;
  onUndoAcknowledgement: () => void;
};

/**
 * Post-transit section of an LR card: delivery record, POD photos,
 * acknowledgement record and scans, with the stage-appropriate actions.
 */
export default function DeliverySection({
  lr,
  canDeliver,
  canAcknowledge,
  onDeliver,
  onEditDelivery,
  onUndoDelivery,
  onAcknowledge,
  onEditAcknowledgement,
  onUndoAcknowledgement,
}: Props) {
  const delivery = lr.delivery ?? null;
  const ack = lr.acknowledgement ?? null;

  if (lr.status === "FINALISED") {
    if (!canDeliver) return null;
    return (
      <div className="mt-3 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onDeliver}>
          <IconTruckDelivery size={14} className="mr-1" /> Mark delivered
        </Button>
      </div>
    );
  }

  if (!delivery) return null;

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="rounded-md bg-sky-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-sky-700">
            <IconTruckDelivery size={13} /> Delivered
          </p>
          <div className="flex gap-1">
            {canDeliver && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Edit delivery"
                onClick={onEditDelivery}
              >
                <IconPencil size={14} />
              </Button>
            )}
            {canDeliver && !ack && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Undo delivery"
                className="text-red-600 hover:bg-red-50"
                onClick={onUndoDelivery}
              >
                <IconArrowBackUp size={14} />
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoField
            label="Delivered at"
            value={formatDateTime(delivery.deliveredAt)}
          />
          <InfoField
            label="Truck reported"
            value={
              delivery.reportedAt ? formatDateTime(delivery.reportedAt) : "—"
            }
          />
          <InfoField
            label="Receiver"
            value={
              delivery.receiverName
                ? `${delivery.receiverName}${delivery.receiverPhone ? ` · ${delivery.receiverPhone}` : ""}`
                : "—"
            }
          />
          <InfoField
            label="Unloading charges"
            value={
              delivery.unloadingCharges != null
                ? formatPaise(delivery.unloadingCharges)
                : "—"
            }
          />
          <InfoField
            label="Recorded by"
            value={
              delivery.createdBy
                ? `${delivery.createdBy.firstName} ${delivery.createdBy.lastName}`
                : "—"
            }
          />
          <InfoField label="Remark" value={delivery.remark ?? "—"} />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            POD photos
          </p>
          <AttachmentPanel
            api={attachmentApi}
            entityType={DELIVERY_POD_ENTITY}
            entityId={delivery.id}
          />
        </div>
      </div>

      {ack ? (
        <div className="rounded-md bg-violet-500/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-violet-700">
              <IconClipboardCheck size={13} /> POD received
            </p>
            {canAcknowledge && (
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit acknowledgement"
                  onClick={onEditAcknowledgement}
                >
                  <IconPencil size={14} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Undo acknowledgement"
                  className="text-red-600 hover:bg-red-50"
                  onClick={onUndoAcknowledgement}
                >
                  <IconArrowBackUp size={14} />
                </Button>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoField
              label="Received"
              value={formatDate(ack.receivedAt)}
            />
            <InfoField
              label="Courier"
              value={
                ack.courierName
                  ? `${ack.courierName}${ack.courierDocketNo ? ` · ${ack.courierDocketNo}` : ""}`
                  : (ack.courierDocketNo ?? "—")
              }
            />
            <InfoField
              label="Courier charge"
              value={
                ack.courierCharge != null ? formatPaise(ack.courierCharge) : "—"
              }
            />
            <InfoField
              label="Detention"
              value={
                ack.detentionDays != null || ack.detentionAmount != null
                  ? `${ack.detentionDays ?? 0} day(s)${ack.detentionAmount != null ? ` · ${formatPaise(ack.detentionAmount)}` : ""}`
                  : "—"
              }
            />
            <InfoField
              label="Damage amount"
              value={
                ack.damageAmount != null ? formatPaise(ack.damageAmount) : "—"
              }
            />
            <InfoField label="Remark" value={ack.remark ?? "—"} />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              POD scans
            </p>
            <AttachmentPanel
              api={attachmentApi}
              entityType={ACK_SCAN_ENTITY}
              entityId={ack.id}
            />
          </div>
        </div>
      ) : (
        canAcknowledge && (
          <Button size="sm" variant="outline" onClick={onAcknowledge}>
            <IconClipboardCheck size={14} className="mr-1" /> Acknowledge POD
          </Button>
        )
      )}
    </div>
  );
}
