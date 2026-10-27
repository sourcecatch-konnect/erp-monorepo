"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TRAINING_TRACKS, type TrainingAdminRole } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { trainingKeys } from "../training.keys";
import { trainingApi } from "../training.service";
import { RoleEditSheet } from "./RoleEditSheet";

const TRACK_TITLE = new Map(
  TRAINING_TRACKS.map((track) => [track.key, track.title]),
);

function RoleCard({
  role,
  onEdit,
}: {
  role: TrainingAdminRole;
  onEdit: () => void;
}) {
  const required = role.tracks.filter(
    (track) => (track.configured ?? track.suggested) === "required",
  );
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{role.name}</p>
          <p className="text-xs text-muted-foreground">
            {role.userCount} {role.userCount === 1 ? "person" : "people"}
            {role.isSystem ? " · full access" : ""}
          </p>
        </div>
        <Button variant="outline" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {role.profile?.summary ||
          "No description yet. People in this role see a general explanation."}
      </p>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Required training ·{" "}
          {role.usesSuggested
            ? "suggested from permissions"
            : "chosen by an admin"}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {required.map((track) => (
            <li
              key={track.key}
              className="rounded-lg border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              {TRACK_TITLE.get(track.key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Every role, what it's told on My role, and the training it must take. */
export function RolesTab() {
  const [editing, setEditing] = useState<TrainingAdminRole | null>(null);
  const {
    data: roles,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: trainingKeys.adminRoles,
    queryFn: trainingApi.adminRoles,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Write a short description for each role and choose its training. Until
        you change it, each role gets training suggested from its permissions.
      </p>

      {isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load the roles: {error.message}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))
          : roles?.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => setEditing(role)}
              />
            ))}
      </div>

      <RoleEditSheet role={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
