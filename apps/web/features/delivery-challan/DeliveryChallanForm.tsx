"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuildingWarehouse,
  IconPackage,
  IconRoute,
  IconTrain,
  IconTruckDelivery,
} from "@tabler/icons-react";
import type {
  CreateDeliveryChallanBody,
  DeliveryChallanPreviewItem,
  UpdateDeliveryChallanBody,
} from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  SuggestInput,
  type SuggestOption,
} from "@skerp/ui/components/suggest-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Textarea } from "@skerp/ui/components/textarea";

import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { driverApi } from "@/features/masters/driver/driver.service";
import DriverForm from "@/features/masters/driver/driverForm";
import VehicleForm from "@/features/masters/vehicle/vehicleForm";
import { useCan } from "@/features/auth";

import {
  type DeliveryChallanDetail,
  type DeliveryVehicleMode,
} from "./delivery-challan.service";
import {
  useCreateDeliveryChallan,
  useDeliveryChallanPreview,
  useDeliveryChallanRakes,
  useDeliveryChallanSupervisors,
  useDeliveryChallanTransports,
  useDeliveryChallanVehicles,
  useUpdateDeliveryChallan,
} from "./useDeliveryChallan";

import { Popover, PopoverContent, PopoverTrigger } from "@skerp/ui/components/popver";

type Props =
  | { mode: "create"; initialData?: never }
  | { mode: "edit"; initialData: DeliveryChallanDetail };

type Quantities = Record<string, number>;
type LrDispatchGroup = {
  key: string;
  lrNumber: string;
  consigneeId: string;
  consigneeName: string | null;
  destinationAddress: string | null;
  items: DeliveryChallanPreviewItem[];
  vpLabels: string[];
  goodsLabels: string[];
};
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const toLocalDateTime = (value: string) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const paiseToRupees = (value?: string | number | null) =>
  value == null || value === "" ? "" : String(Number(value) / 100);

const FieldLabel = ({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="mb-1.5 block text-xs font-medium">
    {children}
    {required ? <span className="ml-0.5 text-destructive">*</span> : null}
  </label>
);

const Section = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border bg-card">
    <div className="flex items-start gap-3 border-b px-4 py-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);
function VpListPopover({ labels }: { labels: string[] }) {
  if (!labels.length) {
    return <span>—</span>;
  }

  if (labels.length === 1) {
    return <span className="whitespace-nowrap">{labels[0]}</span>;
  }

  const [firstLabel, ...remainingLabels] = labels;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-muted"
        >
          <span className="whitespace-nowrap font-medium">
            {firstLabel}
          </span>

          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            +{remainingLabels.length}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Source VPs</p>

          <p className="text-xs text-muted-foreground">
            This goods quantity was received through {labels.length} wagons.
          </p>
        </div>

        <div className="max-h-60 overflow-y-auto p-2">
          <div className="space-y-1">
            {labels.map((label, index) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {index + 1}
                </span>

                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
function AddressPopover({
  consignee,
  address,
}: {
  consignee: string | null;
  address: string | null;
}) {
  return (
    <div className="max-w-[240px]">
      <p className="truncate font-medium" title={consignee ?? undefined}>
        {consignee || "—"}
      </p>

      {address ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-0.5 block max-w-full truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              {address}
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-80">
            <p className="text-sm font-semibold">
              {consignee || "Delivery address"}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
              {address}
            </p>
          </PopoverContent>
        </Popover>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">
          No saved address
        </p>
      )}
    </div>
  );
}
export default function DeliveryChallanForm({ mode, initialData }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [scheduleDate, setScheduleDate] = React.useState("");
  const [rakeId, setRakeId] = React.useState(initialData?.railRakeId ?? "");
  const [vehicleMode, setVehicleMode] = React.useState<DeliveryVehicleMode>(
    initialData?.vehicleMode ?? "MARKET",
  );
  const [transportId, setTransportId] = React.useState(
    initialData?.transportId ?? "",
  );
  const [vehicleId, setVehicleId] = React.useState(
    initialData?.vehicleId ?? "",
  );
  const [selectedBranchGrnId, setSelectedBranchGrnId] =
    React.useState("");
  const [vehicleNumber, setVehicleNumber] = React.useState(
    initialData?.vehicleNumberSnapshot ?? "",
  );
  const [destinationAreaId, setDestinationAreaId] = React.useState(
    initialData?.destinationAreaId ?? "",
  );
  const [destinationLocationId, setDestinationLocationId] = React.useState(
    initialData?.destinationLocationId ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = React.useState(
    initialData?.deliveryAddressSnapshot ?? "",
  );
  const [driverName, setDriverName] = React.useState(
    initialData?.driverName ?? "",
  );
  const [driverMobile, setDriverMobile] = React.useState(
    initialData?.driverMobile ?? "",
  );
  const [totalWeight, setTotalWeight] = React.useState(
    initialData?.totalWeight == null ? "" : String(initialData.totalWeight),
  );
  const [freightAmount, setFreightAmount] = React.useState(
    paiseToRupees(initialData?.freightAmount),
  );
  const [advanceAmount, setAdvanceAmount] = React.useState(
    paiseToRupees(initialData?.advanceAmount),
  );
  const [paymentBy, setPaymentBy] = React.useState(
    initialData?.paymentBy ?? "",
  );
  const [loadingAt, setLoadingAt] = React.useState(
    initialData?.loadingAt
      ? toLocalDateTime(initialData.loadingAt)
      : nowLocal(),
  );
  const [supervisorId, setSupervisorId] = React.useState(
    initialData?.supervisorId ?? "",
  );
  const [remarks] = React.useState(initialData?.remarks ?? "");
  const [quantities, setQuantities] = React.useState<Quantities>(() =>
    Object.fromEntries(
      (initialData?.items ?? []).map((item) => [
        item.branchGrnItemId,
        item.quantity,
      ]),
    ),
  );

  const rakesQuery = useDeliveryChallanRakes(scheduleDate || undefined);
  const previewQuery = useDeliveryChallanPreview(rakeId || undefined);
  const supervisorsQuery = useDeliveryChallanSupervisors(rakeId || undefined);
  const transportsQuery = useDeliveryChallanTransports(
    vehicleMode === "MARKET",
  );
  const vehiclesQuery = useDeliveryChallanVehicles(vehicleMode, transportId);
  const driversQuery = useQuery({
    queryKey: ["delivery-challans", "options", "drivers"],
    queryFn: () => driverApi.list({ page: 0, size: 1000, sort: "name:asc" }),
  });
  const createMutation = useCreateDeliveryChallan();
  const updateMutation = useUpdateDeliveryChallan();
  const queryClient = useQueryClient();
  const canCreateVehicle = useCan(PERMS.MASTERS.VEHICLE.CREATE);
  const canCreateDriver = useCan(PERMS.MASTERS.DRIVER.CREATE);
  const [vehicleFormOpen, setVehicleFormOpen] = React.useState(false);
  const [driverFormOpen, setDriverFormOpen] = React.useState(false);
  const preview = previewQuery.data;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const selectedRake = React.useMemo(
    () => (rakesQuery.data ?? []).find((rake) => rake.id === rakeId),
    [rakeId, rakesQuery.data],
  );
  const railRoute = isEdit
    ? {
      sourceBranch: initialData.railRake.fromBranch,
      receivingBranch: initialData.railRake.toBranch,
      sourceArea: initialData.railRake.vpSchedule.sourceArea,
      destinationArea: initialData.railRake.vpSchedule.destinationArea,
    }
    : selectedRake;

  const currentByItem = React.useMemo(
    () =>
      new Map(
        (initialData?.items ?? []).map((item) => [
          item.branchGrnItemId,
          item.quantity,
        ]),
      ),
    [initialData?.items],
  );

  const maxFor = (item: DeliveryChallanPreviewItem) =>
    item.pendingQty + (currentByItem.get(item.branchGrnItemId) ?? 0);
  const selectedFor = (item: DeliveryChallanPreviewItem) =>
    quantities[item.branchGrnItemId] ?? 0;

  const remainingFor = (item: DeliveryChallanPreviewItem) =>
    Math.max(maxFor(item) - selectedFor(item), 0);

  const pendingForWagon = (branchGrnId: string) =>
    (preview?.items ?? [])
      .filter((item) => item.branchGrnId === branchGrnId)
      .reduce(
        (total, item) => total + remainingFor(item),
        0,
      );
  const lrGroups = React.useMemo(() => {
    const groups = new Map<string, LrDispatchGroup>();

    for (const item of preview?.items ?? []) {
      const key = `${item.consigneeId}:${item.lrNumber}:${item.grnGoodsId}`;
      const vpLabel = item.vpNo || item.rowLabel;
      const goodsLabel = item.unit
        ? `${item.goodsName} (${item.unit})`
        : item.goodsName;

      const existing = groups.get(key);

      if (existing) {
        const isNewGoods = !existing.items.some(
          (source) => source.grnGoodsId === item.grnGoodsId,
        );

        existing.items.push(item);

        if (vpLabel && !existing.vpLabels.includes(vpLabel)) {
          existing.vpLabels.push(vpLabel);
        }

        if (isNewGoods && !existing.goodsLabels.includes(goodsLabel)) {
          existing.goodsLabels.push(goodsLabel);
        }

        continue;
      }

      groups.set(key, {
        key,
        lrNumber: item.lrNumber,
        consigneeId: item.consigneeId,
        consigneeName: item.consigneeName,
        destinationAddress: item.deliveryAddress,
        items: [item],
        vpLabels: vpLabel ? [vpLabel] : [],
        goodsLabels: [goodsLabel],
      });
    }

    return Array.from(groups.values());
  }, [preview?.items]);
  const selectDestinationFrom = (
    item: DeliveryChallanPreviewItem,
    force = false,
  ) => {
    if (
      !force &&
      (destinationAreaId || destinationLocationId || deliveryAddress)
    ) {
      return;
    }
    setDestinationAreaId(item.destinationAreaId ?? "");
    setDestinationLocationId(item.destinationLocationId ?? "");
    setDeliveryAddress(item.deliveryAddress ?? "");
  };

  const setLrQuantity = (
    group: LrDispatchGroup,
    rawValue: string,
  ) => {
    const availableQuantity = group.items.reduce(
      (total, item) => total + maxFor(item),
      0,
    );

    const requestedQuantity = Math.max(
      0,
      Math.min(
        availableQuantity,
        Number.parseInt(rawValue || "0", 10) || 0,
      ),
    );

    const currentlySelectedConsignee = (preview?.items ?? []).find(
      (item) => (quantities[item.branchGrnItemId] ?? 0) > 0,
    )?.consigneeId;

    if (
      requestedQuantity > 0 &&
      currentlySelectedConsignee &&
      currentlySelectedConsignee !== group.consigneeId
    ) {
      toast.error(
        "Create a separate Delivery Challan for a different consignee.",
      );
      return;
    }

    const groupItemIds = new Set(
      group.items.map((item) => item.branchGrnItemId),
    );

    const hasSelectedOutsideGroup = (preview?.items ?? []).some(
      (item) =>
        !groupItemIds.has(item.branchGrnItemId) &&
        (quantities[item.branchGrnItemId] ?? 0) > 0,
    );

    setQuantities((current) => {
      const next = { ...current };
      let remainingQuantity = requestedQuantity;

      for (const item of group.items) {
        const sourceAvailable = maxFor(item);
        const allocatedQuantity = Math.min(
          remainingQuantity,
          sourceAvailable,
        );

        next[item.branchGrnItemId] = allocatedQuantity;
        remainingQuantity -= allocatedQuantity;
      }

      return next;
    });

    if (
      requestedQuantity > 0 &&
      !currentlySelectedConsignee &&
      group.items[0]
    ) {
      selectDestinationFrom(group.items[0], true);
    }

    if (requestedQuantity === 0 && !hasSelectedOutsideGroup) {
      setDestinationAreaId("");
      setDestinationLocationId("");
      setDeliveryAddress("");
    }
  };
  const selectedItems = (preview?.items ?? [])
    .map((item) => ({
      source: item,
      quantity: quantities[item.branchGrnItemId] ?? 0,
    }))
    .filter((item) => item.quantity > 0);
  const availableLrGroups = lrGroups
    .map((group) => {
      const items = group.items.filter(
        (item) => item.branchGrnId === selectedBranchGrnId,
      );

      const vpLabels = Array.from(
        new Set(
          items
            .map((item) => item.vpNo || item.rowLabel)
            .filter((label): label is string => Boolean(label)),
        ),
      );

      return {
        ...group,
        items,
        vpLabels,
      };
    })
    .filter((group) => {
      if (!group.items.length) return false;

      const availableQuantity = group.items.reduce(
        (total, item) => total + maxFor(item),
        0,
      );

      return availableQuantity > 0;
    });
  const selectedLrGroups = lrGroups
    .map((group) => {
      const selectedSources = group.items.filter(
        (item) => (quantities[item.branchGrnItemId] ?? 0) > 0,
      );

      const quantity = selectedSources.reduce(
        (total, item) =>
          total + (quantities[item.branchGrnItemId] ?? 0),
        0,
      );

      const vpLabels = Array.from(
        new Set(
          selectedSources
            .map((item) => item.vpNo || item.rowLabel)
            .filter((label): label is string => Boolean(label)),
        ),
      );

      return {
        group,
        quantity,
        vpLabels,
      };
    })
    .filter(({ quantity }) => quantity > 0);
  const selectedConsigneeIds = new Set(
    selectedItems.map(({ source }) => source.consigneeId),
  );
  const destinationOptions = (preview?.destinationOptions ?? []).filter(
    (option) =>
      selectedConsigneeIds.size === 0 ||
      selectedConsigneeIds.has(option.customerId),
  );
  const selectedTransporter = React.useMemo(
    () =>
      (transportsQuery.data ?? []).find(
        (transport) => transport.id === transportId,
      ),
    [transportId, transportsQuery.data],
  );
  const vehicleSuggestions: SuggestOption[] = (
    vehiclesQuery.data ?? []
  ).map((vehicle) => ({
    value: vehicle.vehicleNumber,
    hint: vehicle.vehicleTypeRef.name,
    badge: vehicle.status === "ON_TRIP" ? "Assigned" : "Available",
    badgeTone: vehicle.status === "ON_TRIP" ? "warning" : "success",
  }));
  const drivers = driversQuery.data?.data ?? [];
  const driverSuggestions: SuggestOption[] = drivers.map((driver) => ({
    value: driver.name,
    hint: driver.mobile ?? undefined,
    badge: "Available",
    badgeTone: "success",
  }));

  const freightValue = Math.max(Number(freightAmount) || 0, 0);
  const advanceValue = Math.max(Number(advanceAmount) || 0, 0);
  const balancePayable = Math.max(freightValue - advanceValue, 0);
  const selectDestination = (locationId: string) => {
    const destination = destinationOptions.find(
      (option) => option.id === locationId,
    );
    setDestinationLocationId(locationId);
    setDestinationAreaId(destination?.areaId ?? "");
    setDeliveryAddress(
      destination?.address ??
      destination?.area?.formattedAddress ??
      destination?.area?.name ??
      "",
    );
  };

  const validate = () => {
    if (!rakeId) return "Select a Rake ID";
    if (!selectedItems.length)
      return "Enter quantity for at least one goods line";
    if (selectedConsigneeIds.size > 1) {
      return "Selected goods belong to different consignees. Create a separate challan for each consignee.";
    }
    if (!destinationLocationId) return "Select a delivery destination";
    if (!supervisorId) return "Unloading supervisor is required";
    if (vehicleMode === "MARKET" && !transportId) {
      return "Transporter is required";
    }
    if (vehicleMode === "OWN" && !vehicleId) {
      return "Select an own vehicle";
    }
    if (vehicleMode === "MARKET" && !vehicleNumber.trim()) {
      return "Vehicle number is required";
    }
    if (advanceValue > 0 && !freightAmount.trim()) {
      return "Enter the freight amount before entering an advance";
    }

    if (advanceValue > freightValue) {
      return "Advance cannot exceed freight amount";
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const fields = {
      destinationAreaId: destinationAreaId || undefined,
      destinationLocationId,
      deliveryAddress: deliveryAddress || undefined,
      vehicleMode,
      transportId: vehicleMode === "MARKET" ? transportId : undefined,
      vehicleId: vehicleId || undefined,
      vehicleNumber:
        vehicleMode === "MARKET"
          ? vehicleNumber.trim().toUpperCase()
          : undefined,
      driverName: driverName || undefined,
      driverMobile: driverMobile || undefined,
      totalWeight: totalWeight ? Number(totalWeight) : undefined,
      freightAmount: freightAmount ? Number(freightAmount) : undefined,
      advanceAmount: advanceAmount ? Number(advanceAmount) : undefined,
      paymentBy: paymentBy || undefined,
      loadingAt: new Date(loadingAt),
      supervisorId,
      remarks: remarks || undefined,
      items: selectedItems.map(({ source, quantity }) => ({
        branchGrnItemId: source.branchGrnItemId,
        quantity,
      })),
    };

    try {
      const row = isEdit
        ? await updateMutation.mutateAsync({
          id: initialData.id,
          body: {
            ...fields,
            version: initialData.version,
          } satisfies UpdateDeliveryChallanBody,
        })
        : await createMutation.mutateAsync({
          ...fields,
          railRakeId: rakeId,
        } satisfies CreateDeliveryChallanBody);
      toast.success(
        isEdit ? "Delivery Challan updated" : "Delivery Challan draft created",
      );
      router.push(`/vp-management/delivery-challans/${row.id}`);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };
  React.useEffect(() => {
    const wagons = preview?.vps ?? [];

    if (!rakeId || !wagons.length) {
      setSelectedBranchGrnId("");
      return;
    }

    const selectedWagonStillExists = wagons.some(
      (wagon) => wagon.branchGrnId === selectedBranchGrnId,
    );

    if (selectedWagonStillExists) return;

    const initialItemIds = new Set(
      (initialData?.items ?? []).map(
        (item) => item.branchGrnItemId,
      ),
    );

    const initialWagon = preview?.items.find((item) =>
      initialItemIds.has(item.branchGrnItemId),
    );

    const firstWagon = wagons[0];

    if (!firstWagon) {
      setSelectedBranchGrnId("");
      return;
    }

    setSelectedBranchGrnId(
      initialWagon?.branchGrnId ??
      wagons.find((wagon) => wagon.pendingQty > 0)?.branchGrnId ??
      firstWagon.branchGrnId,
    );
  }, [
    rakeId,
    preview,
    selectedBranchGrnId,
    initialData?.items,
  ]);
  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/vp-management/delivery-challans">
              <IconArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {isEdit ? "Edit Delivery Challan" : "New Delivery Challan"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Dispatch received VP goods from the branch to their delivery
              point.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/vp-management/delivery-challans">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSaving || previewQuery.isLoading}>
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Save draft"}
          </Button>
        </div>
      </div>

      <Section
        icon={<IconRoute size={18} />}
        title="Rake"
        description="Goods from any of the rake's wagons with a submitted Branch GRN and pending quantity are available below — pick as many as belong on this vehicle."
      >
        {isEdit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Rake ID</FieldLabel>
              <Input value={initialData.railRake.rakeNumber} disabled />
            </div>

          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Schedule date</FieldLabel>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(event) => {
                  setScheduleDate(event.target.value);
                  setRakeId("");
                  setSelectedBranchGrnId("");
                  setQuantities({});
                  setDeliveryAddress("");
                  setDestinationAreaId("");
                  setDestinationLocationId("");
                }}
              />
            </div>
            <div>
              <FieldLabel required>Rake ID</FieldLabel>
              <Select
                value={rakeId}
                onValueChange={(value) => {
                  setRakeId(value);
                  setSelectedBranchGrnId("");
                  setQuantities({});
                  setDeliveryAddress("");
                  setDestinationAreaId("");
                  setDestinationLocationId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rakesQuery.isLoading ? "Loading..." : "Select rake"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(rakesQuery.data ?? []).map((rake) => (
                    <SelectItem key={rake.id} value={rake.id}>
                      {rake.rakeNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {railRoute ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4 text-sm">
            <div className="flex items-center gap-2 text-primary">
              <IconTrain size={18} />
              <span className="font-semibold">Rail movement</span>
            </div>

            <div className="hidden h-4 w-px bg-border sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From</span>

              <span className="font-medium">
                {railRoute.sourceArea.name || "—"}
              </span>

              <span className="text-xs text-muted-foreground">
                ({railRoute.sourceBranch.name || "—"})
              </span>
            </div>

            <IconArrowRight
              size={18}
              className="text-muted-foreground"
              stroke={1.8}
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To</span>

              <span className="font-medium">
                {railRoute.destinationArea.name || "—"}
              </span>

              <span className="text-xs text-muted-foreground">
                ({railRoute.receivingBranch.name || "—"})
              </span>
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        icon={<IconPackage size={18} />}
        title="Goods to dispatch"
        description="LR quantities split across multiple wagons are combined automatically."
      >
        {!rakeId ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Select a Rake to view available LRs.
          </div>
        ) : previewQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : previewQuery.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {getErrorMessage(previewQuery.error)}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="max-w-sm">
              <FieldLabel required>Wagon / VP</FieldLabel>

              <Select
                value={selectedBranchGrnId}
                onValueChange={setSelectedBranchGrnId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wagon" />
                </SelectTrigger>

                <SelectContent>
                  {(preview?.vps ?? []).map((wagon) => {
                    const livePendingQty = pendingForWagon(
                      wagon.branchGrnId,
                    );

                    return (
                      <SelectItem
                        key={wagon.branchGrnId}
                        value={wagon.branchGrnId}
                      >
                        {wagon.vpNo || wagon.rowLabel}
                        {" · "}
                        Pending {livePendingQty}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Available LRs
              </h3>

              <div className="overflow-hidden rounded-md border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[16%]">LR number</TableHead>
                      <TableHead className="w-[12%]">Source VP</TableHead>
                      <TableHead className="w-[23%]">Consignee</TableHead>
                      <TableHead className="w-[17%]">Goods</TableHead>
                      <TableHead className="w-[18%] text-center">
                        Quantity
                      </TableHead>
                      <TableHead className="w-[14%]">
                        Dispatch qty
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {availableLrGroups.length ? (
                      availableLrGroups.map((group) => {
                        const receivedQuantity = group.items.reduce(
                          (total, item) => total + item.receivedQty,
                          0,
                        );

                        const damageQuantity = group.items.reduce(
                          (total, item) => total + item.damageQty,
                          0,
                        );

                        const dispatchCapacity = group.items.reduce(
                          (total, item) => total + maxFor(item),
                          0,
                        );

                        const selectedQuantity = group.items.reduce(
                          (total, item) => total + selectedFor(item),
                          0,
                        );
                        const remainingQuantity = Math.max(
                          dispatchCapacity - selectedQuantity,
                          0,
                        );

                        return (
                          <TableRow key={group.key}>
                            <TableCell className="px-2">
                              <p className="break-all text-xs font-semibold leading-4">
                                {group.lrNumber}
                              </p>
                            </TableCell>

                            <TableCell>
                              <VpListPopover labels={group.vpLabels} />
                            </TableCell>
                            <TableCell>
                              <AddressPopover
                                consignee={group.consigneeName}
                                address={group.destinationAddress}
                              />
                            </TableCell>

                            <TableCell className="px-2">
                              <p
                                className="line-clamp-2 break-words text-sm"
                                title={group.goodsLabels.join(", ")}
                              >
                                {group.goodsLabels.join(", ")}
                              </p>
                            </TableCell>

                            <TableCell className="px-2">
                              <div className="grid grid-cols-3 gap-1 text-center">
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">
                                    Received
                                  </p>
                                  <p className="text-sm font-medium">
                                    {receivedQuantity}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">
                                    Damage
                                  </p>
                                  <p
                                    className={
                                      damageQuantity > 0
                                        ? "text-sm font-medium text-destructive"
                                        : "text-sm font-medium"
                                    }
                                  >
                                    {damageQuantity}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">
                                    Available
                                  </p>
                                  <p className="text-sm font-semibold text-primary">
                                    {remainingQuantity}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="px-2">
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  max={dispatchCapacity}
                                  step={1}
                                  value={selectedQuantity || ""}
                                  placeholder="0"
                                  className="h-8 w-20 shrink-0 text-right font-semibold"
                                  onChange={(event) =>
                                    setLrQuantity(group, event.target.value)
                                  }
                                />

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0"
                                  disabled={
                                    dispatchCapacity === 0 ||
                                    selectedQuantity === dispatchCapacity
                                  }
                                  onClick={() =>
                                    setLrQuantity(group, String(dispatchCapacity))
                                  }
                                >
                                  All
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No pending LR goods are available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Selected truck load
              </h3>

              {selectedLrGroups.length ? (
                <div className="overflow-hidden rounded-md border">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[24%]">LR number</TableHead>
                        <TableHead className="w-[28%]">Goods</TableHead>
                        <TableHead className="w-[20%]">Source VP</TableHead>
                        <TableHead className="w-[16%] text-right">
                          Dispatch qty
                        </TableHead>
                        <TableHead className="w-[12%]" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {selectedLrGroups.map(({ group, quantity, vpLabels }) => (
                        <TableRow key={group.key}>
                          <TableCell className="px-2">
                            <p className="break-all text-xs font-semibold leading-4">
                              {group.lrNumber}
                            </p>
                          </TableCell>

                          <TableCell className="px-2">
                            <p
                              className="line-clamp-2 break-words text-sm"
                              title={group.goodsLabels.join(", ")}
                            >
                              {group.goodsLabels.join(", ")}
                            </p>
                          </TableCell>

                          <TableCell className="px-2">
                            <VpListPopover labels={vpLabels} />
                          </TableCell>

                          <TableCell className="px-2 text-right">
                            <span className="inline-flex min-w-14 justify-center rounded-md bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
                              {quantity}
                            </span>
                          </TableCell>

                          <TableCell className="px-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setLrQuantity(group, "0")}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Enter a full or partial LR goods quantity to add it to this truck.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 text-right text-sm font-medium">
          Total dispatch quantity:{" "}
          {selectedItems.reduce(
            (total, item) => total + item.quantity,
            0,
          )}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={<IconBuildingWarehouse size={18} />}
          title="Local delivery route"
          description="Dispatch from the arrival railhead to the consignee's saved destination."
        >
          <div className="space-y-4">
            <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Source / pickup
              </p>
              <p className="mt-1 text-sm font-semibold">
                {railRoute?.destinationArea.name ?? "Select a Rake ID"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {railRoute
                  ? `${railRoute.receivingBranch.name} · arrival railhead`
                  : "The source is fixed from the selected rail movement."}
              </p>
            </div>

            <div>
              <FieldLabel required>Destination location</FieldLabel>
              <Select
                value={destinationLocationId}
                onValueChange={selectDestination}
                disabled={
                  !selectedItems.length || selectedConsigneeIds.size > 1
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedItems.length
                        ? "Select goods first"
                        : selectedConsigneeIds.size > 1
                          ? "Select goods for one consignee"
                          : destinationOptions.length
                            ? "Select consignee destination"
                            : "No saved destination found"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((destination) => (
                    <SelectItem key={destination.id} value={destination.id}>
                      {destination.area?.name ?? destination.city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Only saved locations belonging to the selected consignee are
                shown.
              </p>
            </div>

            <div>
              <FieldLabel>Delivery address (optional)</FieldLabel>
              <Textarea
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Optional delivery instructions or address"
                rows={3}
              />
            </div>
          </div>
        </Section>

        <Section
          icon={<IconTruckDelivery size={18} />}
          title="Vehicle and transporter"
          description="Market vehicles are filtered under the selected transporter."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Delivery mode</FieldLabel>
              <Select
                value={vehicleMode}
                onValueChange={(value) => {
                  setVehicleMode(value as DeliveryVehicleMode);
                  setVehicleId("");
                  setVehicleNumber("");
                  if (value !== "MARKET") setTransportId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET">Market vehicle</SelectItem>
                  <SelectItem value="OWN">Own vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vehicleMode === "MARKET" ? (
              <div>
                <FieldLabel required>Transporter</FieldLabel>
                <Select
                  value={transportId}
                  onValueChange={(value) => {
                    setTransportId(value);
                    setVehicleId("");
                    setVehicleNumber("");
                    setDriverName("");
                    setDriverMobile("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        transportsQuery.isLoading
                          ? "Loading..."
                          : "Select transporter"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(transportsQuery.data ?? []).map((transport) => (
                      <SelectItem key={transport.id} value={transport.id}>
                        {transport.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel required>Vehicle number</FieldLabel>
                {canCreateVehicle ? (
                  <button
                    type="button"
                    onClick={() => setVehicleFormOpen(true)}
                    className="mb-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    + Add vehicle
                  </button>
                ) : null}
              </div>
              {vehicleMode === "MARKET" ? (
                <SuggestInput
                  value={vehicleNumber}
                  onChange={(value) => {
                    setVehicleNumber(value.toUpperCase());
                    const matched = (vehiclesQuery.data ?? []).find(
                      (vehicle) =>
                        vehicle.vehicleNumber.trim().toLowerCase() ===
                        value.trim().toLowerCase(),
                    );
                    setVehicleId(matched?.id ?? "");
                  }}
                  suggestions={vehicleSuggestions}
                  disabled={!transportId}
                  placeholder={
                    !transportId
                      ? "Select transporter first"
                      : vehiclesQuery.isLoading
                        ? "Loading vehicles or type vehicle number"
                        : "Select or type vehicle number"
                  }
                  className="[&_input]:uppercase"
                />
              ) : (
                <Select
                  value={vehicleId}
                  onValueChange={(value) => {
                    setVehicleId(value);
                  }}
                  disabled={vehiclesQuery.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        vehiclesQuery.isLoading
                          ? "Loading vehicles..."
                          : "Select own vehicle"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {(vehiclesQuery.data ?? []).map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.vehicleNumber} · {vehicle.vehicleTypeRef.name}
                        {vehicle.status === "ON_TRIP" ? " · Assigned" : " · Available"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Driver name</FieldLabel>
                {canCreateDriver ? (
                  <button
                    type="button"
                    onClick={() => setDriverFormOpen(true)}
                    className="mb-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    + Add driver
                  </button>
                ) : null}
              </div>
              <SuggestInput
                value={driverName}
                onChange={(value) => {
                  setDriverName(value);
                  const matched = drivers.find(
                    (driver) =>
                      driver.name.trim().toLowerCase() ===
                      value.trim().toLowerCase(),
                  );
                  setDriverMobile(matched?.mobile ?? "");
                }}
                suggestions={driverSuggestions}
                placeholder={
                  driversQuery.isLoading
                    ? "Loading drivers..."
                    : "Select or type driver"
                }
              />
            </div>
            <div>
              <FieldLabel>Driver mobile</FieldLabel>
              <Input
                placeholder="Driver mobile"
                value={driverMobile}
                onChange={(event) => setDriverMobile(event.target.value)}
              />
            </div>
          </div>
        </Section>
      </div>

      <Section
        icon={<IconTruckDelivery size={18} />}
        title="Loading and charges"
        description="Record dispatch timing, supervisor and transport charges."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Loading date and time</FieldLabel>
            <Input
              type="datetime-local"
              value={loadingAt}
              onChange={(event) => setLoadingAt(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel required>Unloading supervisor</FieldLabel>
            <Select value={supervisorId} onValueChange={setSupervisorId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    supervisorsQuery.isLoading
                      ? "Loading..."
                      : "Select supervisor"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(supervisorsQuery.data ?? []).map((supervisor) => (
                  <SelectItem key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Total weight</FieldLabel>

            <div className="relative">
              <Input
                type="number"
                placeholder="Enter weight"
                min={0}
                step="0.001"
                value={totalWeight}
                className="pr-12"
                onChange={(event) => setTotalWeight(event.target.value)}
              />

              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                MT
              </span>
            </div>

          </div>
          <div>
            <FieldLabel>Payment by</FieldLabel>
            <Select value={paymentBy} onValueChange={setPaymentBy}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Company</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
                <SelectItem value="TRANSPORTER">Transporter</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Freight amount (₹)</FieldLabel>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={freightAmount}
              onChange={(event) => setFreightAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <FieldLabel>Advance amount (₹)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={freightValue || undefined}
              step="0.01"
              value={advanceAmount}
              onChange={(event) => setAdvanceAmount(event.target.value)}
              placeholder="0.00"
            />

            {advanceValue > 0 && vehicleMode === "MARKET" ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Paid to:{" "}
                <span className="font-medium text-foreground">
                  {selectedTransporter?.name || "Select transporter"}
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Balance payable (₹)</FieldLabel>
            <Input
              value={balancePayable.toFixed(2)}
              readOnly
              className="bg-muted font-semibold"
            />
          </div>
        </div>
      </Section>

      <VehicleForm
        open={vehicleFormOpen}
        onOpenChange={setVehicleFormOpen}
        onSaved={async (vehicle) => {
          await queryClient.invalidateQueries({
            queryKey: ["delivery-challans", "options", "vehicles"],
          });

          const matchesMode =
            (vehicleMode === "OWN" &&
              vehicle.ownershipType === "Own_Vehicle") ||
            (vehicleMode === "MARKET" &&
              vehicle.ownershipType === "Market_Vehicle");

          if (!matchesMode) return;

          if (
            vehicleMode === "MARKET" &&
            vehicle.transportId &&
            vehicle.transportId !== transportId
          ) {
            setTransportId(vehicle.transportId);
          }

          setVehicleId(vehicle.id);
          setVehicleNumber(vehicle.vehicleNumber.toUpperCase());
        }}
      />

      <DriverForm
        open={driverFormOpen}
        onOpenChange={setDriverFormOpen}
        onSaved={async (driver) => {
          await queryClient.invalidateQueries({
            queryKey: ["delivery-challans", "options", "drivers"],
          });
          setDriverName(driver.name);
          setDriverMobile(driver.mobile ?? "");
        }}
      />
    </form>
  );
}
