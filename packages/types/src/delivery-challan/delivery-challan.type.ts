import type { z } from "zod";
import {
  cancelDeliveryChallanSchema,
  createDeliveryChallanSchema,
  issueDeliveryChallanSchema,
  updateDeliveryChallanSchema,
} from "@skerp/validators";

export type CreateDeliveryChallanBody = z.output<
  typeof createDeliveryChallanSchema
>;
export type UpdateDeliveryChallanBody = z.output<
  typeof updateDeliveryChallanSchema
>;
export type IssueDeliveryChallanBody = z.output<
  typeof issueDeliveryChallanSchema
>;
export type CancelDeliveryChallanBody = z.output<
  typeof cancelDeliveryChallanSchema
>;

export type DeliveryChallanRakeOption = {
  id: string;
  rakeNumber: string;
  scheduleDate: string;
  scheduleNumber: string;
  sourceBranch: { id: string; name: string; branchCode: string };
  receivingBranch: { id: string; name: string; branchCode: string };
  sourceArea: { id: string; name: string };
  destinationArea: { id: string; name: string };
  eligibleVpCount: number;
};

export type DeliveryChallanVpOption = {
  branchGrnId: string;
  vpWagonLoadingId: string;
  vpNo: string | null;
  rowLabel: string;
  receivedQty: number;
  pendingQty: number;
};

export type DeliveryChallanPreviewItem = {
  branchGrnItemId: string;
  lrNumber: string;
  consigneeId: string;
  consigneeName: string | null;
  goodsName: string;
  unit: string | null;
  receivedQty: number;
  damageQty: number;
  dispatchableQty: number;
  challanedQty: number;
  pendingQty: number;
  destinationLocationId: string | null;
  destinationAreaId: string | null;
  deliveryAddress: string | null;
};

export type DeliveryChallanDestinationOption = {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  areaId: string | null;
  area: {
    id: string;
    name: string;
    formattedAddress: string | null;
  } | null;
  city: {
    id: string;
    name: string;
  };
};
