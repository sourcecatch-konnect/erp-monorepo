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
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-foreground">
        {value ?? "—"}
      </p>
    </div>
  );
}

type Props = {
  lr: LorryReceipt;
  isMarketVehicle: boolean;
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
  isMarketVehicle,
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
      <div className="mt-5 border-t border-border pt-5">
        <Button variant="outline" onClick={onDeliver}>
          <IconTruckDelivery size={16} /> Mark delivered
        </Button>
      </div>
    );
  }

  if (!delivery) return null;

  return (
    <div className="mt-5 space-y-4 border-t border-border pt-5">
      <section className="rounded-md border border-success/30 bg-success/5 p-4">
        <div className="mb-4 flex items-center justify-between border-b border-success/20 pb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconTruckDelivery size={17} className="text-success" /> Delivered
          </h3>
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
                variant="destructive"
                aria-label="Undo delivery"
                onClick={onUndoDelivery}
              >
                <IconArrowBackUp size={14} />
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
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
          {isMarketVehicle && (
            <InfoField
              label="Unloading charge paid"
              value={
                delivery.unloadingCharges != null
                  ? formatPaise(delivery.unloadingCharges)
                  : "—"
              }
            />
          )}
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
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            POD photos
          </p>
          <AttachmentPanel
            api={attachmentApi}
            entityType={DELIVERY_POD_ENTITY}
            entityId={delivery.id}
          />
        </div>
      </section>

      {ack ? (
        <section className="rounded-md border border-primary/25 bg-primary/5 p-4">
          <div className="mb-4 flex items-center justify-between border-b border-primary/15 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconClipboardCheck size={17} className="text-primary" /> POD
              received
            </h3>
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
                  variant="destructive"
                  aria-label="Undo acknowledgement"
                  onClick={onUndoAcknowledgement}
                >
                  <IconArrowBackUp size={14} />
                </Button>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <InfoField label="Received" value={formatDate(ack.receivedAt)} />
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
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              POD scans
            </p>
            <AttachmentPanel
              api={attachmentApi}
              entityType={ACK_SCAN_ENTITY}
              entityId={ack.id}
            />
          </div>
        </section>
      ) : (
        canAcknowledge && (
          <Button variant="outline" onClick={onAcknowledge}>
            <IconClipboardCheck size={16} /> Acknowledge POD
          </Button>
        )
      )}
    </div>
  );
}
