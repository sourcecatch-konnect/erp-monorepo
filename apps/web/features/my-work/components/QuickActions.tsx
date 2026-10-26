"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AcknowledgeLRFormInput,
  DeliverLRFormInput,
} from "@skerp/types";
import { attachmentApi } from "@/features/attachments/attachment.client";
import {
  ACK_SCAN_ENTITY,
  AcknowledgeDialog,
  DELIVERY_POD_ENTITY,
  DeliverDialog,
  lorryReceiptApi,
  lrGroupApi,
} from "@/features/lorry-receipts";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { ApproveOrderModal, orderApi, orderKeys } from "@/features/orders";
import { myWorkKeys } from "../my-work.keys";
import { ApproveDialog } from "./ApproveDialog";
import type { QuickAction } from "./quick";

type Props = {
  action: QuickAction | null;
  onClose: () => void;
};

/** After a step is done, refresh My Work and the screens that own the data. */
function useRefreshAfterAction() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: myWorkKeys.all }),
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["lorry-receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["lr-groups"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-worklists"] }),
    ]);
  };
}

async function uploadAll(
  entityType: string,
  entityId: string,
  files: File[],
  what: string,
) {
  try {
    await Promise.all(
      files.map((file) =>
        attachmentApi.upload(
          {
            entityType,
            entityId,
            originalName: file.name,
            mime: file.type || "application/octet-stream",
            sizeBytes: file.size,
          },
          file,
        ),
      ),
    );
  } catch (error) {
    toast.error(`${what} saved, but a file upload failed: ${getErrorMessage(error)}`);
  }
}

function ConfirmOrder({ id, onClose }: { id: string; onClose: () => void }) {
  const refresh = useRefreshAfterAction();
  const detail = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderApi.detail(id),
  });

  if (!detail.data) return null;
  return (
    <ApproveOrderModal
      order={detail.data}
      open
      onOpenChange={(open) => !open && onClose()}
      onApproved={() => {
        void refresh();
        onClose();
      }}
    />
  );
}

function Acknowledge({ id, onClose }: { id: string; onClose: () => void }) {
  const refresh = useRefreshAfterAction();
  const lr = useQuery({
    queryKey: ["my-work", "quick", "lr", id],
    queryFn: () => lorryReceiptApi.detail(id),
  });

  const acknowledge = useMutation({
    mutationFn: async (vars: {
      values: AcknowledgeLRFormInput;
      scanFiles: File[];
    }) => {
      const ack = await lorryReceiptApi.acknowledge(id, vars.values);
      await uploadAll(ACK_SCAN_ENTITY, ack.id, vars.scanFiles, "Acknowledgement");
      return ack;
    },
    onSuccess: async () => {
      toast.success("POD acknowledged");
      onClose();
      await refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!lr.data) return null;
  return (
    <AcknowledgeDialog
      open
      onOpenChange={(open) => !open && onClose()}
      lrNumber={lr.data.lrNumber}
      goods={lr.data.goods ?? []}
      mode="acknowledge"
      isPending={acknowledge.isPending}
      onConfirm={(values, scanFiles) =>
        acknowledge.mutate({ values, scanFiles })
      }
    />
  );
}

function Deliver({
  id,
  number,
  onClose,
}: {
  id: string;
  number: string;
  onClose: () => void;
}) {
  const refresh = useRefreshAfterAction();
  // The market-vehicle flag lives on the LR's group, and the dialog changes
  // its fields by it, so load the group by the LR number.
  const group = useQuery({
    queryKey: ["my-work", "quick", "group", number],
    queryFn: () => lrGroupApi.detail(number),
  });

  const deliver = useMutation({
    mutationFn: async (vars: {
      values: DeliverLRFormInput;
      podFiles: File[];
    }) => {
      const delivery = await lorryReceiptApi.deliver(id, vars.values);
      await uploadAll(DELIVERY_POD_ENTITY, delivery.id, vars.podFiles, "Delivery");
      return delivery;
    },
    onSuccess: async () => {
      toast.success("LR marked delivered");
      onClose();
      await refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!group.data) return null;
  return (
    <DeliverDialog
      open
      onOpenChange={(open) => !open && onClose()}
      lrNumber={number}
      isMarketVehicle={group.data.isMarketVehicle}
      mode="deliver"
      isPending={deliver.isPending}
      onConfirm={(values, podFiles) => deliver.mutate({ values, podFiles })}
    />
  );
}

function ApproveRow({
  action,
  onClose,
}: {
  action: QuickAction;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // Approvals touch many screens (receipts, payments, salary, POs); refresh all.
  const refresh = () => queryClient.invalidateQueries();
  return <ApproveDialog row={action.row!} onClose={onClose} onDone={refresh} />;
}

/** Renders the dialog for whichever quick action is open. */
export default function QuickActions({ action, onClose }: Props) {
  if (!action) return null;
  // Keyed so each action starts from a clean state.
  const key = `${action.kind}:${action.id}`;

  if (action.kind === "confirm-order") {
    return <ConfirmOrder key={key} id={action.id} onClose={onClose} />;
  }
  if (action.kind === "ack") {
    return <Acknowledge key={key} id={action.id} onClose={onClose} />;
  }
  if (action.kind === "approve") {
    return action.row ? (
      <ApproveRow key={key} action={action} onClose={onClose} />
    ) : null;
  }
  return (
    <Deliver key={key} id={action.id} number={action.number} onClose={onClose} />
  );
}
