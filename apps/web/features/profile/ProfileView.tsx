"use client";

import { IconUserCircle } from "@tabler/icons-react";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useAuth } from "@/features/auth";
import { ProfilePhotoCard } from "./ProfilePhotoCard";
import { ProfileDetailsCard } from "./ProfileDetailsCard";

const initialsOf = (
  firstName?: string,
  lastName?: string,
  userName?: string,
): string => {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  const initials = `${a}${b}`.trim();
  return (initials || userName?.slice(0, 2) || "").toUpperCase();
};

export function ProfileView() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <IconUserCircle className="size-6" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-foreground">My profile</h1>
          <p className="text-sm text-muted-foreground">
            View your account details and manage your profile photo.
          </p>
        </div>
      </header>

      {user ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ProfilePhotoCard
              userId={user.id}
              initials={initialsOf(
                user.firstName,
                user.lastName,
                user.userName,
              )}
            />
          </div>
          <div className="lg:col-span-2">
            <ProfileDetailsCard user={user} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 w-full lg:col-span-1" />
          <Skeleton className="h-72 w-full lg:col-span-2" />
        </div>
      )}
    </div>
  );
}
