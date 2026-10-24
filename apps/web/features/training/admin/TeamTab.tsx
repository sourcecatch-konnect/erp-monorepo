"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { IconCircleCheck, IconCircleDashed, IconDownload, IconSearch } from "@tabler/icons-react";
import { TRAINING_TRACKS, type TrainingTeamRow } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { cn } from "@skerp/ui/lib/util";
import { downloadBlob } from "@/features/masters/_shared/master-api";
import { ProgressBar } from "../components/ProgressBar";
import { trainingKeys } from "../training.keys";
import { trainingApi } from "../training.service";

const PAGE_SIZE = 20;
const ALL = "__all__";
const COLUMNS = 5;
const TRACK_TITLE = new Map<string, string>(TRAINING_TRACKS.map((item) => [item.key, item.title]));

function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QuizStatus({ title, certified }: { title?: string; certified: boolean }) {
  const Icon = certified ? IconCircleCheck : IconCircleDashed;
  const status = certified ? "quiz passed" : "quiz not passed";
  return (
    <li className={cn("flex items-center gap-1 text-xs", certified ? "text-primary" : "text-muted-foreground")}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {title ? `${title}: ${status}` : status.charAt(0).toUpperCase() + status.slice(1)}
    </li>
  );
}

function ProgressCell({ row, track }: { row: TrainingTeamRow; track: string }) {
  const single = track === ALL ? undefined : row.tracks.find((item) => item.key === track);
  const progress = track === ALL ? row.required : single;
  if (!progress) {
    return <span className="text-sm text-muted-foreground">Not part of their role</span>;
  }
  const percent = progress.total === 0 ? 100 : Math.round((progress.finished / progress.total) * 100);
  // A10: certified / not certified per required track (or for the one picked).
  const quizzes = single
    ? [single]
    : row.tracks.filter((item) => item.assignment === "required");
  return (
    <div className="space-y-1">
      <div className="flex min-w-48 items-center gap-3">
        <ProgressBar percent={percent} label={`${row.name} training progress`} className="max-w-32" />
        <span className="shrink-0 text-xs text-muted-foreground">
          {progress.finished} of {progress.total} steps
        </span>
      </div>
      {quizzes.length > 0 ? (
        <ul className="space-y-0.5">
          {quizzes.map((item) => (
            <QuizStatus
              key={item.key}
              title={single ? undefined : TRACK_TITLE.get(item.key)}
              certified={item.certified}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A5 — who has done their training, with filters and Excel export. */
export function TeamTab() {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState(ALL);
  const [branchId, setBranchId] = useState(ALL);
  const [track, setTrack] = useState(ALL);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const filters = {
    ...(search ? { search } : {}),
    ...(roleId !== ALL ? { roleId } : {}),
    ...(branchId !== ALL ? { branchId } : {}),
  };
  const params = { page, size: PAGE_SIZE, ...filters };

  const roles = useQuery({ queryKey: trainingKeys.adminRoles, queryFn: trainingApi.adminRoles });
  const branches = useQuery({ queryKey: trainingKeys.adminBranches, queryFn: trainingApi.adminBranches });
  const team = useQuery({
    queryKey: trainingKeys.adminTeam(params),
    queryFn: () => trainingApi.team(params),
    placeholderData: keepPreviousData,
  });

  const exportXlsx = useMutation({
    mutationFn: () => trainingApi.exportTeam(filters),
    onSuccess: (blob) =>
      downloadBlob(blob, `skerp-training-${new Date().toISOString().slice(0, 10)}.xlsx`),
    onError: (error) => toast.error(`Export failed: ${error.message}`),
  });

  const rows = team.data?.data;
  const total = team.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="team-search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="team-search"
              className="h-10 pl-9"
              placeholder="Name or email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>
        <FilterSelect
          id="team-role"
          label="Role"
          value={roleId}
          allLabel="All roles"
          options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          onChange={(value) => {
            setRoleId(value);
            setPage(0);
          }}
        />
        <FilterSelect
          id="team-branch"
          label="Home branch"
          value={branchId}
          allLabel="All branches"
          options={(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
          onChange={(value) => {
            setBranchId(value);
            setPage(0);
          }}
        />
        <FilterSelect
          id="team-track"
          label="Show progress for"
          value={track}
          allLabel="All required training"
          options={TRAINING_TRACKS.map((item) => ({ value: item.key, label: item.title }))}
          onChange={setTrack}
        />
        <Button className="h-10" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
          <IconDownload className="size-4" aria-hidden />
          {exportXlsx.isPending ? "Preparing file…" : "Export to Excel"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Home branch</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Last activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.isLoading
            ? Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: COLUMNS }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
          {!team.isLoading && rows?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS} className="py-10 text-center text-muted-foreground">
                No people match these filters.
              </TableCell>
            </TableRow>
          ) : null}
          {!team.isLoading
            ? rows?.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </TableCell>
                  <TableCell>{row.roleName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.branchName ?? "—"}</TableCell>
                  <TableCell>
                    <ProgressCell row={row} track={track} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.lastActivity
                      ? format(new Date(row.lastActivity), "dd MMM yyyy")
                      : "Not started"}
                  </TableCell>
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>

      <footer className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{team.data ? `${total} ${total === 1 ? "person" : "people"}` : ""}</span>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={!canPrev}
                className={canPrev ? "" : "pointer-events-none opacity-50"}
                onClick={(event) => {
                  event.preventDefault();
                  if (canPrev) setPage((current) => current - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={!canNext}
                className={canNext ? "" : "pointer-events-none opacity-50"}
                onClick={(event) => {
                  event.preventDefault();
                  if (canNext) setPage((current) => current + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </footer>
    </div>
  );
}
