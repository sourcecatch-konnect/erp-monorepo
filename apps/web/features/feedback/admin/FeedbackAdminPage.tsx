"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { IconDownload, IconFileText } from "@tabler/icons-react";
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_LABELS } from "@skerp/validators";
import { PERMS, type FeedbackStatus } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
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
import { useCan } from "@/features/auth";
import { downloadBlob } from "@/features/masters/_shared/master-api";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { FeedbackDetailSheet } from "./FeedbackDetailSheet";
import { FeedbackFilters, type FeedbackFilterValues } from "./FeedbackFilters";
import { FeedbackSummaryCards } from "./FeedbackSummaryCards";
import { FeedbackTable } from "./FeedbackTable";

const PAGE_SIZE = 20;

/** Settings → Feedback: everything testers reported, for triage and export. */
export function FeedbackAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.FEEDBACK.MANAGE);

  const [filters, setFilters] = useState<FeedbackFilterValues>({});
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const updateFilters = (patch: Partial<FeedbackFilterValues>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
    setSelected(new Set());
  };

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = searchText.trim() || undefined;
      setFilters((current) =>
        current.search === search ? current : { ...current, search },
      );
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ?id= deep-links to one item (used by the Excel "Link" column and Copy as Jira).
  const openId = searchParams.get("id");
  const setOpenId = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("id", id);
    else params.delete("id");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const params = { page, size: PAGE_SIZE, ...filters };
  const list = useQuery({
    queryKey: feedbackKeys.list(params),
    queryFn: () => feedbackApi.list(params),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: feedbackKeys.summary,
    queryFn: feedbackApi.summary,
  });

  const bulk = useMutation({
    mutationFn: feedbackApi.bulkStatus,
    onSuccess: ({ updated }) => {
      toast.success(`${updated} item${updated === 1 ? "" : "s"} updated`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(error.message),
  });

  const exportFile = useMutation({
    mutationFn: async (format: "xlsx" | "docx") => ({
      format,
      blob: await (format === "xlsx"
        ? feedbackApi.exportXlsx(filters)
        : feedbackApi.exportDocx(filters)),
    }),
    onSuccess: ({ format, blob }) =>
      downloadBlob(blob, `skerp-feedback-${new Date().toISOString().slice(0, 10)}.${format}`),
    onError: (error) => toast.error(`Export failed: ${error.message}`),
  });

  const rows = list.data?.data;
  const total = list.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const hasFilters = Object.values(filters).some(Boolean);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected(checked && rows ? new Set(rows.map((row) => row.id)) : new Set());

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            What testers reported from inside the ERP. Click a row to read it
            and update its status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportFile.mutate("docx")}
            disabled={exportFile.isPending}
          >
            <IconFileText className="size-4" aria-hidden />
            {exportFile.isPending && exportFile.variables === "docx"
              ? "Preparing report…"
              : "Export to Word"}
          </Button>
          <Button onClick={() => exportFile.mutate("xlsx")} disabled={exportFile.isPending}>
            <IconDownload className="size-4" aria-hidden />
            {exportFile.isPending && exportFile.variables === "xlsx"
              ? "Preparing file…"
              : "Export to Excel"}
          </Button>
        </div>
      </header>
      <p className="-mt-3 text-xs text-muted-foreground">
        Both exports follow the filters below. The Word report includes the
        pictures and the conversation, for up to 300 items.
      </p>

      <FeedbackSummaryCards
        summary={summary.data}
        status={filters.status}
        category={filters.category}
        pageTitle={filters.pageTitle}
        onStatus={(status) => updateFilters({ status })}
        onCategory={(category) => updateFilters({ category })}
        onPage={({ module, pageTitle }) => updateFilters({ module, pageTitle })}
      />

      <FeedbackFilters
        filters={filters}
        searchText={searchText}
        modules={summary.data?.modules ?? []}
        onSearchText={setSearchText}
        onChange={updateFilters}
        onClear={() => {
          setSearchText("");
          setFilters({});
          setPage(0);
          setSelected(new Set());
        }}
      />

      {canManage && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">{selected.size} selected</span>
          <Select
            value=""
            onValueChange={(status) =>
              bulk.mutate({ ids: [...selected], status: status as FeedbackStatus })
            }
            disabled={bulk.isPending}
          >
            <SelectTrigger className="h-9 w-52" aria-label="Change status of selected">
              <SelectValue placeholder="Change status to…" />
            </SelectTrigger>
            <SelectContent>
              {FEEDBACK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {FEEDBACK_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <FeedbackTable
        rows={rows}
        loading={list.isLoading}
        selectable={canManage}
        selected={selected}
        emptyMessage={
          hasFilters
            ? "No feedback matches these filters."
            : "No feedback yet. When testers use the Feedback button at the top of any page, their reports appear here."
        }
        onToggle={toggle}
        onToggleAll={toggleAll}
        onOpen={setOpenId}
      />

      <footer className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{list.data ? `${total} item${total === 1 ? "" : "s"}` : ""}</span>
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

      <FeedbackDetailSheet
        id={openId}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
