"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@skerp/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";

const COLUMN_COUNT = 5;

export function AuditLogPage() {
  const [filters, setFilters] = useState({
    entity: "",
    actorId: "",
    action: "",
    page: 1,
    size: 10,
  });

  const params = {
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    page: filters.page,
    size: filters.size,
  };

  const { data, isLoading } = useQuery({
    queryKey: rbacKeys.auditLog(params),
    queryFn: () => rbacApi.auditLog(params),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const canPrev = filters.page > 1;
  const canNext = filters.page < totalPages;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          RBAC mutations are recorded here.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Entity
          </label>
          <Input
            placeholder="Role | User"
            value={filters.entity}
            onChange={(e) =>
              setFilters((f) => ({ ...f, entity: e.target.value, page: 1 }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <Input
            placeholder="role.create"
            value={filters.action}
            onChange={(e) =>
              setFilters((f) => ({ ...f, action: e.target.value, page: 1 }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Actor ID
          </label>
          <Input
            placeholder="user id"
            value={filters.actorId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, actorId: e.target.value, page: 1 }))
            }
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && data?.items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="py-8 text-center text-muted-foreground"
              >
                No entries match these filters.
              </TableCell>
            </TableRow>
          )}

          {data?.items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {e.actor
                  ? `${e.actor.firstName} ${e.actor.lastName}`
                  : e.actorId}
              </TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell className="text-muted-foreground">
                {e.entity}:{e.entityId.slice(0, 8)}…
              </TableCell>
              <TableCell className="whitespace-normal">
                {e.before || e.after ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      diff
                    </summary>
                    <pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap rounded-sm bg-muted/40 p-2 text-xs text-foreground">
                      {JSON.stringify(
                        { before: e.before, after: e.after },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <footer className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data ? `${data.total} entries` : ""}</span>
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!canPrev}
                onClick={(e) => {
                  e.preventDefault();
                  if (canPrev) {
                    setFilters((f) => ({ ...f, page: f.page - 1 }));
                  }
                }}
                href="#"
                className={!canPrev ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Page {filters.page} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-disabled={!canNext}
                onClick={(e) => {
                  e.preventDefault();
                  if (canNext) {
                    setFilters((f) => ({ ...f, page: f.page + 1 }));
                  }
                }}
                href="#"
                className={!canNext ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </footer>
    </div>
  );
}
