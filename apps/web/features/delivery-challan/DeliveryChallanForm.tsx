"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import IconTextField from "../masters/_shared/fields/IconTextField";
import type {
  CreateDeliveryChallanBody,
  DeliveryChallanPreviewItem,
  UpdateDeliveryChallanBody,
} from "@skerp/types";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Textarea } from "@skerp/ui/components/textarea";

import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

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
  useDeliveryChallanVps,
  useUpdateDeliveryChallan,
} from "./useDeliveryChallan";

type Props =
  | { mode: "create"; initialData?: never }
  | { mode: "edit"; initialData: DeliveryChallanDetail };

type Quantities = Record<string, number>;

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

export default function DeliveryChallanForm({ mode, initialData }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [scheduleDate, setScheduleDate] = React.useState("");
  const [rakeId, setRakeId] = React.useState(
    initialData?.branchGrn.railRake.id ?? "",
  );
  const [branchGrnId, setBranchGrnId] = React.useState(
    initialData?.branchGrnId ?? "",
  );
  const [vehicleMode, setVehicleMode] = React.useState<DeliveryVehicleMode>(
    initialData?.vehicleMode ?? "MARKET",
  );
  const [transportId, setTransportId] = React.useState(
    initialData?.transportId ?? "",
  );
  const [vehicleId, setVehicleId] = React.useState(
    initialData?.vehicleId ?? "",
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
  const [remarks, setRemarks] = React.useState(initialData?.remarks ?? "");
  const [quantities, setQuantities] = React.useState<Quantities>(() =>
    Object.fromEntries(
      (initialData?.items ?? []).map((item) => [
        item.branchGrnItemId,
        item.quantity,
      ]),
    ),
  );

  const rakesQuery = useDeliveryChallanRakes(scheduleDate || undefined);
  const vpsQuery = useDeliveryChallanVps(rakeId);
  const previewQuery = useDeliveryChallanPreview(branchGrnId);
  const supervisorsQuery = useDeliveryChallanSupervisors(branchGrnId);
  const transportsQuery = useDeliveryChallanTransports(
    vehicleMode === "MARKET",
  );
  const vehiclesQuery = useDeliveryChallanVehicles(vehicleMode, transportId);
  const createMutation = useCreateDeliveryChallan();
  const updateMutation = useUpdateDeliveryChallan();
  const preview = previewQuery.data;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const selectedRake = React.useMemo(
    () => (rakesQuery.data ?? []).find((rake) => rake.id === rakeId),
    [rakeId, rakesQuery.data],
  );
  const railRoute = isEdit
    ? {
      sourceBranch: initialData.branchGrn.railRake.fromBranch,
      receivingBranch: initialData.branchGrn.railRake.toBranch,
      sourceArea: initialData.branchGrn.railRake.vpSchedule.sourceArea,
      destinationArea:
        initialData.branchGrn.railRake.vpSchedule.destinationArea,
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

  const setItemQuantity = (
    item: DeliveryChallanPreviewItem,
    rawValue: string,
  ) => {
    const value = Math.max(
      0,
      Math.min(maxFor(item), Number.parseInt(rawValue || "0", 10) || 0),
    );
    const hasAnotherSelectedItem = (preview?.items ?? []).some(
      (candidate) =>
        candidate.branchGrnItemId !== item.branchGrnItemId &&
        (quantities[candidate.branchGrnItemId] ?? 0) > 0,
    );
    setQuantities((current) => ({
      ...current,
      [item.branchGrnItemId]: value,
    }));
    if (value > 0 && !hasAnotherSelectedItem) {
      selectDestinationFrom(item, true);
    } else if (value === 0 && !hasAnotherSelectedItem) {
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
    if (!branchGrnId) return "Select a VP number";
    if (!selectedItems.length)
      return "Enter quantity for at least one goods line";
    if (selectedConsigneeIds.size > 1) {
      return "Selected goods belong to different consignees. Create a separate challan for each consignee.";
    }
    if (!destinationLocationId) return "Select a delivery destination";
    if (!supervisorId) return "Loading supervisor is required";
    if (vehicleMode === "MARKET" && !transportId) {
      return "Transporter is required";
    }
    if (!vehicleId) {
      return "Vehicle is required";
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
      vehicleId,
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
          branchGrnId,
        } satisfies CreateDeliveryChallanBody);
      toast.success(
        isEdit ? "Delivery Challan updated" : "Delivery Challan draft created",
      );
      router.push(`/vp-management/delivery-challans/${row.id}`);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

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
        title="Rake and VP"
        description="Only VPs with a submitted Branch GRN and pending goods are available."
      >
        {isEdit ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel>Rake ID</FieldLabel>
              <Input
                value={initialData.branchGrn.railRake.rakeNumber}
                disabled
              />
            </div>
            <div>
              <FieldLabel>Schedule</FieldLabel>
              <Input
                value={initialData.branchGrn.railRake.vpSchedule.scheduleNumber}
                disabled
              />
            </div>
            <div>
              <FieldLabel>VP number</FieldLabel>
              <Input
                value={
                  initialData.branchGrn.vpWagonLoading.mrRrRow.vpNo ||
                  initialData.branchGrn.vpWagonLoading.mrRrRow.rowLabel
                }
                disabled
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel>Schedule date</FieldLabel>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(event) => {
                  setScheduleDate(event.target.value);
                  setRakeId("");
                  setBranchGrnId("");
                }}
              />
            </div>
            <div>
              <FieldLabel required>Rake ID</FieldLabel>
              <Select
                value={rakeId}
                onValueChange={(value) => {
                  setRakeId(value);
                  setBranchGrnId("");
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
            <div>
              <FieldLabel required>VP number</FieldLabel>
              <Select
                value={branchGrnId}
                onValueChange={(value) => {
                  setBranchGrnId(value);
                  setQuantities({});
                  setDeliveryAddress("");
                  setDestinationAreaId("");
                  setDestinationLocationId("");
                }}
                disabled={!rakeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      vpsQuery.isLoading ? "Loading..." : "Select VP"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(vpsQuery.data ?? []).map((vp) => (
                    <SelectItem key={vp.branchGrnId} value={vp.branchGrnId}>
                      {vp.vpNo || vp.rowLabel} · pending {vp.pendingQty}
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
        description="Enter only the quantity being sent on this challan."
      >
        {!branchGrnId ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Select a Rake and VP to load received goods.
          </div>
        ) : previewQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : previewQuery.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {getErrorMessage(previewQuery.error)}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>LR number</TableHead>
                  <TableHead>Consignee</TableHead>
                  <TableHead>Goods</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Damage</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="w-36">Dispatch qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview?.items ?? []).map((item) => (
                  <TableRow key={item.branchGrnItemId}>
                    <TableCell className="font-medium">
                      {item.lrNumber}
                    </TableCell>
                    <TableCell>
                      <div>{item.consigneeName || "—"}</div>
                      <div className="max-w-xs truncate text-xs text-muted-foreground">
                        {item.deliveryAddress || "No saved address"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.goodsName}
                      {item.unit ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({item.unit})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.receivedQty}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.damageQty}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {maxFor(item)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={maxFor(item)}
                          value={quantities[item.branchGrnItemId] ?? 0}
                          onChange={(event) =>
                            setItemQuantity(item, event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setItemQuantity(item, String(maxFor(item)))
                          }
                        >
                          All
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 text-right text-sm font-medium">
          Total dispatch quantity:{" "}
          {selectedItems.reduce((total, item) => total + item.quantity, 0)}
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
              <FieldLabel required>Vehicle</FieldLabel>

              <Select
                value={vehicleId}
                onValueChange={(value) => {
                  setVehicleId(value);
                }}
                disabled={
                  vehiclesQuery.isLoading ||
                  (vehicleMode === "MARKET" && !transportId)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      vehicleMode === "MARKET" && !transportId
                        ? "Select transporter first"
                        : vehiclesQuery.isLoading
                          ? "Loading vehicles..."
                          : "Select vehicle"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {(vehiclesQuery.data ?? []).map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicleNumber} · {vehicle.vehicleTypeRef.name}
                      {vehicle.status === "ON_TRIP" ? " · On trip" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>

              <FieldLabel>Driver name</FieldLabel>
              <Input
                placeholder="Driver name"
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
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
            <FieldLabel required>Loading supervisor</FieldLabel>
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
            <Input
              type="number"
              placeholder="Enter Weight"
              min={0}
              step="0.001"
              value={totalWeight}
              onChange={(event) => setTotalWeight(event.target.value)}
            />
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
    </form>
  );
}
