"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { paiseToRupees } from "@/lib/money";
import { jobCardApi, type LookupOption } from "../api/job-card.service";
import { jobCardKeys } from "../api/job-card.keys";
import { newServiceLine, type ServiceLineDraft } from "../line-drafts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanics: LookupOption[];
  serviceProviders: LookupOption[];
  onAdd: (line: ServiceLineDraft) => void;
};

/** Old-ERP-style: Provider → Service Category → Service, with the rate
 *  auto-filled from that service's master rate (still editable) —
 *  mirrors how the PO screen prefills a part's rate. */
export function AddServiceDialog({ open, onOpenChange, mechanics, serviceProviders, onAdd }: Props) {
  const [serviceProviderId, setServiceProviderId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [sparePartId, setSparePartId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [rate, setRate] = React.useState("");
  const [mechanicId, setMechanicId] = React.useState("");
  const [description, setDescription] = React.useState("");

  const categories = useQuery({
    queryKey: jobCardKeys.categories("Service"),
    queryFn: () => jobCardApi.categories("Service"),
  });
  const services = useQuery({
    queryKey: jobCardKeys.spareParts("Service", categoryId),
    queryFn: () => jobCardApi.spareParts("Service", categoryId),
    enabled: Boolean(categoryId),
  });

  const reset = () => {
    setServiceProviderId("");
    setCategoryId("");
    setSparePartId("");
    setQty("1");
    setRate("");
    setMechanicId("");
    setDescription("");
  };

  const selectedProvider = serviceProviders.find((p) => p.value === serviceProviderId);
  const selectedService = services.data?.find((s) => s.value === sparePartId);

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
            <Select value={serviceProviderId} onValueChange={setServiceProviderId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {serviceProviders.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              value={sparePartId}
              onValueChange={(v) => {
                setSparePartId(v);
                const picked = services.data?.find((s) => s.value === v);
                if (picked) setRate(String(paiseToRupees(Number(picked.ratePaise))));
              }}
              disabled={!categoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={categoryId ? "Select service" : "Pick a category first"} />
              </SelectTrigger>
              <SelectContent>
                {services.data?.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
