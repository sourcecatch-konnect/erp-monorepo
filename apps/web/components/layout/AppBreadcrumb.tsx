"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@skerp/ui/components/breadcrumb";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useBreadcrumbLabels } from "./breadcrumb-labels";

/** "lorry-receipts" -> "Lorry Receipts" */
const titleize = (segment: string): string =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Breadcrumb derived from the current route path. */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const { labels } = useBreadcrumbLabels();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label = labels[href];

          const isRoleDetailSegment =
            segments[index - 2] === "settings" &&
            segments[index - 1] === "roles";

          const isDynamicSegment =
            isRoleDetailSegment ||
            (segments[index - 1] === "trips" && !label);

        const decodedSegment = decodeURIComponent(segment);

const isMRRRDetailSegment =
  segments[index - 2] === "operations" &&
  segments[index - 1] === "mrrr";

const content =
  label ??
  (isMRRRDetailSegment ? (
    `MR/RR - ${decodedSegment}`
  ) : isDynamicSegment ? (
    <Skeleton className="h-4 w-36 rounded-sm" />
  ) : (
    titleize(decodedSegment)
  ));

          return (
            <Fragment key={href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{content}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{content}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}