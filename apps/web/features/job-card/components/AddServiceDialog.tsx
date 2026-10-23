"use client";

import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { paiseToRupees } from "@/lib/money";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { jobCardApi, LOOKUP_PAGE_SIZE, type LookupOption } from "../api/job-card.service";
import { jobCardKeys } from "../api/job-card.keys";
import { newServiceLine, type ServiceLineDraft } from "../line-drafts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanics: LookupOption[];
  onAdd: (line: ServiceLineDraft) => void;
};

/** Old-ERP-style: Provider → Service Category → Service, with the rate
 *  auto-filled from that service's master rate (still editable) —
 *  mirrors how the PO screen prefills a part's rate. */
export function AddServiceDialog({ open, onOpenChange, mechanics, onAdd }: Props) {
  const [serviceProviderId, setServiceProviderId] = React.useState("");
  const [providerSearch, setProviderSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [sparePartId, setSparePartId] = React.useState("");
  const [serviceSearch, setServiceSearch] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [rate, setRate] = React.useState("");
  const [mechanicId, setMechanicId] = React.useState("");
  const [description, setDescription] = React.useState("");

  const debouncedProviderSearch = useDebouncedValue(providerSearch, 300);
  const debouncedServiceSearch = useDebouncedValue(serviceSearch, 300);

  const categories = useQuery({
    queryKey: jobCardKeys.categories("Service"),
    queryFn: () => jobCardApi.categories("Service"),
  });
  const serviceProviders = useInfiniteQuery({
    queryKey: jobCardKeys.serviceProviders(debouncedProviderSearch),
    queryFn: ({ pageParam = 0 }) =>
      jobCardApi.serviceProviders({
        page: pageParam,
        size: LOOKUP_PAGE_SIZE,
        search: debouncedProviderSearch,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") return loaded < total ? allPages.length : undefined;
      return lastPage.data.length === LOOKUP_PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: open,
  });
  const services = useInfiniteQuery({
    queryKey: jobCardKeys.spareParts("Service", categoryId, debouncedServiceSearch),
    queryFn: ({ pageParam = 0 }) =>
      jobCardApi.spareParts({
        type: "Service",
        categoryId,
        search: debouncedServiceSearch,
        page: pageParam,
        size: LOOKUP_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") return loaded < total ? allPages.length : undefined;
      return lastPage.data.length === LOOKUP_PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: Boolean(categoryId),
  });
  const providerOptions = React.useMemo(
    () => serviceProviders.data?.pages.flatMap((page) => page.data) ?? [],
    [serviceProviders.data],
  );
  const serviceOptions = React.useMemo(
    () => services.data?.pages.flatMap((page) => page.data) ?? [],
    [services.data],
  );

  const reset = () => {
    setServiceProviderId("");
    setProviderSearch("");
    setCategoryId("");
    setSparePartId("");
    setServiceSearch("");
    setQty("1");
    setRate("");
    setMechanicId("");
    setDescription("");
  };

  const selectedProvider = providerOptions.find((p) => p.value === serviceProviderId);
  const selectedService = serviceOptions.find((s) => s.value === sparePartId);

  const canSave =
    Boolean(serviceProviderId) && Boolean(sparePartId) && Number(qty) > 0 && Number(rate) > 0;

  const handleSave = () => {
    onAdd({
      ...newServiceLine(),
      serviceProviderId,
      serviceProviderName: selectedProvider?.label ?? "",
      sparePartId,
      serviceName: selectedService?.label ?? "",
      qty,
      rate,
      mechanicId,
      description,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Service Detail</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Service Provider</label>
            <Combobox
              options={providerOptions}
              value={serviceProviderId}
              onChange={setServiceProviderId}
              searchValue={providerSearch}
              onSearchChange={setProviderSearch}
              placeholder="Search provider..."
              searchPlaceholder="Type to search..."
              emptyText={serviceProviders.isLoading ? "Loading providers..." : "No providers found"}
              hasMore={Boolean(serviceProviders.hasNextPage)}
              isLoadingMore={serviceProviders.isFetchingNextPage}
              onScrollEnd={() => {
                if (serviceProviders.hasNextPage && !serviceProviders.isFetchingNextPage) {
                  serviceProviders.fetchNextPage();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Service Category</label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setSparePartId("");
                setRate("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.data?.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Service</label>
            <Combobox
              options={serviceOptions}
              value={sparePartId}
              onChange={(v) => {
                setSparePartId(v);
                const picked = serviceOptions.find((s) => s.value === v);
                if (picked) setRate(String(paiseToRupees(Number(picked.ratePaise))));
              }}
              searchValue={serviceSearch}
              onSearchChange={setServiceSearch}
              disabled={!categoryId}
              placeholder={categoryId ? "Search service..." : "Pick a category first"}
              searchPlaceholder="Type to search..."
              hasMore={Boolean(services.hasNextPage)}
              isLoadingMore={services.isFetchingNextPage}
              onScrollEnd={() => {
                if (services.hasNextPage && !services.isFetchingNextPage) services.fetchNextPage();
              }}
              emptyText={services.isLoading ? "Loading services..." : "No services found"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Qty</label>
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Rate (₹) <span className="text-muted-foreground">— from master, editable</span>
            </label>
            <Input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={!(Number(rate) > 0) ? "border-destructive" : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mechanic</label>
            <Select value={mechanicId} onValueChange={setMechanicId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select mechanic" />
              </SelectTrigger>
              <SelectContent>
                {mechanics.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={1} className="resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
