"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  responsibilitiesFromText,
  trainingRoleFormSchema,
} from "@skerp/validators";
import {
  TRAINING_TRACKS,
  type TrainingAdminRole,
  type TrainingRoleFormValues,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@skerp/ui/components/radioButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { cn } from "@skerp/ui/lib/util";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import { trainingKeys } from "../training.keys";
import { trainingApi } from "../training.service";

// Radix sets data-state="checked"; the shared controls' `data-checked:` fill never matches.
const CHECKED =
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

const FORM_ID = "training-role-form";

const effective = (track: TrainingAdminRole["tracks"][number]) =>
  track.configured ?? track.suggested;

const toDefaults = (role: TrainingAdminRole): TrainingRoleFormValues => ({
  summary: role.profile?.summary ?? "",
  responsibilitiesText: role.profile?.responsibilities.join("\n") ?? "",
  useSuggested: role.usesSuggested,
  requiredTracks: role.tracks
    .filter((track) => effective(track) === "required")
    .map((track) => track.key),
});

/** A5 — describe a role and choose the training it must take. */
export function RoleEditSheet({
  role,
  onClose,
}: {
  role: TrainingAdminRole | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const methods = useForm<TrainingRoleFormValues>({
    resolver: zodResolver(trainingRoleFormSchema),
    defaultValues: role ? toDefaults(role) : undefined,
  });

  useEffect(() => {
    if (role) methods.reset(toDefaults(role));
  }, [role, methods]);

  const save = useMutation({
    mutationFn: (values: TrainingRoleFormValues) => {
      if (!role) throw new Error("No role selected");
      return trainingApi.updateRole(role.id, {
        summary: values.summary,
        responsibilities: responsibilitiesFromText(values.responsibilitiesText),
        tracks: values.useSuggested
          ? []
          : role.tracks
              .filter((track) => track.stepCount > 0)
              .map((track) => ({
                trackKey: track.key,
                required: values.requiredTracks.includes(track.key),
              })),
      });
    },
    onSuccess: (updated) => {
      toast.success(`${updated.name} saved`);
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const useSuggested = methods.watch("useSuggested");

  return (
    <Sheet
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="gap-1 border-b border-border px-6 py-4 pr-12">
          <SheetTitle className="text-lg">{role?.name ?? "Role"}</SheetTitle>
          <SheetDescription>
            What people in this role see on their My role page, and which
            training they must finish.
          </SheetDescription>
        </SheetHeader>

        {role ? (
          <FormProvider {...methods}>
            <form
              id={FORM_ID}
              onSubmit={methods.handleSubmit((values) => save.mutate(values))}
              className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
              noValidate
            >
              <section className="space-y-4">
                <TextAreaField<TrainingRoleFormValues>
                  name="summary"
                  label="What does this role do?"
                  placeholder="e.g. Books customer orders at the branch, makes the LRs and plans the trucks."
                  rows={3}
                />
                <TextAreaField<TrainingRoleFormValues>
                  name="responsibilitiesText"
                  label="Main responsibilities (one per line, optional)"
                  placeholder={"Book orders the same day the customer calls\nAttach the e-way bill before the truck leaves"}
                  rows={5}
                />
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Training for this role</h3>
                  <p className="text-xs text-muted-foreground">
                    Everyone also takes ERP basics. Other training stays available as optional.
                  </p>
                </div>
                <Controller
                  control={methods.control}
                  name="useSuggested"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? "suggested" : "custom"}
                      onValueChange={(value) => field.onChange(value === "suggested")}
                    >
                      {[
                        {
                          value: "suggested",
                          label: "Use the suggested training",
                          hint: "Worked out from what this role is allowed to do. Updates itself when permissions change.",
                        },
                        {
                          value: "custom",
                          label: "Choose the training myself",
                          hint: "Tick exactly which training is required.",
                        },
                      ].map((option) => (
                        <label
                          key={option.value}
                          htmlFor={`role-training-${option.value}`}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors duration-150 hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem
                            id={`role-training-${option.value}`}
                            value={option.value}
                            className={cn("mt-0.5", CHECKED)}
                          />
                          <span className="grid gap-0.5">
                            <span className="text-sm font-medium text-foreground">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.hint}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />

                <Controller
                  control={methods.control}
                  name="requiredTracks"
                  render={({ field }) => (
                    <ul className="divide-y divide-border rounded-md border border-border bg-card">
                      {TRAINING_TRACKS.map((track) => {
                        const info = role.tracks.find((item) => item.key === track.key);
                        const applies = (info?.stepCount ?? 0) > 0;
                        const isBasics = track.key === "basics";
                        const checked = useSuggested
                          ? info?.suggested === "required"
                          : isBasics || field.value.includes(track.key);
                        const id = `role-track-${track.key}`;
                        return (
                          <li key={track.key} className={cn("flex items-start gap-3 px-3 py-3", !applies && "opacity-60")}>
                            <Checkbox
                              id={id}
                              className={cn("mt-0.5", CHECKED)}
                              checked={applies && checked}
                              disabled={useSuggested || !applies || isBasics}
                              onCheckedChange={(next) =>
                                field.onChange(
                                  next === true
                                    ? [...field.value, track.key]
                                    : field.value.filter((key) => key !== track.key),
                                )
                              }
                            />
                            <label htmlFor={id} className="grid flex-1 gap-0.5">
                              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                {track.title}
                                {info?.suggested === "required" && !isBasics ? (
                                  <span className="text-xs font-normal text-primary">Suggested</span>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {isBasics
                                  ? "Always required."
                                  : applies
                                    ? `${info?.stepCount} step${info?.stepCount === 1 ? "" : "s"} for this role. ${track.description}`
                                    : "Doesn't apply: this role can't do any of its steps."}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                />
              </section>
            </form>
          </FormProvider>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending || !role}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
