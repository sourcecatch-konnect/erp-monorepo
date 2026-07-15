"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CloseJourneyLegBody,
  JourneyLeg,
  VehicleJourney,
} from "@skerp/types";

import CloseTripDialog from "@/components/feedback/CloseTripDialog";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { journeyApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
  leg: JourneyLeg | null;
};

/** Connects the shared trip/leg close form to the journey close API. */
export default function CloseLegDialog({
  open,
  onOpenChange,
  journey,
  leg,
}: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);

  if (!leg) return null;

  const isReturnToBase = leg.toCityId === journey.returnCityId;

  const onConfirm = async (values: CloseJourneyLegBody) => {
    setSubmitting(true);
    try {
      await journeyApi.closeLeg(journey.id, leg.id, values);
      toast.success(
        isReturnToBase ? "Leg closed — journey returned to base" : "Leg closed",
      );
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CloseTripDialog
      open={open}
      onOpenChange={onOpenChange}
      entity="leg"
      reference={`${leg.sequenceNo ?? ""} — ${leg.fromCity?.name} → ${leg.toCity?.name}`}
      openingKm={leg.openingKm}
      isReturnToBase={isReturnToBase}
      returnCityName={journey.returnCity?.name}
      isPending={submitting}
      onConfirm={onConfirm}
    />
  );
}
